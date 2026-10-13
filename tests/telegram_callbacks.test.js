import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifierTelegram, escapeHtml, ehPeriodoNoturno } from '../src/services/notifier_telegram.js';
import { rotasRepo } from '../src/db.js';

describe('Telegram Compose & Callbacks (notifier_telegram)', () => {
  it('deve escapar caracteres HTML perigosos adequadamente', () => {
    const raw = '<b>Promo & Oferta <teste></b>';
    const escaped = escapeHtml(raw);
    assert.equal(escaped, '&lt;b&gt;Promo &amp; Oferta &lt;teste&gt;&lt;/b&gt;');
  });

  it('deve lidar defensivamente com valores numéricos (inclusive 0), falsy e aspas em atributos', () => {
    // 1. Número zero e booleanos não devem ser convertidos em string vazia por coerção falsy
    assert.equal(escapeHtml(0), '0');
    assert.equal(escapeHtml(false), 'false');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');

    // 2. Aspas duplas devem ser escapadas para segurança de atributos HTML
    assert.equal(escapeHtml('Tarifa "Relâmpago" & Cia'), 'Tarifa &quot;Relâmpago&quot; &amp; Cia');
  });

  it('deve registrar callback de verificação externa', () => {
    let chamada = false;
    notifierTelegram.registrarCallbackVerificacao(() => {
      chamada = true;
    });
    assert.ok(notifierTelegram.onVerificarRotaCallback);
    notifierTelegram.onVerificarRotaCallback({ id: 999 });
    assert.equal(chamada, true);
  });

  it('deve processar callback de silenciamento temporário', async () => {
    // Cria uma rota temporária para teste
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Madrid',
      data_ida: '2026-12-01',
      data_volta: '2026-12-15'
    });

    assert.equal(rotasRepo.estaSilenciada(rota), false);

    // Silencia rota por 24h
    rotasRepo.silenciarRota(rota.id, 24);
    const rotaSilenciada = rotasRepo.buscarPorId(rota.id);
    rotasRepo.excluir(rota.id);
  });

  it('deve processar comando /paridade de milhas e calcular conversão correta', async () => {
    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.processarComando({
        chat: { id: notifierTelegram.chatId || 12345 },
        text: '/paridade 100000 smiles'
      });

      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('CALCULADORA DE PARIDADE DE MILHAS'));
      assert.ok(mensagemEnviada.includes('100.000 milhas/pontos'));
      assert.ok(mensagemEnviada.includes('1750,00'));
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('deve processar comando /teto para ajustar limite de rota', async () => {
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Madrid',
      data_ida: '2026-12-01',
      data_volta: '2026-12-15',
      preco_alvo: 4000
    });

    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.processarComando({
        chat: { id: notifierTelegram.chatId || 12345 },
        text: `/teto ${rota.id} 3200`
      });

      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.toLowerCase().includes('teto atualizado com sucesso'));
      const rotaAtualizada = rotasRepo.buscarPorId(rota.id);
      assert.equal(rotaAtualizada.preco_alvo, 3200);
    } finally {
      rotasRepo.excluir(rota.id);
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('deve calcular e exibir economia em reais e porcentagem no alerta de oportunidade com botão teto_help', async () => {
    let mensagemEnviada = null;
    let botoesEnviados = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto, link, btnTexto, isSilent, inlineKeyboard) => {
      mensagemEnviada = texto;
      botoesEnviados = inlineKeyboard;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 99,
        origem: 'São Paulo',
        destinoReal: 'Lisboa',
        dataIda: '2027-03-10',
        dataVolta: '2027-03-24',
        preco: 2400,
        precoAlvo: 3200,
        ehRecorde: true,
        duracaoHoras: 10,
        detalhes: 'Direto TAP',
        link: 'https://google.com'
      });

      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('META BATIDA!'));
      assert.ok(mensagemEnviada.includes('Economia de <b>R$ 800,00</b>'));
      assert.ok(mensagemEnviada.includes('25% abaixo'));
      assert.ok(mensagemEnviada.includes('RECORDE HISTÓRICO'));

      assert.ok(botoesEnviados);
      const botaoTeto = botoesEnviados.flat().find(b => b.callback_data === 'teto_help:99');
      assert.ok(botaoTeto, 'Deve conter botão inline para alterar teto');
      assert.equal(botaoTeto.text, '🎯 Alterar Teto');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('deve processar callback teto_help e orientar alteração de limite', async () => {
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Roma',
      data_ida: '2026-11-01',
      data_volta: '2026-11-15',
      preco_alvo: 3900
    });

    let mensagemEnviada = null;
    let toastCb = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    const backupCb = notifierTelegram.responderCallbackQuery;

    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };
    notifierTelegram.responderCallbackQuery = async (id, texto) => {
      toastCb = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.processarCallbackQuery({
        id: 'cb_test_123',
        data: `teto_help:${rota.id}`,
        message: { chat: { id: notifierTelegram.chatId || 12345 } }
      });

      assert.ok(toastCb);
      assert.ok(toastCb.includes(`/teto ${rota.id}`));
      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('AJUSTAR TETO DE PREÇO'));
      assert.ok(mensagemEnviada.includes(`/teto ${rota.id}`));
    } finally {
      rotasRepo.excluir(rota.id);
      notifierTelegram.enviarMensagem = backupEnviar;
      notifierTelegram.responderCallbackQuery = backupCb;
    }
  });
});
