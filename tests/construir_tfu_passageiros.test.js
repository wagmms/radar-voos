/**
 * Testes unitários: construirTfu & gerarLinkGoogleFlightsCheapest com passageiros e cabine
 * Arquivo: tests/construir_tfu_passageiros.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  construirTfu,
  gerarLinkGoogleFlightsCheapest,
  gerarTfs
} from '../src/domain/rotas.js';

// Tfu padrão canônico do Google Flights: 1 adulto, economy, sem crianças
const TFU_PADRAO = 'EgoIABAAGAAgAigD';

describe('construirTfu: payload tfu dinâmico de passageiros e cabine', () => {
  it('deve gerar o tfu padrão canônico do Google para 1 adulto economy', () => {
    // Valida que o payload gerado bate byte-a-byte com o tfu hardcoded original
    assert.strictEqual(construirTfu(1, 0, 0, 'economy'), TFU_PADRAO);
    // Defaults opcionais devem produzir o mesmo resultado
    assert.strictEqual(construirTfu(), TFU_PADRAO);
    assert.strictEqual(construirTfu(1), TFU_PADRAO);
  });

  it('deve gerar tfu correto para 2 adultos economy', () => {
    const tfu = construirTfu(2, 0, 0, 'economy');
    const buf = Buffer.from(tfu, 'base64url');
    // Decodificar e verificar que adultos extras = 1 (campo 1, field 0x08, value 0x01)
    assert.ok(buf.includes(0x01), 'Deve conter valor 0x01 para adultos extras');
    // O tfu de 2 adultos deve ser diferente do padrão (1 adulto)
    assert.notStrictEqual(tfu, TFU_PADRAO);
  });

  it('deve gerar tfu correto para 3 adultos economy', () => {
    const tfu = construirTfu(3, 0, 0, 'economy');
    const buf = Buffer.from(tfu, 'base64url');
    // Field 1 byte = 0x08, próximo valor = adultos extras = 2
    const idx = buf.indexOf(0x08);
    assert.ok(idx >= 0, 'Deve ter field 0x08 (adultos extras)');
    assert.strictEqual(buf[idx + 1], 2, 'Adultos extras = 2 para 3 adultos total');
  });

  it('deve gerar tfu correto para 1 adulto + 2 crianças economy', () => {
    const tfu = construirTfu(1, 2, 0, 'economy');
    const buf = Buffer.from(tfu, 'base64url');
    // Field 2 = 0x10, valor = 2 crianças
    const idx = buf.indexOf(0x10);
    assert.ok(idx >= 0, 'Deve ter field 0x10 (crianças)');
    assert.strictEqual(buf[idx + 1], 2, 'Crianças = 2');
  });

  it('deve codificar classe business corretamente (field 6 = 0x30, valor 3)', () => {
    const tfu = construirTfu(1, 0, 0, 'business');
    const buf = Buffer.from(tfu, 'base64url');
    // Classe business: field 6 = 0x30, valor = 3
    const idx = buf.indexOf(0x30);
    assert.ok(idx >= 0, 'Deve ter field 0x30 (classe de cabine) para business');
    assert.strictEqual(buf[idx + 1], 3, 'Cabine business = 3');
    assert.notStrictEqual(tfu, TFU_PADRAO, 'Business deve diferir do tfu economy padrão');
  });

  it('deve codificar classe first corretamente (field 6 = 0x30, valor 4)', () => {
    const tfu = construirTfu(1, 0, 0, 'first');
    const buf = Buffer.from(tfu, 'base64url');
    const idx = buf.indexOf(0x30);
    assert.ok(idx >= 0, 'Deve ter field 0x30 (classe) para first class');
    assert.strictEqual(buf[idx + 1], 4, 'Cabine first = 4');
  });

  it('deve NÃO incluir field de cabine quando economy (é o padrão implícito)', () => {
    const tfu = construirTfu(1, 0, 0, 'economy');
    const buf = Buffer.from(tfu, 'base64url');
    // Não deve conter byte 0x30 (campo de cabine) para economy
    assert.strictEqual(buf.indexOf(0x30), -1, 'Economy não deve ter field de cabine 0x30');
  });

  it('deve codificar cenário completo: 2 adultos + 1 criança + business', () => {
    const tfu = construirTfu(2, 1, 0, 'business');
    const buf = Buffer.from(tfu, 'base64url');
    // Verificar: adultos extras=1, crianças=1, business=3
    const idxAdultos = buf.indexOf(0x08);
    assert.ok(idxAdultos >= 0);
    assert.strictEqual(buf[idxAdultos + 1], 1, 'Adultos extras = 1 (2 adultos - 1)');
    const idxCriancas = buf.indexOf(0x10);
    assert.ok(idxCriancas >= 0);
    assert.strictEqual(buf[idxCriancas + 1], 1, 'Crianças = 1');
    const idxCabine = buf.indexOf(0x30);
    assert.ok(idxCabine >= 0);
    assert.strictEqual(buf[idxCabine + 1], 3, 'Business = 3');
  });

  it('deve tratar defensivamente adultos inválidos (NaN, 0, negativo, string) retornando padrão 1', () => {
    // adultos = 0 deve ser tratado como 1 (mínimo)
    assert.strictEqual(construirTfu(0), TFU_PADRAO);
    // adultos NaN deve fallback para 1
    assert.strictEqual(construirTfu(NaN), TFU_PADRAO);
    // adultos negativo deve fallback para 1
    assert.strictEqual(construirTfu(-1), TFU_PADRAO);
    // adultos como string inválida deve fallback para 1
    assert.strictEqual(construirTfu('abc'), TFU_PADRAO);
  });

  it('deve tratar defensivamente crianças inválidas (NaN, negativo) como 0', () => {
    assert.strictEqual(construirTfu(1, NaN), TFU_PADRAO);
    assert.strictEqual(construirTfu(1, -1), TFU_PADRAO);
    assert.strictEqual(construirTfu(1, null), TFU_PADRAO);
  });

  it('deve tratar classe de cabine desconhecida ou null como economy (padrão)', () => {
    assert.strictEqual(construirTfu(1, 0, 0, 'executive'), TFU_PADRAO);
    assert.strictEqual(construirTfu(1, 0, 0, null), TFU_PADRAO);
    assert.strictEqual(construirTfu(1, 0, 0, undefined), TFU_PADRAO);
    assert.strictEqual(construirTfu(1, 0, 0, ''), TFU_PADRAO);
  });

  it('deve aceitar classe de cabine case-insensitive', () => {
    const tfuLower = construirTfu(1, 0, 0, 'business');
    const tfuUpper = construirTfu(1, 0, 0, 'BUSINESS');
    const tfuMixed = construirTfu(1, 0, 0, 'Business');
    assert.strictEqual(tfuLower, tfuUpper);
    assert.strictEqual(tfuLower, tfuMixed);
  });

  it('deve respeitar limite máximo de 9 adultos (sanitização do payload)', () => {
    const tfu = construirTfu(10, 0, 0, 'economy');
    const buf = Buffer.from(tfu, 'base64url');
    const idxAdultos = buf.indexOf(0x08);
    assert.ok(idxAdultos >= 0);
    // 9 adultos max = adultos extras = 8
    assert.strictEqual(buf[idxAdultos + 1], 8, 'Adultos extras sanitizados a 8 (máx 9 passageiros)');
  });

  it('premium_economy deve ter cabine codificada como 2', () => {
    const tfu = construirTfu(1, 0, 0, 'premium_economy');
    const buf = Buffer.from(tfu, 'base64url');
    const idxCabine = buf.indexOf(0x30);
    assert.ok(idxCabine >= 0, 'Deve conter field de cabine para premium_economy');
    assert.strictEqual(buf[idxCabine + 1], 2, 'Premium economy = 2');
  });
});

describe('gerarLinkGoogleFlightsCheapest: retrocompatibilidade e novos parâmetros', () => {
  it('deve retornar null quando dataIda ausente (retrocompatível)', () => {
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', null), null);
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', ''), null);
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', undefined), null);
  });

  it('deve usar tfu padrão (economy, 1 adulto) quando não forem fornecidos parâmetros extras', () => {
    const link = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24');
    assert.ok(link, 'Link não pode ser nulo');
    assert.ok(link.includes(`tfu=${TFU_PADRAO}`), `Link deve conter tfu padrão. Obteve: ${link}`);
  });

  it('deve gerar link com tfu de 2 adultos quando adultos=2', () => {
    const link = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', null, 2);
    assert.ok(link, 'Link não pode ser nulo');
    const tfuEsperado = construirTfu(2, 0, 0, 'economy');
    assert.ok(link.includes(`tfu=${tfuEsperado}`), `Link deve conter tfu de 2 adultos. Link: ${link}`);
    assert.ok(!link.includes(`tfu=${TFU_PADRAO}`), 'Link com 2 adultos não deve ter tfu padrão de 1 adulto');
  });

  it('deve gerar link com tfu business quando classeViagem=business', () => {
    const link = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', null, 1, 0, 'business');
    const tfuBiz = construirTfu(1, 0, 0, 'business');
    assert.ok(link.includes(`tfu=${tfuBiz}`), `Link deve conter tfu business. Link: ${link}`);
  });

  it('deve gerar link correto para Só Ida com 2 adultos first class', () => {
    const link = gerarLinkGoogleFlightsCheapest('SAO', 'JFK', '2026-12-15', null, null, 2, 0, 'first');
    assert.ok(link, 'Link one-way não pode ser nulo');
    const tfuEsperado = construirTfu(2, 0, 0, 'first');
    assert.ok(link.includes(`tfu=${tfuEsperado}`), 'Link deve conter tfu de 2 adultos first class');
    // Deve conter o tfs (rota codificada no protobuf)
    assert.ok(link.includes('tfs='), 'Link deve conter parâmetro tfs');
  });

  it('deve gerar link com tfu correto para 2 adultos + 1 criança business', () => {
    const link = gerarLinkGoogleFlightsCheapest('GRU', 'CDG', '2026-12-20', '2027-01-03', 16, 2, 1, 'business');
    const tfuEsperado = construirTfu(2, 1, 0, 'business');
    assert.ok(link.includes(`tfu=${tfuEsperado}`), 'Link deve ter tfu de 2 adultos + 1 criança business');
  });

  it('deve ser retrocompatível: chamada com 5 parâmetros (sem adultos/cabine) mantém tfu padrão', () => {
    const link5Params = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', 14);
    assert.ok(link5Params.includes(`tfu=${TFU_PADRAO}`), 'Chamada legada deve ter tfu padrão de 1 adulto economy');
  });

  it('deve manter URL com hl=pt-BR, gl=BR e curr=BRL em todos os links gerados', () => {
    const link = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', null, 2, 1, 'business');
    assert.ok(link.includes('hl=pt-BR'), 'Deve conter idioma pt-BR');
    assert.ok(link.includes('gl=BR'), 'Deve conter região BR');
    assert.ok(link.includes('curr=BRL'), 'Deve conter moeda BRL');
  });
});
