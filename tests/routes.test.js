process.env.NODE_ENV = 'test';
delete process.env.GITHUB_TOKEN;
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/server/app.js';
import { getDb, closeDb } from '../src/db.js';
import { rotasSync } from '../src/services/rotas_sync.js';
import { config } from '../src/config.js';

describe('Servidor Fastify: Endpoints REST', () => {
  const testDbPath = path.resolve('./data/test_routes.sqlite');
  let app;

  before(async () => {
    delete process.env.GITHUB_TOKEN;
    if (config.github) {
      config.github.token = null;
    }
    rotasSync.sincronizarComGitHub = async () => ({ ok: true, skipped: true, commitSha: 'test-mock' });

    closeDb();
    for (const f of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
    getDb(testDbPath);
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    closeDb();
    for (const f of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  });

  it('GET /api/health deve retornar status 200 ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.status, 'ok');
  });

  it('GET /api/status deve retornar relatório do pool', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/status'
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.pool.totalChaves > 0);
  });

  it('POST /api/rotas deve validar e criar uma nova rota monitorada', async () => {
    const nova = {
      origem: 'São Paulo',
      destino: 'Lisboa',
      data_ida: '2026-11-15',
      data_volta: '14',
      preco_alvo: 4200,
      duracao_max_horas: 16
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: nova
    });

    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.rota.origem, 'São Paulo');
    assert.strictEqual(json.rota.codigo_origem, 'SAO');
    assert.strictEqual(json.rota.codigo_destino, 'LIS');
    assert.strictEqual(json.rota.data_volta, '2026-11-29');
  });

  it('POST /api/rotas deve criar rota flexível sem data com sem_data: 1', async () => {
    const rotaFlex = {
      origem: 'Rio de Janeiro',
      destino: 'Europa',
      sem_data: 1,
      dias_estadia: 15,
      preco_alvo: 3900
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: rotaFlex
    });

    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.rota.sem_data, 1);
    assert.strictEqual(json.rota.dias_estadia, 15);
    assert.ok(json.rota.data_ida);
    assert.ok(json.rota.data_volta);
  });

  it('POST /api/rotas deve criar rota flexível quando usuário informa "10 dias" no campo de volta', async () => {
    const rotaFlex = {
      origem: 'São Paulo',
      destino: 'Miami',
      sem_data: 1,
      data_volta: '10 dias',
      preco_alvo: 3200
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: rotaFlex
    });

    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.rota.sem_data, 1);
    assert.strictEqual(json.rota.dias_estadia, 10);
    assert.ok(json.rota.data_ida);
    assert.ok(json.rota.data_volta);
    // data_volta não deve ser nula e deve ser exatamente data_ida + 10 dias
    const [anoI, mesI, diaI] = json.rota.data_ida.split('-').map(Number);
    const [anoV, mesV, diaV] = json.rota.data_volta.split('-').map(Number);
    const diffDias = Math.round((Date.UTC(anoV, mesV - 1, diaV) - Date.UTC(anoI, mesI - 1, diaI)) / (1000 * 3600 * 24));
    assert.strictEqual(diffDias, 10);
  });

  it('GET /api/rotas deve listar as rotas criadas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rotas'
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.rotas.length >= 1);
  });

  it('GET /api/rotas deve incluir paridade_milhas e programa_milhas em todas as rotas', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/rotas' });
    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.rotas.length >= 1, 'Deve existir ao menos uma rota');

    for (const rota of json.rotas) {
      // paridade_milhas deve existir no payload (null quando não configurada)
      assert.ok(Object.prototype.hasOwnProperty.call(rota, 'paridade_milhas'),
        `rota ${rota.id} deve ter paridade_milhas`);
      // programa_milhas deve ser string não vazia com fallback 'smiles'
      assert.ok(typeof rota.programa_milhas === 'string' && rota.programa_milhas.length > 0,
        `rota ${rota.id} deve ter programa_milhas como string não vazia`);
      // milhas_estimadas deve existir no payload (null quando não há preco_atual)
      assert.ok(Object.prototype.hasOwnProperty.call(rota, 'milhas_estimadas'),
        `rota ${rota.id} deve ter milhas_estimadas`);
    }
  });

  it('GET /api/rotas deve retornar milhas_estimadas como null (descontinuado)', async () => {
    // Cria rota com parâmetros
    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: {
        origem: 'São Paulo',
        destino: 'Nova York',
        data_ida: '2026-12-10',
        data_volta: '10',
        preco_alvo: 5000
      }
    });
    assert.strictEqual(resCreate.statusCode, 201);
    const novaRota = resCreate.json().rota;

    // Configura paridade_milhas e programa_milhas via PATCH
    const resPatch = await app.inject({
      method: 'PATCH',
      url: `/api/rotas/${novaRota.id}/milhas`,
      payload: { paridade_milhas: 20.00, programa_milhas: 'latam' }
    });
    assert.strictEqual(resPatch.statusCode, 200);

    // Simula checagem: força preco_atual no banco para o teste
    const { getDb } = await import('../src/db.js');
    const db = getDb();
    db.prepare('UPDATE rotas SET preco_atual = 4500 WHERE id = ?').run(novaRota.id);

    // Verifica se GET /api/rotas retorna milhas_estimadas como null
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const json = resList.json();
    const rotaTeste = json.rotas.find(r => r.id === novaRota.id);

    assert.ok(rotaTeste, 'Rota recém-criada deve aparecer no listAll');
    assert.strictEqual(rotaTeste.programa_milhas, 'latam');
    assert.strictEqual(rotaTeste.paridade_milhas, 20.00);
    // milhas_estimadas deve ser null
    assert.strictEqual(rotaTeste.milhas_estimadas, null, 'milhas_estimadas deve ser null');
  });

  it('PUT /api/rotas/:id deve alterar parâmetros de uma rota existente', async () => {
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const rotaId = resList.json().rotas[0].id;

    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${rotaId}`,
      payload: {
        preco_alvo: 3500,
        duracao_max_horas: 12
      }
    });

    assert.strictEqual(resPut.statusCode, 200);
    const json = resPut.json();
    assert.strictEqual(json.rota.preco_alvo, 3500);
    assert.strictEqual(json.rota.duracao_max_horas, 12);
  });

  it('POST e PUT /api/rotas devem suportar e persistir dias_estadia explicitamente (ex: 14 dias) no modo flexível sem resetar para 10', async () => {
    // 1. Cria rota flexível com 14 dias de estadia
    const resPost = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: {
        origem: 'São Paulo',
        destino: 'Paris',
        sem_data: 1,
        dias_estadia: 14,
        preco_alvo: 4000
      }
    });

    assert.strictEqual(resPost.statusCode, 201);
    const rotaCriada = resPost.json().rota;
    assert.strictEqual(rotaCriada.sem_data, 1);
    assert.strictEqual(rotaCriada.dias_estadia, 14, 'dias_estadia deve ser exatamente 14');

    // 2. PUT atualizando apenas outro campo (ex: preco_alvo) garantindo que dias_estadia NÃO reseta para 10
    const resPut1 = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${rotaCriada.id}`,
      payload: {
        preco_alvo: 3800
      }
    });
    assert.strictEqual(resPut1.statusCode, 200);
    assert.strictEqual(resPut1.json().rota.dias_estadia, 14, 'dias_estadia deve continuar 14 após atualização parcial');

    // 3. PUT atualizando dias_estadia explicitamente para 21 dias
    const resPut2 = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${rotaCriada.id}`,
      payload: {
        dias_estadia: 21
      }
    });
    assert.strictEqual(resPut2.statusCode, 200);
    assert.strictEqual(resPut2.json().rota.dias_estadia, 21, 'dias_estadia deve atualizar para 21');

    // 4. GET /api/rotas deve confirmar 21 dias no banco
    const resGet = await app.inject({ method: 'GET', url: '/api/rotas' });
    const rotaConsultada = resGet.json().rotas.find(r => r.id === rotaCriada.id);
    assert.ok(rotaConsultada);
    assert.strictEqual(rotaConsultada.dias_estadia, 21, 'GET deve retornar dias_estadia 21 intacto');
  });

  it('POST e PUT /api/rotas devem suportar e persistir tipo_viagem ("one_way" vs "round_trip")', async () => {
    // 1. Cria rota com tipo_viagem: 'one_way'
    const resPost = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: {
        origem: 'Rio de Janeiro',
        destino: 'Belém',
        data_ida: '2027-01-17',
        tipo_viagem: 'one_way',
        preco_alvo: 600
      }
    });
    assert.strictEqual(resPost.statusCode, 201);
    const rotaCriada = resPost.json().rota;
    assert.strictEqual(rotaCriada.tipo_viagem, 'one_way');
    assert.strictEqual(rotaCriada.data_volta, null);
    assert.ok(rotaCriada.link_google_flights.includes('one-way'));

    // 2. Altera via PUT para tipo_viagem: 'round_trip' com data_volta
    const resPutRound = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${rotaCriada.id}`,
      payload: {
        tipo_viagem: 'round_trip',
        data_volta: '2027-01-27'
      }
    });
    assert.strictEqual(resPutRound.statusCode, 200);
    const rotaRound = resPutRound.json().rota;
    assert.strictEqual(rotaRound.tipo_viagem, 'round_trip');
    assert.strictEqual(rotaRound.data_volta, '2027-01-27');
    assert.ok(!rotaRound.link_google_flights.includes('one-way'));

    // 3. Altera de volta para tipo_viagem: 'one_way'
    const resPutOneWay = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${rotaCriada.id}`,
      payload: {
        tipo_viagem: 'one_way'
      }
    });
    assert.strictEqual(resPutOneWay.statusCode, 200);
    const rotaFinal = resPutOneWay.json().rota;
    assert.strictEqual(rotaFinal.tipo_viagem, 'one_way');
    assert.strictEqual(rotaFinal.data_volta, null);
    assert.ok(rotaFinal.link_google_flights.includes('one-way'));
  });

  it('GET /api/rotas/:id/clima deve retornar previsão climática do destino', async () => {
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const rotaId = resList.json().rotas[0].id;

    const resClima = await app.inject({
      method: 'GET',
      url: `/api/rotas/${rotaId}/clima`
    });

    assert.strictEqual(resClima.statusCode, 200);
    const json = resClima.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.clima);
    assert.ok(json.clima.resumo);
  });

  it('POST /api/rotas/:id/silenciar deve silenciar a rota temporariamente', async () => {
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const rotaId = resList.json().rotas[0].id;

    const resMute = await app.inject({
      method: 'POST',
      url: `/api/rotas/${rotaId}/silenciar`,
      payload: { horas: 24 }
    });

    assert.strictEqual(resMute.statusCode, 200);
    const json = resMute.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.rota.silenciada_ate);
  });

  it('GET /api/rotas/exportar deve exportar rotas sanitizadas para backup', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rotas/exportar'
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.ok(Array.isArray(json.rotas));
    assert.ok(json.rotas.length >= 1);
    assert.ok(json.rotas[0].origem);
    assert.ok(json.rotas[0].destino);
  });

  it('POST /api/rotas/importar deve importar lote de rotas com sucesso', async () => {
    const lote = [
      {
        origem: 'Brasília',
        destino: 'Miami',
        data_ida: '2026-12-01',
        data_volta: '10',
        preco_alvo: 3000
      }
    ];

    const res = await app.inject({
      method: 'POST',
      url: '/api/rotas/importar',
      payload: { rotas: lote, substituir: false }
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.importadas, 1);
  });

  it('GET /api/bug-fares deve retornar lista compatível com items e bugFares', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bug-fares'
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.ok(Array.isArray(json.items));
    assert.ok(Array.isArray(json.bugFares));
  });

  it('POST /api/bug-fares/escanear deve executar varredura proativa com sucesso', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bug-fares/escanear',
      payload: { limiteRotas: 1, incluirFeeds: false }
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.resultado);
  });

  it('POST /api/rotas com filtros fast-flights (max_stops: 0, carry_on_bags: 1) deve preservar max_stops 0 sem falsy bug', async () => {
    const rotaFiltros = {
      origem: 'Belo Horizonte',
      destino: 'Buenos Aires',
      data_ida: '2026-11-20',
      data_volta: '7',
      preco_alvo: 1950,
      max_stops: 0,
      carry_on_bags: 1
    };

    const resPost = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: rotaFiltros
    });

    assert.strictEqual(resPost.statusCode, 201);
    const rotaCriada = resPost.json().rota;
    assert.strictEqual(rotaCriada.max_stops, 0, 'max_stops 0 deve ser preservado na criação');
    assert.strictEqual(rotaCriada.carry_on_bags, 1);
    assert.strictEqual(rotaCriada.preco_alvo, 1950);

    // Verifica se GET /api/rotas retorna os campos corretamente
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const rotaNaLista = resList.json().rotas.find(r => r.id === rotaCriada.id);
    assert.ok(rotaNaLista, 'Rota criada deve constar no listAll');
    assert.strictEqual(rotaNaLista.max_stops, 0, 'max_stops 0 deve ser número 0 no GET');
    assert.strictEqual(rotaNaLista.carry_on_bags, 1);

    // Atualiza via PUT para max_stops: 1
    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${rotaCriada.id}`,
      payload: { max_stops: 1 }
    });
    assert.strictEqual(resPut.statusCode, 200);
    assert.strictEqual(resPut.json().rota.max_stops, 1);
  });

  it('POST /api/rotas e GET /api/rotas devem suportar dias_flexiveis e desserializar calendario_precos, melhor_data_alternativa e price_insights', async () => {
    const rotaFlex = {
      origem: 'São Paulo',
      destino: 'Madrid',
      data_ida: '2027-05-15',
      data_volta: '2027-05-25',
      duracao_max_horas: 16,
      cabine: 'economy',
      dias_flexiveis: 2,
      preco_alvo: 3800
    };

    const resPost = await app.inject({
      method: 'POST',
      url: '/api/rotas',
      payload: rotaFlex
    });

    assert.strictEqual(resPost.statusCode, 201);
    const criada = resPost.json().rota;
    assert.strictEqual(criada.dias_flexiveis, 2);

    // Simula checagem persistindo json nos novos campos
    const { getDb } = await import('../src/db.js');
    const db = getDb();
    const calendarioMock = [
      { offset: -1, dataIda: '2027-05-14', preco: 3200 },
      { offset: 0, dataIda: '2027-05-15', preco: 3600 },
      { offset: 1, dataIda: '2027-05-16', preco: 4000 }
    ];
    const melhorAltMock = {
      offset: -1,
      dataIda: '2027-05-14',
      preco: 3200,
      economiaReais: 400
    };
    const priceInsightsMock = {
      nivel: 'baixo',
      faixaMinima: 3300,
      faixaMaxima: 4500
    };

    db.prepare(`
      UPDATE rotas SET
        calendario_precos = ?,
        melhor_data_alternativa = ?,
        price_insights = ?
      WHERE id = ?
    `).run(
      JSON.stringify(calendarioMock),
      JSON.stringify(melhorAltMock),
      JSON.stringify(priceInsightsMock),
      criada.id
    );

    // Verifica GET /api/rotas
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const rotaNaLista = resList.json().rotas.find(r => r.id === criada.id);
    assert.ok(rotaNaLista);
    assert.strictEqual(rotaNaLista.dias_flexiveis, 2);
    assert.ok(Array.isArray(rotaNaLista.calendario_precos));
    assert.strictEqual(rotaNaLista.calendario_precos.length, 3);
    assert.strictEqual(rotaNaLista.melhor_data_alternativa?.economiaReais, 400);
    assert.strictEqual(rotaNaLista.price_insights?.nivel, 'baixo');

    // Verifica GET /api/rotas/:id
    const resGetId = await app.inject({ method: 'GET', url: `/api/rotas/${criada.id}` });
    assert.strictEqual(resGetId.statusCode, 200);
    const rotaDetalhada = resGetId.json().rota;
    assert.strictEqual(rotaDetalhada.dias_flexiveis, 2);
    assert.strictEqual(rotaDetalhada.calendario_precos.length, 3);
    assert.strictEqual(rotaDetalhada.melhor_data_alternativa.offset, -1);
    assert.strictEqual(rotaDetalhada.price_insights.faixaMinima, 3300);

    // Testa PUT alterando dias_flexiveis para 3
    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/rotas/${criada.id}`,
      payload: { dias_flexiveis: 3 }
    });
    assert.strictEqual(resPut.statusCode, 200);
    assert.strictEqual(resPut.json().rota.dias_flexiveis, 3);
  });

  it('GET / e /js/card_rota.js devem servir os assets estáticos do Cockpit PWA com sucesso', async () => {
    const resIndex = await app.inject({ method: 'GET', url: '/' });
    assert.strictEqual(resIndex.statusCode, 200);
    assert.ok(resIndex.body.includes('Radar de Voos'));

    const resCardRota = await app.inject({ method: 'GET', url: '/js/card_rota.js' });
    assert.strictEqual(resCardRota.statusCode, 200);
    assert.ok(resCardRota.body.includes('renderizarCardRota'));
  });

  it('GET / deve servir o botão ⚡ Varrer Todos os Voos e app.js deve conter varrerTodasRotas', async () => {
    const resIndex = await app.inject({ method: 'GET', url: '/' });
    assert.strictEqual(resIndex.statusCode, 200);
    assert.ok(resIndex.body.includes('btn-varrer-todas'));
    assert.ok(resIndex.body.includes('⚡ Varrer Todos os Voos'));

    const resApp = await app.inject({ method: 'GET', url: '/app.js' });
    assert.strictEqual(resApp.statusCode, 200);
    assert.ok(resApp.body.includes('varrerTodasRotas'));
    assert.ok(resApp.body.includes('/api/varredura'));
    assert.ok(resApp.body.includes('inicializarSseTelemetria'));
  });

  it('POST /api/varredura deve disparar ciclo sob demanda e responder com 409 quando ocupado', async () => {
    const { scheduler } = await import('../src/services/scheduler.js');
    const originalExecutarCiclo = scheduler.executarCiclo;
    const originalExecutando = scheduler.executando;

    try {
      scheduler.executarCiclo = async (todas) => ({ ok: true, processadas: todas ? 5 : 1 });
      scheduler.executando = false;

      const res = await app.inject({
        method: 'POST',
        url: '/api/varredura',
        payload: { todas: true }
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.ok, true);
      assert.strictEqual(json.resultado.processadas, 5);

      // Simula colisão / conflito (scheduler ocupado)
      scheduler.executando = true;
      const resBusy = await app.inject({
        method: 'POST',
        url: '/api/varredura',
        payload: { todas: true }
      });
      assert.strictEqual(resBusy.statusCode, 409);
      assert.strictEqual(resBusy.json().ok, false);
      assert.ok(resBusy.json().erro.includes('em execução'));
    } finally {
      scheduler.executarCiclo = originalExecutarCiclo;
      scheduler.executando = originalExecutando;
    }
  });
});


