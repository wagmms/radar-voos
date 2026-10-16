/**
 * Testes para Protobuf tfs - Novos Filtros Avançados (Paridade fast-flights)
 * Valida a codificação binária dos campos 13 (Baggage), 17 (Hide Separate/Self Transfer)
 * e 25 (Exclude Basic Economy), bem como a assinatura Chrome 145 nos headers stealth.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarTfs,
  gerarLinkGoogleFlightsCheapest,
  ehRotaIntercontinental
} from '../src/domain/rotas.js';
import { construirUrlBuscaScrapling } from '../src/services/providers/scrapling_client.js';
import {
  USER_AGENTS_STEALTH,
  construirHeadersStealth
} from '../src/services/providers/google_flights_direct_provider.js';

function decodificarBase64UrlParaBuffer(tfs) {
  const base64 = String(tfs).replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  return Buffer.from(base64 + '='.repeat(padLength), 'base64');
}

function contemSubsequenciaBytes(buffer, sequencia) {
  const seqBuf = Buffer.from(sequencia);
  return buffer.indexOf(seqBuf) !== -1;
}

describe('Protobuf tfs - Novos Filtros Avançados (fast_flights parity)', () => {
  it('Deve codificar Field 17 (hide_separate_and_self_transfer = [0x88, 0x01, 0x01]) quando ativado', () => {
    const tfsComFiltro = gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-09-10',
      dataVolta: '2026-09-20',
      hideSeparateAndSelfTransfer: true
    });
    const tfsSemFiltro = gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: '2026-09-10',
      dataVolta: '2026-09-20',
      hideSeparateAndSelfTransfer: false
    });

    const bufCom = decodificarBase64UrlParaBuffer(tfsComFiltro);
    const bufSem = decodificarBase64UrlParaBuffer(tfsSemFiltro);

    assert.strictEqual(contemSubsequenciaBytes(bufCom, [0x88, 0x01, 0x01]), true);
    assert.strictEqual(contemSubsequenciaBytes(bufSem, [0x88, 0x01, 0x01]), false);
  });

  it('Deve codificar Field 25 (exclude_basic_economy = [0xc8, 0x01, 0x01]) quando ativado', () => {
    const tfsComFiltro = gerarTfs({
      origens: ['GRU'],
      destinos: ['MIA'],
      dataIda: '2026-10-05',
      dataVolta: '2026-10-15',
      excludeBasicEconomy: true
    });
    const tfsSemFiltro = gerarTfs({
      origens: ['GRU'],
      destinos: ['MIA'],
      dataIda: '2026-10-05',
      dataVolta: '2026-10-15',
      excludeBasicEconomy: false
    });

    const bufCom = decodificarBase64UrlParaBuffer(tfsComFiltro);
    const bufSem = decodificarBase64UrlParaBuffer(tfsSemFiltro);

    assert.strictEqual(contemSubsequenciaBytes(bufCom, [0xc8, 0x01, 0x01]), true);
    assert.strictEqual(contemSubsequenciaBytes(bufSem, [0xc8, 0x01, 0x01]), false);
  });

  it('Deve codificar Field 13 (Baggage: carry_on_bags=1 [0x10, 0x01], checked_bags=2 [0x18, 0x02])', () => {
    const tfsBagagem = gerarTfs({
      origens: ['GRU'],
      destinos: ['CDG'],
      dataIda: '2026-11-01',
      dataVolta: '2026-11-12',
      carryOnBags: 1,
      checkedBags: 2
    });
    const buf = decodificarBase64UrlParaBuffer(tfsBagagem);

    // Field 13 tag = 0x6a, length = 0x04, field 2 = 0x10 0x01, field 3 = 0x18 0x02
    assert.strictEqual(contemSubsequenciaBytes(buf, [0x6a, 0x04, 0x10, 0x01, 0x18, 0x02]), true);
  });

  it('gerarLinkGoogleFlightsCheapest deve ativar hideSeparateAndSelfTransfer=true por padrão defensivo', () => {
    const urlPadrao = gerarLinkGoogleFlightsCheapest('GRU', 'MAD', '2026-08-10', '2026-08-20');
    const tfsPadrao = new URL(urlPadrao).searchParams.get('tfs');
    const bufPadrao = decodificarBase64UrlParaBuffer(tfsPadrao);

    assert.strictEqual(contemSubsequenciaBytes(bufPadrao, [0x88, 0x01, 0x01]), true);

    // Deve permitir desativar explicitamente quando hideSeparateAndSelfTransfer = false
    const urlDesativado = gerarLinkGoogleFlightsCheapest('GRU', 'MAD', '2026-08-10', '2026-08-20', null, 1, 0, 'economy', 'BRL', {
      hideSeparateAndSelfTransfer: false
    });
    const tfsDesativado = new URL(urlDesativado).searchParams.get('tfs');
    const bufDesativado = decodificarBase64UrlParaBuffer(tfsDesativado);

    assert.strictEqual(contemSubsequenciaBytes(bufDesativado, [0x88, 0x01, 0x01]), false);
  });

  it('ehRotaIntercontinental e autoExcludeBasicEconomyIntercontinental devem funcionar corretamente', () => {
    assert.strictEqual(ehRotaIntercontinental('GRU', 'LIS'), true);
    assert.strictEqual(ehRotaIntercontinental('GIG', 'JFK'), true);
    assert.strictEqual(ehRotaIntercontinental('GRU', 'EZE'), false);
    assert.strictEqual(ehRotaIntercontinental('GRU', 'REC'), false);

    const urlIntercontinental = gerarLinkGoogleFlightsCheapest('GRU', 'LIS', '2026-09-01', '2026-09-15', null, 1, 0, 'economy', 'BRL', {
      autoExcludeBasicEconomyIntercontinental: true
    });
    const bufInter = decodificarBase64UrlParaBuffer(new URL(urlIntercontinental).searchParams.get('tfs'));
    assert.strictEqual(contemSubsequenciaBytes(bufInter, [0xc8, 0x01, 0x01]), true);

    const urlSulAmerica = gerarLinkGoogleFlightsCheapest('GRU', 'EZE', '2026-09-01', '2026-09-08', null, 1, 0, 'economy', 'BRL', {
      autoExcludeBasicEconomyIntercontinental: true
    });
    const bufSul = decodificarBase64UrlParaBuffer(new URL(urlSulAmerica).searchParams.get('tfs'));
    assert.strictEqual(contemSubsequenciaBytes(bufSul, [0xc8, 0x01, 0x01]), false);
  });

  it('construirUrlBuscaScrapling deve propagar hideSeparateAndSelfTransfer=true por padrão', () => {
    const url = construirUrlBuscaScrapling('VCP', 'MCO', '2026-10-10', '2026-10-20');
    const tfs = new URL(url).searchParams.get('tfs');
    const buf = decodificarBase64UrlParaBuffer(tfs);

    assert.strictEqual(contemSubsequenciaBytes(buf, [0x88, 0x01, 0x01]), true);
  });

  it('USER_AGENTS_STEALTH deve usar assinatura Chrome 145 (Windows, macOS e Linux)', () => {
    assert.strictEqual(USER_AGENTS_STEALTH.length, 3);
    for (const uaObj of USER_AGENTS_STEALTH) {
      assert.match(uaObj.ua, /Chrome\/145\.0\.0\.0/);
    }

    const headersMac = construirHeadersStealth(USER_AGENTS_STEALTH[1]);
    assert.match(headersMac['Sec-Ch-Ua'], /"Google Chrome";v="145"/);
    assert.strictEqual(headersMac['Sec-Ch-Ua-Platform'], '"macOS"');
  });
});
