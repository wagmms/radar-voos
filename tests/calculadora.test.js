import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parsePreco,
  calcularVariacao,
  avaliarCustoDestinoComTotal,
  avaliarTermometro,
  analisarLayoversEStopover,
  classificarDeltaPreco,
  converterMoeda,
  COTACOES_PADRAO,
  DIARIAS_REGIONAIS_PADRAO
} from '../src/domain/calculadora.js';

describe('Domínio: Calculadora e Inteligência de Preços', () => {
  it('deve fazer parsing correto de formatos monetários e numéricos', () => {
    assert.strictEqual(parsePreco(1850), 1850);
    assert.strictEqual(parsePreco('R$ 1.950,50'), 1950.50);
    assert.strictEqual(parsePreco('2400.00'), 2400.00);
    assert.strictEqual(parsePreco('R$ 800'), 800);
    assert.strictEqual(parsePreco(null), 0);
  });

  it('deve lidar defensivamente com casos de borda adversariais em parsePreco (infinitos, negativos e BRL)', () => {
    // 1. Valores não-finitos (Infinity, -Infinity, NaN em número ou string) retornam 0
    assert.strictEqual(parsePreco(Infinity), 0);
    assert.strictEqual(parsePreco(-Infinity), 0);
    assert.strictEqual(parsePreco('Infinity'), 0);
    assert.strictEqual(parsePreco('-Infinity'), 0);
    assert.strictEqual(parsePreco(NaN), 0);

    // 2. Preços negativos numéricos ou em string retornam 0
    assert.strictEqual(parsePreco(-500), 0);
    assert.strictEqual(parsePreco('-150.50'), 0);
    assert.strictEqual(parsePreco('R$ -800'), 0);

    // 3. Suporte robusto a prefixo BRL e strings vazias/espaços
    assert.strictEqual(parsePreco('BRL 1.450,20'), 1450.20);
    assert.strictEqual(parsePreco('   '), 0);
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

  it('deve lidar defensivamente com casos de borda adversariais em calcularVariacao (nulos, strings formatadas, zeros e NaNs)', () => {
    // 1. Preço atual nulo, zero ou inválido não deve disparar falsa queda relâmpago (-100%)
    const resNulo = calcularVariacao(null, 2000);
    assert.strictEqual(resNulo.ehQuedaRelampago, false);
    assert.strictEqual(resNulo.pct, 0);
    assert.strictEqual(resNulo.diff, 0);
    assert.strictEqual(resNulo.texto, 'Indisponível');

    // 2. Preço anterior nulo, inválido ou zero retorna Primeira Checagem segura
    const resSemAnterior = calcularVariacao(1500, 'invalido');
    assert.strictEqual(resSemAnterior.ehQuedaRelampago, false);
    assert.strictEqual(resSemAnterior.texto, 'Primeira Checagem');

    // 3. Suporte resiliente a strings monetárias formatadas (ex: 'R$ 1.600,00' vs 'R$ 2.000,00')
    const resFormatado = calcularVariacao('R$ 1.600,00', 'R$ 2.000,00', 15);
    assert.strictEqual(resFormatado.pct, -20);
    assert.strictEqual(resFormatado.ehQuedaRelampago, true);
    assert.strictEqual(resFormatado.diff, -400);
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

  it('deve converter valores entre moedas com precisão e fallback defensivo', () => {
    // 1. Conversão padrão BRL -> USD e USD -> BRL
    // Cotação USD: 5.50
    assert.strictEqual(converterMoeda(550, 'BRL', 'USD'), 100);
    assert.strictEqual(converterMoeda(100, 'USD', 'BRL'), 550);

    // 2. Mesma moeda retorna o próprio valor
    assert.strictEqual(converterMoeda(150, 'EUR', 'EUR'), 150);

    // 3. Conversão cruzada USD -> EUR
    // 100 USD = 550 BRL -> 550 / 6.00 = 91.67 EUR
    assert.strictEqual(converterMoeda(100, 'USD', 'EUR'), 91.67);

    // 4. Cotação personalizada injetada
    assert.strictEqual(converterMoeda(100, 'USD', 'BRL', { USD: 6.00 }), 600);

    // 5. Casos de borda: valores negativos, nulos, NaN e moedas desconhecidas
    assert.strictEqual(converterMoeda(-50, 'USD', 'BRL'), 0);
    assert.strictEqual(converterMoeda(0, 'USD', 'BRL'), 0);
    assert.strictEqual(converterMoeda(null, 'USD', 'BRL'), 0);
    assert.strictEqual(converterMoeda(NaN, 'USD', 'BRL'), 0);
    assert.strictEqual(converterMoeda(100, 'MOEDA_DESCONHECIDA', 'BRL'), 100);
  });

  it('deve estimar custo diário de destinos internacionais fora do dicionário base via inferência geográfica', () => {
    // 1. Viena (VIE) - Áustria, Europa: não está no dicionário base, deve inferir EUROPA (~€85 | ~R$ 510/dia)
    const custoViena = avaliarCustoDestinoComTotal('VIE', 'Viena (VIE)', 2500, '2026-11-01', '2026-11-08');
    assert.strictEqual(custoViena.diasViagem, 7);
    assert.strictEqual(custoViena.origemEstimativa, 'REGIAO_AEROPORTO');
    assert.strictEqual(custoViena.regiaoEstimada, 'EUROPA');
    assert.strictEqual(custoViena.moedaOrigem, 'EUR');
    assert.strictEqual(custoViena.valorDiarioMoedaOrigem, 85);
    assert.strictEqual(custoViena.valorDiarioBrl, 510);
    assert.strictEqual(custoViena.custoTerrestre, 7 * 510);
    assert.strictEqual(custoViena.custoTotalEstimado, 2500 + (7 * 510));
    assert.match(custoViena.textoBase, /€85/);

    // 2. Sydney (SYD) - Austrália: inferência específica de país via AJUSTES_PAIS_CUSTO
    const custoSydney = avaliarCustoDestinoComTotal('SYD', 'Sydney (SYD)', 4000, '2026-12-01', '2026-12-11');
    assert.strictEqual(custoSydney.diasViagem, 10);
    assert.strictEqual(custoSydney.moedaOrigem, 'AUD');
    assert.strictEqual(custoSydney.valorDiarioMoedaOrigem, 170);
    assert.strictEqual(custoSydney.valorDiarioBrl, 612);
    assert.strictEqual(custoSydney.custoTerrestre, 6120);
    assert.strictEqual(custoSydney.custoTotalEstimado, 10120);
    assert.match(custoSydney.textoBase, /A\$170/);

    // 3. Toronto (YYZ) - Canadá: inferência de país com CAD
    const custoToronto = avaliarCustoDestinoComTotal('YYZ', 'Toronto (YYZ)', 2800, '2026-11-10', '2026-11-15');
    assert.strictEqual(custoToronto.diasViagem, 5);
    assert.strictEqual(custoToronto.moedaOrigem, 'CAD');
    assert.strictEqual(custoToronto.valorDiarioMoedaOrigem, 160);
    assert.strictEqual(custoToronto.valorDiarioBrl, 640);
  });

  it('deve estimar destinos nacionais fora do dicionário base com diária doméstica realista', () => {
    // Joinville (JOI): não está no DICIONARIO_CUSTO_DESTINO, mas está catalogado
    const custoJoinville = avaliarCustoDestinoComTotal('JOI', 'Joinville (JOI)', 600, '2026-10-05', '2026-10-09');
    assert.strictEqual(custoJoinville.diasViagem, 4);
    assert.strictEqual(custoJoinville.valorDiarioBrl, 180);
    assert.strictEqual(custoJoinville.custoTerrestre, 720);
    assert.strictEqual(custoJoinville.custoTotalEstimado, 1320);
    assert.strictEqual(custoJoinville.moedaOrigem, 'BRL');
    assert.match(custoJoinville.textoBase, /Nacional/);
  });

  it('deve suportar cálculo de custo total com moedas dinâmicas e cotações personalizadas', () => {
    // 1. Solicitação em USD para destino em Paris (que custa R$ 700/dia no dicionário)
    // Preço voo: R$ 3.300 -> em USD (cotacao 5.50): 600 USD
    // Diária: R$ 700 -> em USD: 127.27 USD
    // 6 dias: custoTerrestre = 6 * 127.27 = 764 USD
    // custoTotal = 600 + 764 = 1364 USD
    const custoParisUsd = avaliarCustoDestinoComTotal(
      'Paris',
      'Paris',
      3300,
      '2026-10-10',
      '2026-10-16',
      { moeda: 'USD' }
    );
    assert.strictEqual(custoParisUsd.moeda, 'USD');
    assert.strictEqual(custoParisUsd.simboloMoeda, '$');
    assert.strictEqual(custoParisUsd.diasViagem, 6);
    assert.strictEqual(custoParisUsd.valorDiario, 127.27);
    assert.strictEqual(custoParisUsd.custoTotalEstimado, 1364);
    assert.match(custoParisUsd.textoResumo, /Total 6d: ~\$ 1364/);

    // 2. Parâmetro simples de string 'USD' como opções
    const custoStringOpcao = avaliarCustoDestinoComTotal('Paris', 'Paris', 3300, '2026-10-10', '2026-10-16', 'USD');
    assert.strictEqual(custoStringOpcao.moeda, 'USD');

    // 3. Cotação dinâmica customizada (ex: EUR a R$ 6.50)
    const custoCotacaoCustom = avaliarCustoDestinoComTotal(
      'Lisboa',
      'Lisboa',
      3000,
      '2026-10-10',
      '2026-10-15',
      { moeda: 'EUR', cotacoes: { EUR: 6.00 } }
    );
    assert.strictEqual(custoCotacaoCustom.moeda, 'EUR');
    assert.strictEqual(custoCotacaoCustom.simboloMoeda, '€');

    // 4. Diária customizada sobreposta
    const custoCustomizado = avaliarCustoDestinoComTotal(
      'Qualquer Destino',
      'Qualquer Destino',
      1000,
      '2026-10-10',
      '2026-10-13',
      { diariaCustomizada: 450 }
    );
    assert.strictEqual(custoCustomizado.origemEstimativa, 'CUSTOMIZADA');
    assert.strictEqual(custoCustomizado.valorDiarioBrl, 450);
    assert.strictEqual(custoCustomizado.custoTerrestre, 3 * 450);
  });

  it('deve lidar defensivamente com casos de borda e entradas adversariais em avaliarCustoDestinoComTotal', () => {
    // 1. Destinos nulos/indefinidos
    const resNulo = avaliarCustoDestinoComTotal(null, null, 1000);
    assert.strictEqual(resNulo.origemEstimativa, 'FALLBACK_PADRAO');
    assert.strictEqual(resNulo.valorDiario, 300);

    // 2. Datas invertidas (volta antes da ida) -> diasViagem = 0
    const resDataInvertida = avaliarCustoDestinoComTotal('Lisboa', 'Lisboa', 2000, '2026-10-20', '2026-10-10');
    assert.strictEqual(resDataInvertida.diasViagem, 0);
    assert.strictEqual(resDataInvertida.custoTerrestre, 0);

    // 3. Preço de voo negativo ou string corrompida
    const resPrecoNegativo = avaliarCustoDestinoComTotal('Lisboa', 'Lisboa', -500, '2026-10-10', '2026-10-15');
    assert.strictEqual(resPrecoNegativo.custoTotalEstimado, 5 * 380);

    // 4. Só ida
    const resSoIda = avaliarCustoDestinoComTotal('Lisboa', 'Lisboa', 1500, '2026-10-10', 'SO_IDA');
    assert.strictEqual(resSoIda.diasViagem, 0);
    assert.match(resSoIda.textoResumo, /Só Ida/);
  });
});

