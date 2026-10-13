import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderizarArcoVooSvg, COORDENADAS_MAPA } from '../src/public/js/geo_routes.js';
import {
  renderizarSparkline,
  ordenarRotasPorEconomia,
  calcularEconomiaPercentualTeto
} from '../src/public/js/sparkline.js';

describe('Rotas Geodésicas e Visualização (geo_routes & sparklines)', () => {
  it('deve conter coordenadas válidas para os principais aeroportos', () => {
    assert.ok(COORDENADAS_MAPA.GRU);
    assert.equal(COORDENADAS_MAPA.GRU.cidade, 'São Paulo');
    assert.ok(COORDENADAS_MAPA.CDG);
    assert.equal(COORDENADAS_MAPA.CDG.cidade, 'Paris');
    assert.ok(COORDENADAS_MAPA.MIA);
  });

  it('deve gerar SVG de arco ortodrômico válido com gradiente', () => {
    const svg = renderizarArcoVooSvg('GRU', 'LIS', 140, 40);
    assert.ok(svg.includes('<svg class="flight-arc-svg"'));
    assert.ok(svg.includes('linearGradient id="arcGrad_GRU_LIS"'));
    assert.ok(svg.includes('<path d="M 15 28 Q 70 6 125 28"'));
    assert.ok(svg.includes('</svg>'));
  });

  it('deve gerar sparkline SVG leve a partir do histórico de preços', () => {
    const historico = [
      { preco: 3800 },
      { preco: 3600 },
      { preco: 3450 },
      { preco: 3200 }
    ];
    const sparkline = renderizarSparkline(historico, { width: 100, height: 30 });
    assert.ok(sparkline.includes('<svg class="sparkline-svg"'));
    assert.ok(sparkline.includes('<polyline'));
    assert.ok(sparkline.includes('<circle')); // Ponto do menor preço
  });

  it('deve tratar histórico vazio ou com 1 ponto de forma graciosa', () => {
    const vazio = renderizarSparkline([]);
    assert.ok(vazio.includes('Sem histórico'));

    const umPonto = renderizarSparkline([{ preco: 2500 }]);
    assert.ok(umPonto.includes('<circle'));
  });

  it('ordenarRotasPorEconomia: deve tolerar defensivamente elementos nulos e indefinidos sem lançar TypeError (economia)', () => {
    const rotasComBugs = [
      null,
      { id: 1, preco_atual: 1500, preco_alvo: 2000 }, // 25% economia
      undefined,
      { id: 2, preco_atual: 800, preco_alvo: 1600 },  // 50% economia
      {},
      { id: 3, preco_atual: 3000 } // sem meta
    ];

    const ordenadas = ordenarRotasPorEconomia(rotasComBugs, 'economia');
    assert.ok(Array.isArray(ordenadas));
    assert.equal(ordenadas.length, 6);
    // Primeiro deve vir id 2 (50%), depois id 1 (25%)
    assert.equal(ordenadas[0]?.id, 2);
    assert.equal(ordenadas[1]?.id, 1);
  });

  it('ordenarRotasPorEconomia: deve tolerar elementos nulos e strings numéricas no critério de preço', () => {
    const rotas = [
      null,
      { id: 'b', preco_atual: '2500' },
      undefined,
      { id: 'a', preco_atual: 1200 },
      { id: 'c', preco_atual: 'invalido' }
    ];

    const ordenadas = ordenarRotasPorEconomia(rotas, 'preco');
    assert.equal(ordenadas.length, 5);
    assert.equal(ordenadas[0]?.id, 'a');
    assert.equal(ordenadas[1]?.id, 'b');
  });

  it('ordenarRotasPorEconomia: deve preservar ordem para entradas inválidas (não array) e critério padrão', () => {
    assert.deepEqual(ordenarRotasPorEconomia(null), []);
    assert.deepEqual(ordenarRotasPorEconomia(undefined), []);
    assert.deepEqual(ordenarRotasPorEconomia('string'), []);

    const listaOriginal = [{ id: 1 }, { id: 2 }];
    const resultadoPadrao = ordenarRotasPorEconomia(listaOriginal, 'padrao');
    assert.equal(resultadoPadrao.length, 2);
    assert.notEqual(resultadoPadrao, listaOriginal); // Deve retornar nova cópia
  });
});

