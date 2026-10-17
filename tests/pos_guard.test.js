import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  POS_BRASIL_CONFIG,
  enforceGoogleFlightsBrUrl,
  auditarTarifaBrasil,
  US_POS_MARKUP_MIN_RATIO,
  US_POS_MARKUP_MAX_RATIO
} from '../src/domain/pos_guard.js';

describe('Blindagem de Point of Sale Brasil (POS-Guard)', () => {
  describe('Configurações Canônicas POS Brasil', () => {
    it('deve exportar parâmetros obrigatórios de mercado brasileiro', () => {
      assert.equal(POS_BRASIL_CONFIG.gl, 'BR');
      assert.equal(POS_BRASIL_CONFIG.hl, 'pt-BR');
      assert.equal(POS_BRASIL_CONFIG.curr, 'BRL');
      assert.equal(POS_BRASIL_CONFIG.timezone, 'America/Sao_Paulo');
      assert.ok(POS_BRASIL_CONFIG.cookies.includes('hl=pt-BR'));
      assert.ok(POS_BRASIL_CONFIG.cookies.includes('gl=BR'));
      assert.ok(POS_BRASIL_CONFIG.headers['Accept-Language'].includes('pt-BR'));
      assert.equal(POS_BRASIL_CONFIG.headers['CF-IPCountry'], 'BR');
    });
  });

  describe('Normalizador de URLs do Google Flights (enforceGoogleFlightsBrUrl)', () => {
    it('deve injetar parâmetros hl=pt-BR, gl=BR e curr=BRL em links sem parâmetros', () => {
      const url = 'https://www.google.com/travel/flights';
      const safe = enforceGoogleFlightsBrUrl(url);
      assert.ok(safe.includes('hl=pt-BR'));
      assert.ok(safe.includes('gl=BR'));
      assert.ok(safe.includes('curr=BRL'));
    });

    it('deve sobrescrever parâmetros estrangeiros existentes para os valores brasileiros', () => {
      const url = 'https://www.google.com/travel/flights?hl=en&gl=US&curr=USD';
      const safe = enforceGoogleFlightsBrUrl(url);
      assert.ok(safe.includes('hl=pt-BR'));
      assert.ok(safe.includes('gl=BR'));
      assert.ok(safe.includes('curr=BRL'));
      assert.ok(!safe.includes('gl=US'));
    });

    it('deve retornar fallback seguro para URLs inválidas ou nulas', () => {
      const safe = enforceGoogleFlightsBrUrl(null);
      assert.ok(safe.startsWith('https://www.google.com/travel/flights'));
      assert.ok(safe.includes('gl=BR'));
    });
  });

  describe('Auditoria de Tarifa Brasil (auditarTarifaBrasil)', () => {
    it('deve aprovar tarifa válida nacional que bate ou melhora o piso histórico', () => {
      const candidato = { preco: 950, moeda: 'BRL', detalhes: 'Voo direto' };
      const baseline = { menor_preco_historico: 1012, preco_atual: 1012 };
      const audit = auditarTarifaBrasil(candidato, baseline);

      assert.equal(audit.valido, true);
      assert.equal(audit.precoFinal, 950);
      assert.equal(audit.ajustado, false);
      assert.equal(audit.posVerificado, 'BR');
      assert.ok(audit.posBadge.includes('Tarifa Brasil'));
    });

    it('deve interceptar e bloquear ágio de Point-of-Sale internacional (~26%) e preservar a tarifa brasileira', () => {
      // 1281 / 1012 = 1.2658 (assinatura de POS americano)
      const candidatoInflacionado = { preco: 1281, moeda: 'BRL', detalhes: 'Scrapling US' };
      const baselineBr = { menor_preco_historico: 1012, preco_atual: 1012 };
      const audit = auditarTarifaBrasil(candidatoInflacionado, baselineBr);

      assert.equal(audit.valido, true);
      assert.equal(audit.precoFinal, 1012, 'Deve manter o piso de R$ 1012 comprovado no Brasil');
      assert.equal(audit.ajustado, true);
      assert.ok(audit.motivo.includes('ágio de POS internacional'));
      assert.equal(audit.posVerificado, 'BR');
    });

    it('deve proteger rota contra inflações espúrias superiores a 15% acima do piso', () => {
      // 884 / 580 = 1.524
      const candidato = { preco: 884, moeda: 'BRL' };
      const baseline = { menor_preco_historico: 580, preco_atual: 580 };
      const audit = auditarTarifaBrasil(candidato, baseline);

      assert.equal(audit.valido, true);
      assert.equal(audit.precoFinal, 580, 'Deve manter o piso de R$ 580');
      assert.equal(audit.ajustado, true);
    });

    it('deve rejeitar ofertas contaminadas com moedas estrangeiras não convertidas', () => {
      const candidatoUsd = { preco: 350, moeda: 'USD', detalhes: 'Preço em US$ 350' };
      const audit = auditarTarifaBrasil(candidatoUsd, null);

      assert.equal(audit.valido, false);
      assert.equal(audit.posVerificado, 'MOEDA_ESTRANGEIRA');
    });

    it('deve lidar defensivamente com candidatos nulos ou inválidos', () => {
      assert.equal(auditarTarifaBrasil(null).valido, false);
      assert.equal(auditarTarifaBrasil({ preco: 0 }).valido, false);
      assert.equal(auditarTarifaBrasil({ preco: -100 }).valido, false);
    });
  });
});
