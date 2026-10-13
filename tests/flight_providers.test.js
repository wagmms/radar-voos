import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FlightProviderInterface } from '../src/services/providers/flight_provider_interface.js';
import { FlightProviderManager } from '../src/services/providers/provider_manager.js';

class MockSuccessProvider extends FlightProviderInterface {
  constructor() {
    super('Mock Success');
  }
  async buscarOfertas(params) {
    return {
      ok: true,
      encontrouVoos: true,
      oferta: {
        preco: 1499.0,
        duracaoHoras: 9.5,
        destinoReal: params.destinoCod,
        termometro: '🟢 Preço Excelente',
        nivelPreco: 'low',
        detalhes: 'Direto | Mock Airline',
        dicaStopover: '-',
        link: 'https://mock.flights',
        provedor: this.nome
      }
    };
  }
}

class MockFailProvider extends FlightProviderInterface {
  constructor() {
    super('Mock Fail');
  }
  async buscarOfertas() {
    return { ok: false, erro: true, mensagemErro: 'Falha simulada no mock' };
  }
}

describe('Provedores de Voos e Failover (FlightProviderManager)', () => {
  it('deve executar o provedor prioritário com sucesso', async () => {
    const manager = new FlightProviderManager();
    const mock = new MockSuccessProvider();
    manager.adicionarProvedor(mock, true); // Adiciona no início

    const res = await manager.buscarOfertas({
      origemCod: 'GRU',
      destinoCod: 'MIA',
      dataIda: '2026-11-01'
    });

    assert.ok(res.ok);
    assert.ok(res.encontrouVoos);
    assert.equal(res.oferta.preco, 1499.0);
    assert.equal(res.oferta.provedor, 'Mock Success');
  });

  it('deve realizar failover para o segundo provedor quando o primeiro falha', async () => {
    const manager = new FlightProviderManager();
    manager.providers = [
      new MockFailProvider(),
      new MockSuccessProvider()
    ];

    const res = await manager.buscarOfertas({
      origemCod: 'GRU',
      destinoCod: 'LIS',
      dataIda: '2026-11-01'
    });

    assert.ok(res.ok);
    assert.equal(res.oferta.provedor, 'Mock Success');
  });

  it('deve reportar erro consolidado se todos os provedores falharem', async () => {
    const manager = new FlightProviderManager();
    manager.providers = [
      new MockFailProvider(),
      new MockFailProvider()
    ];

    const res = await manager.buscarOfertas({
      origemCod: 'GRU',
      destinoCod: 'CDG',
      dataIda: '2026-11-01'
    });

    assert.equal(res.ok, false);
    assert.ok(res.mensagemErro.includes('Todos os provedores de voo falharam'));
  });

  it('deve checar disponibilidade de chaves SerpApi através de estaDisponivel() sem estourar exceção', async () => {
    const { SerpApiProvider } = await import('../src/services/providers/serpapi_provider.js');
    const { serpApiPool } = await import('../src/services/serpapi_pool.js');

    const provider = new SerpApiProvider();
    assert.equal(typeof serpApiPool.temChaveDisponivel, 'function');
    const disp = provider.estaDisponivel();
    assert.equal(typeof disp, 'boolean');
  });

  it('GoogleFlightsDirectProvider deve capturar o menor preço da aba Cheapest (R$ 587) em vez de ficar preso no voo regular (R$ 741)', async () => {
    const { GoogleFlightsDirectProvider } = await import('../src/services/providers/google_flights_direct_provider.js');
    const provider = new GoogleFlightsDirectProvider();

    // Mock do fetch retornando HTML autêntico do Google Flights com a aba Cheapest
    const htmlMock = `
      <html>
        <div aria-label="A partir de 741 Reais brasileiros. Voo da Azul com 1 parada. Duração total: 3 h 40 min."></div>
        <div aria-label="A partir de 920 Reais brasileiros. Voo da Gol com 1 parada. Duração total: 2 h 55 min."></div>
        <script>
          AF_initDataCallback({
            key: 'ds:1',
            data: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
              [[null, 587], "CjRIMS1mNTFfb3VtQ1FBQUpjMmdCRy0tLS0tLWNlYmNyMy1uMkFBQUFBR3JOTVBBSDFrZHNBEhZjb21wcmVoZW5zaXZlbmVzc19sdXJlGgsIzMoDEAIaA0JSTDgdcPtb"]
            ]
          });
        </script>
      </html>
    `;

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => htmlMock
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'RIO',
        destinoCod: 'RAO',
        dataIda: '2027-01-17',
        duracaoMaxHoras: 6
      });

      assert.ok(res.ok);
      assert.ok(res.encontrouVoos);
      assert.equal(res.oferta.preco, 587);
      // 3 h 40 min = 3.667h (precisão de 3 casas decimais, tolerância ±0.001)
      assert.ok(Math.abs(res.oferta.duracaoHoras - 3.667) < 0.001, `duracaoHoras deve ser ≈3.667, recebeu ${res.oferta.duracaoHoras}`);
      assert.ok(res.oferta.detalhes.includes('Aba Cheapest Google Flights'));
      assert.equal(res.oferta.escalas, 1);
      assert.equal(res.oferta.detalhesEscalas, '1 parada');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('deve extrair conexões e escalas (direto, 1 parada, conexões com aeroporto e layover)', async () => {
    const { extrairInfoConexoes } = await import('../src/services/providers/google_flights_direct_provider.js');

    // Voos diretos
    const dir1 = extrairInfoConexoes('Voo direto da LATAM. Duração total: 1 h 15 min.');
    assert.equal(dir1.escalas, 0);
    assert.equal(dir1.detalhesEscalas, 'Direto');

    const dir2 = extrairInfoConexoes('Nonstop flight with United Airlines.');
    assert.equal(dir2.escalas, 0);
    assert.equal(dir2.detalhesEscalas, 'Direto');

    const dir3 = extrairInfoConexoes('Voo sem escalas da GOL.');
    assert.equal(dir3.escalas, 0);
    assert.equal(dir3.detalhesEscalas, 'Direto');

    // 1 parada simples
    const p1 = extrairInfoConexoes('Voo da Azul com 1 parada. Duração total: 4 h.');
    assert.equal(p1.escalas, 1);
    assert.equal(p1.detalhesEscalas, '1 parada');

    // 2 paradas
    const p2 = extrairInfoConexoes('Voo da TAP com 2 paradas. Duração total: 14 h.');
    assert.equal(p2.escalas, 2);
    assert.equal(p2.detalhesEscalas, '2 paradas');

    // Conexão detalhada com aeroporto e tempo de parada
    const pDet = extrairInfoConexoes('Voo da LATAM com 1 parada. Conexão de 2 h 15 min no Aeroporto de Brasília (BSB). Duração total: 5 h 30 min.');
    assert.equal(pDet.escalas, 1);
    assert.equal(pDet.tempoConexao, '2 h 15 min');
    assert.equal(pDet.aeroportoConexao, 'Aeroporto de Brasília (BSB)');
    assert.equal(pDet.detalhesEscalas, '1 parada em Aeroporto de Brasília (BSB)');

    // Conexão em Campinas
    const pVcp = extrairInfoConexoes('Voo da Azul com 1 parada. 1 parada em Campinas (VCP). Duração total: 3 h 40 min.');
    assert.equal(pVcp.escalas, 1);
    assert.equal(pVcp.aeroportoConexao, 'Campinas (VCP)');
    assert.equal(pVcp.detalhesEscalas, '1 parada em Campinas (VCP)');
  });

  it('deve extrair status e modalidades de bagagem (mão, despachada, taxa adicional e item pessoal)', async () => {
    const { extrairInfoBagagem } = await import('../src/services/providers/google_flights_direct_provider.js');

    // Mala de mão incluída e despachada paga
    const b1 = extrairInfoBagagem('Inclui 1 mala de mão. Bagagem despachada por uma taxa adicional.');
    assert.equal(b1.mao, 'incluida');
    assert.equal(b1.despachada, 'paga');
    assert.equal(b1.texto, 'Mala de mão incluída (despachada paga)');

    // Inclui bagagem despachada e de mão
    const b2 = extrairInfoBagagem('1 bagagem despachada incluída. Inclui mala de mão.');
    assert.equal(b2.mao, 'incluida');
    assert.equal(b2.despachada, 'incluida');
    assert.equal(b2.texto, 'Inclui bagagem despachada e de mão');

    // Apenas item pessoal (sem mala de mão)
    const b3 = extrairInfoBagagem('Apenas item pessoal incluído. Sem bagagem de mão.');
    assert.equal(b3.mao, 'nao_incluida');
    assert.equal(b3.texto, 'Apenas item pessoal (sem mala de mão)');

    // Em inglês
    const b4 = extrairInfoBagagem('Carry-on bag included. Checked bag for a fee.');
    assert.equal(b4.mao, 'incluida');
    assert.equal(b4.despachada, 'paga');
    assert.equal(b4.texto, 'Mala de mão incluída (despachada paga)');

    // Texto sem menção de bagagem
    const b5 = extrairInfoBagagem('Voo regular sem dados de bagagem.');
    assert.equal(b5.mao, 'desconhecido');
    assert.equal(b5.despachada, 'desconhecido');
    assert.equal(b5.texto, null);
  });

  it('deve limpar nomes de companhias aéreas e fazer parsing de preços monetários com milhar', async () => {
    const { limparNomeCompanhia, extrairPrecoNumerico } = await import('../src/services/providers/google_flights_direct_provider.js');

    // Limpeza de cia aérea
    assert.equal(limparNomeCompanhia('Azul com 1 parada'), 'Azul');
    assert.equal(limparNomeCompanhia('LATAM Airlines direto'), 'LATAM Airlines');
    assert.equal(limparNomeCompanhia('TAP Air Portugal com 2 paradas.'), 'TAP Air Portugal');
    assert.equal(limparNomeCompanhia('operado por Air Japan'), 'Air Japan');
    assert.equal(limparNomeCompanhia(''), 'Companhia Aérea');

    // Parsing numérico de preços
    assert.equal(extrairPrecoNumerico('741'), 741);
    assert.equal(extrairPrecoNumerico('1.250'), 1250);
    assert.equal(extrairPrecoNumerico('2,450'), 2450);
    assert.equal(extrairPrecoNumerico('3 890'), 3890);
    assert.equal(extrairPrecoNumerico('1.990,00'), 1990);
  });

  it('GoogleFlightsDirectProvider deve extrair conexões detalhadas e bagagens completas do HTML', async () => {
    const { GoogleFlightsDirectProvider } = await import('../src/services/providers/google_flights_direct_provider.js');
    const provider = new GoogleFlightsDirectProvider();

    const htmlRico = `
      <html>
        <div aria-label="A partir de 1.450 Reais brasileiros. Voo da LATAM Airlines com 1 parada. Conexão de 2 h 10 min em Campinas (VCP). Duração total: 4 h 50 min. Inclui 1 mala de mão. Bagagem despachada por uma taxa."></div>
        <div aria-label="A partir de 2.100 Reais brasileiros. Voo direto da GOL. Duração total: 1 h 20 min. 1 bagagem despachada incluída. Inclui mala de mão."></div>
      </html>
    `;

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => htmlRico
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'GRU',
        destinoCod: 'SSA',
        dataIda: '2027-02-10'
      });

      assert.ok(res.ok);
      assert.ok(res.encontrouVoos);
      assert.equal(res.oferta.preco, 1450);
      assert.equal(res.oferta.escalas, 1);
      assert.equal(res.oferta.detalhesEscalas, '1 parada em Campinas (VCP)');
      assert.equal(res.oferta.tempoConexao, '2 h 10 min');
      assert.equal(res.oferta.aeroportoConexao, 'Campinas (VCP)');
      assert.equal(res.oferta.bagagem.mao, 'incluida');
      assert.equal(res.oferta.bagagem.despachada, 'paga');
      assert.ok(res.oferta.detalhes.includes('LATAM Airlines'));
      assert.ok(res.oferta.detalhes.includes('1 parada em Campinas (VCP)'));
      assert.ok(res.oferta.detalhes.includes('Mala de mão incluída (despachada paga)'));
      assert.ok(res.oferta.detalhes.includes('Tarifa Direta Stealth'));
      assert.equal(res.oferta.amostraVoos.length, 2);
      assert.ok(res.oferta.amostraVoos[0].includes('Mala de mão incluída'));
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('GoogleFlightsDirectProvider deve inspecionar nós HTML filhos quando conexões e bagagens não constam no aria-label principal', async () => {
    const { GoogleFlightsDirectProvider } = await import('../src/services/providers/google_flights_direct_provider.js');
    const provider = new GoogleFlightsDirectProvider();

    const htmlFilhos = `
      <html>
        <div class="flight-row" aria-label="A partir de 890 Reais brasileiros. Voo da Azul. Duração total: 3 h 15 min.">
          <span class="stops-node" aria-label="1 parada">1 parada em BSB</span>
          <span class="bag-node" aria-label="Bagagem de mão incluída">Mala de mão incluída</span>
        </div>
      </html>
    `;

    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: 'https://www.google.com/travel/flights',
      text: async () => htmlFilhos
    });

    try {
      const res = await provider.buscarOfertas({
        origemCod: 'VCP',
        destinoCod: 'BSB',
        dataIda: '2027-03-15'
      });

      assert.ok(res.ok);
      assert.ok(res.encontrouVoos);
      assert.equal(res.oferta.preco, 890);
      assert.equal(res.oferta.escalas, 1);
      assert.ok(res.oferta.detalhesEscalas.includes('1 parada'));
      assert.equal(res.oferta.bagagem.mao, 'incluida');
      assert.ok(res.oferta.detalhes.includes('Azul'));
      assert.ok(res.oferta.detalhes.includes('Mala de mão incluída'));
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});
