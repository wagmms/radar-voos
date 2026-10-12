import { describe, it } from 'node:test';
import assert from 'node:assert';
import { somarDiasData, gerarCombinacoesFlexibilidade } from '../src/domain/rotas.js';
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
});
