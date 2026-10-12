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
});
