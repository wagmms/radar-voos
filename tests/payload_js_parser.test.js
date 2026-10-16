/**
 * Testes unitários para extrairVoosDoPayloadJs (Padrão fast-flights v3.0)
 * Extração de dados nativos via payload JSON script.ds:1 / AF_initDataCallback
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairVoosDoPayloadJs,
  extrairVoosDoHtml,
  formatarHorarioTrecho,
  formatarDataTrecho,
  calcularDiasExtrasChegada,
  extrairEmissoesCarbono,
  calcularTempoConexaoTrechos
} from '../src/services/providers/scrapling_client.js';

// Fixture mockada simulando a resposta real do Google Flights com script.ds:1
const MOCK_HTML_DS1_VALIDO = `
<html>
<head>
  <script class="ds:1">
    AF_initDataCallback({
      key: 'ds:1',
      hash: '9',
      data: [
        null,
        null,
        [
          [
            [
              ["LA", ["LATAM"], [
                [null, null, null, "GRU", "Guarulhos", "Jorge Chavez", "LIM", null, [3, 35], null, [6, 45], null, null, null, null, null, null, "Airbus A321", null, null, [2026, 11, 10], [2026, 11, 10], ["LA", "8004", null, "LATAM"]],
                [null, null, null, "LIM", "Jorge Chavez", "Miami Intl", "MIA", null, [8, 20], null, [14, 15], null, null, null, null, null, null, "Airbus A320", null, null, [2026, 11, 10], [2026, 11, 10], ["LA", "2990", null, "LATAM"]]
              ], "GRU", null, null, "MIA", null, null, 760],
              [[null, 3714]]
            ],
            [
              ["G3", ["GOL"], [
                [null, null, null, "GRU", "Guarulhos", "Miami Intl", "MIA", null, [9, 0], null, [17, 30], null, null, null, null, null, null, "Boeing 737", null, null, [2026, 11, 10], [2026, 11, 10], ["G3", "7710", null, "GOL"]]
              ], "GRU", null, null, "MIA", null, null, 510],
              [[null, 4120]]
            ]
          ]
        ],
        [
          [
            [
              ["AA", ["American Airlines"], [
                [null, null, null, "GRU", "Guarulhos", "Miami Intl", "MIA", null, [22, 10], null, [6, 35], null, null, null, null, null, null, "Boeing 777", null, null, [2026, 11, 10], [2026, 11, 11], ["AA", "906", null, "American Airlines"]]
              ], "GRU", null, null, "MIA", null, null, 505],
              [[null, 4550]]
            ]
          ]
        ]
      ],
      sideChannel: {}
    });
  </script>
</head>
<body><h1>Google Flights Mock</h1></body>
</html>
`;

const MOCK_HTML_DS1_ERROR_STATUS = `
<html>
  <script class="ds:1">
    AF_initDataCallback({
      key: 'ds:1',
      data: [],
      errorHasStatus: true
    });
  </script>
</html>
`;

const MOCK_HTML_DS1_CORROMPIDO = `
<html>
  <script class="ds:1">
    AF_initDataCallback({
      key: 'ds:1',
      data: [invalido_json_nao_parseavel...
  </script>
</html>
`;

describe('Fast-Flights Engine: extrairVoosDoPayloadJs (script.ds:1)', () => {
  it('inclui other_flights válido e ignora preço solto de rodapé', () => {
    const trecho = (origem, destino, partida, chegada, codigo, numero) => [
      null, null, null, origem, '', '', destino, null, partida, null, chegada,
      null, null, null, null, null, null, '', null, null,
      [2027, 2, 10], [2027, 2, 10], [codigo, numero, null, codigo]
    ];
    const direto = [["G3", ["GOL"], [trecho('GRU', 'SSA', [7, 50], [11, 30], 'G3', '2006')], 'GRU', null, null, 'SSA', null, null, 220], [[null, 1002]]];
    const conexao = [["LA", ["LATAM"], [
      trecho('GRU', 'BSB', [6, 0], [7, 30], 'LA', '3001'),
      trecho('BSB', 'SSA', [9, 0], [11, 0], 'LA', '3002')
    ], 'GRU', null, null, 'SSA', null, null, 300], [[null, 540]]];
    const data = [null, null, [[direto], [conexao, [[null, 199]]]]];
    const html = `<script class="ds:1">AF_initDataCallback({key:'ds:1',data:${JSON.stringify(data)},sideChannel:{}});</script>`;

    const voos = extrairVoosDoPayloadJs(html);
    assert.deepEqual(voos.map(v => v.preco), [1002, 540]);
    assert.equal(voos[1].escalas, 1);
    assert.equal(voos[1].isBest, false);
    assert.equal(voos[1].aeroportoConexao, 'BSB');
  });

  it('deve extrair voos estruturados diretamente do payload JSON nativo ds:1', () => {
    const voos = extrairVoosDoPayloadJs(MOCK_HTML_DS1_VALIDO);
    assert.ok(Array.isArray(voos));
    assert.equal(voos.length, 3, 'Deve extrair os 3 voos dos grupos 2 e 3');

    // 1. Voo LATAM com conexão em Lima
    const latam = voos[0];
    assert.equal(latam.preco, 3714);
    assert.equal(latam.cia, 'LATAM');
    assert.equal(latam.numeroVoo, 'LA 8004');
    assert.equal(latam.horarioPartida, '03:35');
    assert.equal(latam.horarioChegada, '14:15');
    assert.equal(latam.escalas, 1);
    assert.equal(latam.aeroportoConexao, 'LIM');
    assert.equal(latam.tempoConexao, '1h 35min');
    assert.equal(latam.tempoConexaoMinutos, 95);
    assert.equal(latam.isBest, true);
    assert.ok(latam.detalhesEscalas.includes('1 parada em LIM'));
    assert.equal(latam.duracaoHoras, 12.7);
    assert.equal(latam.duracaoTexto, '12 h 40 min');

    // 2. Voo GOL direto
    const gol = voos[1];
    assert.equal(gol.preco, 4120);
    assert.equal(gol.cia, 'GOL');
    assert.equal(gol.numeroVoo, 'G3 7710');
    assert.equal(gol.horarioPartida, '09:00');
    assert.equal(gol.horarioChegada, '17:30');
    assert.equal(gol.escalas, 0);
    assert.equal(gol.detalhesEscalas, 'Direto');
    assert.equal(gol.aeroportoConexao, null);
    assert.equal(gol.tempoConexao, null);
    assert.equal(gol.tempoConexaoMinutos, null);
    assert.equal(gol.isBest, true);
    assert.equal(gol.duracaoHoras, 8.5);
    assert.equal(gol.duracaoTexto, '8 h 30 min');

    // 3. Voo American Airlines direto do grupo restante (isBest: false)
    const aa = voos[2];
    assert.equal(aa.preco, 4550);
    assert.equal(aa.cia, 'American Airlines');
    assert.equal(aa.numeroVoo, 'AA 906');
    assert.equal(aa.horarioPartida, '22:10');
    assert.equal(aa.horarioChegada, '06:35');
    assert.equal(aa.escalas, 0);
    assert.equal(aa.tempoConexao, null);
    assert.equal(aa.tempoConexaoMinutos, null);
    assert.equal(aa.isBest, false);
    assert.equal(aa.duracaoHoras, 8.4);
    assert.equal(aa.duracaoTexto, '8 h 25 min');
  });

  it('deve lidar com fallback seguro (null) quando legs estão incompletos ou simplificados', () => {
    const htmlSimplificado = `
      <script class="ds:1">
        AF_initDataCallback({
          key: 'ds:1',
          data: [null, null, [
            [
              [["LA", ["LATAM"], [[null, null, null, "GRU", "", "", "MIA"]], "GRU", null, null, "MIA", null, null, 500], [[null, 1500]]]
            ]
          ]],
          sideChannel: {}
        });
      </script>
    `;
    const voos = extrairVoosDoPayloadJs(htmlSimplificado);
    assert.equal(voos.length, 1);
    const v = voos[0];
    assert.equal(v.preco, 1500);
    assert.equal(v.horarioPartida, null);
    assert.equal(v.horarioChegada, null);
    assert.equal(v.numeroVoo, null);
    assert.equal(v.tempoConexao, null);
    assert.equal(v.tempoConexaoMinutos, null);
    assert.equal(v.isBest, true);
  });

  it('deve retornar array vazio para HTML sem tag script ds:1 ou nulo', () => {
    assert.deepEqual(extrairVoosDoPayloadJs(null), []);
    assert.deepEqual(extrairVoosDoPayloadJs(undefined), []);
    assert.deepEqual(extrairVoosDoPayloadJs(''), []);
    assert.deepEqual(extrairVoosDoPayloadJs('<html><body>sem script</body></html>'), []);
  });

  it('deve ignorar graciosamente payloads com errorHasStatus: true', () => {
    const voos = extrairVoosDoPayloadJs(MOCK_HTML_DS1_ERROR_STATUS);
    assert.deepEqual(voos, []);
  });

  it('deve lidar defensivamente com script contendo JSON corrompido sem estourar exceção', () => {
    const voos = extrairVoosDoPayloadJs(MOCK_HTML_DS1_CORROMPIDO);
    assert.deepEqual(voos, []);
  });

  it('deve filtrar tarifas fora do limite aceitável (< 80 ou > 60000)', () => {
    const htmlPrecosExtremos = `
      <script class="ds:1">
        AF_initDataCallback({
          key: 'ds:1',
          data: [null, null, [
            [
              [["LA", ["LATAM"], [[null, null, null, "GRU", "", "", "MIA"]], "GRU", null, null, "MIA", null, null, 500], [[null, 50]]],
              [["G3", ["GOL"], [[null, null, null, "GRU", "", "", "MIA"]], "GRU", null, null, "MIA", null, null, 500], [[null, 99000]]]
            ]
          ]],
          sideChannel: {}
        });
      </script>
    `;
    const voos = extrairVoosDoPayloadJs(htmlPrecosExtremos);
    assert.equal(voos.length, 0, 'Deve ignorar tarifas anômalas R$ 50 e R$ 99.000');
  });

  it('extrairVoosDoHtml: Camada 0 (Payload JS) deve ter precedência máxima sobre regex de aria-label', () => {
    // HTML que possui tanto o script ds:1 (com R$ 3.714) quanto um aria-label falso/antigo (com R$ 8.900)
    const htmlMisto = `
      <html>
        <div aria-label="Preço total a partir de 8.900 Reais brasileiros. Voo caro."></div>
        ${MOCK_HTML_DS1_VALIDO}
      </html>
    `;
    const voos = extrairVoosDoHtml(htmlMisto);
    assert.ok(voos.length >= 1);
    // Deve retornar o preço exato do script ds:1 (3714), provando a precedência da Camada 0
    assert.equal(voos[0].preco, 3714);
    assert.equal(voos[0].cia, 'LATAM');
  });

  describe('extrairPriceInsightsDoPayloadJs: Termômetro Nativo de Preços', () => {
    it('deve extrair nivel "baixo" e faixa típica a partir do script ds:1 com payload[5]', async () => {
      const { extrairPriceInsightsDoPayloadJs } = await import('../src/services/providers/scrapling_client.js');
      const htmlComInsights = `
        <script class="ds:1">
          AF_initDataCallback({
            key: 'ds:1',
            data: [
              null,
              null,
              [],
              [],
              null,
              [
                [3100, 4250],
                1
              ]
            ],
            sideChannel: {}
          });
        </script>
      `;

      const insights = extrairPriceInsightsDoPayloadJs(htmlComInsights);
      assert.ok(insights, 'Deve retornar objeto de insights');
      assert.strictEqual(insights.nivel, 'baixo');
      assert.strictEqual(insights.faixaMinima, 3100);
      assert.strictEqual(insights.faixaMaxima, 4250);
    });

    it('deve interpretar níveis textuais "TYPICAL" / "tipico" e "HIGH" / "alto"', async () => {
      const { extrairPriceInsightsDoPayloadJs } = await import('../src/services/providers/scrapling_client.js');

      // Teste com array direto do payload
      const payloadTipico = [
        null, null, [], [], null,
        [ [2500, 3800], 'TYPICAL' ]
      ];
      const resTipico = extrairPriceInsightsDoPayloadJs(payloadTipico);
      assert.strictEqual(resTipico?.nivel, 'tipico');
      assert.strictEqual(resTipico?.faixaMinima, 2500);
      assert.strictEqual(resTipico?.faixaMaxima, 3800);

      const payloadAlto = [
        null, null, [], [], null,
        [ [2000, 2900], 3 ]
      ];
      const resAlto = extrairPriceInsightsDoPayloadJs(payloadAlto);
      assert.strictEqual(resAlto?.nivel, 'alto');
      assert.strictEqual(resAlto?.faixaMinima, 2000);
      assert.strictEqual(resAlto?.faixaMaxima, 2900);
    });

    it('deve retornar null de forma 100% segura quando não há insights de preço no payload', async () => {
      const { extrairPriceInsightsDoPayloadJs } = await import('../src/services/providers/scrapling_client.js');
      assert.strictEqual(extrairPriceInsightsDoPayloadJs(null), null);
      assert.strictEqual(extrairPriceInsightsDoPayloadJs(''), null);
      assert.strictEqual(extrairPriceInsightsDoPayloadJs(MOCK_HTML_DS1_VALIDO), null);
      assert.strictEqual(extrairPriceInsightsDoPayloadJs(MOCK_HTML_DS1_CORROMPIDO), null);
    });
  });

  describe('Blindagem Cambial: Conversão Defensiva de Moeda (USD -> BRL)', () => {
    it('deve converter voo com tupla ["USD", 400] para R$ 2320 (taxa 5.80) e registrar moedaOriginal: "USD"', () => {
      const htmlDs1Usd = `
        <script class="ds:1">
          AF_initDataCallback({
            key: 'ds:1',
            data: [
              null,
              null,
              [
                [
                  [
                    ["AA", ["American Airlines"], [[null, null, null, "GRU", "", "", "MIA"]], "GRU", null, null, "MIA", null, null, 500],
                    [["USD", 400]]
                  ]
                ]
              ]
            ],
            sideChannel: {}
          });
        </script>
      `;

      const voos = extrairVoosDoPayloadJs(htmlDs1Usd);
      assert.strictEqual(voos.length, 1);
      const v = voos[0];
      // 400 USD * 5.80 = 2320 BRL
      assert.strictEqual(v.preco, 2320, 'Preço deve ser convertido para 2320 BRL e NUNCA retornado como 400');
      assert.strictEqual(v.precoOriginal, 400);
      assert.strictEqual(v.moeda, 'BRL');
      assert.strictEqual(v.moedaOriginal, 'USD');
    });

    it('deve manter valor exato e moeda BRL para tupla com BRL explícito ou nulo (retrocompatibilidade)', () => {
      const htmlDs1Brl = `
        <script class="ds:1">
          AF_initDataCallback({
            key: 'ds:1',
            data: [
              null,
              null,
              [
                [
                  [
                    ["G3", ["GOL"], [[null, null, null, "GRU", "", "", "MIA"]], "GRU", null, null, "MIA", null, null, 500],
                    [["BRL", 2450]]
                  ],
                  [
                    ["LA", ["LATAM"], [[null, null, null, "GRU", "", "", "MIA"]], "GRU", null, null, "MIA", null, null, 500],
                    [[null, 1890]]
                  ]
                ]
              ]
            ],
            sideChannel: {}
          });
        </script>
      `;

      const voos = extrairVoosDoPayloadJs(htmlDs1Brl);
      assert.strictEqual(voos.length, 2);
      assert.strictEqual(voos[0].preco, 2450);
      assert.strictEqual(voos[0].moeda, 'BRL');
      assert.strictEqual(voos[0].moedaOriginal, 'BRL');

      assert.strictEqual(voos[1].preco, 1890);
      assert.strictEqual(voos[1].moeda, 'BRL');
      assert.strictEqual(voos[1].moedaOriginal, 'BRL');
    });

    it('deve converter faixas de priceInsights para BRL quando a moeda for USD', async () => {
      const { extrairPriceInsightsDoPayloadJs } = await import('../src/services/providers/scrapling_client.js');
      const htmlInsightsUsd = `
        <script class="ds:1">
          AF_initDataCallback({
            key: 'ds:1',
            data: [
              null,
              null,
              [],
              [],
              null,
              [
                [400, 600],
                "low",
                "USD"
              ]
            ],
            sideChannel: {}
          });
        </script>
      `;

      const insights = extrairPriceInsightsDoPayloadJs(htmlInsightsUsd);
      assert.ok(insights);
      assert.strictEqual(insights.nivel, 'baixo');
      // 400 * 5.80 = 2320, 600 * 5.80 = 3480
      assert.strictEqual(insights.faixaMinima, 2320);
      assert.strictEqual(insights.faixaMaxima, 3480);
      assert.strictEqual(insights.moeda, 'BRL');
      assert.strictEqual(insights.moedaOriginal, 'USD');
    });
  });

  describe('Enriquecimento Etapa 1 — Sparse Times, Datas, Aeronaves e Emissões de CO2', () => {
    it('formatarHorarioTrecho suporta Sparse Time Arrays do JSPB', () => {
      assert.strictEqual(formatarHorarioTrecho([8]), '08:00');
      assert.strictEqual(formatarHorarioTrecho([null, 31]), '00:31');
      assert.strictEqual(formatarHorarioTrecho([14, 5]), '14:05');
      assert.strictEqual(formatarHorarioTrecho([]), '00:00');
      assert.strictEqual(formatarHorarioTrecho([0, 0]), '00:00');

      // Casos inválidos
      assert.strictEqual(formatarHorarioTrecho(null), null);
      assert.strictEqual(formatarHorarioTrecho('08:00'), null);
      assert.strictEqual(formatarHorarioTrecho([24, 0]), null);
      assert.strictEqual(formatarHorarioTrecho([-1, 10]), null);
      assert.strictEqual(formatarHorarioTrecho([10, 60]), null);
      assert.strictEqual(formatarHorarioTrecho([10, 30, 0]), null);
    });

    it('calcularTempoConexaoTrechos funciona com horários esparsos ([8] e [null, 31])', () => {
      const legChegada = [];
      legChegada[10] = [null, 31]; // pousa às 00:31
      legChegada[21] = [2026, 11, 10];

      const legPartida = [];
      legPartida[8] = [8]; // decola às 08:00
      legPartida[20] = [2026, 11, 10];

      assert.strictEqual(calcularTempoConexaoTrechos(legChegada, legPartida), 449); // 7h29m = 449 min
    });

    it('formatarDataTrecho e calcularDiasExtrasChegada calculam corretamente voos noturnos (+1/+2 dias)', () => {
      assert.strictEqual(formatarDataTrecho([2026, 5, 9]), '2026-05-09');
      assert.strictEqual(formatarDataTrecho([2026, 11, 10]), '2026-11-10');
      assert.strictEqual(formatarDataTrecho([2026, 13, 10]), null);
      assert.strictEqual(formatarDataTrecho(null), null);

      assert.strictEqual(calcularDiasExtrasChegada('2026-11-10', '2026-11-10'), 0);
      assert.strictEqual(calcularDiasExtrasChegada('2026-11-10', '2026-11-11'), 1);
      assert.strictEqual(calcularDiasExtrasChegada('2026-11-10', '2026-11-12'), 2);
      assert.strictEqual(calcularDiasExtrasChegada(null, '2026-11-11'), 0);
    });

    it('extrairEmissoesCarbono converte gramas para kg e calcula variação percentual', () => {
      const flight = [];
      flight[22] = [null, null, null, null, null, null, null, 115000, 131000];

      const emissoes = extrairEmissoesCarbono(flight);
      assert.deepStrictEqual(emissoes, {
        kg: 115,
        tipicaKg: 131,
        variacaoPct: -12
      });

      assert.strictEqual(extrairEmissoesCarbono([]), null);
    });

    it('extrairVoosDoPayloadJs extrai aeronave, datas, diasExtrasChegada, emissoes e sparse times', () => {
      const leg1 = [];
      leg1[3] = 'GRU';
      leg1[6] = 'CMN';
      leg1[8] = [null, 35]; // 00:35
      leg1[10] = [13];      // 13:00
      leg1[11] = 505;
      leg1[17] = 'Boeing 787-8';
      leg1[20] = [2026, 11, 10];
      leg1[21] = [2026, 11, 10];
      leg1[22] = ['AT', '215', null, 'Royal Air Maroc'];

      const leg2 = [];
      leg2[3] = 'CMN';
      leg2[6] = 'CDG';
      leg2[8] = [16];       // 16:00
      leg2[10] = [20, 5];   // 20:05
      leg2[11] = 185;
      leg2[17] = 'Boeing 737-800';
      leg2[20] = [2026, 11, 11];
      leg2[21] = [2026, 11, 11];
      leg2[22] = ['AT', '770', null, 'Royal Air Maroc'];

      const flight = [
        'Royal Air Maroc',
        ['AT'],
        [leg1, leg2],
        null, null, null, null, null, null,
        1650
      ];
      flight[22] = [null, null, null, null, null, null, null, 580000, 650000];

      const wrapper = [flight, [[null, 3490]]];
      const data = [null, null, [[wrapper]]];
      const html = `<script class="ds:1">AF_initDataCallback({key:'ds:1',data:${JSON.stringify(data)},sideChannel:{}});</script>`;

      const voos = extrairVoosDoPayloadJs(html);
      assert.strictEqual(voos.length, 1);
      const v = voos[0];
      assert.strictEqual(v.preco, 3490);
      assert.strictEqual(v.horarioPartida, '00:35');
      assert.strictEqual(v.horarioChegada, '20:05');
      assert.strictEqual(v.dataPartida, '2026-11-10');
      assert.strictEqual(v.dataChegada, '2026-11-11');
      assert.strictEqual(v.diasExtrasChegada, 1);
      assert.strictEqual(v.aeronave, 'Boeing 787-8');
      assert.deepStrictEqual(v.aeronaves, ['Boeing 787-8', 'Boeing 737-800']);
      assert.deepStrictEqual(v.emissoes, {
        kg: 580,
        tipicaKg: 650,
        variacaoPct: -11
      });
      assert.strictEqual(v.aeroportoConexao, 'CMN');
      assert.strictEqual(v.tempoConexaoMinutos, 1620); // 27h entre 13h do dia 10 e 16h do dia 11
    });
  });
});

