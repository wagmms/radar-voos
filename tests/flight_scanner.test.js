import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FlightScanner, calcularMilhasRota } from '../src/services/flight_scanner.js';
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

// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários: calcularMilhasRota (descontinuado — radar focado exclusivamente em dinheiro)
// ─────────────────────────────────────────────────────────────────────────────
describe('calcularMilhasRota — função descontinuada (retorna null)', () => {
  it('1. deve retornar null para qualquer entrada (descontinuado em prol de economia real em dinheiro)', () => {
    assert.strictEqual(calcularMilhasRota(1000, 20, 'azul'), null);
    assert.strictEqual(calcularMilhasRota(1750, null, 'smiles'), null);
    assert.strictEqual(calcularMilhasRota(100, null, 'smiles'), null);
    assert.strictEqual(calcularMilhasRota(0, 20, 'azul'), null);
    assert.strictEqual(calcularMilhasRota(-500, 20, 'azul'), null);
    assert.strictEqual(calcularMilhasRota(null, 20, 'azul'), null);
    assert.strictEqual(calcularMilhasRota('2000', 20, 'azul'), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Testes de integração: milhas_estimadas descontinuadas no payload de escanearRota
// ─────────────────────────────────────────────────────────────────────────────
describe('escanearRota — milhas_estimadas como null no payload de retorno', () => {
  const originalBuscarOfertas = FlightScanner.buscarOfertas;

  const ofertaSimulada = {
    preco: 1750,
    nivelPreco: 'NORMAL',
    duracaoHoras: 8.0,
    duracaoMinutos: 480,
    detalhes: 'Voo Simulado Dinheiro',
    dicaStopover: '-',
    termometro: '⚪ Preço Normal',
    origemReal: 'GRU',
    destinoReal: 'LIS',
    codigoDestinoReal: 'LIS',
    link: 'https://flights.google.com/teste'
  };

  beforeEach(() => {
    FlightScanner.buscarOfertas = async () => ({ ok: true, encontrouVoos: true, oferta: ofertaSimulada });
  });

  afterEach(() => {
    FlightScanner.buscarOfertas = originalBuscarOfertas;
  });

  it('2. escanearRota: deve retornar milhas_estimadas como null no retorno', async () => {
    const rota = rotasRepo.listarTodas(true)[0];
    assert.ok(rota, 'Requer ao menos uma rota ativa no banco');

    const res = await FlightScanner.escanearRota(rota);

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.milhas_estimadas, null, 'milhas_estimadas deve ser null');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Testes de integração: propagação de filtros avançados Protobuf
// ─────────────────────────────────────────────────────────────────────────────
describe('FlightScanner — propagação de filtros avançados Protobuf', () => {
  const originalBuscarOfertas = FlightScanner.buscarOfertas;

  afterEach(() => {
    FlightScanner.buscarOfertas = originalBuscarOfertas;
  });

  it('deve repassar filtros opcionais da rota (max_stops, carry_on_bags, checked_bags, preco_alvo, etc.) em escanearRota', async () => {
    let opcoesCapturadas = null;
    FlightScanner.buscarOfertas = async (...args) => {
      opcoesCapturadas = typeof args[0] === 'object' ? args[0] : args[8];
      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: 2200,
          nivelPreco: 'NORMAL',
          duracaoHoras: 9.0,
          duracaoMinutos: 540,
          detalhes: 'Voo com filtros',
          dicaStopover: '-',
          termometro: '⚪ Normal',
          origemReal: 'GRU',
          destinoReal: 'JFK',
          codigoDestinoReal: 'JFK',
          link: 'https://flights.google.com/test'
        }
      };
    };

    const rotaComFiltros = {
      id: 9999,
      origem: 'São Paulo',
      codigo_origem: 'GRU',
      destino: 'Nova York',
      codigo_destino: 'JFK',
      data_ida: '2027-04-10',
      data_volta: '2027-04-20',
      duracao_max_horas: 15,
      cabine: 'economy',
      max_stops: 0,
      carry_on_bags: 1,
      checked_bags: 2,
      max_price: 3000,
      preco_alvo: 3000,
      hide_separate_and_self_transfer: 1,
      exclude_basic_economy: 1,
      ativa: 1,
      preco_atual: 2500,
      flexibilidade_dias: 0,
      sem_data: 0
    };

    const res = await FlightScanner.escanearRota(rotaComFiltros);
    assert.strictEqual(res.sucesso, true);
    assert.ok(opcoesCapturadas, 'Filtros avançados devem ser repassados para buscarOfertas');
    assert.strictEqual(opcoesCapturadas.maxStops, 0);
    assert.strictEqual(opcoesCapturadas.carryOnBags, 1);
    assert.strictEqual(opcoesCapturadas.checkedBags, 2);
    assert.strictEqual(opcoesCapturadas.maxPrice, 3000);
    assert.strictEqual(opcoesCapturadas.hideSeparateAndSelfTransfer, 1);
    assert.strictEqual(opcoesCapturadas.excludeBasicEconomy, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Testes de integração: Janela de Datas Flexíveis (calendarioPrecos & melhorDataAlternativa)
// ─────────────────────────────────────────────────────────────────────────────
describe('FlightScanner — Janela de Datas Flexíveis & Termômetro priceInsights', () => {
  const originalBuscarOfertas = FlightScanner.buscarOfertas;

  afterEach(() => {
    FlightScanner.buscarOfertas = originalBuscarOfertas;
  });

  it('deve varrer janela flexível (dias_flexiveis: 1), montar calendarioPrecos e calcular melhorDataAlternativa', async () => {
    // Rota cadastrada no banco para validar persistência
    const rotaCriada = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Lisboa',
      data_ida: '2027-06-10',
      data_volta: '2027-06-20',
      duracao_max_horas: 16,
      cabine: 'economy',
      dias_flexiveis: 1,
      preco_alvo: 4000
    });

    FlightScanner.buscarOfertas = async (origem, destino, dataIda, dataVolta) => {
      // Data base (2027-06-10): R$ 3500
      // Offset -1 (2027-06-09): R$ 2800 (R$ 700 mais barato!)
      // Offset +1 (2027-06-11): R$ 3900
      let preco = 3500;
      let cia = 'TAP Air Portugal';
      if (dataIda === '2027-06-09') {
        preco = 2800;
        cia = 'LATAM';
      } else if (dataIda === '2027-06-11') {
        preco = 3900;
        cia = 'Air France';
      }

      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco,
          cia,
          nivelPreco: 'low',
          duracaoHoras: 10.5,
          duracaoMinutos: 630,
          detalhes: `${cia} direto`,
          dicaStopover: '-',
          termometro: '🟢 Preço Baixo',
          origemReal: 'GRU',
          destinoReal: 'LIS',
          codigoDestinoReal: 'LIS',
          link: `https://flights.google.com/?ida=${dataIda}`,
          horarioPartida: '18:30',
          horarioChegada: '07:15',
          numeroVoo: 'TP 88',
          escalas: 0,
          priceInsights: {
            nivel: 'baixo',
            faixaMinima: 3000,
            faixaMaxima: 4200
          }
        }
      };
    };

    const res = await FlightScanner.escanearRota(rotaCriada);

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.oferta.preco, 3500, 'Preço base deve ser 3500');

    // Calendário de Preços ordenado
    assert.ok(Array.isArray(res.calendarioPrecos), 'Deve conter array calendarioPrecos');
    assert.strictEqual(res.calendarioPrecos.length, 3, 'Deve conter 3 offsets (-1, 0, 1)');
    assert.strictEqual(res.calendarioPrecos[0].offset, -1);
    assert.strictEqual(res.calendarioPrecos[0].preco, 2800);
    assert.strictEqual(res.calendarioPrecos[1].offset, 0);
    assert.strictEqual(res.calendarioPrecos[1].preco, 3500);
    assert.strictEqual(res.calendarioPrecos[2].offset, 1);
    assert.strictEqual(res.calendarioPrecos[2].preco, 3900);

    // Melhor Data Alternativa
    assert.ok(res.melhorDataAlternativa, 'Deve identificar melhorDataAlternativa mais barata');
    assert.strictEqual(res.melhorDataAlternativa.offset, -1);
    assert.strictEqual(res.melhorDataAlternativa.dataIda, '2027-06-09');
    assert.strictEqual(res.melhorDataAlternativa.dataVolta, '2027-06-19');
    assert.strictEqual(res.melhorDataAlternativa.preco, 2800);
    assert.strictEqual(res.melhorDataAlternativa.economiaReais, 700);
    assert.strictEqual(res.melhorDataAlternativa.economiaPercentual, 20);
    assert.strictEqual(res.melhorDataAlternativa.cia, 'LATAM');
    assert.ok(res.melhorDataAlternativa.linkGoogleFlights.startsWith('https://www.google.com/travel/flights'), 'Link deve ser URL do Google Flights');
    assert.ok(res.melhorDataAlternativa.linkGoogleFlights.includes('tfs='), 'Link deve conter payload tfs');

    // Validação da persistência no SQLite
    const rotaNoBanco = rotasRepo.buscarPorId(rotaCriada.id);
    assert.ok(rotaNoBanco.calendario_precos, 'calendario_precos deve ser persistido como JSON');
    assert.ok(rotaNoBanco.melhor_data_alternativa, 'melhor_data_alternativa deve ser persistida');
    assert.ok(rotaNoBanco.price_insights, 'price_insights deve ser persistido');

    const calSalvo = JSON.parse(rotaNoBanco.calendario_precos);
    assert.strictEqual(calSalvo.length, 3);
    const altSalva = JSON.parse(rotaNoBanco.melhor_data_alternativa);
    assert.strictEqual(altSalva.economiaReais, 700);
    const insightsSalvos = JSON.parse(rotaNoBanco.price_insights);
    assert.strictEqual(insightsSalvos.nivel, 'baixo');

    // Limpeza
    rotasRepo.excluir(rotaCriada.id);
  });

  it('11. escanearRota: deve realizar varredura multi-hub para rota regional (GRU ➔ EUR), consolidar ranking e eleger o destino mais barato em R$', async () => {
    const precosHubs = {
      LIS: 3120,
      MAD: 3390,
      OPO: 3650,
      CDG: 3800,
      MXP: 3510,
      FCO: 3900
    };

    const hubsConsultados = [];

    FlightScanner.buscarOfertas = async (...args) => {
      const dest = typeof args[0] === 'object' ? args[0].destinoCod : args[1];
      hubsConsultados.push(dest);
      const preco = precosHubs[dest] || 4500;
      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco,
          nivelPreco: 'NORMAL',
          duracaoHoras: 10.5,
          duracaoMinutos: 630,
          detalhes: `Voo para ${dest}`,
          cia: dest === 'LIS' ? 'TAP Air Portugal' : 'Iberia',
          dicaStopover: '-',
          termometro: '🟢 Preço Bom',
          origemReal: 'GRU',
          destinoReal: dest,
          codigoDestinoReal: dest,
          link: `https://www.google.com/travel/flights?q=Flights%20to%20${dest}`
        }
      };
    };

    const rotaRegional = rotasRepo.criar({
      origem: 'São Paulo',
      codigo_origem: 'GRU',
      destino: 'Europa',
      codigo_destino: 'EUR',
      data_ida: '2027-05-15',
      data_volta: '2027-05-25',
      sem_data: 0
    });

    const res = await FlightScanner.escanearRota(rotaRegional);

    assert.strictEqual(res.sucesso, true);
    assert.ok(Array.isArray(res.rankingDestinosRegionais), 'Deve retornar rankingDestinosRegionais');
    assert.strictEqual(res.rankingDestinosRegionais.length, 6, 'Deve varrer os 6 hubs da Europa');

    // 1º colocado: Lisboa (LIS) por R$ 3120
    assert.strictEqual(res.rankingDestinosRegionais[0].destinoIata, 'LIS');
    assert.strictEqual(res.rankingDestinosRegionais[0].preco, 3120);
    assert.strictEqual(res.rankingDestinosRegionais[0].nomeCidade, 'Lisboa');

    // 2º colocado: Madri (MAD) por R$ 3390
    assert.strictEqual(res.rankingDestinosRegionais[1].destinoIata, 'MAD');
    assert.strictEqual(res.rankingDestinosRegionais[1].preco, 3390);

    // Oferta principal eleita deve ser a de menor preço (LIS)
    assert.strictEqual(res.oferta.preco, 3120);
    assert.strictEqual(res.destinoVencedorIata, 'LIS');
    assert.strictEqual(res.destinoVencedorNome, 'Lisboa');
    assert.ok(!res.linkCanonicoRota.includes('EUR'), 'Link canônico não deve conter EUR sintético');
    assert.ok(res.linkCanonicoRota.startsWith('https://www.google.com/travel/flights'));

    const tfsParam = new URL(res.linkCanonicoRota).searchParams.get('tfs');
    if (tfsParam) {
      const decodedTfs = Buffer.from(tfsParam, 'base64').toString('utf8');
      assert.ok(decodedTfs.includes('LIS'), 'Payload tfs deve apontar para o aeroporto vencedor LIS');
      assert.ok(!decodedTfs.includes('EUR'), 'Payload tfs não deve conter código sintético EUR');
    } else {
      assert.ok(res.linkCanonicoRota.includes('LIS'), 'Link deve apontar para LIS');
    }

    // Persistência no SQLite
    const rotaSalva = rotasRepo.buscarPorId(rotaRegional.id);
    assert.ok(rotaSalva.ranking_destinos_regionais, 'ranking_destinos_regionais deve ser persistido no SQLite');
    const rankingSalvo = JSON.parse(rotaSalva.ranking_destinos_regionais);
    assert.strictEqual(rankingSalvo[0].destinoIata, 'LIS');
    assert.strictEqual(rankingSalvo[0].preco, 3120);

    // Limpeza
    rotasRepo.excluir(rotaRegional.id);
  });

  it('Bug 1 & 2: scanner regional com rota sem data_volta explícita deve varrer com data_volta calculada, links round-trip e SEM maxPrice contaminante', async () => {
    const chamadas = [];
    FlightScanner.buscarOfertas = async (origem, destino, ida, volta, duracao, cabine, adultos, moeda, filtros) => {
      chamadas.push({ origem, destino, ida, volta, filtros });
      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: destino === 'LIS' ? 3200 : 3500,
          nivelPreco: 'NORMAL',
          duracaoHoras: 10,
          cia: 'TAP',
          termometro: '🟢 Preço Normal',
          link: `https://www.google.com/travel/flights?q=Flights%20to%20${destino}`
        }
      };
    };

    const rotaRegionalSemVolta = rotasRepo.criar({
      origem: 'São Paulo',
      codigo_origem: 'GRU',
      destino: 'Europa',
      codigo_destino: 'EUR',
      data_ida: '2026-11-10',
      data_volta: null,
      dias_estadia: 10,
      preco_alvo: 2000,
      sem_data: 0
    });

    const res = await FlightScanner.escanearRota(rotaRegionalSemVolta);
    assert.strictEqual(res.sucesso, true);

    // 1. Nenhuma busca aos hubs regionais pode ter volta nula (deve ser 2026-11-20)
    assert.ok(chamadas.length > 0);
    chamadas.forEach(c => {
      assert.strictEqual(c.volta, '2026-11-20', `Hub ${c.destino} deve ser buscado com volta calculada 2026-11-20`);
      // 2. maxPrice NUNCA deve ser preenchido com preco_alvo
      assert.strictEqual(c.filtros.maxPrice, null, 'maxPrice NUNCA deve conter o preco_alvo da rota');
    });

    // 3. Links do ranking regional devem ser round-trip (conter volta ou returning)
    assert.ok(Array.isArray(res.rankingDestinosRegionais));
    res.rankingDestinosRegionais.forEach(item => {
      assert.ok(!item.linkGoogleFlights.includes('one-way'), `Link de ${item.destinoIata} não pode ser one-way`);
      assert.ok(item.linkGoogleFlights.includes('2026-11-20') || item.linkGoogleFlights.includes('returning') || item.linkGoogleFlights.includes('tfs='), `Link de ${item.destinoIata} deve conter a volta`);
    });

    rotasRepo.excluir(rotaRegionalSemVolta.id);
  });

  it('Bug 3: scanner em rota flexível (sem_data=1) NUNCA deve gerar termômetro com "()" vazio', async () => {
    FlightScanner.buscarOfertas = async () => ({
      ok: true,
      encontrouVoos: true,
      oferta: {
        preco: 2500,
        nivelPreco: 'NORMAL',
        duracaoHoras: 10,
        cia: 'TAP',
        termometro: '🟢 Preço Normal',
        link: 'https://flights.google.com/test'
      }
    });

    const rotaFlex = rotasRepo.criar({
      origem: 'São Paulo',
      codigo_origem: 'GRU',
      destino: 'Europa',
      codigo_destino: 'EUR',
      data_ida: '2026-11-10',
      sem_data: 1,
      dias_estadia: 10
    });

    const res = await FlightScanner.escanearRota(rotaFlex);
    assert.strictEqual(res.sucesso, true);

    const rotaSalva = rotasRepo.buscarPorId(rotaFlex.id);
    assert.ok(!rotaSalva.termometro.includes('()'), 'termometro salvo no banco NUNCA deve conter "()" vazio');

    rotasRepo.excluir(rotaFlex.id);
  });
});


