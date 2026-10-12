import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderizarArcoVooSvg, COORDENADAS_MAPA } from '../src/public/js/geo_routes.js';
import { renderizarSparkline } from '../src/public/js/sparkline.js';

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
});
