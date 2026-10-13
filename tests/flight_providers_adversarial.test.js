/**
 * Testes Adversariais: Providers de Voo — QA Adversarial Sprint
 *
 * Cobertura de casos extremos descobertos durante auditoria QA:
 * 1. extrairPrecoNumerico — zero como preço inválido, strings vazias
 * 2. converterDuracaoParaHoras — precisão de 3 casas (evita filtros errados de duração)
 * 3. limparNomeCompanhia — sufixos corporativos, "Multiple airlines/carriers"
 * 4. extrairPrecoCheapestTab — espaços extras, formato compacto [null,N], token base64
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extrairPrecoNumerico,
  converterDuracaoParaHoras,
  limparNomeCompanhia
} from '../src/services/providers/google_flights_direct_provider.js';

import {
  extrairPrecoCheapestTab
} from '../src/services/providers/scrapling_client.js';

// ─────────────────────────────────────────────────────────────────────────────
describe('QA Adversarial: extrairPrecoNumerico — casos de borda', () => {
  it('deve retornar null para "0" — zero não é preço válido de passagem', () => {
    assert.equal(extrairPrecoNumerico('0'), null);
  });

  it('deve retornar null para string vazia', () => {
    assert.equal(extrairPrecoNumerico(''), null);
  });

  it('deve retornar null para null/undefined', () => {
    assert.equal(extrairPrecoNumerico(null), null);
    assert.equal(extrairPrecoNumerico(undefined), null);
  });

  it('deve extrair preço com ponto de milhar brasileiro: "1.250" → 1250', () => {
    assert.equal(extrairPrecoNumerico('1.250'), 1250);
  });

  it('deve extrair preço com ponto de milhar e vírgula decimal: "1.250,00" → 1250', () => {
    assert.equal(extrairPrecoNumerico('1.250,00'), 1250);
  });

  it('deve extrair preço com espaço como separador: "1 250" → 1250', () => {
    assert.equal(extrairPrecoNumerico('1 250'), 1250);
  });

  it('deve extrair preço de valor com texto contextual: "1.450 Reais brasileiros" → 1450', () => {
    assert.equal(extrairPrecoNumerico('1.450 Reais brasileiros'), 1450);
  });

  it('deve retornar null para texto sem dígitos', () => {
    assert.equal(extrairPrecoNumerico('abc'), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('QA Adversarial: converterDuracaoParaHoras — precisão decimal', () => {
  it('deve converter "3 h 40 min" para 3.667 com 3 casas decimais de precisão', () => {
    const resultado = converterDuracaoParaHoras('3 h 40 min');
    assert.ok(Math.abs(resultado - 3.667) < 0.001, `esperado ≈3.667, recebeu ${resultado}`);
  });

  it('deve converter "1 h 20 min" para 1.333', () => {
    const resultado = converterDuracaoParaHoras('1 h 20 min');
    assert.ok(Math.abs(resultado - 1.333) < 0.001);
  });

  it('deve converter "45 min" para 0.75 (crítico: antes retornava 0.8 causando filtros errados)', () => {
    const resultado = converterDuracaoParaHoras('45 min');
    assert.ok(Math.abs(resultado - 0.75) < 0.001, `esperado 0.75, recebeu ${resultado}`);
  });

  it('deve suportar formato compacto "2h30m" → 2.5', () => {
    const resultado = converterDuracaoParaHoras('2h30m');
    assert.ok(Math.abs(resultado - 2.5) < 0.001);
  });

  it('deve suportar "2h30min" → 2.5', () => {
    const resultado = converterDuracaoParaHoras('2h30min');
    assert.ok(Math.abs(resultado - 2.5) < 0.001);
  });

  it('deve retornar fallback 12.0 para string vazia ou nula', () => {
    assert.equal(converterDuracaoParaHoras(''), 12.0);
    assert.equal(converterDuracaoParaHoras(null), 12.0);
    assert.equal(converterDuracaoParaHoras('abc'), 12.0);
  });

  it('deve preservar precisão que afeta filtros: duracaoMaxHoras=0.7 e voo de 40min (0.667h) deve PASSAR', () => {
    // Bug anterior: 40min → 0.8h (acima de 0.7 → filtrado incorretamente)
    // Correção: 40min → 0.667h (abaixo de 0.7 → não filtrado → correto)
    const duracao = converterDuracaoParaHoras('40 min');
    assert.ok(duracao < 0.7, `40min deveria ser < 0.7h mas foi ${duracao}`);
  });

  it('deve converter formato compacto somente com minutos "45m" e "50 m" evitando fallback de 12h', () => {
    const dur45 = converterDuracaoParaHoras('45m');
    const dur50 = converterDuracaoParaHoras('50 m');
    assert.ok(Math.abs(dur45 - 0.75) < 0.001, `esperado 0.75, recebeu ${dur45}`);
    assert.ok(Math.abs(dur50 - 0.833) < 0.001, `esperado ≈0.833, recebeu ${dur50}`);
  });

  it('deve suportar entradas numéricas e lidar defensivamente com extremos (negativo, Infinity, NaN)', () => {
    assert.equal(converterDuracaoParaHoras(2.5), 2.5);
    assert.equal(converterDuracaoParaHoras(-10), 12.0);
    assert.equal(converterDuracaoParaHoras(Infinity), 12.0);
    assert.equal(converterDuracaoParaHoras(NaN), 12.0);
  });

  it('deve converter formato de relógio digital "HH:MM" (ex: "02:30" → 2.5, "1:45" → 1.75)', () => {
    const dur230 = converterDuracaoParaHoras('02:30');
    const dur145 = converterDuracaoParaHoras('1:45');
    assert.equal(dur230, 2.5);
    assert.equal(dur145, 1.75);
  });

  it('deve converter formatos decimais com ponto ou vírgula: "2.5h" → 2.5 e "1,5 h" → 1.5', () => {
    const durPonto = converterDuracaoParaHoras('2.5h');
    const durVirgula = converterDuracaoParaHoras('1,5 h');
    assert.equal(durPonto, 2.5);
    assert.equal(durVirgula, 1.5);
  });

  it('deve retornar fallback de 12.0 para tempo zerado em relógio digital ("00:00" ou "0:00")', () => {
    assert.equal(converterDuracaoParaHoras('00:00'), 12.0);
    assert.equal(converterDuracaoParaHoras('0:00'), 12.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('QA Adversarial: limparNomeCompanhia — sufixos corporativos', () => {
  it('deve remover "Linhas Aéreas" de GOL e Azul', () => {
    assert.equal(limparNomeCompanhia('GOL Linhas Aéreas'), 'GOL');
    assert.equal(limparNomeCompanhia('Azul Linhas Aéreas'), 'Azul');
  });

  it('deve remover sufixo "Group" preservando "Airlines": "LATAM Airlines Group" → "LATAM Airlines"', () => {
    assert.equal(limparNomeCompanhia('LATAM Airlines Group'), 'LATAM Airlines');
  });

  it('deve remover "Holdings" preservando "Airlines": "Copa Airlines Holdings" → "Copa Airlines"', () => {
    assert.equal(limparNomeCompanhia('Copa Airlines Holdings'), 'Copa Airlines');
  });

  it('deve remover sufixo "Airline" (singular) preservando o nome: "Emirates Airline" → "Emirates"', () => {
    assert.equal(limparNomeCompanhia('Emirates Airline'), 'Emirates');
  });

  it('deve traduzir "Multiple airlines" → "Múltiplas Companhias"', () => {
    assert.equal(limparNomeCompanhia('Multiple airlines'), 'Múltiplas Companhias');
  });

  it('deve traduzir "Multiple carriers" → "Múltiplas Companhias"', () => {
    assert.equal(limparNomeCompanhia('Multiple carriers'), 'Múltiplas Companhias');
  });

  it('deve remover S.A.: "Aerolíneas Argentinas S.A." → "Aerolíneas Argentinas"', () => {
    assert.equal(limparNomeCompanhia('Aerolíneas Argentinas S.A.'), 'Aerolíneas Argentinas');
  });

  it('deve preservar "Air Portugal" em "TAP Air Portugal" — não remove "Air"', () => {
    assert.equal(limparNomeCompanhia('TAP Air Portugal'), 'TAP Air Portugal');
  });

  it('deve preservar "LATAM Airlines" quando não há sufixo para remover', () => {
    assert.equal(limparNomeCompanhia('LATAM Airlines'), 'LATAM Airlines');
  });

  it('deve retornar "Companhia Aérea" para null/undefined/vazio', () => {
    assert.equal(limparNomeCompanhia(null), 'Companhia Aérea');
    assert.equal(limparNomeCompanhia(undefined), 'Companhia Aérea');
    assert.equal(limparNomeCompanhia(''), 'Companhia Aérea');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('QA Adversarial: extrairPrecoCheapestTab — variantes de formato real', () => {
  it('deve extrair preço com espaços extras: [[null,  587 ], "EhZ..."] → 587', () => {
    const html = `[[null,  587 ], "EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl"]`;
    assert.equal(extrairPrecoCheapestTab(html), 587);
  });

  it('deve extrair preço em formato compacto [null,1850],"EhZjb21..." (Camada 3)', () => {
    const html = `[null,1850],"EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl"`;
    assert.equal(extrairPrecoCheapestTab(html), 1850);
  });

  it('deve extrair preço em formato [[null,1450],"base64longo"] (Camada 2)', () => {
    const html = `[[null, 1450], "EhZjb21wcmVoZW5zaXZlbmVzc19sdXJlGgsIzMoDEAIaA0JSTA"]`;
    assert.equal(extrairPrecoCheapestTab(html), 1450);
  });

  it('deve rejeitar preço abaixo de R$ 80 (limite inferior)', () => {
    const html = `[[null, 79], "comprehensiveness_lure"]`;
    assert.equal(extrairPrecoCheapestTab(html), null);
  });

  it('deve rejeitar preço acima de R$ 60.000 (limite superior)', () => {
    const html = `[[null, 60001], "comprehensiveness_lure"]`;
    assert.equal(extrairPrecoCheapestTab(html), null);
  });

  it('deve aceitar exatamente R$ 80 (limite inferior incluído)', () => {
    const html = `[[null, 80], "comprehensiveness_lure"]`;
    assert.equal(extrairPrecoCheapestTab(html), 80);
  });

  it('deve aceitar exatamente R$ 60.000 (limite superior incluído)', () => {
    const html = `[[null, 60000], "comprehensiveness_lure"]`;
    assert.equal(extrairPrecoCheapestTab(html), 60000);
  });

  it('deve retornar null para HTML nulo, vazio ou sem dados', () => {
    assert.equal(extrairPrecoCheapestTab(null), null);
    assert.equal(extrairPrecoCheapestTab(''), null);
    assert.equal(extrairPrecoCheapestTab('<html><body>404 Not Found</body></html>'), null);
  });

  it('deve retornar null quando comprehensiveness_lure não tem preço adjacente', () => {
    const html = `[null, "comprehensiveness_lure"]`;
    assert.equal(extrairPrecoCheapestTab(html), null);
  });
});
