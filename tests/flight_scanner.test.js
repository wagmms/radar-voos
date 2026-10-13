import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FlightScanner } from '../src/services/flight_scanner.js';
import { rotasRepo, getDb } from '../src/db.js';

describe('Serviço FlightScanner & Ciclo de Varredura (executarCicloVarredura)', () => {
  const originalBuscarOfertas = FlightScanner.buscarOfertas;

  beforeEach(() => {
    FlightScanner.buscarOfertas = async () => ({
      ok: true,
      encontrouVoos: true,
      oferta: {
        preco: 1200,
        nivelPreco: 'NORMAL',
        duracaoHoras: 6.0,
        duracaoMinutos: 360,
        detalhes: 'Voo Simulado de Teste',
        dicaStopover: '-',
        termometro: '⚪ Preço Normal',
        origemReal: 'SAO',
        destinoReal: 'MIA',
        codigoDestinoReal: 'MIA',
        link: 'https://flights.google.com/teste'
      }
    });
  });

  afterEach(() => {
    FlightScanner.buscarOfertas = originalBuscarOfertas;
  });

  it('1. executarCicloVarredura: deve lidar graciosamente com fila vazia de rotas ativas', async () => {
    const db = getDb();
    // Temporariamente desativa todas as rotas para testar fila vazia
    db.prepare('UPDATE rotas SET ativa = 0').run();

    try {
      const res = await FlightScanner.executarCicloVarredura({ forcarTodas: false, limite: 1 });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.processadas, 0);
      assert.deepStrictEqual(res.resultados, []);
    } finally {
      // Reativa as rotas
      db.prepare('UPDATE rotas SET ativa = 1').run();
    }
  });

  it('2. executarCicloVarredura: deve orquestrar a varredura da fila LRU com limite configurado', async () => {
    // Insere ou garante uma rota teste
    const db = getDb();
    const rotaExistente = rotasRepo.listarTodas(true)[0];
    assert.ok(rotaExistente, 'Deve haver ao menos uma rota no banco para o teste');

    const ciclo = await FlightScanner.executarCicloVarredura({ forcarTodas: false, limite: 1, aplicarJitter: false });
    assert.strictEqual(ciclo.ok, true);
    assert.strictEqual(ciclo.processadas, 1);
    assert.strictEqual(ciclo.resultados.length, 1);

    const primeiro = ciclo.resultados[0];
    assert.strictEqual(typeof primeiro.rotaId, 'number');
    const rotaChecada = rotasRepo.buscarPorId(primeiro.rotaId);
    assert.ok(rotaChecada, 'Rota checada deve existir no banco');
    assert.ok(primeiro.res, 'Resultado da checagem deve existir');
    assert.strictEqual(primeiro.res.sucesso, true);
    // Deve incluir a telemetria do delta estatístico
    assert.ok(primeiro.res.deltaEstatistico, 'Deve incluir deltaEstatistico enriquecido');
    assert.ok(['INFO', 'OPORTUNIDADE', 'BUG_FARE'].includes(primeiro.res.deltaEstatistico.categoria));
  });

  it('3. escanearRota: deve retornar deltaEstatistico com analise de Z-Score da rota', async () => {
    const rotas = rotasRepo.listarTodas(true);
    const rota = rotas[0];

    const resultado = await FlightScanner.escanearRota(rota);
    assert.strictEqual(resultado.sucesso, true);
    assert.ok(resultado.deltaEstatistico);
    assert.strictEqual(typeof resultado.deltaEstatistico.quedaPct, 'number');
    assert.ok(['INFO', 'OPORTUNIDADE', 'BUG_FARE'].includes(resultado.deltaEstatistico.categoria));
  });

  it('4. executarCicloVarredura: deve propagar moeda configurada (moeda=USD) para os provedores e registrar no resultado', async () => {
    let moedaCapturada = null;
    FlightScanner.buscarOfertas = async (...args) => {
      // O último argumento posicional ou o campo moeda no objeto é a moeda
      if (typeof args[0] === 'object') {
        moedaCapturada = args[0].moeda;
      } else {
        moedaCapturada = args[7]; // 8º argumento posicional
      }
      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: 250,
          nivelPreco: 'NORMAL',
          duracaoHoras: 7.0,
          duracaoMinutos: 420,
          detalhes: 'Voo USD',
          dicaStopover: '-',
          termometro: '⚪ Preço Normal USD',
          origemReal: 'SAO',
          destinoReal: 'MIA',
          codigoDestinoReal: 'MIA',
          link: 'https://flights.google.com/teste-usd'
        }
      };
    };

    const res = await FlightScanner.executarCicloVarredura({ forcarTodas: false, limite: 1, moeda: 'USD' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.moeda, 'USD');
    assert.strictEqual(moedaCapturada, 'USD');
    assert.ok(res.resultados.length > 0);
    assert.strictEqual(res.resultados[0].moeda, 'USD');
    assert.strictEqual(res.resultados[0].res.moeda, 'USD');
  });

  it('5. executarCicloVarredura: deve aceitar alias curr (curr="eur") e normalizar para EUR', async () => {
    let moedaCapturada = null;
    FlightScanner.buscarOfertas = async (...args) => {
      moedaCapturada = typeof args[0] === 'object' ? args[0].moeda : args[7];
      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: 320,
          nivelPreco: 'NORMAL',
          duracaoHoras: 10.0,
          duracaoMinutos: 600,
          detalhes: 'Voo EUR',
          dicaStopover: '-',
          termometro: '⚪ Preço Normal EUR',
          origemReal: 'SAO',
          destinoReal: 'LIS',
          codigoDestinoReal: 'LIS',
          link: 'https://flights.google.com/teste-eur'
        }
      };
    };

    const res = await FlightScanner.executarCicloVarredura({ forcarTodas: false, limite: 1, curr: 'eur' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.moeda, 'EUR');
    assert.strictEqual(moedaCapturada, 'EUR');
    assert.strictEqual(res.resultados[0].moeda, 'EUR');
  });

  it('6. escanearRota: deve usar moeda da rota ou fallback BRL quando nao especificada globalmente', async () => {
    let moedaCapturada = null;
    FlightScanner.buscarOfertas = async (...args) => {
      moedaCapturada = typeof args[0] === 'object' ? args[0].moeda : args[7];
      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: 990,
          nivelPreco: 'NORMAL',
          duracaoHoras: 8.0,
          duracaoMinutos: 480,
          detalhes: 'Voo Rota Moeda',
          dicaStopover: '-',
          termometro: '⚪ Preço Normal',
          origemReal: 'SAO',
          destinoReal: 'MIA',
          codigoDestinoReal: 'MIA',
          link: 'https://flights.google.com/teste'
        }
      };
    };

    const rotaComMoeda = {
      ...rotasRepo.listarTodas(true)[0],
      moeda: 'GBP'
    };

    const res = await FlightScanner.escanearRota(rotaComMoeda);
    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.moeda, 'GBP');
    assert.strictEqual(moedaCapturada, 'GBP');
  });

  it('7. buscarOfertas: deve encapsular moeda para flightProviderManager corretamente', async () => {
    // Restaura buscarOfertas original para testar integração com flightProviderManager
    FlightScanner.buscarOfertas = originalBuscarOfertas;

    // Chamada com parâmetros posicionais
    const promPosicional = FlightScanner.buscarOfertas('GRU', 'MIA', '2027-04-10', '2027-04-20', 12, 'economy', 1, 'USD');
    assert.ok(promPosicional instanceof Promise);

    // Chamada com objeto direto
    const promObjeto = FlightScanner.buscarOfertas({
      origemCod: 'GRU',
      destinoCod: 'MIA',
      dataIda: '2027-04-10',
      dataVolta: '2027-04-20',
      moeda: 'EUR'
    });
    assert.ok(promObjeto instanceof Promise);
  });
});
