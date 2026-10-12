import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classificarItemFeed } from '../src/domain/bug_fares.js';

describe('Domínio: Filtro de Bug Fares e Erros de Tarifa', () => {
  it('deve descartar imediatamente posts com termos comerciais banidos', () => {
    const postHotel = classificarItemFeed('Mega desconto em hotel e resort em Cancun com cupom', 'https://exemplo.com/promo-hotel');
    assert.strictEqual(postHotel.valido, false);

    const postMilhas = classificarItemFeed('Ganhe até 100% de bônus livelo transferindo para smiles', 'https://exemplo.com/milhas');
    assert.strictEqual(postMilhas.valido, false);

    const postPacote = classificarItemFeed('Pacote Disney 7 dias com aéreo e hotel incluso', 'https://exemplo.com/pacote-disney');
    assert.strictEqual(postPacote.valido, false);
  });

  it('deve reconhecer positivamente erros autênticos de tarifa (Bug Fares)', () => {
    const bugFare = classificarItemFeed('URGENTE: Erro de tarifa para Paris e Roma por R$ 890 ida e volta!', 'https://exemplo.com/erro-tarifa-paris');
    assert.strictEqual(bugFare.valido, true);
    assert.strictEqual(bugFare.ehBugFare, true);
    assert.match(bugFare.tipo, /BUG FARE/);

    const bugFareIngles = classificarItemFeed('Bug Fare absurdo: voos para os EUA por preço errado', 'https://exemplo.com/bug-fare-eua');
    assert.strictEqual(bugFareIngles.valido, true);
    assert.strictEqual(bugFareIngles.ehBugFare, true);
  });

  it('deve identificar corretamente a região do destino para checagem de piso estrutural', async () => {
    const { identificarRegiaoDestino } = await import('../src/domain/bug_fares.js');
    assert.strictEqual(identificarRegiaoDestino('LIS'), 'EUROPA');
    assert.strictEqual(identificarRegiaoDestino('CDG'), 'EUROPA');
    assert.strictEqual(identificarRegiaoDestino('MIA'), 'AMERICA_NORTE');
    assert.strictEqual(identificarRegiaoDestino('JFK'), 'AMERICA_NORTE');
    assert.strictEqual(identificarRegiaoDestino('EZE'), 'AMERICA_SUL');
    assert.strictEqual(identificarRegiaoDestino('HND'), 'ASIA_OCEANIA');
    assert.strictEqual(identificarRegiaoDestino('REC'), 'DOMESTICO');
  });

  it('deve detectar Bug Fares estatísticos por queda abrupta ou valor abaixo do piso regional', async () => {
    const { detectarBugFareEstatistico } = await import('../src/domain/bug_fares.js');

    // Caso 1: Tarifa para Europa abaixo do piso estrutural de R$ 1.950 (ida e volta)
    const bugPiso = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'MAD',
      preco: 1450,
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(bugPiso.ehBugFare, true);
    assert.match(bugPiso.tipo, /BUG FARE/);
    assert.match(bugPiso.motivo, /abaixo do piso estrutural/);

    // Caso 2: Queda estatística >= 50% em relação à média histórica
    const bugQueda = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'REC',
      preco: 400,
      precoMedioHistorico: 1200,
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(bugQueda.ehBugFare, true);
    assert.match(bugQueda.tipo, /ANOMALIA ESTATÍSTICA/);

    // Caso 3: Tarifa normal e equilibrada
    const vooNormal = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'CDG',
      preco: 3900,
      precoMedioHistorico: 4100,
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(vooNormal.ehBugFare, false);
  });
});
