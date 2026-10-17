import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizarPayloadPosBrasil } from '../src/domain/pos_guard.js';
import { renderizarCardRota, renderizarCalloutDataAlternativa, renderizarGraficoCalendarioSvg } from '../src/public/js/card_rota.js';

describe('Blindagem POS-Guard + Sincronização de Janela Flexível (GIG -> BEL)', () => {
  it('deve sanear offset 0 do calendário e anular dia vizinho falso quando POS-Guard bloqueia ágio de R$ 1.281', () => {
    const rotaBaseline = {
      id: 1,
      origem: 'Rio de Janeiro',
      destino: 'Belém',
      preco_atual: 1009,
      menor_preco_historico: 1009,
      preco_alvo: 1200,
      termometro: '🟢 Abaixo da meta!'
    };

    const resultadoContaminadoDatacenter = {
      preco: 1281,
      moeda: 'BRL',
      variacao_texto: '📈 Subiu 26.9%',
      calendario_precos: [
        { offset: -1, dataIda: '2027-01-16', preco: 1062 },
        { offset: 0, dataIda: '2027-01-17', preco: 1281 },
        { offset: 1, dataIda: '2027-01-18', preco: 1203 }
      ],
      melhor_data_alternativa: {
        offset: -1,
        dataIda: '2027-01-16',
        preco: 1062,
        economiaReais: 219,
        economiaPercentual: 17
      }
    };

    const saneado = sanitizarPayloadPosBrasil(resultadoContaminadoDatacenter, rotaBaseline);

    assert.equal(saneado.precoEfetivo, 1009);
    const baseItem = saneado.calendario_precos.find(i => i.offset === 0);
    assert.equal(baseItem.preco, 1009, 'O offset 0 (17/01) deve refletir o preço auditado R$ 1.009');
    assert.equal(saneado.melhor_data_alternativa, null, '16/01 (R$ 1.062) não é mais barato que R$ 1.009 e deve ser nulo');
    assert.equal(saneado.melhor_opcao_flexivel, null);
  });

  it('frontend deve sincronizar offset 0 com preco_atual e ocultar callout se vizinho >= preco_atual', () => {
    const rotaDesalinhada = {
      id: 1,
      origem: 'Rio de Janeiro',
      destino: 'Belém',
      data_ida: '2027-01-17',
      tipo_viagem: 'one_way',
      preco_atual: 1009,
      menor_preco_historico: 1009,
      preco_alvo: 1200,
      calendario_precos: [
        { offset: -1, dataIda: '2027-01-16', preco: 1062 },
        { offset: 0, dataIda: '2027-01-17', preco: 1281 },
        { offset: 1, dataIda: '2027-01-18', preco: 1203 }
      ],
      melhor_data_alternativa: {
        offset: -1,
        dataIda: '2027-01-16',
        preco: 1062,
        economiaReais: 219,
        economiaPercentual: 17
      }
    };

    const htmlCard = renderizarCardRota(rotaDesalinhada);

    assert.ok(!htmlCard.includes('data-testid="card-data-alternativa"'), 'Não deve exibir callout de dia vizinho quando 1062 > 1009');
    assert.ok(!htmlCard.includes('1.281'), 'Não deve exibir R$ 1.281 no gráfico SVG quando preco_atual é R$ 1.009');
    assert.ok(htmlCard.includes('Menor tarifa: <strong>R$ 1.009</strong>'), 'Menor tarifa do gráfico deve ser R$ 1.009');
  });

  it('renderizarCalloutDataAlternativa isolado deve retornar vazio quando vizinho >= precoBase', () => {
    const callout = renderizarCalloutDataAlternativa(
      { offset: -1, dataIda: '2027-01-16', preco: 1062, economiaReais: 219 },
      1009
    );
    assert.equal(callout, '');
  });

  it('renderizarGraficoCalendarioSvg isolado deve exibir R$ 1.009 na barra Base', () => {
    const svg = renderizarGraficoCalendarioSvg(
      [
        { offset: -1, dataIda: '2027-01-16', preco: 1062 },
        { offset: 0, dataIda: '2027-01-17', preco: 1281 },
        { offset: 1, dataIda: '2027-01-18', preco: 1203 }
      ],
      1009
    );
    assert.ok(svg.includes('R$ 1.009'), 'Gráfico deve conter R$ 1.009');
    assert.ok(!svg.includes('R$ 1.281'), 'Gráfico NÃO deve conter R$ 1.281');
  });
});
