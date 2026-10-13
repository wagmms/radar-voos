import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  somarDiasData,
  gerarCombinacoesFlexibilidade,
  gerarJanelasExploracaoSemData,
  gerarDataPadraoInicial,
  ehSoIda,
  rotaEhSoIda
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

  it('deve lidar defensivamente com entradas nulas, malformadas ou não finitas em somarDiasData', () => {
    // 1. Entradas nulas, vazias, inválidas no calendário ou tipos incompatíveis
    assert.strictEqual(somarDiasData(null, 5), null);
    assert.strictEqual(somarDiasData(undefined, 5), null);
    assert.strictEqual(somarDiasData('', 5), null);
    assert.strictEqual(somarDiasData('data-invalida', 5), null);
    assert.strictEqual(somarDiasData('2026-02-31', 5), null);
    assert.strictEqual(somarDiasData(12345, 5), null);

    // 2. Dias não finitos ou malformados não devem lançar RangeError/TypeError
    assert.strictEqual(somarDiasData('2026-11-10', NaN), '2026-11-10');
    assert.strictEqual(somarDiasData('2026-11-10', Infinity), '2026-11-10');
    assert.strictEqual(somarDiasData('2026-11-10', -Infinity), '2026-11-10');
    assert.strictEqual(somarDiasData('2026-11-10', 'invalido'), '2026-11-10');

    // 3. Suporte resiliente a string numérica de dias e formato DD/MM/YYYY
    assert.strictEqual(somarDiasData('2026-11-10', '5'), '2026-11-15');
    assert.strictEqual(somarDiasData('10/11/2026', 2), '2026-11-12');
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

  it('gerarCombinacoesFlexibilidade: deve normalizar defensivamente "Só Ida", formato brasileiro e entradas nulas/não-finitas', () => {
    // 1. String "Só Ida" deve ser uniformemente null em todas as combinações, incluindo Data Base
    const combsSoIda = gerarCombinacoesFlexibilidade('2026-11-10', 'Só Ida', 2);
    assert.strictEqual(combsSoIda.length, 5);
    combsSoIda.forEach(c => {
      assert.strictEqual(c.dataVolta, null);
    });
    assert.strictEqual(combsSoIda[0].dataVolta, null);

    // 2. Formato brasileiro DD/MM/YYYY deve ser normalizado para ISO em todas as combinações
    const combsBr = gerarCombinacoesFlexibilidade('10/11/2026', '20/11/2026', 1);
    assert.strictEqual(combsBr[0].dataIda, '2026-11-10');
    assert.strictEqual(combsBr[0].dataVolta, '2026-11-20');
    assert.strictEqual(combsBr[1].dataIda, '2026-11-09');
    assert.strictEqual(combsBr[1].dataVolta, '2026-11-19');
    assert.strictEqual(combsBr[2].dataIda, '2026-11-11');
    assert.strictEqual(combsBr[2].dataVolta, '2026-11-21');

    // 3. Entradas nulas e flexibilidade inválida ou negativa devem degradar graciosamente sem lançar erro
    const combsNulo = gerarCombinacoesFlexibilidade(null, null, -5);
    assert.strictEqual(combsNulo.length, 1);
    assert.strictEqual(combsNulo[0].dataIda, null);
    assert.strictEqual(combsNulo[0].dataVolta, null);
    assert.strictEqual(combsNulo[0].deltaDias, 0);

    const combsNan = gerarCombinacoesFlexibilidade('2026-11-10', null, NaN);
    assert.strictEqual(combsNan.length, 1);
    assert.strictEqual(combsNan[0].dataIda, '2026-11-10');
  });

  it('gerarCombinacoesFlexibilidade: deve suportar duracao relativa de estadia, degradar volta no passado e sanitizar strings corrompidas', () => {
    // 1. Duração relativa ("10 dias", 14 ou "7 noites") deve manter a duração constante em todas as combinações flexíveis
    const combsDuracao = gerarCombinacoesFlexibilidade('2026-11-10', '10 dias', 2);
    assert.strictEqual(combsDuracao.length, 5);
    assert.strictEqual(combsDuracao[0].dataIda, '2026-11-10');
    assert.strictEqual(combsDuracao[0].dataVolta, '2026-11-20');
    assert.strictEqual(combsDuracao[1].dataIda, '2026-11-09');
    assert.strictEqual(combsDuracao[1].dataVolta, '2026-11-19'); // -1d preserva 10 dias
    assert.strictEqual(combsDuracao[2].dataIda, '2026-11-11');
    assert.strictEqual(combsDuracao[2].dataVolta, '2026-11-21'); // +1d preserva 10 dias

    // Suporte a número direto de dias como número puro
    const combsNum = gerarCombinacoesFlexibilidade('2026-11-10', 7, 1);
    assert.strictEqual(combsNum[0].dataVolta, '2026-11-17');
    assert.strictEqual(combsNum[1].dataVolta, '2026-11-16');
    assert.strictEqual(combsNum[2].dataVolta, '2026-11-18');

    // 2. Data de volta cronologicamente anterior à ida deve degradar defensivamente para Só Ida (null)
    const combsPassado = gerarCombinacoesFlexibilidade('2026-11-10', '2026-11-05', 2);
    assert.strictEqual(combsPassado.length, 5);
    combsPassado.forEach(c => {
      assert.strictEqual(c.dataVolta, null);
    });

    // 3. String corrompida / não-data no campo volta deve resultar uniformemente em null
    const combsCorrompida = gerarCombinacoesFlexibilidade('2026-11-10', 'texto_aleatorio_invalido', 1);
    assert.strictEqual(combsCorrompida.length, 3);
    combsCorrompida.forEach(c => {
      assert.strictEqual(c.dataVolta, null);
    });
  });

  it('gerarCombinacoesFlexibilidade: deve tratar defensivamente entradas adversariais em dataIda (nula, texto inválido, objeto) sem vazar deltas fantasmas', () => {
    // 1. dataIda nula ou indefinida com flexibilidade positiva (> 0) deve degradar graciosamente sem deltas fantasmas
    const combsNulaComFlex = gerarCombinacoesFlexibilidade(null, null, 3);
    assert.strictEqual(combsNulaComFlex.length, 1);
    assert.strictEqual(combsNulaComFlex[0].dataIda, null);
    assert.strictEqual(combsNulaComFlex[0].deltaDias, 0);

    // 2. dataIda malformatada / texto aleatório não deve vazar strings espúrias
    const combsInvalida = gerarCombinacoesFlexibilidade('data-invalida', null, 2);
    assert.strictEqual(combsInvalida.length, 1);
    assert.strictEqual(combsInvalida[0].dataIda, null);
    assert.strictEqual(combsInvalida[0].deltaDias, 0);

    // 3. dataIda passada como objeto ou tipo inesperado não deve vazar [object Object]
    const combsObjeto = gerarCombinacoesFlexibilidade({ dia: 15 }, null, 2);
    assert.strictEqual(combsObjeto.length, 1);
    assert.strictEqual(combsObjeto[0].dataIda, null);
    assert.strictEqual(combsObjeto[0].deltaDias, 0);
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

  it('deve criar rota flexível sem data no modo Só Ida e manter data_volta como null', () => {
    const rotaSoIda = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Lisboa',
      sem_data: 1,
      data_volta: 'Só Ida',
      preco_alvo: 1900
    });

    assert.ok(rotaSoIda);
    assert.strictEqual(rotaSoIda.sem_data, 1);
    assert.strictEqual(rotaSoIda.data_volta, null);
    assert.strictEqual(ehSoIda(rotaSoIda.data_volta), true);
    assert.strictEqual(rotaSoIda.preco_alvo, 1900);

    // Janelas geradas para essa rota devem ser estritamente só ida
    const janelas = gerarJanelasExploracaoSemData({
      dataBase: rotaSoIda.data_ida,
      qtdAmostras: 3,
      soIda: ehSoIda(rotaSoIda.data_volta)
    });

    assert.strictEqual(janelas.length, 3);
    janelas.forEach(j => {
      assert.ok(j.dataIda);
      assert.strictEqual(j.dataVolta, null, 'No modo Só Ida a dataVolta das amostras deve ser estritamente null');
    });

    rotasRepo.excluir(rotaSoIda.id);
  });

  it('deve identificar corretamente se o teto configurado se aplica a Apenas Ida ou Ida e Volta', () => {
    // Caso 1: Rota sem data com estadia
    const rotaRound = rotasRepo.criar({
      origem: 'Rio de Janeiro',
      destino: 'Paris',
      sem_data: 1,
      data_volta: '14 dias',
      preco_alvo: 4200
    });
    assert.strictEqual(ehSoIda(rotaRound.data_volta), false);
    const escopoRound = ehSoIda(rotaRound.data_volta) ? 'Apenas Ida' : 'Ida e Volta';
    assert.strictEqual(escopoRound, 'Ida e Volta');

    // Caso 2: Rota sem data só ida
    const rotaOneWay = rotasRepo.criar({
      origem: 'Rio de Janeiro',
      destino: 'Paris',
      sem_data: 1,
      data_volta: 'Só Ida',
      preco_alvo: 2100
    });
    assert.strictEqual(ehSoIda(rotaOneWay.data_volta), true);
    const escopoOneWay = ehSoIda(rotaOneWay.data_volta) ? 'Apenas Ida' : 'Ida e Volta';
    assert.strictEqual(escopoOneWay, 'Apenas Ida');

    rotasRepo.excluir(rotaRound.id);
    rotasRepo.excluir(rotaOneWay.id);
  });

  it('rotaEhSoIda deve discernir com precisão entre Só Ida e Ida e Volta em qualquer cenário', () => {
    // 1. Rota de data fixa com ida e volta
    assert.strictEqual(rotaEhSoIda({ data_ida: '2026-11-10', data_volta: '2026-11-20' }), false);

    // 2. Rota de data fixa só ida
    assert.strictEqual(rotaEhSoIda({ data_ida: '2026-11-10', data_volta: null }), true);
    assert.strictEqual(rotaEhSoIda({ data_ida: '2026-11-10', data_volta: 'Só Ida' }), true);

    // 3. Rota sem data com dias de estadia configurados (DEVE ser Ida e Volta)
    assert.strictEqual(rotaEhSoIda({ sem_data: 1, dias_estadia: 15, data_volta: null }), false);
    assert.strictEqual(rotaEhSoIda({ sem_data: 1, dias_estadia: 10, data_volta: '10 dias' }), false);

    // 4. Rota sem data explicitamente só ida
    assert.strictEqual(rotaEhSoIda({ sem_data: 1, data_volta: 'Só Ida' }), true);
    assert.strictEqual(rotaEhSoIda({ sem_data: 1, tipo: 'one_way' }), true);
    assert.strictEqual(rotaEhSoIda({ sem_data: 1, tipo_viagem: 'one_way' }), true);
    assert.strictEqual(rotaEhSoIda({ sem_data: 1, dias_estadia: 0, data_volta: null }), true);

    // 5. Casos de borda adversariais: case-insensitivity, hífens, espaços e tipos não-objeto
    assert.strictEqual(rotaEhSoIda({ tipo: 'ONE_WAY', data_volta: '2026-11-20' }), true);
    assert.strictEqual(rotaEhSoIda({ tipo: 'one-way' }), true);
    assert.strictEqual(rotaEhSoIda({ tipo: '  so_ida  ' }), true);
    assert.strictEqual(rotaEhSoIda({ tipo_viagem: 'ONE-WAY' }), true);
    assert.strictEqual(rotaEhSoIda({ tipo: 'ROUND_TRIP', data_volta: null }), false);
    assert.strictEqual(rotaEhSoIda({ tipo: 'round-trip' }), false);
    assert.strictEqual(rotaEhSoIda({ tipo_viagem: 'ROUND_TRIP' }), false);
    assert.strictEqual(rotaEhSoIda(12345), false);
    assert.strictEqual(rotaEhSoIda(true), false);
    assert.strictEqual(rotaEhSoIda([]), false);
    assert.strictEqual(rotaEhSoIda(['voo']), false);
  });

  it('deve alterar rota flexível de Ida e Volta para Só Ida e manter como Só Ida após sincronização Two-Way', async () => {
    const { rotasSync } = await import('../src/services/rotas_sync.js');

    // 1. Criar rota inicial como Ida e Volta
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Roma',
      sem_data: 1,
      dias_estadia: 12,
      preco_alvo: 3800
    });

    assert.ok(rota.data_volta, 'Deve possuir data de volta inicial');
    assert.strictEqual(rotaEhSoIda(rota), false, 'Deve ser inicialmente Ida e Volta');

    // 2. Alterar para Só Ida
    const atualizada = rotasRepo.atualizar(rota.id, {
      tipo: 'one_way',
      tipo_viagem: 'one_way',
      data_volta: 'Só Ida',
      dias_estadia: null
    });

    assert.strictEqual(atualizada.data_volta, null);
    assert.strictEqual(atualizada.dias_estadia, null);
    assert.strictEqual(rotaEhSoIda(atualizada), true);

    // 3. Serializar para data/rotas.json
    const rotasSalvas = rotasSync.salvarArquivoRotas();
    const rotaSerializada = rotasSalvas.find(r => r.destino === 'Roma');
    assert.ok(rotaSerializada);
    assert.strictEqual(rotaSerializada.data_volta, null);
    assert.strictEqual(rotaSerializada.dias_estadia, null);
    assert.strictEqual(rotaSerializada.tipo_viagem, 'one_way');

    // 4. Sincronizar de volta com o banco (simulando F5 / sync pull do GitHub)
    rotasSync.sincronizarRotasComBanco(rotasSalvas);

    const rotaFinal = rotasRepo.buscarPorId(rota.id);
    assert.strictEqual(rotaFinal.data_volta, null, 'data_volta deve permanecer estritamente null pós-sync');
    assert.strictEqual(rotaFinal.dias_estadia, null, 'dias_estadia deve permanecer null');
    assert.strictEqual(rotaEhSoIda(rotaFinal), true, 'Deve permanecer categorizada como Só Ida');

    rotasRepo.excluir(rota.id);
  });

  it('QA Adversarial: deve blindar gerarJanelasExploracaoSemData contra entradas mal formatadas, tipos espúrios e dias negativos', () => {
    // 1. Strings não-ISO, texto livre ou formato brasileiro em dataBase não devem lançar RangeError/TypeError
    const entradasInvalidas = ['sem data', 'flexivel', 'qualquer data', '31/12/2026', 20261115, {}, []];
    for (const entrada of entradasInvalidas) {
      assert.doesNotThrow(() => {
        const janelas = gerarJanelasExploracaoSemData({ dataBase: entrada, qtdAmostras: 2 });
        assert.ok(Array.isArray(janelas));
        assert.strictEqual(janelas.length, 2);
        assert.match(janelas[0].dataIda, /^\d{4}-\d{2}-\d{2}$/);
      }, `Falha ao processar dataBase adversarial: ${String(entrada)}`);
    }

    // 2. diasEstadia negativo ou string com formato descritivo não corrompe as datas
    const janelasTextoEstadia = gerarJanelasExploracaoSemData({ diasEstadia: '15 dias', qtdAmostras: 2 });
    assert.strictEqual(janelasTextoEstadia.length, 2);
    assert.strictEqual(somarDiasData(janelasTextoEstadia[0].dataIda, 15), janelasTextoEstadia[0].dataVolta);

    const janelasNegativo = gerarJanelasExploracaoSemData({ diasEstadia: -5, qtdAmostras: 2 });
    assert.strictEqual(janelasNegativo.length, 2);
    // Deve recorrer ao padrão de 10 dias de estadia
    assert.strictEqual(somarDiasData(janelasNegativo[0].dataIda, 10), janelasNegativo[0].dataVolta);

    // 3. soIda via string "Só Ida" e qtdAmostras limites (0 ou negativa)
    const janelasSoIdaStr = gerarJanelasExploracaoSemData({ soIda: 'Só Ida', qtdAmostras: 2 });
    assert.strictEqual(janelasSoIdaStr[0].dataVolta, null);

    const janelasVazias = gerarJanelasExploracaoSemData({ qtdAmostras: 0 });
    assert.deepStrictEqual(janelasVazias, []);

    const janelasNegativas = gerarJanelasExploracaoSemData({ qtdAmostras: -3 });
    assert.deepStrictEqual(janelasNegativas, []);
  });

  it('QA Adversarial: deve blindar gerarDataPadraoInicial contra coerção de strings, nulos e extremos', () => {
    // 1. Strings numéricas ("30", "45") não devem sofrer concatenação espúria de texto (ex: 13 + "30" = "1330")
    const dataNumero = gerarDataPadraoInicial(30);
    const dataString = gerarDataPadraoInicial('30');
    assert.strictEqual(dataString, dataNumero, 'String numérica deve produzir o mesmo resultado que número');
    assert.match(dataString, /^\d{4}-\d{2}-\d{2}$/);

    // 2. Entradas nulas, NaN, tipos espúrios e strings inválidas devem acionar fallback seguro de 30 dias sem lançar RangeError
    const casosFallback = [null, NaN, 'invalido', '   ', {}, []];
    for (const valor of casosFallback) {
      assert.doesNotThrow(() => {
        const res = gerarDataPadraoInicial(valor);
        assert.strictEqual(res, dataNumero, `Valor adversarial ${String(valor)} deve recorrer ao fallback padrão de 30 dias`);
      });
    }

    // 3. Offsets negativos e números extremos não quebram ou extrapolam o calendário
    const resNegativo = gerarDataPadraoInicial(-20);
    assert.strictEqual(resNegativo, dataNumero, 'Offset negativo deve recorrer ao fallback seguro');

    const resExtremo = gerarDataPadraoInicial(99999999);
    assert.match(resExtremo, /^\d{4}-\d{2}-\d{2}$/, 'Offset extremo deve ser limitado defensivamente a ISO válida');
  });
});

