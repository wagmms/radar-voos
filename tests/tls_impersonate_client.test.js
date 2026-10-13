import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verificarPrimpDisponivel,
  fetchComPrimpTls
} from '../src/services/providers/tls_impersonate_client.js';

describe('TLS Impersonation Engine (Padrão primp / Chrome 145)', () => {
  it('verificarPrimpDisponivel deve retornar booleano sem estourar exceção', async () => {
    const disponivel = await verificarPrimpDisponivel();
    assert.strictEqual(typeof disponivel, 'boolean');
  });

  it('fetchComPrimpTls deve respeitar timeout e retornar objeto estruturado', async () => {
    const resultado = await fetchComPrimpTls('https://httpbin.org/status/200', {
      timeoutMs: 5000
    });
    assert.strictEqual(typeof resultado, 'object');
    assert.ok('ok' in resultado);
    assert.ok('status' in resultado);
    assert.ok('text' in resultado);
  });

  it('fetchComPrimpTls deve degradar graciosamente para URLs inválidas ou inexistentes', async () => {
    const resultado = await fetchComPrimpTls('http://localhost:59999/nao-existe', {
      timeoutMs: 1500
    });
    assert.strictEqual(resultado.ok, false);
    assert.ok(resultado.erro);
  });
});
