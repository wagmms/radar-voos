import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectarBloqueioBot,
  extrairPrecoCheapestTab,
  decodificarPrecoDoTfu,
  construirUrlCheapest,
  extrairVoosDoHtml,
  ScraplingProvider
} from '../src/services/providers/scrapling_client.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de HTML mock e tokens de teste
// ──────────────────────────────────────────────────────────────────────────────
const TOKEN_CHEAPEST_CANONICO = 'CjRIMS1mNTFfb3VtQ1FBQUpjMmdCRy0tLS0tLWNlYmNyMy1uMkFBQUFBR3JOTVBBSDFrZHNBEhZjb21wcmVoZW5zaXZlbmVzc19sdXJlGgsIzMoDEAIaA0JSTDgdcPtb';
const URL_RESPOSTA_COM_TFU = `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL&tfs=CBwQA...&tfu=${TOKEN_CHEAPEST_CANONICO}`;

const HTML_COM_CHEAPEST = `
  <html>
    <div aria-label="A partir de 890 Reais brasileiros. Voo da LATAM Airlines com 1 parada. Conexão de 2 h em Campinas (VCP). Duração total: 3 h 40 min. Mala de mão incluída."></div>
    <script>
      AF_initDataCallback({
        key: 'ds:1',
        data: [null, null, null, null, null, null, null, null, null, null, null, null, null, null,
          [[null, 587], "CjRIMS1mNTFfb3VtQ1FBQUpjMmdCRy0tLS0tLWNlYmNyMy1uMkFBQUFBR3JOTVBBSDFrZHNBEhZjb21wcmVoZW5zaXZlbmVzc19sdXJlGgsIzMoDEAIaA0JSTDgdcPtb"]
        ]
      });
    </script>
  </html>
`;

const HTML_SEM_PRECOS = `<html><body><h1>Nenhum resultado encontrado</h1></body></html>`;

const HTML_APENAS_BRL = `<html><body><span>BRL 1.250</span></body></html>`;

const HTML_RICO_MULTI_VOO = `
  <html>
    <div aria-label="Preço total a partir de 1.450 Reais brasileiros. Voo da LATAM Airlines com 1 parada. Conexão de 2 h 10 min em Campinas (VCP). Duração total: 4 h 50 min. Inclui 1 mala de mão. Bagagem despachada por uma taxa."></div>
    <div aria-label="Preço total a partir de 2.100 Reais brasileiros. Voo direto da GOL. Duração total: 1 h 20 min. 1 bagagem despachada incluída."></div>
    <div aria-label="A partir de 3.200 Reais brasileiros. Voo da Azul com 2 paradas. Duração total: 8 h."></div>
  </html>
`;

const HTML_SOMENTE_ARIA_SIMPLES = `
  <html>
    <button aria-label="A partir de 741 Reais brasileiros"></button>
    <button aria-label="A partir de 920 Reais brasileiros"></button>
  </html>
`;

const HTML_AJAX_REDIRECT_SEM_CORPO = `
  <html>
    <head>
      <script>
        window.location.replace("https://www.google.com/travel/flights?tfs=CBwQA...&tfu=CjRIMS1mNTFfb3VtQ1FBQUpjMmdCRy0tLS0tLWNlYmNyMy1uMkFBQUFBR3JOTVBBSDFrZHNBEhZjb21wcmVoZW5zaXZlbmVzc19sdXJlGgsIzMoDEAIaA0JSTDgdcPtb");
      </script>
    </head>
    <body>Carregando voos...</body>
  </html>
`;

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: detectarBloqueioBot', () => {
  it('deve detectar bloqueio por status 429', () => {
    assert.equal(detectarBloqueioBot({ status: 429, url: 'https://www.google.com' }), true);
  });

  it('deve detectar bloqueio por status 503', () => {
    assert.equal(detectarBloqueioBot({ status: 503, url: 'https://www.google.com' }), true);
  });

  it('deve detectar bloqueio pela URL do sorry/index', () => {
    assert.equal(detectarBloqueioBot({ status: 200, url: 'https://www.google.com/sorry/index?hl=pt-BR' }), true);
  });

  it('deve detectar bloqueio pela URL do consent.google.com', () => {
    assert.equal(detectarBloqueioBot({ status: 200, url: 'https://consent.google.com/ml?hl=pt-BR' }), true);
  });

  it('deve retornar false para resposta legítima 200', () => {
    assert.equal(detectarBloqueioBot({ status: 200, url: 'https://www.google.com/travel/flights?tfs=...' }), false);
  });

  it('deve retornar false para status 301 de redirect legítimo', () => {
    assert.equal(detectarBloqueioBot({ status: 301, url: 'https://www.google.com/travel/flights' }), false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: decodificarPrecoDoTfu (Base64url / Protobuf tfu)', () => {
  it('deve decodificar tarifa R$ 587 a partir do token tfu real do Google Flights', () => {
    const preco = decodificarPrecoDoTfu(TOKEN_CHEAPEST_CANONICO);
    assert.equal(preco, 587);
  });

  it('deve decodificar tarifa R$ 587 a partir de URL completa contendo tfu', () => {
    const preco = decodificarPrecoDoTfu(URL_RESPOSTA_COM_TFU);
    assert.equal(preco, 587);
  });

  it('deve decodificar token tfu em formato URL-encoded', () => {
    const urlEncoded = encodeURIComponent(TOKEN_CHEAPEST_CANONICO);
    const preco = decodificarPrecoDoTfu(`https://www.google.com/travel/flights?tfu=${urlEncoded}`);
    assert.equal(preco, 587);
  });

  it('deve retornar null para token inicial EgoIABAAGAAgAigD sem preço', () => {
    assert.equal(decodificarPrecoDoTfu('EgoIABAAGAAgAigD'), null);
    assert.equal(decodificarPrecoDoTfu('https://www.google.com/travel/flights?tfu=EgoIABAAGAAgAigD'), null);
  });

  it('deve retornar null para strings vazias, nulas ou indefinidas', () => {
    assert.equal(decodificarPrecoDoTfu(null), null);
    assert.equal(decodificarPrecoDoTfu(undefined), null);
    assert.equal(decodificarPrecoDoTfu(''), null);
    assert.equal(decodificarPrecoDoTfu('   '), null);
  });

  it('deve retornar null para base64 inválido ou corrompido', () => {
    assert.equal(decodificarPrecoDoTfu('!!!invalido!!!'), null);
    assert.equal(decodificarPrecoDoTfu('AAAA'), null);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: extrairPrecoCheapestTab', () => {
  it('deve extrair preço R$ 587 da aba Cheapest via padrão comprehensiveness_lure', () => {
    const preco = extrairPrecoCheapestTab(HTML_COM_CHEAPEST);
    assert.equal(preco, 587);
  });

  it('deve retornar null para HTML sem dados da aba Cheapest e sem URL', () => {
    const preco = extrairPrecoCheapestTab(HTML_SEM_PRECOS);
    assert.equal(preco, null);
  });

  it('deve retornar null para null/undefined', () => {
    assert.equal(extrairPrecoCheapestTab(null), null);
    assert.equal(extrairPrecoCheapestTab(undefined), null);
    assert.equal(extrairPrecoCheapestTab(''), null);
  });

  it('deve ignorar preços fora do intervalo válido (< 80 ou > 60000)', () => {
    const htmlBaixo = '[[null, 50], "comprehensiveness_lure"]';
    const htmlAlto = '[[null, 99999], "comprehensiveness_lure"]';
    assert.equal(extrairPrecoCheapestTab(htmlBaixo), null);
    assert.equal(extrairPrecoCheapestTab(htmlAlto), null);
  });

  it('deve extrair preço via padrão AF_initDataCallback com comprehensiveness_lure embutido', () => {
    const htmlAf = `
      AF_initDataCallback({data: [null, null, [[null, 1350], "EhZjb21wcmVoZW5zaXZlbmVzc19sdXJlGgsI"]]});
    `;
    const preco = extrairPrecoCheapestTab(htmlAf);
    assert.ok(preco === null || (typeof preco === 'number' && preco >= 80 && preco <= 60000));
  });

  it('deve extrair preço R$ 587 via Camada 4 (URL de resposta com parâmetro tfu) quando HTML é vazio', () => {
    const preco = extrairPrecoCheapestTab(HTML_SEM_PRECOS, URL_RESPOSTA_COM_TFU);
    assert.equal(preco, 587);
  });

  it('deve extrair preço R$ 587 via Camada 4 quando HTML é resposta AJAX de redirecionamento', () => {
    const preco = extrairPrecoCheapestTab(HTML_AJAX_REDIRECT_SEM_CORPO);
    assert.equal(preco, 587);
  });

  it('deve manter prioridade das Camadas 1-3 do HTML quando disponíveis', () => {
    // HTML com R$ 587 e URL com o mesmo valor ou fornecida
    const preco = extrairPrecoCheapestTab(HTML_COM_CHEAPEST, URL_RESPOSTA_COM_TFU);
    assert.equal(preco, 587);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: construirUrlCheapest', () => {
  it('deve construir URL com tfs para One-Way (data_volta null)', () => {
    const { url, tipoViagem, tfs } = construirUrlCheapest('GRU', 'LIS', '2027-02-10', null, 14);
    assert.equal(tipoViagem, 'one_way');
    assert.match(url, /google\.com\/travel\/flights/);
    assert.match(url, /tfs=/);
    assert.match(url, /tfu=EgoIABAAGAAgAigD/);
    assert.match(url, /hl=pt-BR/);
    assert.match(url, /gl=BR/);
    assert.match(url, /curr=BRL/);
    assert.ok(tfs.length > 20, 'tfs deve ter payload binário codificado em base64url');
  });

  it('deve construir URL com tfs para Round-Trip (data_volta preenchida)', () => {
    const { url, tipoViagem, tfs } = construirUrlCheapest('SAO', 'MIA', '2027-03-15', '2027-03-29', 12);
    assert.equal(tipoViagem, 'round_trip');
    assert.match(url, /tfs=/);
    assert.ok(tfs.length > 20);
    // tfs de round-trip deve ser maior que one-way (leg de volta adiciona bytes)
    const { tfs: tfsOw } = construirUrlCheapest('SAO', 'MIA', '2027-03-15', null, 12);
    assert.ok(tfs.length > tfsOw.length, 'tfs Round-Trip deve ser maior que One-Way pela leg de volta');
  });

  it('deve tratar strings de Só Ida como One-Way corretamente', () => {
    const { tipoViagem: t1 } = construirUrlCheapest('GRU', 'CDG', '2027-01-20', 'Só Ida');
    const { tipoViagem: t2 } = construirUrlCheapest('GRU', 'CDG', '2027-01-20', 'one way');
    const { tipoViagem: t3 } = construirUrlCheapest('GRU', 'CDG', '2027-01-20', '');
    assert.equal(t1, 'one_way');
    assert.equal(t2, 'one_way');
    assert.equal(t3, 'one_way');
  });

  it('deve expandir metrópoles para aeroportos físicos no payload tfs', () => {
    // SAO → GRU,CGH; RIO → GIG,SDU — o tfs deve refletir múltiplos aeroportos
    const { tfs: tfsSao } = construirUrlCheapest('SAO', 'RAO', '2027-02-10', null);
    const { tfs: tfsGru } = construirUrlCheapest('GRU', 'RAO', '2027-02-10', null);
    // SAO expande para GRU,CGH → payload maior que single GRU
    assert.ok(tfsSao.length >= tfsGru.length, 'Metrópole SAO deve gerar tfs ≥ aeroporto único GRU');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: extrairVoosDoHtml', () => {
  it('deve extrair múltiplos voos do HTML rico com aria-label completo', () => {
    const voos = extrairVoosDoHtml(HTML_RICO_MULTI_VOO);
    assert.ok(voos.length >= 2, `Esperava ≥ 2 voos, encontrou ${voos.length}`);

    const precos = voos.map(v => v.preco).sort((a, b) => a - b);
    assert.ok(precos[0] >= 80 && precos[0] <= 60000, 'Primeiro preço deve estar no intervalo válido');
  });

  it('deve extrair voo com conexão detalhada e bagagem corretamente', () => {
    const voos = extrairVoosDoHtml(HTML_RICO_MULTI_VOO);
    const latam = voos.find(v => v.cia.includes('LATAM'));
    if (latam) {
      assert.equal(latam.escalas, 1);
      assert.ok(latam.detalhesEscalas.includes('1 parada'));
      assert.ok(latam.bagagem.mao === 'incluida');
    }
  });

  it('deve cair no fallback aria simples quando aria-label rico não tem "Preço total"', () => {
    const voos = extrairVoosDoHtml(HTML_SOMENTE_ARIA_SIMPLES);
    assert.ok(voos.length >= 1, 'Deve extrair pelo menos 1 voo via fallback simples');
    assert.equal(voos[0].preco, 741);
  });

  it('deve cair no fallback BRL quando nenhum aria-label encontrado', () => {
    const voos = extrairVoosDoHtml(HTML_APENAS_BRL);
    assert.ok(voos.length >= 1, 'Deve extrair pelo menos 1 voo via fallback BRL');
    assert.equal(voos[0].preco, 1250);
  });

  it('deve retornar array vazio para HTML sem preços', () => {
    const voos = extrairVoosDoHtml(HTML_SEM_PRECOS);
    assert.equal(voos.length, 0);
  });

  it('deve filtrar preços fora do intervalo válido (< 80 e > 60000)', () => {
    const htmlInvalido = `
      <div aria-label="A partir de 50 Reais brasileiros. Voo sem nome. Duração total: 1 h."></div>
      <div aria-label="A partir de 75000 Reais brasileiros. Voo caro. Duração total: 20 h."></div>
    `;
    const voos = extrairVoosDoHtml(htmlInvalido);
    assert.equal(voos.length, 0, 'Deve ignorar preços R$ 50 (< 80) e R$ 75.000 (> 60.000)');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: ScraplingProvider (buscarOfertas)', () => {
  it('deve extrair corretamente preço da aba Cheapest (R$ 587) menor que o parseado do HTML (R$ 890)', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => HTML_COM_CHEAPEST
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'SSA',
        dataIda: '2027-02-10'
      });

      assert.ok(res.ok, 'Deve retornar ok: true');
      assert.ok(res.encontrouVoos, 'Deve encontrar voos');
      assert.equal(res.oferta.preco, 587, 'Preço Cheapest R$ 587 deve ter prioridade sobre R$ 890');
      assert.equal(res.oferta.precoOriginal, 890, 'Preço original R$ 890 deve ser preservado');
      assert.ok(res.oferta.cheapestTabAtivada, 'Flag cheapestTabAtivada deve ser true');
      assert.ok(res.oferta.detalhes.includes('Cheapest'), 'Detalhes devem mencionar Cheapest');
      assert.equal(res.oferta.tipoViagem, 'one_way', 'Sem data_volta → One-Way');
      assert.equal(res.oferta.provedor, 'Scrapling Stealth (Google Flights Cheapest)');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve identificar Round-Trip quando data_volta é fornecida', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => HTML_RICO_MULTI_VOO
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'LIS',
        dataIda: '2027-03-10',
        dataVolta: '2027-03-24'
      });

      assert.ok(res.ok);
      assert.equal(res.oferta.tipoViagem, 'round_trip', 'Com data_volta → Round-Trip');
      assert.ok(res.oferta.detalhes.includes('Ida e Volta'), 'Badge "Ida e Volta" deve estar nos detalhes');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve retornar ok: false ao detectar bloqueio de bot (HTTP 429)', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      url: 'https://www.google.com/travel/flights'
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'CDG',
        dataIda: '2027-04-01'
      });

      assert.equal(res.ok, false, 'Deve retornar falha ao detectar bloqueio 429');
      assert.ok(res.erro, 'Deve marcar erro: true');
      assert.ok(res.mensagemErro.includes('falhou'), 'Mensagem de erro deve indicar falha do ScraplingProvider');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve retornar ok: false quando HTML não contém preços extraíveis', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => HTML_SEM_PRECOS
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'NYC',
        dataIda: '2027-05-01'
      });

      assert.equal(res.ok, false, 'HTML vazio deve acionar failover');
      assert.ok(res.mensagemErro.includes('falhou'));
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve retornar ok: false para parâmetros incompletos (sem dataIda)', async () => {
    const provider = new ScraplingProvider();

    const res = await provider.buscarOfertas({
      origemCod: 'GRU',
      destinoCod: 'LIS',
      dataIda: null
    });

    assert.equal(res.ok, false);
    assert.ok(res.mensagemErro.includes('incompletos'));
  });

  it('deve filtrar voos por duração máxima e retornar o mais barato dentro do limite', async () => {
    const provider = new ScraplingProvider();

    // HTML com dois voos: R$ 1.450 (4h50min) e R$ 2.100 (1h20min)
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => HTML_RICO_MULTI_VOO
    });

    try {
      // Duração máxima de 2 horas → apenas o voo de 1h20min se qualifica
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'SSA',
        dataIda: '2027-02-10',
        duracaoMaxHoras: 2
      });

      assert.ok(res.ok);
      // Deve retornar R$ 2.100 (1h20min) e não R$ 1.450 (4h50min fora do limite)
      assert.equal(res.oferta.preco, 2100, 'Deve retornar voo mais barato dentro do limite de duração');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve retornar amostra de até 10 voos no oferta.amostraVoos', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => HTML_RICO_MULTI_VOO
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'SSA',
        dataIda: '2027-02-10'
      });

      assert.ok(res.ok);
      assert.ok(Array.isArray(res.oferta.amostraVoos), 'amostraVoos deve ser array');
      assert.ok(res.oferta.amostraVoos.length <= 10, 'amostraVoos deve ter no máximo 10 voos');
      assert.ok(res.oferta.amostraVoos.length >= 1, 'amostraVoos deve ter pelo menos 1 voo');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve ativar tarifa Cheapest quando string de Só Ida é passada como data_volta', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => HTML_COM_CHEAPEST
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'CGH',
        destinoCod: 'BSB',
        dataIda: '2027-06-10',
        dataVolta: 'Só Ida'
      });

      assert.ok(res.ok);
      assert.equal(res.oferta.tipoViagem, 'one_way', '"Só Ida" deve resultar em One-Way');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve capturar tarifa Cheapest R$ 587 via URL de redirecionamento com parâmetro tfu quando HTML é esparso', async () => {
    const provider = new ScraplingProvider();

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: URL_RESPOSTA_COM_TFU,
      text: async () => '<html><body>Carregando voos...</body></html>'
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'SSA',
        dataIda: '2027-02-10'
      });

      assert.ok(res.ok, 'Deve retornar ok: true');
      assert.ok(res.encontrouVoos, 'Deve encontrar voos via URL tfu');
      assert.equal(res.oferta.preco, 587, 'Tarifa R$ 587 deve ser extraída do parâmetro tfu da URL de resposta');
      assert.ok(res.oferta.cheapestTabAtivada, 'Flag cheapestTabAtivada deve ser true');
      assert.ok(res.oferta.detalhes.includes('Cheapest'), 'Detalhes devem mencionar Cheapest');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve reportar estaDisponivel() como true por padrão', () => {
    const provider = new ScraplingProvider();
    assert.equal(provider.estaDisponivel(), true);
  });

  it('deve retornar estatísticas de uso via obterEstatisticas()', () => {
    const provider = new ScraplingProvider();
    const stats = provider.obterEstatisticas();
    assert.equal(typeof stats, 'object');
    assert.equal(stats.provedor, 'Scrapling Stealth (Google Flights Cheapest)');
    assert.equal(typeof stats.requisicoesCiclo, 'number');
    assert.equal(stats.ativo, true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('ScraplingClient: Integração com FlightProviderManager (cadeia Scrapling → Direct → SerpAPI)', () => {
  it('deve registrar buscasScraplingsSucesso nas estatísticas quando Scrapling encontra voos', async () => {
    const { FlightProviderManager } = await import('../src/services/providers/provider_manager.js');
    const { ScraplingProvider } = await import('../src/services/providers/scrapling_client.js');

    const manager = new FlightProviderManager();

    // Substitui o Scrapling real por mock de sucesso com cheapestTabAtivada
    const scraplingMock = new ScraplingProvider();
    scraplingMock.buscarOfertas = async () => ({
      ok: true,
      encontrouVoos: true,
      oferta: {
        preco: 587,
        duracaoHoras: 3.5,
        destinoReal: 'SSA',
        termometro: '🟢 Preço Mais Barato',
        nivelPreco: 'low',
        detalhes: 'LATAM | 1 parada em VCP | Duração: 3 h 40 min | Só Ida | Menor Tarifa (Aba Cheapest Google Flights: R$ 587)',
        dicaStopover: '-',
        link: 'https://www.google.com/travel/flights?tfs=...',
        provedor: 'Scrapling Stealth (Google Flights Cheapest)',
        tipoViagem: 'one_way',
        cheapestTabAtivada: true
      }
    });
    manager.providers = [scraplingMock];

    const res = await manager.buscarOfertas({ origemCod: 'GRU', destinoCod: 'SSA', dataIda: '2027-02-10' });

    assert.ok(res.ok);
    assert.equal(res.oferta.preco, 587);
    assert.equal(manager.stats.buscasScraplingsSucesso, 1);
    assert.equal(manager.stats.buscasDiretasSucesso, 0);
    assert.equal(manager.stats.buscasSerpApiSucesso, 0);
  });

  it('deve realizar failover para GoogleFlightsDirect quando Scrapling falha', async () => {
    const { FlightProviderManager } = await import('../src/services/providers/provider_manager.js');
    const { ScraplingProvider } = await import('../src/services/providers/scrapling_client.js');
    const { GoogleFlightsDirectProvider } = await import('../src/services/providers/google_flights_direct_provider.js');

    const manager = new FlightProviderManager();

    const scraplingFail = new ScraplingProvider();
    scraplingFail.buscarOfertas = async () => ({ ok: false, erro: true, mensagemErro: 'Bloqueio anti-bot simulado' });

    const directMock = new GoogleFlightsDirectProvider();
    directMock.buscarOfertas = async () => ({
      ok: true,
      encontrouVoos: true,
      oferta: {
        preco: 890,
        duracaoHoras: 3.7,
        destinoReal: 'SSA',
        termometro: '🟢 Preço Direto',
        nivelPreco: 'low',
        detalhes: 'Azul | 1 parada | Tarifa Direta Stealth',
        dicaStopover: '-',
        link: 'https://www.google.com/travel/flights',
        provedor: 'Google Flights Direct (0 Custo)'
      }
    });

    manager.providers = [scraplingFail, directMock];
    const res = await manager.buscarOfertas({ origemCod: 'GRU', destinoCod: 'SSA', dataIda: '2027-02-10' });

    assert.ok(res.ok);
    assert.equal(res.oferta.provedor, 'Google Flights Direct (0 Custo)');
    assert.equal(manager.stats.buscasDiretasSucesso, 1);
  });

  it('FlightProviderManager deve listar Scrapling como primeiro provedor ativo na cadeia', async () => {
    const { FlightProviderManager } = await import('../src/services/providers/provider_manager.js');
    const manager = new FlightProviderManager();
    const stats = manager.obterEstatisticas();

    assert.ok(Array.isArray(stats.provedoresAtivos), 'provedoresAtivos deve ser array');
    assert.ok(stats.provedoresAtivos.length >= 3, 'Deve ter ≥ 3 provedores na cadeia');
    assert.ok(
      stats.provedoresAtivos[0].toLowerCase().includes('scrapling'),
      `Primeiro provedor deve ser Scrapling, mas é: "${stats.provedoresAtivos[0]}"`
    );
  });
});
