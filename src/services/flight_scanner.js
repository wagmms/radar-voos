import { flightProviderManager } from './providers/provider_manager.js';
import { weatherService } from './weather_service.js';
import {
  parsePreco,
  calcularVariacao,
  avaliarCustoDestinoComTotal,
  classificarDeltaPreco
} from '../domain/calculadora.js';
import { rotasRepo, alertasRepo, bugFaresRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';
import { detectarBugFareEstatistico } from '../domain/bug_fares.js';
import { gerarCombinacoesFlexibilidade, gerarJanelasExploracaoSemData, ehSoIda, gerarLinkGoogleFlightsCheapest, gerarLinkGoogleFlights } from '../domain/rotas.js';
import { montarCardBugFare, resolverDestinoConcreto } from '../domain/aeroportos.js';
import { telemetryEvents } from './telemetry_events.js';

/**
 * Cotações de referência R$/milheiro por programa de fidelidade (espelho do frontend card_rota.js).
 * Fonte: valores médios de mercado brasileiro (atualizar conforme variação de mercado).
 */
const COTACOES_MILHA_MILHEIRO_BACKEND = {
  smiles:    17.50,
  latam:     24.00,
  latampass: 24.00,
  livelo:    35.00,
  azul:      20.00,
  tudoazul:  20.00,
  iberia:    65.00,
  tap:       32.00
};

/**
 * Calcula a estimativa de milhas necessárias para emitir o voo pelo preço atual.
 * Espelha `calcularMilhasEstimadas` de `src/public/js/card_rota.js` para uso no backend
 * (Telegram, API, escanearRota), eliminando recalculo no cliente.
 *
 * @param {number|null} precoAtual   Preço atual em BRL (ou na moeda da rota)
 * @param {number|null} paridadeMilheiro  Cotação R$ por milheiro customizada (ex: 17.50)
 * @param {string}      [programa='smiles'] Chave do programa de fidelidade
 * @returns {{ milhas: number, programa: string, cotacaoMilheiro: number } | null}
 *   Retorna null quando preço ou paridade são inválidos.
 */
export function calcularMilhasRota(precoAtual, paridadeMilheiro, programa = 'smiles') {
  const preco = typeof precoAtual === 'number' ? precoAtual : parseFloat(precoAtual);
  if (!Number.isFinite(preco) || preco <= 0) return null;

  const progKey = String(programa || 'smiles').toLowerCase().trim();
  const cotacaoPadrao = COTACOES_MILHA_MILHEIRO_BACKEND[progKey] || COTACOES_MILHA_MILHEIRO_BACKEND.smiles;
  const cotacao = typeof paridadeMilheiro === 'number' && Number.isFinite(paridadeMilheiro) && paridadeMilheiro > 0
    ? paridadeMilheiro
    : cotacaoPadrao;

  // milhas = (preço / R$-por-milheiro) × 1.000
  const milhas = Math.ceil((preco / cotacao) * 1000);
  return { milhas, programa: progKey, cotacaoMilheiro: cotacao };
}

export class FlightScanner {
  /**
   * Consulta os provedores de voo através do gerenciador de estratégias
   */
  static async buscarOfertas(origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1, moeda = 'BRL') {
    if (typeof origemCod === 'object' && origemCod !== null) {
      return flightProviderManager.buscarOfertas(origemCod);
    }
    return flightProviderManager.buscarOfertas({
      origemCod,
      destinoCod,
      dataIda,
      dataVolta,
      duracaoMaxHoras,
      cabine,
      adultos,
      moeda: (moeda || 'BRL').trim().toUpperCase()
    });
  }

  /**
   * Executa varredura de uma rota cadastrada no banco de dados com flexibilidade de datas e detecção de Bug Fares
   * @param {Object} rota Rota a escanear
   * @param {Object} [opcoes]
   * @param {string} [opcoes.moeda] Moeda opcional de cotação (ex: 'BRL', 'USD', 'EUR')
   * @param {string} [opcoes.curr] Alias para moeda
   */
  static async escanearRota(rota, opcoes = {}) {
    try {
      const moedaEfetiva = (opcoes?.moeda || opcoes?.curr || rota?.moeda || rota?.curr || 'BRL').trim().toUpperCase();

      // 1. Consulta meteorológica do destino em paralelo
      const climaPromise = weatherService.obterClimaDestino(rota.codigo_destino || rota.destino, rota.data_ida);

      let resultadoFinal = null;
      let oferta = null;
      let melhorOpcaoFlexivel = null;
      let dataIdaEfetiva = rota.data_ida;
      let dataVoltaEfetiva = rota.data_volta;

      // 2. Modo Voo Flexível Sem Data (movido pelo menor preço nos próximos meses)
      if (rota.sem_data === 1) {
        const soIda = ehSoIda(rota.data_volta);
        const janelas = gerarJanelasExploracaoSemData({
          dataBase: rota.data_ida,
          diasEstadia: rota.dias_estadia || 10,
          qtdAmostras: 4,
          soIda
        });

        const resultadosAmostras = [];
        for (const j of janelas) {
          try {
            const res = await FlightScanner.buscarOfertas(
              rota.codigo_origem,
              rota.codigo_destino,
              j.dataIda,
              j.dataVolta,
              rota.duracao_max_horas,
              rota.cabine || 'economy',
              1,
              moedaEfetiva
            );
            if (res.ok && res.encontrouVoos && res.oferta && res.oferta.preco > 0) {
              resultadosAmostras.push({
                ...j,
                oferta: res.oferta
              });
            }
          } catch (_) {}
        }

        if (resultadosAmostras.length === 0) {
          const clima = await climaPromise.catch(() => ({ ok: false, resumo: 'Clima indisponível' }));
          rotasRepo.atualizarResultadoChecagem(rota.id, {
            preco: 0,
            variacao_texto: '-',
            termometro: '⚪ Sem voos no período flexível',
            custo_destino_texto: '-',
            detalhes_voo: '-',
            dica_stopover: '-',
            link_google_flights: rota.link_google_flights,
            clima_destino_resumo: clima.ok ? clima.resumo : null,
            clima_temp_media: clima.ok ? clima.tempMedia : null,
            melhor_opcao_flexivel: null
          });
          return { sucesso: true, encontrou: false, mensagem: 'Sem voos no período flexível' };
        }

        // Ordena estritamente pelo MENOR PREÇO (Best Price)
        resultadosAmostras.sort((a, b) => a.oferta.preco - b.oferta.preco);
        const campeao = resultadosAmostras[0];

        oferta = campeao.oferta;
        dataIdaEfetiva = campeao.dataIda;
        dataVoltaEfetiva = campeao.dataVolta;
        resultadoFinal = { ok: true, encontrouVoos: true, oferta };

        melhorOpcaoFlexivel = {
          data_ida: campeao.dataIda,
          data_volta: campeao.dataVolta,
          preco: campeao.oferta.preco,
          label: campeao.label,
          modo: 'sem_data',
          totalAmostras: resultadosAmostras.length,
          link: campeao.oferta.link
        };
      } else {
        // 2b. Modo Data Fixa / Base
        const resultadoBase = await FlightScanner.buscarOfertas(
          rota.codigo_origem,
          rota.codigo_destino,
          rota.data_ida,
          rota.data_volta,
          rota.duracao_max_horas,
          rota.cabine || 'economy',
          1,
          moedaEfetiva
        );

        if (!resultadoBase.ok) {
          rotasRepo.marcarFalhaChecagem(rota.id, resultadoBase.mensagemErro || 'Falha na checagem');
          return { sucesso: false, erro: resultadoBase.mensagemErro };
        }

        if (!resultadoBase.encontrouVoos) {
          const clima = await climaPromise.catch(() => ({ ok: false, resumo: 'Clima indisponível' }));
          rotasRepo.atualizarResultadoChecagem(rota.id, {
            preco: 0,
            variacao_texto: '-',
            termometro: resultadoBase.mensagem || '⚪ Sem voos no filtro',
            custo_destino_texto: '-',
            detalhes_voo: '-',
            dica_stopover: '-',
            link_google_flights: rota.link_google_flights,
            clima_destino_resumo: clima.ok ? clima.resumo : null,
            clima_temp_media: clima.ok ? clima.tempMedia : null,
            melhor_opcao_flexivel: null
          });
          return { sucesso: true, encontrou: false, mensagem: resultadoBase.mensagem };
        }

        oferta = resultadoBase.oferta;

        // 3. Matriz de Flexibilidade Adjacente (±0 a ±7 dias)
        const flexDias = rota.flexibilidade_dias || 0;
        if (flexDias > 0) {
          const voltaEfetiva = ehSoIda(rota.data_volta) ? null : rota.data_volta;
          const combinacoes = gerarCombinacoesFlexibilidade(rota.data_ida, voltaEfetiva, flexDias);
          for (const comb of combinacoes.slice(1, 3)) {
            try {
              const resAdj = await FlightScanner.buscarOfertas(
                rota.codigo_origem,
                rota.codigo_destino,
                comb.dataIda,
                comb.dataVolta,
                rota.duracao_max_horas,
                rota.cabine || 'economy',
                1,
                moedaEfetiva
              );

              if (resAdj.ok && resAdj.encontrouVoos && resAdj.oferta.preco < oferta.preco) {
                const economia = oferta.preco - resAdj.oferta.preco;
                const economiaPct = Math.round((economia / oferta.preco) * 100);
                melhorOpcaoFlexivel = {
                  data_ida: comb.dataIda,
                  data_volta: comb.dataVolta,
                  preco: resAdj.oferta.preco,
                  economia,
                  economiaPct,
                  deltaDias: comb.deltaDias,
                  link: resAdj.oferta.link
                };
                break;
              }
            } catch (_) {}
          }
        }
      }

      const clima = await climaPromise.catch(() => ({ ok: false, resumo: 'Clima indisponível' }));

    const precoAnterior = parsePreco(rota.preco_atual);
    const variacao = calcularVariacao(oferta.preco, precoAnterior);

    const custoInfo = avaliarCustoDestinoComTotal(
      oferta.destinoReal,
      rota.destino,
      oferta.preco,
      dataIdaEfetiva,
      dataVoltaEfetiva
    );

    // 4. Detecção Estatística de Bug Fares em Tempo Real (Zero Delay)
    const statsPreco = rotasRepo.obterEstatisticasPreco(rota.id);
    const mediaReferencia = statsPreco.media || precoAnterior || rota.preco_atual;

    const analiseBug = detectarBugFareEstatistico({
      origemCod: rota.codigo_origem,
      destinoCod: rota.codigo_destino,
      preco: oferta.preco,
      precoMedioHistorico: mediaReferencia,
      desvioPadrao: statsPreco.desvioPadrao,
      cabine: rota.cabine || 'economy',
      dataVolta: dataVoltaEfetiva
    });

    if (analiseBug.ehBugFare) {
      const chaveBugAlerta = `BUG_FARE:${rota.codigo_origem}_${rota.codigo_destino}_${dataIdaEfetiva}_${dataVoltaEfetiva || 'SO_IDA'}`;
      const decisaoBug = alertasRepo.deveDispararBugFare(chaveBugAlerta, oferta.preco);

      const bugCard = montarCardBugFare({
        origem: rota.origem,
        codigoOrigem: rota.codigo_origem,
        destino: rota.destino,
        codigoDestino: rota.codigo_destino,
        dataIda: dataIdaEfetiva,
        dataVolta: dataVoltaEfetiva,
        preco: oferta.preco,
        motivo: analiseBug.motivo,
        tipo: analiseBug.tipo,
        destinoReal: oferta.destinoReal || rota.destino_real || null,
        codigoDestinoReal: oferta.codigoDestinoReal || null,
        linkOriginal: oferta.link
      });

      bugFaresRepo.inserir(bugCard);

      telemetryEvents.emitirAtualizacao('bug_fare_detectado', {
        ...bugCard,
        rotaId: rota.id
      });

      // Alerta de urgência máxima no Telegram com deduplicação inteligente:
      // - Não repete se for o mesmo preço a cada minuto (zero spam)
      // - Dispara imediatamente se for o primeiro alerta ou se o preço cair ainda mais no mesmo dia!
      if (decisaoBug.deve) {
        await notifierTelegram.enviarAlertaBugFare(bugCard);
        alertasRepo.registrarDisparo(chaveBugAlerta, oferta.preco, 'BUG_FARE');
      } else {
        console.log(`🔇 [SUPRIMIDO/DEDUPLICAÇÃO] Bug Fare para ${chaveBugAlerta} já alertado recentemente (R$ ${decisaoBug.ultimoPreco}). Motivo: ${decisaoBug.motivo}`);
      }
    }

    const destinoInfoRota = resolverDestinoConcreto({
      destino: rota.destino,
      codigoDestino: rota.codigo_destino,
      destinoReal: oferta.destinoReal || rota.destino_real,
      codigoDestinoReal: oferta.codigoDestinoReal || null
    });

    const destinoParaLink = oferta.codigoDestinoReal || destinoInfoRota.iata;
    const linkCanonicoRota = (dataIdaEfetiva && destinoParaLink)
      ? (gerarLinkGoogleFlightsCheapest(rota.codigo_origem, destinoParaLink, dataIdaEfetiva, dataVoltaEfetiva, rota.duracao_max_horas, 1, 0, rota.cabine || 'economy', moedaEfetiva)
         || gerarLinkGoogleFlights(rota.codigo_origem, rota.codigo_destino || destinoParaLink, dataIdaEfetiva, dataVoltaEfetiva, moedaEfetiva))
      : oferta.link;

    const rotaAtualizada = rotasRepo.atualizarResultadoChecagem(rota.id, {
      data_ida: rota.sem_data === 1 ? dataIdaEfetiva : undefined,
      data_volta: rota.sem_data === 1 ? dataVoltaEfetiva : undefined,
      preco: oferta.preco,
      moeda: moedaEfetiva,
      variacao_texto: variacao.texto,
      termometro: analiseBug.ehBugFare ? '🚨 BUG FARE CONFIRMADO' : (rota.sem_data === 1 ? `🔥 Menor Preço Flexível (${melhorOpcaoFlexivel?.label || ''})` : oferta.termometro),
      custo_destino_texto: custoInfo.textoResumo,
      detalhes_voo: `${oferta.duracaoHoras.toFixed(1)}h | ${oferta.detalhes}`,
      dica_stopover: oferta.dicaStopover,
      link_google_flights: linkCanonicoRota || oferta.link,
      destino_real: `${destinoInfoRota.cidade}, ${destinoInfoRota.pais} (${destinoInfoRota.iata})`,
      clima_destino_resumo: clima.ok ? clima.resumo : null,
      clima_temp_media: clima.ok ? clima.tempMedia : null,
      melhor_opcao_flexivel: melhorOpcaoFlexivel
    });

    // 4b. Análise de Delta e Z-Score da Rota Monitorada (padrão proactive-agent)
    const analiseDelta = classificarDeltaPreco({
      preco: oferta.preco,
      media: statsPreco.media,
      desvioPadrao: statsPreco.desvioPadrao
    });

    // 5. Inteligência de Alertas Regulares
    const chaveAlerta = rota.sem_data === 1
      ? `${rota.codigo_origem}_${rota.codigo_destino}_FLEXIVEL`
      : `${rota.codigo_origem}_${rota.codigo_destino}_${rota.data_ida}_${rota.data_volta || 'SO_IDA'}`;
    const ehRecorde = !rota.menor_preco_historico || oferta.preco < rota.menor_preco_historico;

    const decisaoAlerta = alertasRepo.deveDisparar(
      chaveAlerta,
      oferta.preco,
      precoAnterior,
      rota.preco_alvo,
      ehRecorde,
      oferta.nivelPreco,
      variacao.pct,
      {
        zScore: analiseDelta.zScore,
        deltaMediaPct: analiseDelta.quedaPct,
        classificacaoDelta: analiseBug.ehBugFare ? 'BUG_FARE' : analiseDelta.categoria,
        statsPreco
      }
    );

    if (!decisaoAlerta.deve && decisaoAlerta.motivo === 'oscilacao_normal_mercado_info') {
      console.log(`🔇 [Zero Ruído / proactive-agent] ${rota.origem} ➔ ${rota.destino}: R$ ${oferta.preco.toFixed(2)} classificado como INFO (oscilação normal). Alerta suprimido.`);
    }

    const rotaSilenciada = rotasRepo.estaSilenciada(rotaAtualizada);

    if (decisaoAlerta.deve && !rotaSilenciada && !analiseBug.ehBugFare) {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: rota.id,
        origem: rota.origem,
        destinoReal: oferta.destinoReal,
        dataIda: dataIdaEfetiva,
        dataVolta: dataVoltaEfetiva,
        preco: oferta.preco,
        variacaoTexto: variacao.texto,
        ehRecorde,
        custoInfo,
        duracaoHoras: oferta.duracaoHoras,
        detalhes: oferta.detalhes,
        dicaStopover: oferta.dicaStopover,
        link: oferta.link,
        clima: clima.ok ? clima : null,
        semData: rota.sem_data === 1,
        labelJanela: melhorOpcaoFlexivel?.label,
        precoAlvo: rota.preco_alvo
      });
    }

    // 6. Cálculo automático de milhas estimadas usando paridade e programa da rota
    const milhasEstimadas = calcularMilhasRota(
      oferta.preco,
      rota.paridade_milhas ?? null,
      rota.programa_milhas || 'smiles'
    );

    return {
      sucesso: true,
      encontrou: true,
      oferta,
      rotaAtualizada,
      clima,
      melhorOpcaoFlexivel,
      ehBugFare: analiseBug.ehBugFare,
      deltaEstatistico: analiseDelta,
      moeda: moedaEfetiva,
      milhas_estimadas: milhasEstimadas
    };
  } catch (err) {
    rotasRepo.marcarFalhaChecagem(rota.id, `Erro inesperado: ${err.message}`);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}

  /**
   * Executa ciclo de varredura orquestrado nas rotas monitoradas
   * Fila justa anti-inanição (LRU) por padrão ou todas as rotas ativas.
   *
   * @param {Object} [params]
   * @param {boolean} [params.forcarTodas=false] Varre todas as rotas ativas ou apenas o próximo lote
   * @param {number} [params.limite=1] Quantidade de rotas da fila LRU a escanear
   * @param {boolean} [params.aplicarJitter=false] Se deve aplicar jitter defensivo entre requisições
   * @param {string|null} [params.moeda=null] Moeda desejada ('BRL', 'USD', 'EUR') ou herdada da rota
   * @param {string|null} [params.curr=null] Alias para moeda
   * @returns {Promise<{ ok: boolean, processadas: number, moeda?: string, resultados: Array<{ rotaId: number, rota: string, moeda?: string, res?: Object, erro?: string }> }>}
   */
  static async executarCicloVarredura({ forcarTodas = false, limite = 1, aplicarJitter = false, moeda = null, curr = null } = {}) {
    const moedaGlob = (moeda || curr || null);
    const rotas = forcarTodas
      ? rotasRepo.listarTodas(true)
      : rotasRepo.obterFilaLru(limite);

    if (!rotas || rotas.length === 0) {
      return { ok: true, processadas: 0, resultados: [] };
    }

    const resultados = [];
    for (let i = 0; i < rotas.length; i++) {
      const rota = rotas[i];
      const moedaRota = (moedaGlob || rota.moeda || rota.curr || 'BRL').trim().toUpperCase();
      try {
        const res = await FlightScanner.escanearRota(rota, { moeda: moedaRota });
        resultados.push({
          rotaId: rota.id,
          rota: `${rota.origem} ➔ ${rota.destino}`,
          moeda: moedaRota,
          res
        });
      } catch (err) {
        resultados.push({
          rotaId: rota.id,
          rota: `${rota.origem} ➔ ${rota.destino}`,
          moeda: moedaRota,
          erro: err.message
        });
      }

      if (aplicarJitter && rotas.length > 1 && i < rotas.length - 1) {
        const jitterMs = 2500 + Math.floor(Math.random() * 2000);
        await new Promise(r => setTimeout(r, jitterMs));
      }
    }

    return {
      ok: true,
      processadas: resultados.length,
      ...(moedaGlob ? { moeda: moedaGlob.trim().toUpperCase() } : {}),
      resultados
    };
  }
}
