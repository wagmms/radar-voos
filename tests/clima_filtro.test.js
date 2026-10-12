import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairTemperaturaMedia,
  classificarFaixaClima,
  obterMetaFaixaClima,
  filtrarPorFaixaClima,
  renderizarWeatherBadge
} from '../src/public/js/clima_filtro.js';

describe('Cockpit PWA: Filtro por Faixa de Temperatura Climática (clima_temp_media)', () => {
  describe('extrairTemperaturaMedia', () => {
    it('deve extrair valor numérico direto de clima_temp_media', () => {
      const rota = { clima_temp_media: 28.5 };
      assert.equal(extrairTemperaturaMedia(rota), 28.5);
    });

    it('deve converter string numérica em float', () => {
      const rota = { clima_temp_media: '22.4' };
      assert.equal(extrairTemperaturaMedia(rota), 22.4);
    });

    it('deve aceitar número direto passado como argumento', () => {
      assert.equal(extrairTemperaturaMedia(18), 18);
      assert.equal(extrairTemperaturaMedia(0), 0);
      assert.equal(extrairTemperaturaMedia(-5), -5);
    });

    it('deve fazer fallback com regex em clima_destino_resumo quando clima_temp_media for nulo', () => {
      const rota1 = { clima_temp_media: null, clima_destino_resumo: '29°C • Pancadas de Chuva 🌧️' };
      assert.equal(extrairTemperaturaMedia(rota1), 29);

      const rota2 = { clima_temp_media: null, clima_destino_resumo: 'Sol forte, 31.5°C' };
      assert.equal(extrairTemperaturaMedia(rota2), 31.5);

      const rota3 = { clima_temp_media: null, clima_destino_resumo: 'Frio extremo, -3°C' };
      assert.equal(extrairTemperaturaMedia(rota3), -3);

      const rotaVirgula = { clima_temp_media: null, clima_destino_resumo: 'Ameno 18,5 °C com nuvens' };
      assert.equal(extrairTemperaturaMedia(rotaVirgula), 18.5);
    });

    it('deve retornar null para rota sem clima ou com formato irreconhecível', () => {
      assert.equal(extrairTemperaturaMedia(null), null);
      assert.equal(extrairTemperaturaMedia(undefined), null);
      assert.equal(extrairTemperaturaMedia({}), null);
      assert.equal(extrairTemperaturaMedia({ clima_temp_media: null, clima_destino_resumo: null }), null);
      assert.equal(extrairTemperaturaMedia({ clima_temp_media: null, clima_destino_resumo: 'Nublado sem temperatura' }), null);
    });
  });

  describe('classificarFaixaClima', () => {
    it('deve classificar como quente temperaturas estritamente acima de 25°C', () => {
      assert.equal(classificarFaixaClima(25.1), 'quente');
      assert.equal(classificarFaixaClima(28), 'quente');
      assert.equal(classificarFaixaClima(35), 'quente');
    });

    it('deve classificar como ameno temperaturas entre 15°C e 25°C (inclusive)', () => {
      assert.equal(classificarFaixaClima(15), 'ameno');
      assert.equal(classificarFaixaClima(18.5), 'ameno');
      assert.equal(classificarFaixaClima(20), 'ameno');
      assert.equal(classificarFaixaClima(25), 'ameno');
    });

    it('deve classificar como frio temperaturas estritamente abaixo de 15°C', () => {
      assert.equal(classificarFaixaClima(14.9), 'frio');
      assert.equal(classificarFaixaClima(10), 'frio');
      assert.equal(classificarFaixaClima(0), 'frio');
      assert.equal(classificarFaixaClima(-8), 'frio');
    });

    it('deve classificar como sem_dados quando temperatura for nula ou inválida', () => {
      assert.equal(classificarFaixaClima(null), 'sem_dados');
      assert.equal(classificarFaixaClima(undefined), 'sem_dados');
      assert.equal(classificarFaixaClima(NaN), 'sem_dados');
    });
  });

  describe('obterMetaFaixaClima', () => {
    it('deve retornar metadados corretos para faixa quente', () => {
      const meta = obterMetaFaixaClima('quente');
      assert.equal(meta.id, 'quente');
      assert.equal(meta.rotulo, 'Quente (>25°C)');
      assert.equal(meta.emoji, '☀️');
      assert.equal(meta.badgeClass, 'weather-badge-quente');
      assert.equal(meta.chipClass, 'chip-clima-quente');
    });

    it('deve retornar metadados corretos para faixa amena', () => {
      const meta = obterMetaFaixaClima('ameno');
      assert.equal(meta.id, 'ameno');
      assert.equal(meta.rotulo, 'Ameno (15-25°C)');
      assert.equal(meta.emoji, '⛅');
      assert.equal(meta.badgeClass, 'weather-badge-ameno');
    });

    it('deve retornar metadados corretos para faixa fria', () => {
      const meta = obterMetaFaixaClima('frio');
      assert.equal(meta.id, 'frio');
      assert.equal(meta.rotulo, 'Frio (<15°C)');
      assert.equal(meta.emoji, '❄️');
      assert.equal(meta.badgeClass, 'weather-badge-frio');
    });

    it('deve extrair metadados diretamente a partir de um objeto de rota', () => {
      const rotaBelem = { clima_temp_media: 29 };
      const meta = obterMetaFaixaClima(rotaBelem);
      assert.equal(meta.id, 'quente');
      assert.equal(meta.emoji, '☀️');
    });
  });

  describe('filtrarPorFaixaClima', () => {
    const rotaQuente = { id: 1, destino: 'Belém', clima_temp_media: 29 };
    const rotaAmena = { id: 2, destino: 'Lisboa', clima_temp_media: 21 };
    const rotaFria = { id: 3, destino: 'Bariloche', clima_temp_media: 8 };
    const rotaSemClima = { id: 4, destino: 'Madrid', clima_temp_media: null };

    it('deve aceitar todas as rotas quando filtro for "todos", "todas" ou vazio', () => {
      assert.equal(filtrarPorFaixaClima(rotaQuente, 'todos'), true);
      assert.equal(filtrarPorFaixaClima(rotaAmena, 'todos'), true);
      assert.equal(filtrarPorFaixaClima(rotaFria, 'todos'), true);
      assert.equal(filtrarPorFaixaClima(rotaSemClima, 'todos'), true);
      assert.equal(filtrarPorFaixaClima(rotaQuente, ''), true);
      assert.equal(filtrarPorFaixaClima(rotaQuente, null), true);
    });

    it('deve filtrar apenas rotas quentes (>25°C)', () => {
      assert.equal(filtrarPorFaixaClima(rotaQuente, 'quente'), true);
      assert.equal(filtrarPorFaixaClima(rotaAmena, 'quente'), false);
      assert.equal(filtrarPorFaixaClima(rotaFria, 'quente'), false);
      assert.equal(filtrarPorFaixaClima(rotaSemClima, 'quente'), false);

      // Suporte a prefixo 'clima-quente'
      assert.equal(filtrarPorFaixaClima(rotaQuente, 'clima-quente'), true);
    });

    it('deve filtrar apenas rotas amenas (15°C a 25°C)', () => {
      assert.equal(filtrarPorFaixaClima(rotaQuente, 'ameno'), false);
      assert.equal(filtrarPorFaixaClima(rotaAmena, 'ameno'), true);
      assert.equal(filtrarPorFaixaClima(rotaFria, 'ameno'), false);
      assert.equal(filtrarPorFaixaClima(rotaSemClima, 'ameno'), false);

      // Suporte a prefixo 'clima-ameno'
      assert.equal(filtrarPorFaixaClima(rotaAmena, 'clima-ameno'), true);
    });

    it('deve filtrar apenas rotas frias (<15°C)', () => {
      assert.equal(filtrarPorFaixaClima(rotaQuente, 'frio'), false);
      assert.equal(filtrarPorFaixaClima(rotaAmena, 'frio'), false);
      assert.equal(filtrarPorFaixaClima(rotaFria, 'frio'), true);
      assert.equal(filtrarPorFaixaClima(rotaSemClima, 'frio'), false);

      // Suporte a prefixo 'clima-frio'
      assert.equal(filtrarPorFaixaClima(rotaFria, 'clima-frio'), true);
    });
  });

  describe('renderizarWeatherBadge', () => {
    it('deve retornar string vazia para rota sem clima', () => {
      assert.equal(renderizarWeatherBadge({}), '');
      assert.equal(renderizarWeatherBadge({ clima_temp_media: null, clima_destino_resumo: null }), '');
    });

    it('deve renderizar badge com classe de calor e micro-tag para destino quente', () => {
      const rota = {
        clima_temp_media: 29,
        clima_destino_resumo: '29°C • Pancadas de Chuva 🌧️'
      };
      const html = renderizarWeatherBadge(rota);
      assert.ok(html.includes('weather-badge weather-badge-quente'));
      assert.ok(html.includes('29°C • Pancadas de Chuva 🌧️'));
      assert.ok(html.includes('weather-faixa-pill'));
      assert.ok(html.includes('☀️ Quente'));
    });

    it('deve renderizar badge para destino frio com micro-tag correspondente', () => {
      const rota = {
        clima_temp_media: 12,
        clima_destino_resumo: '12°C • Chuva Leve 🌧️'
      };
      const html = renderizarWeatherBadge(rota);
      assert.ok(html.includes('weather-badge weather-badge-frio'));
      assert.ok(html.includes('❄️ Frio'));
    });

    it('deve renderizar badge para destino ameno com micro-tag correspondente', () => {
      const rota = {
        clima_temp_media: 20,
        clima_destino_resumo: '20°C • Parcialmente Nublado ⛅'
      };
      const html = renderizarWeatherBadge(rota);
      assert.ok(html.includes('weather-badge weather-badge-ameno'));
      assert.ok(html.includes('⛅ Ameno'));
    });
  });
});
