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
});
