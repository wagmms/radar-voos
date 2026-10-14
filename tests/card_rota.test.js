import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatarPreco,
  formatarDiaMes,
  ehUrlSegura,
  renderizarBadgeMeta,
  renderizarBadgeTermometro,
  renderizarBadgeJanelaFlex,
  renderizarBadgesFiltros,
  renderizarLinhaHorarios,
  renderizarTradeOff,
  renderizarCalloutDataAlternativa,
  renderizarGraficoCalendarioSvg,
  renderizarRankingDestinosRegionais,
  renderizarCardRota
} from '../src/public/js/card_rota.js';

describe('Cockpit PWA: Módulo Card de Rota (card_rota.js)', () => {
  describe('Sanitização e Formatação Base', () => {
    it('escapeHtml: deve escapar caracteres perigosos contra XSS', () => {
      const perigoso = '<script>alert("xss")</script> & \'teste\'';
      const seguro = escapeHtml(perigoso);
      assert.equal(seguro, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;teste&#39;');
    });

    it('escapeHtml: deve lidar com nulos, indefinidos e números', () => {
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
      assert.equal(escapeHtml(0), '0');
      assert.equal(escapeHtml(3500), '3500');
    });

    it('formatarPreco: deve formatar valores monetários em padrão pt-BR', () => {
      assert.equal(formatarPreco(2500), '2.500');
      assert.equal(formatarPreco(2500.5), '2.500,50');
      assert.equal(formatarPreco('invalido'), '—');
    });

    it('formatarDiaMes: imunidade a fuso horário (-03:00 Brasília), preservando dia e mês exatos', () => {
      // 2026-11-10 não pode virar 09/11 por recuo de fuso horário
      assert.equal(formatarDiaMes('2026-11-10'), '10/11');
      assert.equal(formatarDiaMes('2026-01-01'), '01/01');
      assert.equal(formatarDiaMes('2026-12-31'), '31/12');
      assert.equal(formatarDiaMes(''), '');
      assert.equal(formatarDiaMes(null), '');
      assert.equal(formatarDiaMes(undefined), '');
    });

    it('ehUrlSegura: deve aceitar estritamente protocolos http e https e rejeitar javascript: ou maliciosos', () => {
      assert.equal(ehUrlSegura('https://flights.google.com/test'), true);
      assert.equal(ehUrlSegura('http://localhost:3000'), true);
      assert.equal(ehUrlSegura('HTTPS://WWW.GOOGLE.COM'), true);
      assert.equal(ehUrlSegura('javascript:alert("xss")'), false);
      assert.equal(ehUrlSegura('data:text/html,<script>alert(1)</script>'), false);
      assert.equal(ehUrlSegura('ftp://servidor.com'), false);
      assert.equal(ehUrlSegura(''), false);
      assert.equal(ehUrlSegura(null), false);
      assert.equal(ehUrlSegura(undefined), false);
    });
  });

  describe('Badge de Meta / Teto em R$', () => {
    it('deve renderizar badge de meta batida quando preco_atual <= preco_alvo', () => {
      const rota = {
        preco_alvo: 3500,
        preco_atual: 2900
      };
      const html = renderizarBadgeMeta(rota);
      assert.ok(html.includes('badge-meta-batida'), 'Deve ter classe de meta batida');
      assert.ok(html.includes('Economia de R$ 600'), 'Deve exibir cálculo da economia em R$');
    });

    it('deve renderizar badge de meta comum quando preco_atual > preco_alvo', () => {
      const rota = {
        preco_alvo: 3000,
        preco_atual: 3400
      };
      const html = renderizarBadgeMeta(rota);
      assert.ok(!html.includes('badge-meta-batida'));
      assert.ok(html.includes('🎯 Meta: R$ 3.000'));
    });

    it('deve retornar string vazia quando rota não possui preco_alvo', () => {
      const rota = { preco_alvo: null, preco_atual: 2500 };
      assert.equal(renderizarBadgeMeta(rota), '');
    });
  });

  describe('Badges de Filtros fast-flights (Blindagem de Falsy)', () => {
    it('max_stops === 0 DEVE renderizar badge de voo direto (não pode cair em falsy null)', () => {
      const rota = { max_stops: 0 };
      const html = renderizarBadgesFiltros(rota);
      assert.ok(html.includes('✈️ Voo Direto'), 'max_stops: 0 deve ser interpretado como Voo Direto');
    });

    it('max_stops === 1 deve renderizar badge de 1 parada máxima', () => {
      const rota = { max_stops: 1 };
      const html = renderizarBadgesFiltros(rota);
      assert.ok(html.includes('1 Parada máx.'));
    });

    it('carry_on_bags === 1 deve renderizar badge de mala de mão inclusa', () => {
      const rota = { carry_on_bags: 1 };
      const html = renderizarBadgesFiltros(rota);
      assert.ok(html.includes('🧳 Mala de mão inclusa'));
    });

    it('deve combinar múltiplos filtros simultâneos', () => {
      const rota = { max_stops: 0, carry_on_bags: 1 };
      const html = renderizarBadgesFiltros(rota);
      assert.ok(html.includes('✈️ Voo Direto'));
      assert.ok(html.includes('🧳 Mala de mão inclusa'));
    });

    it('max_stops null ou undefined não deve exibir badge de paradas', () => {
      const rota = { max_stops: null, carry_on_bags: 0 };
      const html = renderizarBadgesFiltros(rota);
      assert.equal(html, '');
    });
  });

  describe('Horários, Conexão e Trade-off Direto/Rápido', () => {
    it('deve renderizar linha de horários com número do voo e tempo de conexão', () => {
      const rota = {
        horario_partida: '07:15',
        horario_chegada: '18:30',
        numero_voo: 'G3 1542',
        tempo_conexao: '1h 45min'
      };
      const html = renderizarLinhaHorarios(rota);
      assert.ok(html.includes('07:15 ➔ 18:30'));
      assert.ok(html.includes('G3 1542'));
      assert.ok(html.includes('⏱️ Espera: 1h 45min'));
    });

    it('deve retornar vazio quando horários não estão disponíveis', () => {
      const rota = { horario_partida: null, horario_chegada: null };
      assert.equal(renderizarLinhaHorarios(rota), '');
    });

    it('deve renderizar card-tradeoff quando melhor_opcao_direta_rapida está presente', () => {
      const rota = {
        melhor_opcao_direta_rapida: {
          preco: 1490,
          diferencaPreco: 290,
          economiaHoras: 3.5,
          cia: 'GOL'
        }
      };
      const html = renderizarTradeOff(rota);
      assert.ok(html.includes('⚡ Opção Direta/Rápida'));
      assert.ok(html.includes('R$ 1.490'));
      assert.ok(html.includes('+R$ 290 para economizar <strong>3.5h</strong> de viagem'));
    });
  });

  describe('Renderização Completa do Card de Rota (Zero Milhas)', () => {
    it('deve gerar HTML completo com dados do voo, sem menção a milhas', () => {
      const rota = {
        id: 42,
        origem: 'São Paulo (GRU)',
        destino: 'Lisboa (LIS)',
        data_ida: '2026-11-15',
        data_volta: '2026-11-29',
        preco_atual: 3200,
        preco_alvo: 3800,
        menor_preco_historico: 3100,
        termometro: '🟢 Menor preço dos últimos 30 dias',
        max_stops: 0,
        carry_on_bags: 1,
        horario_partida: '20:30',
        horario_chegada: '10:00',
        numero_voo: 'TP 88',
        link_google_flights: 'https://flights.google.com/test'
      };

      const html = renderizarCardRota(rota);

      // Verificações essenciais
      assert.ok(html.includes('data-id="42"'));
      assert.ok(html.includes('São Paulo (GRU)'));
      assert.ok(html.includes('Lisboa (LIS)'));
      assert.ok(html.includes('R$ 3.200'));
      assert.ok(html.includes('🎯 Meta Batida'));
      assert.ok(html.includes('✈️ Voo Direto'));
      assert.ok(html.includes('🧳 Mala de mão inclusa'));
      assert.ok(html.includes('20:30 ➔ 10:00'));
      assert.ok(html.includes('TP 88'));

      // Proibição de milhas no card do Cockpit
      assert.ok(!html.toLowerCase().includes('milhas'), 'Card não deve conter referências a milhas');
      assert.ok(!html.toLowerCase().includes('smiles'), 'Card não deve conter programa de milhas');
      assert.ok(!html.toLowerCase().includes('paridade'), 'Card não deve conter paridade de milhas');
    });

    it('deve proteger contra XSS em campos de texto da rota', () => {
      const rotaMaliciosa = {
        id: 99,
        origem: '<img src=x onerror=alert(1)>Rio',
        destino: '<b>Paris</b>',
        termometro: '"><script>bad()</script>'
      };

      const html = renderizarCardRota(rotaMaliciosa);
      assert.ok(!html.includes('<img src=x'), 'Deve escapar tags HTML injetadas na origem');
      assert.ok(!html.includes('<script>'), 'Deve escapar tags de script no termômetro');
      assert.ok(html.includes('&lt;b&gt;Paris&lt;/b&gt;'), 'Deve escapar tags no destino');
    });

    it('deve renderizar card completo com badge de termômetro, badge flexível, callout e gráfico SVG', () => {
      const rotaCompleta = {
        id: 101,
        origem: 'São Paulo (GRU)',
        destino: 'Nova York (JFK)',
        data_ida: '2026-11-10',
        data_volta: '2026-11-20',
        preco_atual: 2900,
        preco_alvo: 3500,
        menor_preco_historico: 2800,
        dias_flexiveis: 2,
        price_insights: {
          nivel: 'baixo',
          faixaMinima: 3200,
          faixaMaxima: 4500
        },
        melhor_data_alternativa: {
          offset: 1,
          dataIda: '2026-11-11',
          dataVolta: '2026-11-21',
          preco: 2500,
          economiaReais: 400,
          economiaPercentual: 14,
          linkGoogleFlights: 'https://flights.google.com/test-alt'
        },
        calendario_precos: [
          { offset: -2, dataIda: '2026-11-08', preco: 3100 },
          { offset: -1, dataIda: '2026-11-09', preco: 2950 },
          { offset: 0, dataIda: '2026-11-10', preco: 2900 },
          { offset: 1, dataIda: '2026-11-11', preco: 2500 },
          { offset: 2, dataIda: '2026-11-12', preco: 3200 }
        ]
      };

      const html = renderizarCardRota(rotaCompleta);

      // Badges
      assert.ok(html.includes('badge-termometro-baixo'), 'Deve conter classe do termômetro baixo');
      assert.ok(html.includes('🟢 Preço Baixo'), 'Deve conter texto do termômetro');
      assert.ok(html.includes('R$ 3.200 – R$ 4.500'), 'Deve exibir faixa típica');
      assert.ok(html.includes('📅 ±2d'), 'Deve conter badge de janela flexível ativa');

      // Callout data alternativa
      assert.ok(html.includes('card-data-alternativa'), 'Deve conter container do callout');
      assert.ok(html.includes('Dia Vizinho Mais Barato (+1d)'), 'Deve conter tag da melhor data vizinha');
      assert.ok(html.includes('11/11 ➔ 21/11'), 'Deve formatar datas com imunidade a fuso horário');
      assert.ok(html.includes('R$ 2.500'), 'Deve conter preço da melhor data');
      assert.ok(html.includes('-R$ 400 (-14%)'), 'Deve exibir economia');
      assert.ok(html.includes('href="https://flights.google.com/test-alt"'), 'Deve conter link seguro');

      // Gráfico SVG
      assert.ok(html.includes('role="img"'), 'SVG deve conter atributo role="img"');
      assert.ok(html.includes('aria-label="Gráfico de preços da janela flexível"'), 'SVG deve conter aria-label');
      assert.ok(html.includes('fill="#10b981"'), 'Menor preço deve estar destacado em verde esmeralda');
      assert.ok(html.includes('fill="#38bdf8"'), 'Data base (offset 0) deve estar destacada');
    });

    it('compatibilidade dual: deve aceitar chaves camelCase nos objetos da rota', () => {
      const rotaCamel = {
        id: 102,
        origem: 'Brasília (BSB)',
        destino: 'Lisboa (LIS)',
        data_ida: '2026-12-01',
        preco_atual: 3600,
        diasFlexiveis: 1,
        priceInsights: {
          nivel: 'tipico',
          faixa_minima: 3400,
          faixa_maxima: 4200
        },
        melhorDataAlternativa: {
          offset: -1,
          data_ida: '2026-11-30',
          preco: 3200,
          economia_reais: 400,
          economia_percentual: 11
        },
        calendarioPrecos: [
          { offset: -1, data_ida: '2026-11-30', preco: 3200 },
          { offset: 0, data_ida: '2026-12-01', preco: 3600 }
        ]
      };

      const html = renderizarCardRota(rotaCamel);
      assert.ok(html.includes('badge-termometro-tipico'), 'Deve processar priceInsights camelCase');
      assert.ok(html.includes('📅 ±1d'), 'Deve processar diasFlexiveis camelCase');
      assert.ok(html.includes('card-data-alternativa'), 'Deve processar melhorDataAlternativa camelCase');
      assert.ok(html.includes('grafico-calendario'), 'Deve processar calendarioPrecos camelCase');
    });
  });

  describe('Badge do Termômetro Google (renderizarBadgeTermometro)', () => {
    it('deve renderizar badge verde para nível baixo', () => {
      const html = renderizarBadgeTermometro({ nivel: 'baixo', faixaMinima: 2000, faixaMaxima: 3000 });
      assert.ok(html.includes('badge-termometro-baixo'));
      assert.ok(html.includes('🟢 Preço Baixo'));
      assert.ok(html.includes('R$ 2.000 – R$ 3.000'));
    });

    it('deve renderizar badge amarela para nível típico', () => {
      const html = renderizarBadgeTermometro({ nivel: 'tipico' });
      assert.ok(html.includes('badge-termometro-tipico'));
      assert.ok(html.includes('🟡 Preço Típico'));
    });

    it('deve renderizar badge vermelha para nível alto', () => {
      const html = renderizarBadgeTermometro({ nivel: 'alto' });
      assert.ok(html.includes('badge-termometro-alto'));
      assert.ok(html.includes('🔴 Preço Alto'));
    });

    it('deve retornar string vazia para nível nulo, indefinido ou inválido', () => {
      assert.equal(renderizarBadgeTermometro(null), '');
      assert.equal(renderizarBadgeTermometro({}), '');
      assert.equal(renderizarBadgeTermometro({ nivel: 'desconhecido' }), '');
    });
  });

  describe('Badge de Janela Flexível (renderizarBadgeJanelaFlex)', () => {
    it('deve renderizar badge quando diasFlex > 0', () => {
      assert.ok(renderizarBadgeJanelaFlex(1).includes('📅 ±1d'));
      assert.ok(renderizarBadgeJanelaFlex(3).includes('📅 ±3d'));
    });

    it('deve retornar vazio quando diasFlex === 0 ou nulo', () => {
      assert.equal(renderizarBadgeJanelaFlex(0), '');
      assert.equal(renderizarBadgeJanelaFlex(null), '');
      assert.equal(renderizarBadgeJanelaFlex(undefined), '');
    });
  });

  describe('Callout de Melhor Data Alternativa (renderizarCalloutDataAlternativa)', () => {
    it('deve renderizar callout quando há economia positiva', () => {
      const alt = {
        offset: 2,
        dataIda: '2026-11-15',
        dataVolta: '2026-11-25',
        preco: 1800,
        economiaReais: 500,
        economiaPercentual: 22,
        linkGoogleFlights: 'https://flights.google.com/test'
      };
      const html = renderizarCalloutDataAlternativa(alt);
      assert.ok(html.includes('Dia Vizinho Mais Barato (+2d)'));
      assert.ok(html.includes('15/11 ➔ 25/11'));
      assert.ok(html.includes('R$ 1.800'));
      assert.ok(html.includes('-R$ 500 (-22%)'));
      assert.ok(html.includes('href="https://flights.google.com/test"'));
    });

    it('deve bloquear injeção XSS de links javascript: ou protocolos inseguros no callout', () => {
      const altInseguro = {
        offset: -1,
        dataIda: '2026-11-10',
        preco: 1500,
        economiaReais: 200,
        linkGoogleFlights: 'javascript:alert(document.cookie)'
      };
      const html = renderizarCalloutDataAlternativa(altInseguro);
      assert.ok(!html.includes('javascript:'), 'Não pode conter href javascript');
      assert.ok(!html.includes('Ver voo alternativo'), 'Não deve exibir o link para protocolo inválido');
    });

    it('deve retornar vazio se economiaReais for zero ou nulo', () => {
      assert.equal(renderizarCalloutDataAlternativa({ economiaReais: 0 }), '');
      assert.equal(renderizarCalloutDataAlternativa(null), '');
    });
  });

  describe('Mini-Gráfico SVG da Janela Flexível (renderizarGraficoCalendarioSvg)', () => {
    it('deve renderizar gráfico SVG acessível com destaques visualmente corretos', () => {
      const calendario = [
        { offset: -1, dataIda: '2026-11-09', preco: 2200 },
        { offset: 0, dataIda: '2026-11-10', preco: 2500 },
        { offset: 1, dataIda: '2026-11-11', preco: 1900 }
      ];

      const html = renderizarGraficoCalendarioSvg(calendario, 2500);

      assert.ok(html.includes('<svg role="img" aria-label="Gráfico de preços da janela flexível"'),
        'SVG deve possuir papel e rótulo semântico acessível');
      assert.ok(html.includes('fill="#10b981"'), 'Menor preço (1900) deve estar destacado em verde esmeralda');
      assert.ok(html.includes('fill="#38bdf8"'), 'Data base (offset 0) deve estar destacada');
      assert.ok(html.includes('09/11'), 'Data deve estar formatada como DD/MM');
      assert.ok(html.includes('10/11'), 'Data deve estar formatada como DD/MM');
      assert.ok(html.includes('11/11'), 'Data deve estar formatada como DD/MM');
    });

    it('imunidade a divisão por zero: quando todos os preços forem exatamente iguais, não deve conter NaN', () => {
      const calendarioIguais = [
        { offset: -1, dataIda: '2026-11-09', preco: 2000 },
        { offset: 0, dataIda: '2026-11-10', preco: 2000 },
        { offset: 1, dataIda: '2026-11-11', preco: 2000 }
      ];

      const html = renderizarGraficoCalendarioSvg(calendarioIguais, 2000);

      assert.ok(!html.includes('NaN'), 'Coordenadas do SVG não podem conter NaN');
      assert.ok(!html.includes('Infinity'), 'Coordenadas do SVG não podem conter Infinity');
      assert.ok(html.includes('<rect'), 'Deve renderizar barras retangulares normalmente');
    });

    it('deve retornar string vazia quando houver menos de 2 itens válidos', () => {
      assert.equal(renderizarGraficoCalendarioSvg([]), '');
      assert.equal(renderizarGraficoCalendarioSvg([{ offset: 0, dataIda: '2026-11-10', preco: 2000 }]), '');
      assert.equal(renderizarGraficoCalendarioSvg(null), '');
      assert.equal(renderizarGraficoCalendarioSvg([
        { offset: 0, dataIda: '2026-11-10', preco: 0 },
        { offset: 1, dataIda: '2026-11-11', preco: -50 }
      ]), '');
    });
  });

  describe('Ranking de Destinos Regionais Multi-Hub (renderizarRankingDestinosRegionais)', () => {
    it('deve renderizar destaque do vencedor e mini-ranking ordenado com links seguros', () => {
      const ranking = [
        {
          destinoIata: 'LIS',
          nomeCidade: 'Lisboa',
          preco: 3120,
          cia: 'TAP Air Portugal',
          escalas: 0,
          duracaoTexto: '10.0h',
          linkGoogleFlights: 'https://flights.google.com/lis'
        },
        {
          destinoIata: 'MAD',
          nomeCidade: 'Madri',
          preco: 3390,
          cia: 'Iberia',
          escalas: 0,
          duracaoTexto: '11.0h',
          linkGoogleFlights: 'https://flights.google.com/mad'
        },
        {
          destinoIata: 'MXP',
          nomeCidade: 'Milão',
          preco: 3510,
          cia: 'LATAM',
          escalas: 1,
          duracaoTexto: '13.5h',
          linkGoogleFlights: 'https://flights.google.com/mxp'
        }
      ];

      const html = renderizarRankingDestinosRegionais(ranking);
      assert.ok(html.includes('data-testid="ranking-destinos-regionais"'), 'Deve conter o container de ranking');
      assert.ok(html.includes('Melhor destino na região:'), 'Deve destacar texto de melhor destino');
      assert.ok(html.includes('Lisboa (LIS)'), 'Deve conter nome e IATA do vencedor');
      assert.ok(html.includes('R$ 3.120'), 'Deve exibir preço do vencedor formatado em R$');
      assert.ok(html.includes('Madri (MAD)'), 'Deve listar 2º colocado');
      assert.ok(html.includes('R$ 3.390'), 'Deve exibir preço do 2º colocado');
      assert.ok(html.includes('href="https://flights.google.com/lis"'), 'Deve incluir link seguro do Google Flights');
      assert.ok(html.includes('href="https://flights.google.com/mad"'), 'Deve incluir link seguro do 2º colocado');
    });

    it('blindagem XSS: deve escapar caracteres perigosos no nome da cidade e IATA', () => {
      const rankingXss = [
        {
          destinoIata: '<script>',
          nomeCidade: '<b>Hacked</b>',
          preco: 2500,
          linkGoogleFlights: 'javascript:alert(1)'
        }
      ];

      const html = renderizarRankingDestinosRegionais(rankingXss);
      assert.ok(!html.includes('<script>'), 'Não deve conter tags script');
      assert.ok(html.includes('&lt;b&gt;Hacked&lt;/b&gt;'), 'Deve escapar tags HTML do nome da cidade');
      assert.ok(html.includes('&lt;script&gt;'), 'Deve escapar tags do IATA');
      assert.ok(!html.includes('href="javascript:'), 'Não deve permitir protocolo javascript:');
    });

    it('deve retornar string vazia para entradas nulas, indefinidas ou arrays vazios', () => {
      assert.strictEqual(renderizarRankingDestinosRegionais(null), '');
      assert.strictEqual(renderizarRankingDestinosRegionais(undefined), '');
      assert.strictEqual(renderizarRankingDestinosRegionais([]), '');
      assert.strictEqual(renderizarRankingDestinosRegionais('invalido'), '');
    });

    it('renderizarCardRota: deve incluir a seção de ranking regional quando a rota contiver ranking_destinos_regionais', () => {
      const rotaComRanking = {
        id: 42,
        origem: 'São Paulo',
        destino: 'Europa',
        codigo_origem: 'GRU',
        codigo_destino: 'EUR',
        preco_atual: 3120,
        ranking_destinos_regionais: [
          { destinoIata: 'LIS', nomeCidade: 'Lisboa', preco: 3120, linkGoogleFlights: 'https://flights.google.com/lis' },
          { destinoIata: 'MAD', nomeCidade: 'Madri', preco: 3390, linkGoogleFlights: 'https://flights.google.com/mad' }
        ]
      };

      const cardHtml = renderizarCardRota(rotaComRanking);
      assert.ok(cardHtml.includes('data-testid="ranking-destinos-regionais"'), 'Card deve renderizar ranking de destinos');
      assert.ok(cardHtml.includes('Lisboa (LIS)'));
    });
  });

  describe('Correções de Produção: Subtítulo Ida e Volta e Prevenção de () vazio', () => {
    it('Bug 3: renderizarCardRota NUNCA deve renderizar badge ou termômetro com "()" vazio', () => {
      const rotaComParentesesVazio = {
        id: 99,
        origem: 'São Paulo',
        destino: 'Lisboa',
        preco_atual: 3500,
        termometro: '🔥 Menor Preço Flexível ()'
      };

      const html = renderizarCardRota(rotaComParentesesVazio);
      assert.ok(!html.includes('()'), 'Card nunca deve renderizar parênteses vazios "()"');
      assert.ok(html.includes('🔥 Menor Preço Flexível'), 'Deve preservar o texto do termômetro sem "()"');
    });

    it('Bug 3 & 4: subtítulo em modo Flexível (sem_data=1) deve exibir período de Ida e Volta (10/11 a 20/11 ou 2026-11-10 ➔ 2026-11-20 (10d)) quando for Ida e Volta', () => {
      const rotaFlexIdaVolta = {
        id: 101,
        origem: 'São Paulo',
        destino: 'Lisboa',
        sem_data: 1,
        data_ida: '2026-11-10',
        data_volta: '2026-11-20',
        dias_estadia: 10,
        preco_atual: 3500
      };

      const html = renderizarCardRota(rotaFlexIdaVolta);
      assert.ok(!html.includes('(Só Ida)'), 'Rota de Ida e Volta flexível não pode exibir (Só Ida)');
      assert.ok(html.includes('2026-11-10') && (html.includes('2026-11-20') || html.includes('10d')), 'Subtítulo deve exibir período completo de Ida e Volta');
    });

    it('Bug 4: subtítulo em data fixa não deve cair em "(Só Ida)" se a rota for de Ida e Volta com estadia padrão', () => {
      const rotaSemVoltaExplicita = {
        id: 102,
        origem: 'São Paulo',
        destino: 'Santiago',
        sem_data: 0,
        data_ida: '2026-11-10',
        data_volta: null,
        dias_estadia: 10,
        preco_atual: 1500
      };

      const html = renderizarCardRota(rotaSemVoltaExplicita);
      assert.ok(!html.includes('(Só Ida)'), 'Rota com estadia de 10 dias não deve cair em (Só Ida)');
      assert.ok(html.includes('2026-11-20') || html.includes('10d'), 'Deve calcular e exibir data de volta ou dias de estadia');
    });

    it('subtítulo DEVE exibir "(Só Ida)" se a rota for estritamente só ida', () => {
      const rotaSoIdaReal = {
        id: 103,
        origem: 'Rio de Janeiro',
        destino: 'Belém',
        tipo_viagem: 'one_way',
        sem_data: 0,
        data_ida: '2027-01-17',
        data_volta: null
      };

      const html = renderizarCardRota(rotaSoIdaReal);
      assert.ok(html.includes('(Só Ida)'), 'Rota configurada como one_way deve exibir (Só Ida)');
    });
  });
});

