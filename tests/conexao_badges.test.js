import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearTempoMinutos,
  extrairInfoConexao,
  renderizarBadgeConexao,
  renderizarBannerStopover
} from '../src/public/js/conexao_badges.js';

describe('Cockpit PWA: Badges Visuais de Conexões e Stopover (conexao_badges)', () => {
  describe('parsearTempoMinutos', () => {
    it('deve converter corretamente horas e minutos para minutos inteiros', () => {
      assert.equal(parsearTempoMinutos('9h 30m'), 570);
      assert.equal(parsearTempoMinutos('1h 45min'), 105);
      assert.equal(parsearTempoMinutos('2 h 15 min'), 135);
    });

    it('deve converter horas inteiras e decimais', () => {
      assert.equal(parsearTempoMinutos('8h'), 480);
      assert.equal(parsearTempoMinutos('10 horas'), 600);
      assert.equal(parsearTempoMinutos('9.5h'), 570);
      assert.equal(parsearTempoMinutos('9,5 hr'), 570);
    });

    it('deve converter apenas minutos', () => {
      assert.equal(parsearTempoMinutos('45 min'), 45);
      assert.equal(parsearTempoMinutos('30m'), 30);
    });

    it('deve retornar null para strings vazias, nulas ou sem tempo', () => {
      assert.equal(parsearTempoMinutos(null), null);
      assert.equal(parsearTempoMinutos(''), null);
      assert.equal(parsearTempoMinutos('sem tempo informado'), null);
    });
  });

  describe('extrairInfoConexao', () => {
    it('deve retornar null para rota nula, indefinida ou sem dados de voo', () => {
      assert.equal(extrairInfoConexao(null), null);
      assert.equal(extrairInfoConexao({}), null);
      assert.equal(extrairInfoConexao({ detalhes_voo: '-', dica_stopover: '-' }), null);
    });

    it('deve detectar voo direto sem escalas', () => {
      const rota = {
        origem: 'São Paulo',
        destino: 'Miami',
        detalhes_voo: '8.5h | Direto | LATAM Airlines | Duração: 8h 30m',
        dica_stopover: '-'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'direto');
      assert.equal(info.escalas, 0);
      assert.equal(info.rotulo, 'Voo Direto');
      assert.equal(info.icone, '✈️');
      assert.equal(info.badgeClasse, 'tag-conexao-direto');
      assert.equal(info.ehNoturna, false);
      assert.equal(info.ehProlongada, false);
      assert.equal(info.ehStopover, false);
    });

    it('deve detectar voo direto via "sem escalas"', () => {
      const rota = {
        origem: 'São Paulo',
        destino: 'Rio de Janeiro',
        detalhes_voo: '1.0h | Sem escalas | G3',
        dica_stopover: '-'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'direto');
      assert.equal(info.escalas, 0);
    });

    it('deve detectar conexão rápida (<= 3h)', () => {
      const rota = {
        origem: 'Curitiba',
        destino: 'Lisboa',
        detalhes_voo: '12.0h | 1 parada (GRU) | Conexão 1h 45m | TAP Air Portugal',
        dica_stopover: '-'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'curta');
      assert.equal(info.escalas, 1);
      assert.equal(info.aeroporto, 'GRU');
      assert.equal(info.tempoMinutos, 105);
      assert.equal(info.icone, '⚡');
      assert.equal(info.badgeClasse, 'tag-conexao-curta');
      assert.ok(info.rotulo.includes('Parada Rápida'));
      assert.ok(info.rotulo.includes('1h 45m'));
      assert.equal(info.ehNoturna, false);
      assert.equal(info.ehProlongada, false);
    });

    it('deve detectar conexão moderada (3h a 8h)', () => {
      const rota = {
        origem: 'São Paulo',
        destino: 'Roma',
        detalhes_voo: '15.5h | 1 parada em MAD | Conexão 4h 30m | Iberia',
        dica_stopover: '-'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'moderada');
      assert.equal(info.escalas, 1);
      assert.equal(info.aeroporto, 'MAD');
      assert.equal(info.tempoMinutos, 270);
      assert.equal(info.icone, '🔄');
      assert.equal(info.badgeClasse, 'tag-conexao-moderada');
      assert.ok(info.rotulo.includes('4h 30m'));
      assert.equal(info.ehNoturna, false);
      assert.equal(info.ehProlongada, false);
    });

    it('deve detectar escala prolongada (> 8h) com oportunidade de stopover', () => {
      const rota = {
        origem: 'São Paulo',
        destino: 'Paris',
        detalhes_voo: '18.0h | 1 parada (MAD) | Conexão 9h 30m | Air Europa',
        dica_stopover: 'Possível conexão longa de 9h em MAD (Madrid-Barajas). Dica de Stopover 2-em-1!'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'longa');
      assert.equal(info.escalas, 1);
      assert.equal(info.aeroporto, 'MAD');
      assert.equal(info.tempoMinutos, 570);
      assert.equal(info.ehProlongada, true);
      assert.equal(info.ehStopover, true);
      assert.equal(info.ehNoturna, false);
      assert.equal(info.icone, '⏳');
      assert.equal(info.badgeClasse, 'tag-conexao-longa');
      assert.ok(info.rotulo.includes('Escala Prolongada'));
      assert.ok(info.rotulo.includes('9h 30m'));
    });

    it('deve detectar escala noturna / pernoite / overnight', () => {
      const rota = {
        origem: 'São Paulo',
        destino: 'Tóquio',
        detalhes_voo: '28.0h | 1 parada (DOH) | Conexão noturna 11h 20m | Qatar Airways',
        dica_stopover: 'Possível conexão noturna de 11h em DOH (Hamad Intl). Dica de Stopover 2-em-1!'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'noturna');
      assert.equal(info.escalas, 1);
      assert.equal(info.aeroporto, 'DOH');
      assert.equal(info.ehNoturna, true);
      assert.equal(info.ehProlongada, true);
      assert.equal(info.ehStopover, true);
      assert.equal(info.icone, '🌙');
      assert.equal(info.badgeClasse, 'tag-conexao-noturna');
      assert.ok(info.rotulo.includes('Escala Noturna'));
      assert.ok(info.rotulo.includes('11h 20m'));
    });

    it('deve detectar escala noturna a partir de dica_stopover com pernoite', () => {
      const rota = {
        origem: 'Rio de Janeiro',
        destino: 'Londres',
        detalhes_voo: '1 parada (LIS)',
        dica_stopover: 'Possível conexão noturna de 10h em LIS (Aeroporto de Lisboa). Dica de Stopover 2-em-1!'
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'noturna');
      assert.equal(info.aeroporto, 'LIS');
      assert.equal(info.ehNoturna, true);
      assert.equal(info.tempoMinutos, 600);
      assert.equal(info.icone, '🌙');
    });

    it('deve extrair dados a partir de melhor_opcao_flexivel quando detalhes_voo for vazio', () => {
      const rota = {
        origem: 'Belo Horizonte',
        destino: 'Miami',
        detalhes_voo: '-',
        melhor_opcao_flexivel: JSON.stringify({
          detalhes: '1 parada (PTY) | Conexão 2h 10m',
          dicaStopover: '-'
        })
      };

      const info = extrairInfoConexao(rota);
      assert.ok(info);
      assert.equal(info.tipo, 'curta');
      assert.equal(info.aeroporto, 'PTY');
      assert.equal(info.tempoMinutos, 130);
    });
  });

  describe('renderizarBadgeConexao', () => {
    it('deve retornar string vazia para info nula', () => {
      assert.equal(renderizarBadgeConexao(null), '');
    });

    it('deve renderizar tag HTML válida com classe e ícone', () => {
      const info = {
        tipo: 'longa',
        rotulo: '⏳ Escala Prolongada (9h 30m)',
        descricao: 'Escala longa de 9h 30m em MAD.',
        icone: '⏳',
        badgeClasse: 'tag-conexao-longa'
      };

      const html = renderizarBadgeConexao(info);
      assert.ok(html.includes('tag-conexao-pill'));
      assert.ok(html.includes('tag-conexao-longa'));
      assert.ok(html.includes('⏳'));
      assert.ok(html.includes('Escala Prolongada (9h 30m)'));
    });
  });

  describe('renderizarBannerStopover', () => {
    it('deve retornar string vazia quando não for stopover nem houver dica', () => {
      assert.equal(renderizarBannerStopover(null, null), '');
      assert.equal(renderizarBannerStopover({ ehNoturna: false, ehProlongada: false }, '-'), '');
    });

    it('deve renderizar banner de escala noturna com tema stopover-noturno', () => {
      const info = {
        ehNoturna: true,
        ehProlongada: true,
        aeroporto: 'LIS',
        tempoTexto: '11h'
      };

      const html = renderizarBannerStopover(info, 'Dica de pernoite em Lisboa!');
      assert.ok(html.includes('stopover-callout'));
      assert.ok(html.includes('stopover-noturno'));
      assert.ok(html.includes('🌙'));
      assert.ok(html.includes('Escala Noturna (Pernoite) em LIS'));
      assert.ok(html.includes('Stopover 2-em-1'));
      assert.ok(html.includes('Dica de pernoite em Lisboa!'));
    });

    it('deve renderizar banner de escala prolongada (>8h) com tema stopover-longo', () => {
      const info = {
        ehNoturna: false,
        ehProlongada: true,
        aeroporto: 'MAD',
        tempoTexto: '9h 30m'
      };

      const html = renderizarBannerStopover(info, 'Aproveite para passear no centro de Madri!');
      assert.ok(html.includes('stopover-callout'));
      assert.ok(html.includes('stopover-longo'));
      assert.ok(html.includes('⏳'));
      assert.ok(html.includes('Escala Prolongada (>8h) em MAD'));
      assert.ok(html.includes('Stopover 2-em-1'));
      assert.ok(html.includes('Aproveite para passear no centro de Madri!'));
    });

    it('deve renderizar callout simples quando houver apenas dica customizada legada', () => {
      const html = renderizarBannerStopover(null, 'Dica simples de conexão.');
      assert.ok(html.includes('stopover-callout'));
      assert.ok(html.includes('💡 Dica simples de conexão.'));
    });
  });
});
