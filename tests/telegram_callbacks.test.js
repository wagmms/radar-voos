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
});
