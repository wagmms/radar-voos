import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getDb, alertasRepo } from '../src/db.js';

describe('Inteligência de Alertas e Critérios Estritos (alertasRepo.deveDisparar)', () => {
  const chaveTeste = 'TESTE_SAO_LIS_2026-11-10_2026-11-24';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM alertas_disparados WHERE chave_alerta = ?').run(chaveTeste);
  });

  it('1. NUNCA deve alertar na primeira checagem após deploy (baseline inicial)', () => {
    // Primeira checagem (precoAnterior é 0 ou null)
    const res = alertasRepo.deveDisparar(
      chaveTeste,
      2800, // precoAtual
      0,    // precoAnterior (novo deploy/primeira checagem)
      3500, // precoAlvo
      true, // ehRecorde
      'LOW',
      0
    );

    assert.strictEqual(res.deve, false);
    assert.strictEqual(res.motivo, 'baseline_inicial_deploy');
  });

  it('2. NUNCA deve alertar se o preço estiver acima do preço alvo do usuário', () => {
    // Preço anterior era 4500, caiu para 4000 (queda de mais de 10% e novo recorde)
    // MAS a meta do usuário é 3500!
    const res = alertasRepo.deveDisparar(
      chaveTeste,
      4000,  // precoAtual (acima do alvo de 3500)
      4500,  // precoAnterior
      3500,  // precoAlvo
      true,  // ehRecorde
      'LOW',
      -11.1  // variação percentual
    );

    assert.strictEqual(res.deve, false);
    assert.strictEqual(res.motivo, 'acima_preco_alvo');
  });

  it('3. DEVE alertar quando o preço cruzar a meta do usuário para baixo', () => {
    // Preço anterior era 3800 (fora da meta), agora caiu para 3400 (dentro da meta 3500)
    const res = alertasRepo.deveDisparar(
      chaveTeste,
      3400,  // precoAtual (dentro da meta)
      3800,  // precoAnterior (estava fora)
      3500,  // precoAlvo
      true,
      'LOW',
      -10.5
    );

    assert.strictEqual(res.deve, true);
    assert.strictEqual(res.tipo, 'ATINGIU_META');
  });

  it('4. NUNCA deve alertar novamente para oscilações mínimas ou preços maiores', () => {
    // Primeiro alerta registrado a 3200
    const res1 = alertasRepo.deveDisparar(chaveTeste, 3200, 3600, 3500, true, 'LOW', -11.1);
    assert.strictEqual(res1.deve, true);

    // No ciclo seguinte, preço oscilou de 3200 para 3250 (subiu)
    const resSubiu = alertasRepo.deveDisparar(chaveTeste, 3250, 3200, 3500, false, 'LOW', 1.5);
    assert.strictEqual(resSubiu.deve, false);
    assert.strictEqual(resSubiu.motivo, 'preco_nao_melhorou');

    // No ciclo seguinte, preço caiu de 3200 para 3180 (redução irrisória de < 5%)
    const resMinima = alertasRepo.deveDisparar(chaveTeste, 3180, 3200, 3500, true, 'LOW', -0.6);
    assert.strictEqual(resMinima.deve, false);
    assert.strictEqual(resMinima.motivo, 'variacao_insignificante');
  });

  it('5. DEVE alertar se o preço cair significativamente no mesmo dia (nova queda > 5%)', () => {
    // Primeiro alerta registrado a 3200
    const res1 = alertasRepo.deveDisparar(chaveTeste, 3200, 3600, 3500, true, 'LOW', -11.1);
    assert.strictEqual(res1.deve, true);

    // Algumas horas depois no mesmo dia, preço cai para 2800 (queda de 12.5% em relação aos 3200)
    // Cooldown de anti-rajada expirado (simulamos ajustando timestamp do alerta anterior)
    const db = getDb();
    db.prepare(`
      UPDATE alertas_disparados
      SET disparado_em = ?
      WHERE chave_alerta = ?
    `).run(new Date(Date.now() - 2 * 3600 * 1000).toISOString(), chaveTeste);

    const resNovaQueda = alertasRepo.deveDisparar(chaveTeste, 2800, 3200, 3500, true, 'LOW', -12.5);
    assert.strictEqual(resNovaQueda.deve, true);
    assert.strictEqual(resNovaQueda.tipo, 'NOVO_RECORDE');
  });

  it('6. deveDispararBugFare: suprime repetição do mesmo preço mas dispara nova queda no mesmo dia', () => {
    const chaveBug = 'BUG_SAO_MAD_2026-12-15_2026-12-27';
    const db = getDb();
    db.prepare('DELETE FROM alertas_disparados WHERE chave_alerta = ?').run(chaveBug);

    // Primeiro disparo de bug fare a R$ 1500
    const d1 = alertasRepo.deveDispararBugFare(chaveBug, 1500);
    assert.strictEqual(d1.deve, true);
    alertasRepo.registrarDisparo(chaveBug, 1500, 'BUG_FARE');

    // Minuto seguinte: mesmo preço R$ 1500 -> suprime com sucesso (zero spam)
    const dRepetido = alertasRepo.deveDispararBugFare(chaveBug, 1500);
    assert.strictEqual(dRepetido.deve, false);
    assert.strictEqual(dRepetido.motivo, 'mesmo_preco_em_cooldown_24h');

    // Horas depois no mesmo dia: preço cai ainda mais para R$ 1100 (queda de 26.6%)
    const dNovaQueda = alertasRepo.deveDispararBugFare(chaveBug, 1100);
    assert.strictEqual(dNovaQueda.deve, true);
    assert.strictEqual(dNovaQueda.motivo, 'nova_queda_mesmo_dia');
  });
});
