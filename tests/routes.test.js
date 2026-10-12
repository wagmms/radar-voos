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
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    getDb(testDbPath);
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
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
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.rota.preco_alvo, 3500);
    assert.strictEqual(json.rota.duracao_max_horas, 12);
  });
});
