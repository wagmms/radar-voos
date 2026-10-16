/**
 * Testes para a Etapa 3: Integração de Metadados do Google Flights (Aeronave, Dias Extras, Emissões e Widebody)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatarSufixoDiasExtras,
  formatarMetadadosVooTelegram
} from '../src/services/notifier_telegram.js';
import { renderizarLinhaHorarios } from '../src/public/js/card_rota.js';
import { ehAeronaveWidebody, avaliarOportunidade } from '../src/domain/bug_fares.js';

describe('Etapa 3 - Notifier Telegram: Metadados Enriquecidos', () => {
  it('formatarSufixoDiasExtras deve formatar singular, plural e ignorar valores <= 0', () => {
    assert.strictEqual(formatarSufixoDiasExtras(null), '');
    assert.strictEqual(formatarSufixoDiasExtras(0), '');
    assert.strictEqual(formatarSufixoDiasExtras(-1), '');
    assert.strictEqual(formatarSufixoDiasExtras(1), ' (+1 dia)');
    assert.strictEqual(formatarSufixoDiasExtras(2), ' (+2 dias)');
  });

  it('formatarMetadadosVooTelegram deve formatar aeronave com escape HTML e emissões com variação', () => {
    const html = formatarMetadadosVooTelegram({
      aeronave: 'Airbus A350-900 <LATAM>',
      emissoes: { kg: 412, variacaoPct: -18 }
    });

    assert.ok(html.includes('✈️ <b>Aeronave:</b> Airbus A350-900 &lt;LATAM&gt;\n'));
    assert.ok(html.includes('🌱 <b>Emissões:</b> 412 kg CO₂ (-18%)\n'));
  });

  it('formatarMetadadosVooTelegram deve aceitar emissões sem variacaoPct ou como JSON string', () => {
    const html = formatarMetadadosVooTelegram({
      aeronave: null,
      emissoes: JSON.stringify({ kg: 145, variacaoPct: 12 })
    });

    assert.strictEqual(html, '🌱 <b>Emissões:</b> 145 kg CO₂ (+12%)\n');
  });
});

describe('Etapa 3 - Cockpit PWA card_rota: renderizarLinhaHorarios', () => {
  it('deve renderizar badge de dias extras (+1d) e aeronave-tag', () => {
    const html = renderizarLinhaHorarios({
      horario_partida: '22:35',
      horario_chegada: '14:15',
      dias_extras_chegada: 1,
      numero_voo: 'LA 8004',
      aeronave: 'Boeing 787-9'
    });

    assert.ok(html.includes('22:35 ➔ 14:15<span class="badge-dias-extras" data-testid="badge-dias-extras">+1d</span>'));
    assert.ok(html.includes('<span class="aeronave-tag">✈️ Boeing 787-9</span>'));
    assert.ok(html.includes('<span class="voo-tag">LA 8004</span>'));
  });

  it('não deve renderizar badge-dias-extras quando diasExtras for 0 ou ausente', () => {
    const html = renderizarLinhaHorarios({
      horarioPartida: '08:00',
      horarioChegada: '10:15',
      diasExtrasChegada: 0,
      aeronave: 'Airbus A320neo'
    });

    assert.ok(!html.includes('badge-dias-extras'));
    assert.ok(html.includes('<span class="aeronave-tag">✈️ Airbus A320neo</span>'));
  });

  it('deve escapar HTML malicioso no nome da aeronave (proteção XSS)', () => {
    const html = renderizarLinhaHorarios({
      horario_partida: '10:00',
      horario_chegada: '12:00',
      aeronave: '<img src=x onerror=alert(1)>'
    });

    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img'));
  });
});

describe('Etapa 3 - Domínio Bug Fares: Widebody Detection e Bônus', () => {
  it('ehAeronaveWidebody deve identificar corretamente aeronaves de fuselagem larga', () => {
    assert.strictEqual(ehAeronaveWidebody('Boeing 777-300ER'), true);
    assert.strictEqual(ehAeronaveWidebody('Boeing 787-9 Dreamliner'), true);
    assert.strictEqual(ehAeronaveWidebody('Airbus A350-900'), true);
    assert.strictEqual(ehAeronaveWidebody('Airbus A330-900neo'), true);
    assert.strictEqual(ehAeronaveWidebody('Boeing 767-300'), true);
    assert.strictEqual(ehAeronaveWidebody('Airbus A380'), true);
  });

  it('ehAeronaveWidebody deve retornar false para narrowbodies e regionais', () => {
    assert.strictEqual(ehAeronaveWidebody('Airbus A320neo'), false);
    assert.strictEqual(ehAeronaveWidebody('Airbus A321'), false);
    assert.strictEqual(ehAeronaveWidebody('Boeing 737 MAX 8'), false);
    assert.strictEqual(ehAeronaveWidebody('Embraer E195-E2'), false);
    assert.strictEqual(ehAeronaveWidebody('ATR 72'), false);
    assert.strictEqual(ehAeronaveWidebody(null), false);
  });

  it('avaliarOportunidade deve conceder bonusWidebody em rota na América do Sul operada por Boeing 787', () => {
    const comWidebody = avaliarOportunidade({
      origem: 'GRU',
      destino: 'SCL',
      precoAtual: 890,
      precoMedio: 1500,
      aeronave: 'Boeing 787-9'
    });

    const comNarrowbody = avaliarOportunidade({
      origem: 'GRU',
      destino: 'SCL',
      precoAtual: 890,
      precoMedio: 1500,
      aeronave: 'Airbus A320'
    });

    assert.strictEqual(comWidebody.ehWidebody, true);
    assert.strictEqual(comWidebody.bonusWidebody, true);
    assert.strictEqual(comNarrowbody.bonusWidebody, false);
    assert.ok(comWidebody.score > comNarrowbody.score);
  });
});
