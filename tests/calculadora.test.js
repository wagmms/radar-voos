import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parsePreco,
  calcularVariacao,
  avaliarCustoDestinoComTotal,
  avaliarTermometro,
  analisarLayoversEStopover,
  classificarDeltaPreco
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

  it('deve lidar defensivamente com entradas nulas, indefinidas e layovers corrompidos', () => {
    // 1. Entradas nulas e indefinidas
    const resNulo = analisarLayoversEStopover(null);
    assert.deepStrictEqual(resNulo.layoversValidos, []);
    assert.strictEqual(resNulo.dicaStopover, '-');

    const resUndefined = analisarLayoversEStopover(undefined);
    assert.deepStrictEqual(resUndefined.layoversValidos, []);
    assert.strictEqual(resUndefined.dicaStopover, '-');

    // 2. Elementos corrompidos, duração zerada ou negativa
    const resCorrompido = analisarLayoversEStopover({
      layovers: [null, undefined, {}, { id: 'MAD', duration: 0 }, { duration: -30 }, { duration: 'abc' }]
    });
    assert.deepStrictEqual(resCorrompido.layoversValidos, []);
    assert.strictEqual(resCorrompido.dicaStopover, '-');

    // 3. String numérica válida com conexão >= 8h
    const resStringValida = analisarLayoversEStopover({
      layovers: [{ id: 'PTY', name: 'Tocumen', duration: '540', overnight: false }]
    });
    assert.strictEqual(resStringValida.layoversValidos.length, 1);
    assert.match(resStringValida.dicaStopover, /9h em PTY/);
  });

  it('deve classificar deltas estatísticos com Z-Score (padrão proactive-agent)', () => {
    // 1. Z-Score <= -2.5 (BUG_FARE anômalo)
    // Média = 4000, DP = 500, Preço = 2600 -> Z-Score = (2600-4000)/500 = -2.8
    const bugFareDelta = classificarDeltaPreco({ preco: 2600, media: 4000, desvioPadrao: 500 });
    assert.strictEqual(bugFareDelta.categoria, 'BUG_FARE');
    assert.strictEqual(bugFareDelta.zScore, -2.8);
    assert.strictEqual(bugFareDelta.quedaPct, 35);

    // 2. Z-Score <= -1.5 (OPORTUNIDADE comprovada)
    // Média = 4000, DP = 500, Preço = 3100 -> Z-Score = (3100-4000)/500 = -1.8
    const oportunidadeZ = classificarDeltaPreco({ preco: 3100, media: 4000, desvioPadrao: 500 });
    assert.strictEqual(oportunidadeZ.categoria, 'OPORTUNIDADE');
    assert.strictEqual(oportunidadeZ.zScore, -1.8);

    // 3. Queda >= 30% sem desvio padrão robusto (OPORTUNIDADE)
    // Média = 3000, DP = null, Preço = 2000 -> queda = 33.3%
    const oportunidadePct = classificarDeltaPreco({ preco: 2000, media: 3000, desvioPadrao: null });
    assert.strictEqual(oportunidadePct.categoria, 'OPORTUNIDADE');
    assert.strictEqual(oportunidadePct.zScore, null);
    assert.strictEqual(oportunidadePct.quedaPct, 33.3);

    // 4. Oscilação normal de mercado (INFO)
    // Média = 4000, DP = 500, Preço = 3800 -> Z-Score = -0.4, queda = 5%
    const normalDelta = classificarDeltaPreco({ preco: 3800, media: 4000, desvioPadrao: 500 });
    assert.strictEqual(normalDelta.categoria, 'INFO');
    assert.strictEqual(normalDelta.zScore, -0.4);

    // 5. Entradas inválidas ou nulas retornam INFO seguro
    const nuloDelta = classificarDeltaPreco({ preco: 0, media: null });
    assert.strictEqual(nuloDelta.categoria, 'INFO');
    assert.strictEqual(nuloDelta.zScore, null);
  });

  it('deve lidar com casos de borda e entradas adversariais em classificarDeltaPreco', () => {
    // Caso 1: Queda >= 30% com desvio padrão amplo onde zScore é > -1.5 (ex: -1.17)
    // Média = 1000, DP = 300, Preço = 650 -> Queda = 35%, Z-Score = (650-1000)/300 = -1.17
    const quedaComDPAmplo = classificarDeltaPreco({ preco: 650, media: 1000, desvioPadrao: 300 });
    assert.strictEqual(quedaComDPAmplo.categoria, 'OPORTUNIDADE');
    assert.strictEqual(quedaComDPAmplo.zScore, -1.17);
    assert.strictEqual(quedaComDPAmplo.quedaPct, 35);

    // Caso 2: Entradas malformadas, NaN e infinitos
    const entradaInvalida = classificarDeltaPreco({ preco: 'preco_invalido', media: 1000 });
    assert.strictEqual(entradaInvalida.categoria, 'INFO');
    assert.strictEqual(entradaInvalida.zScore, null);
    assert.strictEqual(entradaInvalida.quedaPct, 0);

    const entradaInfinita = classificarDeltaPreco({ preco: Infinity, media: 1000 });
    assert.strictEqual(entradaInfinita.categoria, 'INFO');
    assert.strictEqual(entradaInfinita.zScore, null);

    // Caso 3: Coerção resiliente de strings numéricas válidas
    const stringNumerica = classificarDeltaPreco({ preco: '650.00', media: '1000.00', desvioPadrao: '300.00' });
    assert.strictEqual(stringNumerica.categoria, 'OPORTUNIDADE');
    assert.strictEqual(stringNumerica.zScore, -1.17);
    assert.strictEqual(stringNumerica.quedaPct, 35);
  });
});

