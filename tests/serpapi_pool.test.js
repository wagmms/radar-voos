import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { serpApiPool } from '../src/services/serpapi_pool.js';
import { getDb, closeDb, chavesRepo } from '../src/db.js';

describe('Serviços: Pool de Chaves SerpAPI e Cotas', () => {
  const testDbPath = path.resolve('./data/test_serpapi.sqlite');

  before(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    getDb(testDbPath);
    serpApiPool.inicializar();
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('deve obter a primeira chave disponível e rotacionar', () => {
    const ch1 = serpApiPool.obterChaveDisponivel();
    assert.ok(ch1);
    assert.strictEqual(typeof ch1.chave, 'string');

    // Registrar consumo na chave obtida
    serpApiPool.registrarUso(ch1.indice);

    const relatorio = serpApiPool.obterRelatorio();
    assert.ok(relatorio.buscasHoje >= 1);
  });

  it('deve aplicar e respeitar cooldown de 30 minutos em caso de rate limit', () => {
    serpApiPool.registrarRateLimit(0, 30);
    const status = chavesRepo.listarStatus();
    const chave0 = status[0];
    assert.ok(chave0.cooldown_ate > Date.now());

    const relatorio = serpApiPool.obterRelatorio();
    assert.match(relatorio.chaves[0].estado, /Cooldown/);
  });
});
