import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb, rotasRepo } from '../src/db.js';
import { rotasSync } from '../src/services/rotas_sync.js';

describe('Serviço de Sincronização Canônica Two-Way Sync (rotasSync)', () => {
  const testDbPath = path.resolve('./data/test_sync.sqlite');

  before(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    const db = getDb(testDbPath);
    db.prepare('DELETE FROM rotas').run();
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('deve sincronizar com o SQLite local: inserir novas rotas remotas', () => {
    const rotasCanonica = [
      {
        origem: 'São Paulo',
        destino: 'Lisboa',
        codigo_origem: 'SAO',
        codigo_destino: 'LIS',
        data_ida: '2026-11-10',
        data_volta: '2026-11-24',
        preco_alvo: 3500,
        duracao_max_horas: 14,
        sem_data: 0,
        dias_estadia: 14,
        ativa: 1
      },
      {
        origem: 'São Paulo',
        destino: 'Buenos Aires',
        codigo_origem: 'SAO',
        codigo_destino: 'BUE',
        data_ida: '2026-11-10',
        data_volta: null,
        preco_alvo: null,
        duracao_max_horas: 8,
        sem_data: 1,
        dias_estadia: 10,
        ativa: 1
      }
    ];

    const stats = rotasSync.sincronizarRotasComBanco(rotasCanonica);
    assert.strictEqual(stats.inseridas, 2);

    const todas = rotasRepo.listarTodas(false);
    assert.strictEqual(todas.length, 2);
    assert.strictEqual(todas[0].destino, 'Lisboa');
    assert.strictEqual(todas[1].sem_data, 1);
  });

  it('deve atualizar rotas modificadas e excluir as que foram removidas na nuvem', () => {
    // Nova lista: Lisboa agora com preço 3200, Buenos Aires foi excluído na nuvem, e entra Miami
    const novaCanonica = [
      {
        origem: 'São Paulo',
        destino: 'Lisboa',
        codigo_origem: 'SAO',
        codigo_destino: 'LIS',
        data_ida: '2026-11-10',
        data_volta: '2026-11-24',
        preco_alvo: 3200,
        duracao_max_horas: 14,
        sem_data: 0,
        dias_estadia: 14,
        ativa: 1
      },
      {
        origem: 'Rio de Janeiro',
        destino: 'Miami',
        codigo_origem: 'RIO',
        codigo_destino: 'MIA',
        data_ida: '2026-12-01',
        data_volta: '2026-12-15',
        preco_alvo: 2800,
        duracao_max_horas: 12,
        sem_data: 0,
        dias_estadia: 14,
        ativa: 1
      }
    ];

    const stats = rotasSync.sincronizarRotasComBanco(novaCanonica);
    assert.strictEqual(stats.atualizadas, 1);
    assert.strictEqual(stats.inseridas, 1);
    assert.strictEqual(stats.removidas, 1); // Buenos Aires foi removido

    const todas = rotasRepo.listarTodas(false);
    assert.strictEqual(todas.length, 2);

    const lisboa = todas.find(r => r.destino === 'Lisboa');
    assert.ok(lisboa);
    assert.strictEqual(lisboa.preco_alvo, 3200);

    const bue = todas.find(r => r.destino === 'Buenos Aires');
    assert.strictEqual(bue, undefined);
  });

  it('salvarArquivoRotas em modo de teste deve retornar lista sem escrever no disco', () => {
    const res = rotasSync.salvarArquivoRotas();
    assert.ok(Array.isArray(res));
    assert.strictEqual(res.length, 2);
  });
});
