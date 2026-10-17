import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executarComConcorrenciaLimitada } from '../src/services/flight_scanner.js';
import { scheduler } from '../src/services/scheduler.js';
import { CORREDORES_GLOBAIS_SWEET_SPOT } from '../src/services/bug_fare_hunter.js';

describe('Performance & Concorrência Controlada (Pilar 3)', () => {
  it('executarComConcorrenciaLimitada deve preservar ordem e limitar paralelismo a N=2', async () => {
    let ativos = 0;
    let maxAtivos = 0;

    const itens = [10, 20, 30, 40, 50];
    const resultados = await executarComConcorrenciaLimitada(itens, async (item) => {
      ativos++;
      if (ativos > maxAtivos) maxAtivos = ativos;
      await new Promise(r => setTimeout(r, 20));
      ativos--;
      return item * 2;
    }, { limite: 2, staggerMs: 5 });

    assert.equal(maxAtivos, 2, 'Não deve exceder limite de 2 workers simultâneos');
    assert.deepEqual(resultados, [20, 40, 60, 80, 100], 'Deve preservar a ordem original dos itens');
  });

  it('executarComConcorrenciaLimitada deve tolerar falhas graciosamente retornando null para o item com erro', async () => {
    const itens = ['a', 'b', 'c'];
    const resultados = await executarComConcorrenciaLimitada(itens, async (item) => {
      if (item === 'b') throw new Error('Falha simulada');
      return item.toUpperCase();
    }, { limite: 2, staggerMs: 0 });

    assert.deepEqual(resultados, ['A', null, 'C']);
  });
});

describe('Scheduler Multi-Tier & Super-Clusters (Pilares 1 e 2)', () => {
  it('Scheduler deve expor 3 pistas independentes e calibração de alta performance', () => {
    assert.ok(scheduler.intervaloFeedsMinutos <= 5, 'Feeds devem rodar com alta frequência (<= 5 min)');
    assert.ok(scheduler.intervaloMinutos <= 15, 'Scanner deve rodar em micro-lotes (<= 15 min)');
    assert.ok(scheduler.intervaloHunterMinutos <= 30, 'Hunter deve rodar de forma contínua');
    assert.equal(typeof scheduler.executarCicloFeeds, 'function');
    assert.equal(typeof scheduler.executarCicloHunter, 'function');
  });

  it('iniciar e parar o scheduler deve gerenciar timers de todas as pistas sem vazamentos', () => {
    scheduler.iniciar();
    assert.ok(scheduler.timerFeeds !== null, 'timerFeeds deve estar ativo');
    assert.ok(scheduler.timerScanner !== null, 'timerScanner deve estar ativo');
    assert.ok(scheduler.timerHunter !== null, 'timerHunter deve estar ativo');

    scheduler.parar();
    assert.equal(scheduler.timerFeeds, null);
    assert.equal(scheduler.timerScanner, null);
    assert.equal(scheduler.timerHunter, null);
  });

  it('CORREDORES_GLOBAIS_SWEET_SPOT deve conter Super-Clusters Multi-IATA no topo e manter >= 15 corredores', () => {
    assert.ok(CORREDORES_GLOBAIS_SWEET_SPOT.length >= 15);
    const primeiro = CORREDORES_GLOBAIS_SWEET_SPOT[0];
    assert.ok(primeiro.destino.includes(','), 'O primeiro item deve ser um Super-Cluster multi-IATA');
    assert.equal(primeiro.regiao, 'EUROPA');
  });
});
