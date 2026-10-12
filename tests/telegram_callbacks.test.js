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
    assert.equal(rotasRepo.estaSilenciada(rotaSilenciada), true);

    // Limpa rota de teste
    rotasRepo.excluir(rota.id);
  });
});
