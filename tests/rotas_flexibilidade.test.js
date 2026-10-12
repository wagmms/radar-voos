import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  somarDiasData,
  gerarCombinacoesFlexibilidade,
  gerarJanelasExploracaoSemData
} from '../src/domain/rotas.js';
import { rotasRepo } from '../src/db.js';

describe('Domínio: Flexibilidade de Datas (Matriz ±0 a ±7 dias)', () => {
  it('deve somar ou subtrair dias de uma data ISO com precisão', () => {
    assert.strictEqual(somarDiasData('2026-11-10', 0), '2026-11-10');
    assert.strictEqual(somarDiasData('2026-11-10', 3), '2026-11-13');
    assert.strictEqual(somarDiasData('2026-11-10', -3), '2026-11-07');
    assert.strictEqual(somarDiasData('2026-11-30', 2), '2026-12-02');
    assert.strictEqual(somarDiasData('2026-03-01', -1), '2026-02-28');
  });

  it('deve retornar apenas 1 combinação quando a flexibilidade for 0 (data fixa)', () => {
    const combs = gerarCombinacoesFlexibilidade('2026-11-10', '2026-11-20', 0);
    assert.strictEqual(combs.length, 1);
    assert.strictEqual(combs[0].dataIda, '2026-11-10');
    assert.strictEqual(combs[0].dataVolta, '2026-11-20');
    assert.strictEqual(combs[0].deltaDias, 0);
  });

  it('deve gerar combinações priorizadas por proximidade para viagem de ida e volta', () => {
    const combs = gerarCombinacoesFlexibilidade('2026-11-10', '2026-11-20', 2);
    // Deve conter a data base como primeiro elemento
    assert.strictEqual(combs[0].deltaDias, 0);
    assert.strictEqual(combs.length, 5); // 0, -1, +1, -2, +2

    // Todas as combinações de volta devem ser estritamente posteriores à ida
    combs.forEach(c => {
      assert.ok(c.dataVolta > c.dataIda);
    });
  });

  it('deve gerar combinações para viagens Só Ida', () => {
    const combs = gerarCombinacoesFlexibilidade('2026-11-10', null, 3);
    assert.strictEqual(combs.length, 7); // 0, -1, +1, -2, +2, -3, +3
    assert.strictEqual(combs[0].dataIda, '2026-11-10'); // Data original primeiro
    combs.forEach(c => {
      assert.strictEqual(c.dataVolta, null);
    });
  });

  it('deve persistir e recuperar rota com flexibilidade_dias e melhor_opcao_flexivel no SQLite', () => {
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Lisboa',
      data_ida: '2026-11-10',
      data_volta: '2026-11-24',
      preco_alvo: 3500,
      flexibilidade_dias: 3
    });

    assert.ok(rota);
    assert.strictEqual(rota.flexibilidade_dias, 3);

    // Atualizar resultado com melhor opção da janela flexível
    const opcaoFlex = {
      data_ida: '2026-11-12',
      data_volta: '2026-11-26',
      preco: 2890,
      economia: 610,
      economia_pct: 17
    };

    rotasRepo.atualizarResultadoChecagem(rota.id, {
      preco_atual: 3500,
      melhor_opcao_flexivel: opcaoFlex,
      termometro: 'Preço Médio'
    });

    const rotaAtualizada = rotasRepo.buscarPorId(rota.id);
    assert.ok(rotaAtualizada.melhor_opcao_flexivel);
    const parsed = typeof rotaAtualizada.melhor_opcao_flexivel === 'string'
      ? JSON.parse(rotaAtualizada.melhor_opcao_flexivel)
      : rotaAtualizada.melhor_opcao_flexivel;

    assert.strictEqual(parsed.preco, 2890);
    assert.strictEqual(parsed.economia, 610);

    // Limpar rota de teste
    rotasRepo.excluir(rota.id);
  });

  it('deve gerar janelas estratégicas para voos flexíveis sem data fixa espaçadas em múltiplos meses', () => {
    const janelas = gerarJanelasExploracaoSemData({
      dataBase: '2026-11-01',
      diasEstadia: 12,
      qtdAmostras: 4,
      soIda: false
    });

    assert.strictEqual(janelas.length, 4);
    // Cada amostra deve ter dataIda e dataVolta espaçadas por 12 dias
    janelas.forEach(j => {
      assert.ok(j.dataIda);
      assert.ok(j.dataVolta);
      assert.strictEqual(somarDiasData(j.dataIda, 12), j.dataVolta);
      assert.ok(j.label);
      assert.ok(j.mes);
    });

    // As janelas devem estar em ordem cronológica ascendente
    for (let i = 1; i < janelas.length; i++) {
      assert.ok(janelas[i].dataIda > janelas[i - 1].dataIda);
    }
  });

  it('deve criar e persistir rota flexível sem data fixa no SQLite com datas calculadas automaticamente', () => {
    const rotaFlex = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Buenos Aires',
      sem_data: 1,
      dias_estadia: 8,
      preco_alvo: 1800
    });

    assert.ok(rotaFlex);
    assert.strictEqual(rotaFlex.sem_data, 1);
    assert.strictEqual(rotaFlex.dias_estadia, 8);
    assert.ok(rotaFlex.data_ida);
    assert.ok(rotaFlex.data_volta);
    assert.strictEqual(somarDiasData(rotaFlex.data_ida, 8), rotaFlex.data_volta);

    // Simular que o scanner encontrou uma data com o menor preço histórico
    rotasRepo.atualizarResultadoChecagem(rotaFlex.id, {
      data_ida: '2027-02-16',
      data_volta: '2027-02-24',
      preco_atual: 1450,
      termometro: '🔥 Menor Preço Flexível (Fev/27)',
      melhor_opcao_flexivel: {
        data_ida: '2027-02-16',
        data_volta: '2027-02-24',
        preco: 1450,
        modo: 'sem_data',
        label: 'Janela 2 (Fev/27)'
      }
    });

    const rotaAtualizada = rotasRepo.buscarPorId(rotaFlex.id);
    assert.strictEqual(rotaAtualizada.preco_atual, 1450);
    assert.strictEqual(rotaAtualizada.data_ida, '2027-02-16');
    assert.strictEqual(rotaAtualizada.data_volta, '2027-02-24');
    assert.strictEqual(rotaAtualizada.termometro, '🔥 Menor Preço Flexível (Fev/27)');

    // Limpar rota
    rotasRepo.excluir(rotaFlex.id);
  });
});
