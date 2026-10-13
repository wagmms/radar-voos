import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeployPipeline, deployPipeline } from '../src/services/deploy_pipeline.js';
import { notifierTelegram } from '../src/services/notifier_telegram.js';

describe('Pipeline de Deploy com Validação e Autocura (deploy_pipeline)', () => {
  it('deve executar validação com sucesso quando runner retorna status 0', () => {
    const fakeRunner = (cmd) => {
      assert.deepEqual(cmd, ['./validate.sh', 'fast']);
      return { status: 0, stdout: 'Todos os 114 testes aprovados', stderr: '' };
    };

    const pipeline = new DeployPipeline({ execRunner: fakeRunner });
    const res = pipeline.executarValidacao('fast');

    assert.equal(res.sucesso, true);
    assert.equal(res.codigo, 0);
    assert.ok(res.stdout.includes('114 testes'));
  });

  it('deve capturar falha de validação quando runner retorna status 1', () => {
    const fakeRunner = () => {
      return { status: 1, stdout: '', stderr: 'AssertionError: teste falhou' };
    };

    const pipeline = new DeployPipeline({ execRunner: fakeRunner });
    const res = pipeline.executarValidacao('fast');

    assert.equal(res.sucesso, false);
    assert.equal(res.codigo, 1);
    assert.ok(res.stderr.includes('AssertionError'));
  });

  it('deve completar pipeline de deploy quando validação é aprovada', async () => {
    let passos = [];
    const fakeRunner = (cmd) => {
      passos.push(cmd[0]);
      return { status: 0, stdout: 'OK', stderr: '' };
    };

    const pipeline = new DeployPipeline({ execRunner: fakeRunner });
    const res = await pipeline.executarDeploy();

    assert.equal(res.sucesso, true);
    assert.equal(res.autocuraExecutada, false);
    assert.ok(res.hashCommit);
    assert.ok(res.mensagemCommit);
  });

  it('deve acionar autocura autônoma quando validação inicial falha e recuperar', async () => {
    let chamadasValidacao = 0;
    let autocuraDisparada = false;

    const fakeRunner = (cmd) => {
      if (cmd[0] === './validate.sh') {
        chamadasValidacao++;
        if (chamadasValidacao === 1) {
          return { status: 1, stdout: 'Erro de sintaxe', stderr: 'SyntaxError: unexpected token' };
        }
        return { status: 0, stdout: '114 testes aprovados após autocura', stderr: '' };
      }
      if (cmd[0] === 'agy') {
        autocuraDisparada = true;
        return { status: 0, stdout: 'Correção aplicada com sucesso', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };

    const pipeline = new DeployPipeline({ execRunner: fakeRunner });
    const res = await pipeline.executarDeploy();

    assert.equal(res.sucesso, true);
    assert.equal(res.autocuraExecutada, true);
    assert.equal(chamadasValidacao, 2);
    assert.equal(autocuraDisparada, true);
  });

  it('deve cancelar deploy com segurança se os testes continuarem falhando após autocura', async () => {
    const fakeRunner = (cmd) => {
      if (cmd[0] === './validate.sh') {
        return { status: 1, stdout: '', stderr: 'Falha permanente de teste' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };

    const pipeline = new DeployPipeline({ execRunner: fakeRunner });
    const res = await pipeline.executarDeploy();

    assert.equal(res.sucesso, false);
    assert.equal(res.autocuraExecutada, true);
    assert.ok(res.motivo.includes('reprovou alterações'));
  });

  it('deve rejeitar deploy simultâneo se já houver um em andamento', async () => {
    const pipeline = new DeployPipeline();
    pipeline.emAndamento = true;

    const res = await pipeline.executarDeploy();
    assert.equal(res.sucesso, false);
    assert.ok(res.motivo.includes('Já existe um deploy em andamento'));
  });

  it('notifierTelegram deve processar comando /deploy e enviar notificação de sucesso', async () => {
    const msgsEnviadas = [];
    const backupEnviar = notifierTelegram.enviarMensagem;
    const backupDeploy = deployPipeline.executarDeploy;
    notifierTelegram.enviarMensagem = async (texto) => {
      msgsEnviadas.push(texto);
      return { ok: true };
    };
    deployPipeline.executarDeploy = async () => ({
      sucesso: true,
      hashCommit: 'abc1234',
      mensagemCommit: 'feat(core): teste commit',
      totalTestes: 114,
      autocuraExecutada: false
    });

    try {
      await notifierTelegram.processarComando({
        chat: { id: notifierTelegram.chatId || 12345 },
        text: '/deploy'
      });

      assert.ok(msgsEnviadas.length >= 2);
      assert.ok(msgsEnviadas[0].includes('Iniciando pipeline de Deploy'));
      assert.ok(msgsEnviadas[1].includes('DEPLOY DISPARADO COM SUCESSO NO RENDER'));
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
      deployPipeline.executarDeploy = backupDeploy;
    }
  });

  it('notifierTelegram deve processar callback query deploy:now', async () => {
    const msgsEnviadas = [];
    let cbRespondido = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    const backupResponderCb = notifierTelegram.responderCallbackQuery;
    const backupDeploy = deployPipeline.executarDeploy;

    notifierTelegram.enviarMensagem = async (texto) => {
      msgsEnviadas.push(texto);
      return { ok: true };
    };
    notifierTelegram.responderCallbackQuery = async (id, texto) => {
      cbRespondido = { id, texto };
      return true;
    };
    deployPipeline.executarDeploy = async () => ({
      sucesso: true,
      hashCommit: 'abc1234',
      mensagemCommit: 'feat(core): teste commit',
      totalTestes: 114,
      autocuraExecutada: false
    });

    try {
      await notifierTelegram.processarCallbackQuery({
        id: 'cb_test_deploy',
        data: 'deploy:now',
        message: { chat: { id: notifierTelegram.chatId || 12345 } }
      });

      assert.ok(cbRespondido);
      assert.ok(cbRespondido.texto.includes('deploy com validação e autocura'));
      assert.ok(msgsEnviadas.some(m => m.includes('DEPLOY DISPARADO COM SUCESSO')));
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
      notifierTelegram.responderCallbackQuery = backupResponderCb;
      deployPipeline.executarDeploy = backupDeploy;
    }
  });
});
