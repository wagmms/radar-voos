/**
 * Testes unitários: construirTfu & gerarLinkGoogleFlightsCheapest com passageiros e cabine
 * Arquivo: tests/construir_tfu_passageiros.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  construirTfu,
  gerarLinkGoogleFlights,
  gerarLinkGoogleFlightsCheapest,
  gerarTfs
} from '../src/domain/rotas.js';

// Tfu padrão canônico do Google Flights: 1 adulto, economy, sem crianças
const TFU_PADRAO = 'EgoIABAAGAAgAigD';

describe('Paridade entre link do cockpit e busca Cheapest', () => {
  it('compartilha tfs, tfu, moeda e abrangência metropolitana RIO → BEL sem restringir conexões', () => {
    const linkCockpit = new URL(gerarLinkGoogleFlights('RIO', 'BEL', '2027-01-17', null));
    const linkScraper = new URL(gerarLinkGoogleFlightsCheapest('RIO', 'BEL', '2027-01-17', null));
    const tfs = Buffer.from(linkScraper.searchParams.get('tfs'), 'base64url');

    assert.strictEqual(linkCockpit.searchParams.get('tfs'), linkScraper.searchParams.get('tfs'));
    assert.strictEqual(linkCockpit.searchParams.get('tfu'), linkScraper.searchParams.get('tfu'));
    assert.strictEqual(linkCockpit.searchParams.get('curr'), 'BRL');
    assert.strictEqual(linkScraper.searchParams.get('curr'), 'BRL');
    for (const aeroporto of ['GIG', 'SDU', 'BEL']) {
      assert.ok(tfs.includes(Buffer.from(aeroporto)), `${aeroporto} deve estar no tfs`);
    }
    assert.ok(!tfs.includes(Buffer.from([0x28, 0x00])), 'Busca pelo menor preço deve aceitar conexões');
  });
});

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

  it('QA Adversarial: deve retornar null quando dataIda for string malformada ou tipo inválido', () => {
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', 'data_invalida'), null);
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026/99/99'), null);
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', 12345), null);
    assert.strictEqual(gerarLinkGoogleFlightsCheapest('GRU', 'LIS', true), null);
  });

  it('QA Adversarial: deve calcular dataVolta quando fornecida como duração e descartar volta retroativa', () => {
    // 10 dias a partir de 2026-11-10 -> 2026-11-20
    const linkDuracao = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '10 dias');
    assert.ok(linkDuracao, 'Link com duração em dias não pode ser nulo');
    // Trip type deve ser 0x02 (Round-Trip) e conter o buffer da data 2026-11-20 no tfs
    const decodedTfsDuracao = Buffer.from(new URL(linkDuracao).searchParams.get('tfs'), 'base64url').toString('utf8');
    assert.ok(decodedTfsDuracao.includes('2026-11-20'), 'Deve conter data de volta calculada no protobuf tfs');

    // Volta retroativa anterior à ida (2026-11-01 < 2026-11-10) deve virar Só Ida (sem perna retroativa)
    const linkRetroativo = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-01');
    assert.ok(linkRetroativo, 'Link com volta retroativa não deve falhar');
    const decodedTfsRetroativo = Buffer.from(new URL(linkRetroativo).searchParams.get('tfs'), 'base64url').toString('utf8');
    assert.ok(!decodedTfsRetroativo.includes('2026-11-01'), 'Volta retroativa não deve constar no protobuf tfs');
  });

  it('QA Adversarial: deve blindar parâmetro moeda contra valores não-string sem lançar exceção', () => {
    // moeda como número, booleano, nulo ou vazio não deve lançar TypeError
    const linkNum = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', null, 1, 0, 'economy', 123);
    assert.ok(linkNum.includes('curr=BRL'), 'Moeda numérica deve ter fallback para BRL');

    const linkBool = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', null, 1, 0, 'economy', false);
    assert.ok(linkBool.includes('curr=BRL'), 'Moeda booleana deve ter fallback para BRL');

    const linkUsd = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-11-10', '2026-11-24', null, 1, 0, 'economy', 'usd');
    assert.ok(linkUsd.includes('curr=USD'), 'Moeda string minúscula deve ser convertida para maiúscula');
  });

  it('gerarTfs: deve codificar enum Trip como ROUND_TRIP (1) para ida e volta e ONE_WAY (2) para só ida', () => {
    // 1. Ida e Volta
    const tfsRT = gerarTfs({
      origens: ['GRU'],
      destinos: ['MIA'],
      dataIda: '2026-11-10',
      dataVolta: '2026-11-20'
    });
    const bufRT = Buffer.from(tfsRT, 'base64url');
    // Campo 19 (0x98, 0x01) com valor 0x01 (ROUND_TRIP) no final
    assert.strictEqual(bufRT[bufRT.length - 3], 0x98);
    assert.strictEqual(bufRT[bufRT.length - 2], 0x01);
    assert.strictEqual(bufRT[bufRT.length - 1], 0x01, 'Ida e Volta deve terminar com enum Trip = 1 (ROUND_TRIP)');

    // 2. Só Ida
    const tfsOW = gerarTfs({
      origens: ['GRU'],
      destinos: ['MIA'],
      dataIda: '2026-11-10',
      dataVolta: null
    });
    const bufOW = Buffer.from(tfsOW, 'base64url');
    // Campo 19 (0x98, 0x01) com valor 0x02 (ONE_WAY) no final
    assert.strictEqual(bufOW[bufOW.length - 3], 0x98);
    assert.strictEqual(bufOW[bufOW.length - 2], 0x01);
    assert.strictEqual(bufOW[bufOW.length - 1], 0x02, 'Só Ida deve terminar com enum Trip = 2 (ONE_WAY)');
  });
});

describe('gerarTfs: filtros avançados fast-flights (passageiros, cabine, maxStops, layover, bagagem)', () => {
  it('deve manter 100% de compatibilidade nos bytes de passageiros e cabine para 1 adulto economy padrão', () => {
    const tfs = gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10'
    });
    const buf = Buffer.from(tfs, 'base64url');
    // Deve conter tag 0x42 (field 8), tamanho 0x01, valor 0x01 (Adult)
    const idxPass = buf.indexOf(Buffer.from([0x42, 0x01, 0x01]));
    assert.ok(idxPass >= 0, 'Deve conter exatamente 0x42, 0x01, 0x01 para 1 adulto');
    // Deve conter tag 0x48 (field 9), valor 0x01 (Economy)
    const idxSeat = buf.indexOf(Buffer.from([0x48, 0x01]));
    assert.ok(idxSeat >= 0, 'Deve conter exatamente 0x48, 0x01 para Economy');
  });

  it('deve codificar passageiros dinâmicos no Field 8 (2 adultos, 1 criança, 1 bebê no assento = [1, 1, 2, 3])', () => {
    const tfs = gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      adultos: 2,
      criancas: 1,
      infantsInSeat: 1
    });
    const buf = Buffer.from(tfs, 'base64url');
    // Tag 0x42, tamanho 0x04, sequência [0x01, 0x01, 0x02, 0x03]
    const seqEsperada = Buffer.from([0x42, 0x04, 0x01, 0x01, 0x02, 0x03]);
    const idx = buf.indexOf(seqEsperada);
    assert.ok(idx >= 0, 'Deve conter sequência binária exata para 2 adultos, 1 criança e 1 bebê no assento');
  });

  it('deve codificar classe de cabine dinâmica no Field 9 (premium_economy=2, business=3, first=4)', () => {
    const tfsPrem = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['LIS'], dataIda: '2026-11-10', classeViagem: 'premium_economy' }), 'base64url');
    assert.ok(tfsPrem.indexOf(Buffer.from([0x48, 0x02])) >= 0, 'Premium economy deve ser 0x48, 0x02');

    const tfsBiz = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['LIS'], dataIda: '2026-11-10', classeViagem: 'business' }), 'base64url');
    assert.ok(tfsBiz.indexOf(Buffer.from([0x48, 0x03])) >= 0, 'Business deve ser 0x48, 0x03');

    const tfsFirst = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['LIS'], dataIda: '2026-11-10', classeViagem: 'first' }), 'base64url');
    assert.ok(tfsFirst.indexOf(Buffer.from([0x48, 0x04])) >= 0, 'First deve ser 0x48, 0x04');
  });

  it('deve codificar maxStops no Field 5 (0x28) de cada perna (0=direto, 1=até 1 parada, 2=até 2 paradas)', () => {
    // Voo direto: maxStops = 0
    const tfsDireto = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['MIA'], dataIda: '2026-11-10', maxStops: 0 }), 'base64url');
    assert.ok(tfsDireto.indexOf(Buffer.from([0x28, 0x00])) >= 0, 'maxStops=0 deve conter tag 0x28 com valor 0x00');

    // Até 1 parada: maxStops = 1
    const tfs1Parada = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['MIA'], dataIda: '2026-11-10', maxStops: 1 }), 'base64url');
    assert.ok(tfs1Parada.indexOf(Buffer.from([0x28, 0x01])) >= 0, 'maxStops=1 deve conter tag 0x28 com valor 0x01');

    // Até 2 paradas: maxStops = 2
    const tfs2Paradas = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['MIA'], dataIda: '2026-11-10', maxStops: 2 }), 'base64url');
    assert.ok(tfs2Paradas.indexOf(Buffer.from([0x28, 0x02])) >= 0, 'maxStops=2 deve conter tag 0x28 com valor 0x02');

    // Sem maxStops (null): não deve injetar tag 0x28
    const tfsSemFiltro = Buffer.from(gerarTfs({ origens: ['GRU'], destinos: ['MIA'], dataIda: '2026-11-10' }), 'base64url');
    assert.strictEqual(tfsSemFiltro.indexOf(Buffer.from([0x28])), -1, 'Sem maxStops não deve ter tag 0x28');
  });

  it('deve codificar maxLayoverMinutes no Field 18 (0x90, 0x01) em cada perna', () => {
    // Escala máxima de 180 minutos (3h)
    const tfsLayover = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      maxLayoverMinutes: 180
    }), 'base64url');
    // 180 em varint: (180 & 0x7f)|0x80 = 0xb4, 180 >> 7 = 1 -> [0xb4, 0x01]
    const seqLayover = Buffer.from([0x90, 0x01, 0xb4, 0x01]);
    assert.ok(tfsLayover.indexOf(seqLayover) >= 0, 'Deve conter Field 18 com valor 180min codificado');
  });

  it('deve codificar bagagem de mão (carryOnBags = 1) no Field 13 (0x6a)', () => {
    const tfsBag = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      carryOnBags: 1
    }), 'base64url');
    // Baggage submessage: carry_on_bags = 1 (tag 0x10, val 0x01) -> [0x10, 0x01], empacotado no Field 13: [0x6a, 0x02, 0x10, 0x01]
    const seqBag = Buffer.from([0x6a, 0x02, 0x10, 0x01]);
    assert.ok(tfsBag.indexOf(seqBag) >= 0, 'Deve conter submensagem Baggage com carry_on_bags=1');
  });

  it('gerarLinkGoogleFlightsCheapest: deve repassar novos filtros para tfs e tfu', () => {
    const link = gerarLinkGoogleFlightsCheapest(
      'GRU',
      'MIA',
      '2026-11-10',
      '2026-11-20',
      null,
      2,
      1,
      'business',
      'BRL',
      { maxStops: 0, carryOnBags: 1, maxLayoverMinutes: 120 }
    );
    assert.ok(link, 'Link deve ser gerado');
    const urlObj = new URL(link);
    const tfsDecoded = Buffer.from(urlObj.searchParams.get('tfs'), 'base64url');

    // Deve conter maxStops=0 ([0x28, 0x00])
    assert.ok(tfsDecoded.indexOf(Buffer.from([0x28, 0x00])) >= 0, 'Deve conter maxStops=0 no tfs');
    // Deve conter carryOnBags=1
    assert.ok(tfsDecoded.indexOf(Buffer.from([0x6a, 0x02, 0x10, 0x01])) >= 0, 'Deve conter carryOnBags=1 no tfs');
    // Deve conter business no Field 9 do tfs ([0x48, 0x03])
    assert.ok(tfsDecoded.indexOf(Buffer.from([0x48, 0x03])) >= 0, 'Deve conter business no tfs');
    // tfu deve estar presente e conter os passageiros e cabine
    assert.ok(urlObj.searchParams.get('tfu'), 'Deve conter parâmetro tfu');
  });

  it('deve codificar airlines (Field 6) por trecho no tfs', () => {
    const tfsAirlines = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['MIA'],
      dataIda: '2026-11-10',
      airlines: ['G3', 'ONEWORLD']
    }), 'base64url');
    // Field 6: tag 0x32, len 0x02, "G3" -> [0x32, 0x02, 0x47, 0x33]
    const seqG3 = Buffer.from([0x32, 0x02, 0x47, 0x33]);
    assert.ok(tfsAirlines.indexOf(seqG3) >= 0, 'Deve conter companhia G3 no Field 6');
    // Field 6: tag 0x32, len 0x08, "ONEWORLD"
    const seqOneworld = Buffer.concat([Buffer.from([0x32, 0x08]), Buffer.from('ONEWORLD')]);
    assert.ok(tfsAirlines.indexOf(seqOneworld) >= 0, 'Deve conter aliança ONEWORLD no Field 6');
  });

  it('deve codificar janelas de horário no tfs sem cair na armadilha do falsy para hora 0 (meia-noite)', () => {
    const tfsHoras = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      earliestDepartureHour: 0, // 0h deve ser serializado como [0x40, 0x00]
      latestDepartureHour: 18,  // 18h -> Field 9 [0x48, 0x12]
      earliestArrivalHour: 6,   // 6h -> Field 10 [0x50, 0x06]
      latestArrivalHour: 23     // 23h -> Field 11 [0x58, 0x17]
    }), 'base64url');

    // earliestDepartureHour = 0: tag 0x40, val 0x00
    assert.ok(tfsHoras.indexOf(Buffer.from([0x40, 0x00])) >= 0, 'earliestDepartureHour=0 deve conter [0x40, 0x00]');
    // latestDepartureHour = 18: tag 0x48, val 0x12 (18)
    assert.ok(tfsHoras.indexOf(Buffer.from([0x48, 0x12])) >= 0, 'latestDepartureHour=18 deve conter [0x48, 0x12]');
    // earliestArrivalHour = 6: tag 0x50, val 0x06
    assert.ok(tfsHoras.indexOf(Buffer.from([0x50, 0x06])) >= 0, 'earliestArrivalHour=6 deve conter [0x50, 0x06]');
    // latestArrivalHour = 23: tag 0x58, val 0x17 (23)
    assert.ok(tfsHoras.indexOf(Buffer.from([0x58, 0x17])) >= 0, 'latestArrivalHour=23 deve conter [0x58, 0x17]');
  });

  it('deve codificar minLayoverMinutes (Field 17) e connectingAirports (Field 15) no tfs', () => {
    const tfsConn = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['CDG'],
      dataIda: '2026-11-10',
      minLayoverMinutes: 60,
      connectingAirports: ['MAD']
    }), 'base64url');

    // minLayoverMinutes = 60: tag 17 varint -> [0x88, 0x01], val 60 (0x3c)
    assert.ok(tfsConn.indexOf(Buffer.from([0x88, 0x01, 0x3c])) >= 0, 'Deve conter minLayoverMinutes=60');
    // connectingAirports = ['MAD']: Field 15 length-delimited -> tag 0x7a, len 0x03, "MAD"
    const seqMad = Buffer.from([0x7a, 0x03, 0x4d, 0x41, 0x44]);
    assert.ok(tfsConn.indexOf(seqMad) >= 0, 'Deve conter MAD em connectingAirports (Field 15)');
  });

  it('deve codificar maxPrice (Field 12) com Varint multibyte para valores > 127', () => {
    // maxPrice = 1500 (1500 em varint: 0xdc, 0x0b)
    const tfsPrice = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['MIA'],
      dataIda: '2026-11-10',
      maxPrice: 1500
    }), 'base64url');

    // Field 12: tag 0x60, valor 1500 em varint -> [0x60, 0xdc, 0x0b]
    assert.ok(tfsPrice.indexOf(Buffer.from([0x60, 0xdc, 0x0b])) >= 0, 'Deve conter maxPrice=1500 em varint [0x60, 0xdc, 0x0b]');
  });

  it('deve codificar checkedBags (Field 3 do Baggage), hideSeparateAndSelfTransfer e excludeBasicEconomy', () => {
    const tfsOpts = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      carryOnBags: 1,
      checkedBags: 2,
      hideSeparateAndSelfTransfer: true,
      excludeBasicEconomy: true
    }), 'base64url');

    // Baggage: carry_on_bags=1 ([0x10, 0x01]), checked_bags=2 ([0x18, 0x02]) -> Submessage [0x10, 0x01, 0x18, 0x02], Field 13 [0x6a, 0x04, 0x10, 0x01, 0x18, 0x02]
    const seqBaggage = Buffer.from([0x6a, 0x04, 0x10, 0x01, 0x18, 0x02]);
    assert.ok(tfsOpts.indexOf(seqBaggage) >= 0, 'Deve conter carryOnBags=1 e checkedBags=2 na submensagem Baggage');

    // hideSeparateAndSelfTransfer: Field 17 varint -> [0x88, 0x01, 0x01]
    assert.ok(tfsOpts.indexOf(Buffer.from([0x88, 0x01, 0x01])) >= 0, 'Deve conter hideSeparateAndSelfTransfer=true');

    // excludeBasicEconomy: Field 25 varint -> [0xc8, 0x01, 0x01]
    assert.ok(tfsOpts.indexOf(Buffer.from([0xc8, 0x01, 0x01])) >= 0, 'Deve conter excludeBasicEconomy=true');
  });

  it('deve resolver precedência de bebês (infantsInSeat=3, infantsOnLap=4) sem duplicação', () => {
    // 1. Específicos: 1 adulto + 1 bebê no assento (3) + 1 bebê no colo (4)
    const tfsEsp = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      adultos: 1,
      infantsInSeat: 1,
      infantsOnLap: 1
    }), 'base64url');
    // Field 8: tag 0x42, len 0x03, [1, 3, 4]
    const seqEsp = Buffer.from([0x42, 0x03, 0x01, 0x03, 0x04]);
    assert.ok(tfsEsp.indexOf(seqEsp) >= 0, 'Deve codificar Adult=1, InfantInSeat=3, InfantOnLap=4');

    // 2. Fallback legado: bebes=1 sem específicos -> mapeia para InfantOnLap = 4
    const tfsLeg = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      adultos: 1,
      bebes: 1
    }), 'base64url');
    // Field 8: tag 0x42, len 0x02, [1, 4]
    const seqLeg = Buffer.from([0x42, 0x02, 0x01, 0x04]);
    assert.ok(tfsLeg.indexOf(seqLeg) >= 0, 'bebes=1 deve mapear para InfantOnLap=4 por padrão');

    // 3. Precedência: quando infantsOnLap é declarado, bebes é ignorado sem duplicação
    const tfsPrec = Buffer.from(gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-11-10',
      adultos: 1,
      bebes: 5, // deve ser ignorado pela presença de infantsOnLap
      infantsOnLap: 1
    }), 'base64url');
    assert.ok(tfsPrec.indexOf(seqLeg) >= 0, 'Deve priorizar infantsOnLap e não duplicar contagem de bebês');
  });
});



