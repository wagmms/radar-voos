import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parsePreco,
  calcularVariacao,
  avaliarCustoDestinoComTotal,
  avaliarTermometro,
  analisarLayoversEStopover
} from '../src/domain/calculadora.js';

describe('Domínio: Calculadora e Inteligência de Preços', () => {
  it('deve fazer parsing correto de formatos monetários e numéricos', () => {
    assert.strictEqual(parsePreco(1850), 1850);
    assert.strictEqual(parsePreco('R$ 1.950,50'), 1950.50);
    assert.strictEqual(parsePreco('2400.00'), 2400.00);
    assert.strictEqual(parsePreco('R$ 800'), 800);
    assert.strictEqual(parsePreco(null), 0);
  });

  it('deve calcular variações percentuais e sinalizar quedas relâmpago', () => {
    // Queda de 20% (supera o gatilho de 15%)
    const resQueda = calcularVariacao(1600, 2000, 15);
    assert.strictEqual(resQueda.pct, -20);
    assert.strictEqual(resQueda.ehQuedaRelampago, true);
    assert.match(resQueda.texto, /Caiu/);

    // Alta de 10%
    const resAlta = calcularVariacao(2200, 2000, 15);
    assert.strictEqual(resAlta.pct, 10);
    assert.strictEqual(resAlta.ehQuedaRelampago, false);
    assert.match(resAlta.texto, /Subiu/);
  });

  it('deve calcular o Custo Total da Viagem (Voo + Diária x Dias)', () => {
    // Buenos Aires: R$ 180/dia. 10 dias = R$ 1.800 de estadia + R$ 1.200 voo = R$ 3.000 total
    const custo = avaliarCustoDestinoComTotal('Buenos Aires', 'Buenos Aires', 1200, '2026-10-10', '2026-10-20');
    assert.strictEqual(custo.diasViagem, 10);
    assert.strictEqual(custo.valorDiario, 180);
    assert.strictEqual(custo.custoTerrestre, 1800);
    assert.strictEqual(custo.custoTotalEstimado, 3000);
  });

  it('deve avaliar o termômetro do voo conforme price_insights do Google Flights', () => {
    const baixo = avaliarTermometro({ price_level: 'LOW' });
    assert.strictEqual(baixo.nivelPreco, 'LOW');
    assert.match(baixo.termometro, /Super Barato/);

    const alto = avaliarTermometro({ price_level: 'HIGH' });
    assert.strictEqual(alto.nivelPreco, 'HIGH');
    assert.match(alto.termometro, /Caro/);
  });

  it('deve identificar oportunidades reais de Stopover para conexões >= 8h', () => {
    const vooComLongaConexao = {
      layovers: [
        { id: 'LIS', name: 'Lisbon Portela', duration: 600, overnight: true }
      ]
    };
    const { dicaStopover } = analisarLayoversEStopover(vooComLongaConexao);
    assert.match(dicaStopover, /Stopover 2-em-1/);
    assert.match(dicaStopover, /10h em LIS/);

    const vooCurto = {
      layovers: [
        { id: 'GRU', name: 'Guarulhos', duration: 120, overnight: false }
      ]
    };
    const resCurto = analisarLayoversEStopover(vooCurto);
    assert.strictEqual(resCurto.dicaStopover, '-');
  });
});
