import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/server/app.js';
import { getDb, closeDb } from '../src/db.js';

describe('Servidor Fastify: Endpoints REST', () => {
  const testDbPath = path.resolve('./data/test_routes.sqlite');
  let app;

  before(async () => {
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

  it('GET /api/rotas deve retornar milhas_estimadas calculado quando preco_atual existe', async () => {
    // Cria rota com paridade_milhas configurada
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

    // Verifica se GET /api/rotas retorna milhas_estimadas calculadas
    const resList = await app.inject({ method: 'GET', url: '/api/rotas' });
    const json = resList.json();
    const rotaTeste = json.rotas.find(r => r.id === novaRota.id);

    assert.ok(rotaTeste, 'Rota recém-criada deve aparecer no listAll');
    assert.strictEqual(rotaTeste.programa_milhas, 'latam');
    assert.strictEqual(rotaTeste.paridade_milhas, 20.00);
    // milhas_estimadas deve existir e conter { milhas, programa, cotacaoMilheiro }
    assert.ok(rotaTeste.milhas_estimadas !== null, 'milhas_estimadas não deve ser null quando há preco_atual');
    assert.ok(typeof rotaTeste.milhas_estimadas.milhas === 'number', 'milhas_estimadas.milhas deve ser número');
    assert.ok(rotaTeste.milhas_estimadas.milhas > 0, 'milhas_estimadas.milhas deve ser positivo');
    assert.strictEqual(rotaTeste.milhas_estimadas.programa, 'latam');
    assert.strictEqual(rotaTeste.milhas_estimadas.cotacaoMilheiro, 20.00);
    // Verificação de valor: ceil(4500 / 20.00 * 1000) = 225000 milhas
    assert.strictEqual(rotaTeste.milhas_estimadas.milhas, Math.ceil((4500 / 20.00) * 1000));
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
});


