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
import {
  gerarCombinacoesFlexibilidade,
  gerarJanelaDatasFlexiveis,
  gerarJanelasExploracaoSemData,
  ehSoIda,
  rotaEhSoIda,
  obterDatasEfetivasRota,
  formatarDataParaBusca,
  formatarDiaMes,
  gerarLinkGoogleFlightsCheapest,
  gerarLinkGoogleFlights,
  gerarDataPadraoInicial,
  ehRotaDomesticaBrasil
} from '../domain/rotas.js';
import { montarCardBugFare, resolverDestinoConcreto } from '../domain/aeroportos.js';
import { telemetryEvents } from './telemetry_events.js';
import {
  ehCodigoRegional,
  expandirDestinoOuOrigemRegional,
  NOMES_CIDADES_IATA
} from '../domain/dicionarios.js';

/**
 * @deprecated Descontinuado: O Radar de Voos opera exclusivamente com tarifas reais em dinheiro.
 * Retorna null sem poluir os payloads de rota.
 *
 * @returns {null}
 */
export function calcularMilhasRota() {
  return null;
}

/**
 * Executor concorrente com limite defensivo e espaçamento escalonado (stagger).
 * Otimiza o tempo de varredura multi-hub e datas flexíveis sem gerar picos na rede.
 *
 * @template T, R
 * @param {T[]} itens
 * @param {(item: T, index: number) => Promise<R>} workerFn
 * @param {Object} [opcoes]
 * @param {number} [opcoes.limite=2] - Máximo de execuções simultâneas
 * @param {number} [opcoes.staggerMs=300] - Intervalo entre o disparo de novos workers
 * @returns {Promise<R[]>}
 */
export async function executarComConcorrenciaLimitada(itens, workerFn, { limite = 2, staggerMs = 300 } = {}) {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  const resultados = new Array(itens.length);
  const fila = itens.map((item, index) => ({ item, index }));

  const executarWorker = async () => {
    while (fila.length > 0) {
      const tarefa = fila.shift();
      try {
        resultados[tarefa.index] = await workerFn(tarefa.item, tarefa.index);
      } catch (err) {
        resultados[tarefa.index] = null;
      }
    }
  };

  const totalWorkers = Math.min(limite, itens.length);
  const workers = [];
  for (let w = 0; w < totalWorkers; w++) {
    if (w > 0 && staggerMs > 0) {
      await new Promise(r => setTimeout(r, staggerMs));
    }
    workers.push(executarWorker());
  }

  await Promise.all(workers);
  return resultados;
}

export class FlightScanner {
  /**
   * Consulta os provedores de voo através do gerenciador de estratégias
   */
  static async buscarOfertas(origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1, moeda = 'BRL', opcoesExtras = {}) {
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
      moeda: (moeda || 'BRL').trim().toUpperCase(),
      ...(opcoesExtras || {})
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
      const rotaDomestica = ehRotaDomesticaBrasil(
        rota?.codigo_origem || rota?.origem,
        rota?.codigo_destino || rota?.destino
      );

      // Rotas domésticas no Brasil operam estritamente em BRL (previne distorções cambiais)
      const moedaSolicitada = (opcoes?.moeda || opcoes?.curr || rota?.moeda || rota?.curr || 'BRL').trim().toUpperCase();
      const moedaEfetiva = rotaDomestica ? 'BRL' : moedaSolicitada;

      // Determinação unificada e segura das datas da rota (prevenção de buscas espúrias de só ida)
      const datasEfetivas = obterDatasEfetivasRota(rota);
      const ehSoIda = datasEfetivas.soIda;
      let dataIdaEfetiva = datasEfetivas.dataIda;
      let dataVoltaEfetiva = datasEfetivas.dataVolta;

      // NUNCA repassar preco_alvo como maxPrice para busca de voos no Google Flights
      // (oculta voos de mercado, impede rastreamento de tendências e contamina o parser com nós de filtro)
      const filtrosAvancados = {
        maxStops: rota.max_stops ?? rota.maxStops ?? null,
        carryOnBags: rota.carry_on_bags ?? rota.carryOnBags ?? null,
        checkedBags: rota.checked_bags ?? rota.checkedBags ?? null,
        maxPrice: (rota.max_price !== undefined && rota.max_price !== null && !isNaN(Number(rota.max_price))) ? Number(rota.max_price) : null,
        hideSeparateAndSelfTransfer: rota.hide_separate_and_self_transfer ?? rota.hideSeparateAndSelfTransfer ?? null,
        excludeBasicEconomy: rota.exclude_basic_economy ?? rota.excludeBasicEconomy ?? null
      };

      // 1. Consulta meteorológica do destino em paralelo
      const climaPromise = weatherService.obterClimaDestino(rota.codigo_destino || rota.destino, dataIdaEfetiva);

      const hubsDestino = expandirDestinoOuOrigemRegional(rota.codigo_destino || rota.destino);
      const ehRegional = hubsDestino.length > 0;

      let origemBusca = rota.codigo_origem;
      if (ehCodigoRegional(rota.codigo_origem)) {
        const hubsOrigem = expandirDestinoOuOrigemRegional(rota.codigo_origem);
        const ehInternacional = ['EUR', 'SAM', 'USA', 'CAR'].includes(String(rota.codigo_destino).toUpperCase()) ||
          hubsDestino.some(h => ['LIS', 'MAD', 'OPO', 'CDG', 'MXP', 'FCO', 'MIA', 'JFK', 'SCL', 'EZE'].includes(h));
        origemBusca = (ehInternacional && hubsOrigem.includes('GRU')) ? 'GRU' : (hubsOrigem[0] || rota.codigo_origem);
      }

      let resultadoFinal = null;
      let oferta = null;
      let melhorOpcaoFlexivel = null;
      let calendarioPrecos = [];
      let melhorDataAlternativa = null;
      let rankingDestinosRegionais = [];
      let destinoVencedorIata = null;
      let destinoVencedorNome = null;

      // 2. Modo Exploração Multi-Hub por Região/Continente (Concorrência N=2 com Stagger)
      if (ehRegional) {
        let menorOfertaRegional = null;
        const respostasHubs = await executarComConcorrenciaLimitada(hubsDestino, async (hubIata) => {
          try {
            const resHub = await FlightScanner.buscarOfertas(
              origemBusca,
              hubIata,
              dataIdaEfetiva,
              dataVoltaEfetiva,
              rota.duracao_max_horas,
              rota.cabine || 'economy',
              1,
              moedaEfetiva,
              filtrosAvancados
            );
            return { hubIata, resHub };
          } catch (_) {
            return null;
          }
        }, { limite: 2, staggerMs: 300 });

        for (const itemHub of respostasHubs) {
          if (!itemHub?.resHub) continue;
          const { hubIata, resHub } = itemHub;
          if (resHub.ok && resHub.encontrouVoos && resHub.oferta && resHub.oferta.preco > 0) {
            const nomeCidade = NOMES_CIDADES_IATA[hubIata] || resHub.oferta.destinoReal || hubIata;
            const linkHub = (dataIdaEfetiva && hubIata)
              ? (gerarLinkGoogleFlightsCheapest(origemBusca, hubIata, dataIdaEfetiva, dataVoltaEfetiva, rota.duracao_max_horas, 1, 0, rota.cabine || 'economy', moedaEfetiva, filtrosAvancados)
                 || gerarLinkGoogleFlights(origemBusca, hubIata, dataIdaEfetiva, dataVoltaEfetiva, moedaEfetiva))
              : resHub.oferta.link;

            const item = {
              destinoIata: hubIata,
              nomeCidade,
              preco: resHub.oferta.preco,
              cia: resHub.oferta.cia || null,
              escalas: resHub.oferta.escalas ?? 0,
              duracaoTexto: resHub.oferta.detalhes || `${resHub.oferta.duracaoHoras?.toFixed(1)}h`,
              horarioPartida: resHub.oferta.horarioPartida || null,
              linkGoogleFlights: linkHub
            };
            rankingDestinosRegionais.push(item);
            if (!menorOfertaRegional || resHub.oferta.preco < menorOfertaRegional.oferta.preco) {
              menorOfertaRegional = {
                hubIata,
                nomeCidade,
                oferta: resHub.oferta
              };
            }
          }
        }

        if (rankingDestinosRegionais.length === 0) {
          const clima = await climaPromise.catch(() => ({ ok: false, resumo: 'Clima indisponível' }));
          rotasRepo.atualizarResultadoChecagem(rota.id, {
            preco: 0,
            variacao_texto: '-',
            termometro: '⚪ Sem voos para os hubs da região',
            custo_destino_texto: '-',
            detalhes_voo: '-',
            dica_stopover: '-',
            link_google_flights: rota.link_google_flights,
            clima_destino_resumo: clima.ok ? clima.resumo : null,
            clima_temp_media: clima.ok ? clima.tempMedia : null,
            melhor_opcao_flexivel: null
          });
          return { sucesso: true, encontrou: false, mensagem: 'Sem voos para os hubs da região' };
        }

        rankingDestinosRegionais.sort((a, b) => a.preco - b.preco);
        oferta = menorOfertaRegional.oferta;
        destinoVencedorIata = menorOfertaRegional.hubIata;
        destinoVencedorNome = menorOfertaRegional.nomeCidade;
        oferta.codigoDestinoReal = destinoVencedorIata;
        oferta.destinoReal = destinoVencedorNome;
      } else if (rota.sem_data === 1) {
        const janelas = gerarJanelasExploracaoSemData({
          dataBase: dataIdaEfetiva,
          diasEstadia: datasEfetivas.diasEstadia || 10,
          qtdAmostras: 4,
          soIda: ehSoIda
        });

        const respostasJanelas = await executarComConcorrenciaLimitada(janelas, async (j) => {
          try {
            const res = await FlightScanner.buscarOfertas(
              rota.codigo_origem,
              rota.codigo_destino,
              j.dataIda,
              j.dataVolta,
              rota.duracao_max_horas,
              rota.cabine || 'economy',
              1,
              moedaEfetiva,
              filtrosAvancados
            );
            if (res.ok && res.encontrouVoos && res.oferta && res.oferta.preco > 0) {
              return {
                ...j,
                oferta: res.oferta
              };
            }
          } catch (_) {}
          return null;
        }, { limite: 2, staggerMs: 300 });

        const resultadosAmostras = respostasJanelas.filter(Boolean);

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

        const labelAmostra = campeao.label || `${formatarDiaMes(campeao.dataIda)}${campeao.dataVolta ? ` a ${formatarDiaMes(campeao.dataVolta)}` : ''}`;

        melhorOpcaoFlexivel = {
          data_ida: campeao.dataIda,
          data_volta: campeao.dataVolta,
          preco: campeao.oferta.preco,
          label: labelAmostra,
          modo: 'sem_data',
          totalAmostras: resultadosAmostras.length,
          link: campeao.oferta.link
        };
      } else {
        // 2b. Modo Data Fixa / Base
        const diasFlex = Math.min(3, Math.max(0, parseInt(rota.dias_flexiveis !== undefined ? rota.dias_flexiveis : rota.flexibilidade_dias, 10) || 0));

        const resultadoBase = await FlightScanner.buscarOfertas(
          rota.codigo_origem,
          rota.codigo_destino,
          dataIdaEfetiva,
          dataVoltaEfetiva,
          rota.duracao_max_horas,
          rota.cabine || 'economy',
          1,
          moedaEfetiva,
          filtrosAvancados
        );

        if (!resultadoBase.ok && diasFlex === 0) {
          rotasRepo.marcarFalhaChecagem(rota.id, resultadoBase.mensagemErro || 'Falha na checagem');
          return { sucesso: false, erro: resultadoBase.mensagemErro };
        }

        if (!resultadoBase.encontrouVoos && diasFlex === 0) {
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

        if (resultadoBase.ok && resultadoBase.encontrouVoos && resultadoBase.oferta) {
          oferta = resultadoBase.oferta;
        }

        // 3. Janela de Datas Flexíveis (±1 a ±3 dias) & Calendário de Preços
        if (diasFlex > 0) {
          const paresJanela = gerarJanelaDatasFlexiveis(rota.data_ida, rota.data_volta, diasFlex);
          const ofertasVizinhos = [];

          // Se a data base (offset === 0) retornou voo válido, inclui no calendário
          if (oferta && oferta.preco > 0) {
            calendarioPrecos.push({
              offset: 0,
              dataIda: rota.data_ida,
              dataVolta: rota.data_volta || null,
              preco: oferta.preco,
              cia: oferta.cia || null,
              escalas: oferta.escalas ?? 0,
              horarioPartida: oferta.horarioPartida || null
            });
          }

          // Varre os offsets vizinhos com concorrência controlada (N=2 com stagger de 250ms)
          const vizinhosParaBuscar = paresJanela.filter(p => p.offset !== 0);
          const respostasVizinhos = await executarComConcorrenciaLimitada(vizinhosParaBuscar, async (par) => {
            try {
              const resAdj = await FlightScanner.buscarOfertas(
                rota.codigo_origem,
                rota.codigo_destino,
                par.dataIda,
                par.dataVolta,
                rota.duracao_max_horas,
                rota.cabine || 'economy',
                1,
                moedaEfetiva,
                filtrosAvancados
              );

              if (resAdj.ok && resAdj.encontrouVoos && resAdj.oferta && resAdj.oferta.preco > 0) {
                const itemCalendario = {
                  offset: par.offset,
                  dataIda: par.dataIda,
                  dataVolta: par.dataVolta || null,
                  preco: resAdj.oferta.preco,
                  cia: resAdj.oferta.cia || null,
                  escalas: resAdj.oferta.escalas ?? 0,
                  horarioPartida: resAdj.oferta.horarioPartida || null
                };
                return {
                  itemCalendario,
                  ofertaCompleta: resAdj.oferta
                };
              }
            } catch (_) {}
            return null;
          }, { limite: 2, staggerMs: 250 });

          for (const item of respostasVizinhos) {
            if (!item) continue;
            calendarioPrecos.push(item.itemCalendario);
            ofertasVizinhos.push({
              ...item.itemCalendario,
              ofertaCompleta: item.ofertaCompleta
            });
          }

          // Ordena por offset crescente
          calendarioPrecos.sort((a, b) => a.offset - b.offset);

          // Se nem a data base nem os dias vizinhos encontraram voos, finaliza sem voos
          if (!oferta && ofertasVizinhos.length === 0) {
            const clima = await climaPromise.catch(() => ({ ok: false, resumo: 'Clima indisponível' }));
            rotasRepo.atualizarResultadoChecagem(rota.id, {
              preco: 0,
              variacao_texto: '-',
              termometro: resultadoBase.mensagem || '⚪ Sem voos na janela flexível',
              custo_destino_texto: '-',
              detalhes_voo: '-',
              dica_stopover: '-',
              link_google_flights: rota.link_google_flights,
              clima_destino_resumo: clima.ok ? clima.resumo : null,
              clima_temp_media: clima.ok ? clima.tempMedia : null,
              melhor_opcao_flexivel: null
            });
            return { sucesso: true, encontrou: false, mensagem: resultadoBase.mensagem || 'Sem voos na janela flexível' };
          }

          // Caso a data base não tenha encontrado voo, elege o melhor vizinho como oferta principal da rota
          if (!oferta && ofertasVizinhos.length > 0) {
            ofertasVizinhos.sort((a, b) => a.preco - b.preco);
            const melhorVizinhoFallback = ofertasVizinhos[0];
            oferta = melhorVizinhoFallback.ofertaCompleta;
            dataIdaEfetiva = melhorVizinhoFallback.dataIda;
            dataVoltaEfetiva = melhorVizinhoFallback.dataVolta;

            melhorDataAlternativa = {
              offset: melhorVizinhoFallback.offset,
              dataIda: melhorVizinhoFallback.dataIda,
              dataVolta: melhorVizinhoFallback.dataVolta,
              preco: melhorVizinhoFallback.preco,
              economiaReais: 0,
              economiaPercentual: 0,
              cia: melhorVizinhoFallback.cia,
              escalas: melhorVizinhoFallback.escalas,
              linkGoogleFlights: null
            };

            melhorOpcaoFlexivel = {
              data_ida: melhorVizinhoFallback.dataIda,
              data_volta: melhorVizinhoFallback.dataVolta,
              preco: melhorVizinhoFallback.preco,
              economia: 0,
              economiaPct: 0,
              deltaDias: melhorVizinhoFallback.offset,
              link: null
            };
          } else {
            // Identifica data vizinha mais barata que a base (offset === 0)
            const vizinhos = calendarioPrecos.filter(item => item.offset !== 0);
            const vizinhosMaisBaratos = vizinhos.filter(item => item.preco < oferta.preco);
            if (vizinhosMaisBaratos.length > 0) {
              vizinhosMaisBaratos.sort((a, b) => a.preco - b.preco);
              const melhorVizinho = vizinhosMaisBaratos[0];
              const economiaReais = oferta.preco - melhorVizinho.preco;
              const economiaPercentual = Math.round((economiaReais / oferta.preco) * 100);

              melhorDataAlternativa = {
                offset: melhorVizinho.offset,
                dataIda: melhorVizinho.dataIda,
                dataVolta: melhorVizinho.dataVolta,
                preco: melhorVizinho.preco,
                economiaReais,
                economiaPercentual,
                cia: melhorVizinho.cia,
                escalas: melhorVizinho.escalas,
                linkGoogleFlights: null
              };

              melhorOpcaoFlexivel = {
                data_ida: melhorVizinho.dataIda,
                data_volta: melhorVizinho.dataVolta,
                preco: melhorVizinho.preco,
                economia: economiaReais,
                economiaPct: economiaPercentual,
                deltaDias: melhorVizinho.offset,
                link: null
              };
            }
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

    const destinoParaLink = destinoVencedorIata || oferta.codigoDestinoReal || destinoInfoRota.iata;
    const origemParaLink = origemBusca || rota.codigo_origem;

    if (melhorDataAlternativa) {
      melhorDataAlternativa.linkGoogleFlights = (melhorDataAlternativa.dataIda && destinoParaLink)
        ? (gerarLinkGoogleFlightsCheapest(origemParaLink, destinoParaLink, melhorDataAlternativa.dataIda, melhorDataAlternativa.dataVolta, rota.duracao_max_horas, 1, 0, rota.cabine || 'economy', moedaEfetiva, filtrosAvancados)
           || gerarLinkGoogleFlights(origemParaLink, destinoParaLink, melhorDataAlternativa.dataIda, melhorDataAlternativa.dataVolta, moedaEfetiva))
        : null;
      if (melhorOpcaoFlexivel) {
        melhorOpcaoFlexivel.link = melhorDataAlternativa.linkGoogleFlights;
      }
    }

    const linkCanonicoRota = (dataIdaEfetiva && destinoParaLink)
      ? (gerarLinkGoogleFlightsCheapest(origemParaLink, destinoParaLink, dataIdaEfetiva, dataVoltaEfetiva, rota.duracao_max_horas, 1, 0, rota.cabine || 'economy', moedaEfetiva, filtrosAvancados)
         || gerarLinkGoogleFlights(origemParaLink, destinoParaLink, dataIdaEfetiva, dataVoltaEfetiva, moedaEfetiva))
      : oferta.link;

    let labelFlex = melhorOpcaoFlexivel?.label || '';
    if (!labelFlex && melhorOpcaoFlexivel?.data_ida) {
      const idaFmt = formatarDiaMes(melhorOpcaoFlexivel.data_ida);
      const voltaFmt = melhorOpcaoFlexivel.data_volta ? ` a ${formatarDiaMes(melhorOpcaoFlexivel.data_volta)}` : '';
      labelFlex = `${idaFmt}${voltaFmt}`;
    }
    const termometroFlex = labelFlex ? `🔥 Menor Preço Flexível (${labelFlex})` : '🔥 Menor Preço Flexível';

    let opcaoDiretaSaneada = oferta.melhorOpcaoDiretaOuRapida || null;
    if (opcaoDiretaSaneada) {
      const precoOpcao = Number(opcaoDiretaSaneada.preco);
      const vooPrincipalJaDireto = Number(oferta.escalas ?? 0) === 0;
      if (!Number.isFinite(precoOpcao) || precoOpcao <= Number(oferta.preco) || vooPrincipalJaDireto) {
        opcaoDiretaSaneada = null;
      } else {
        opcaoDiretaSaneada = {
          ...opcaoDiretaSaneada,
          diferencaPreco: Math.round(precoOpcao - Number(oferta.preco))
        };
      }
    }

    const rotaAtualizada = rotasRepo.atualizarResultadoChecagem(rota.id, {
      data_ida: rota.sem_data === 1 ? dataIdaEfetiva : undefined,
      data_volta: rota.sem_data === 1 ? dataVoltaEfetiva : undefined,
      preco: oferta.preco,
      moeda: rotaDomestica ? 'BRL' : moedaEfetiva,
      variacao_texto: variacao.texto,
      termometro: analiseBug.ehBugFare ? '🚨 BUG FARE CONFIRMADO' : (rota.sem_data === 1 ? termometroFlex : oferta.termometro),
      custo_destino_texto: custoInfo.textoResumo,
      detalhes_voo: `${oferta.duracaoHoras.toFixed(1)}h | ${oferta.detalhes}`,
      dica_stopover: oferta.dicaStopover,
      link_google_flights: linkCanonicoRota || oferta.link,
      destino_real: destinoVencedorNome
        ? `${destinoVencedorNome} (${destinoVencedorIata})`
        : `${destinoInfoRota.cidade}, ${destinoInfoRota.pais} (${destinoInfoRota.iata})`,
      clima_destino_resumo: clima.ok ? clima.resumo : null,
      clima_temp_media: clima.ok ? clima.tempMedia : null,
      melhor_opcao_flexivel: melhorOpcaoFlexivel,
      horario_partida: oferta.horarioPartida || null,
      horario_chegada: oferta.horarioChegada || null,
      numero_voo: oferta.numeroVoo || null,
      tempo_conexao: oferta.tempoConexao || null,
      top_ofertas: oferta.topOfertas || null,
      melhor_opcao_direta_rapida: opcaoDiretaSaneada,
      calendario_precos: calendarioPrecos.length > 0 ? calendarioPrecos : null,
      melhor_data_alternativa: melhorDataAlternativa,
      price_insights: oferta.priceInsights || null,
      ranking_destinos_regionais: rankingDestinosRegionais.length > 0 ? rankingDestinosRegionais : null
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
      : `${rota.codigo_origem}_${rota.codigo_destino}_${dataIdaEfetiva}_${dataVoltaEfetiva || 'SO_IDA'}`;
    const ehRecorde = !rota.menor_preco_historico || oferta.preco < rota.menor_preco_historico;

      const nivelInsightRaw = String(oferta.priceInsights?.nivel || oferta.nivelPreco || '').trim().toLowerCase();
      const nivelPrecoEfetivo = (nivelInsightRaw === 'baixo' || nivelInsightRaw === 'low')
        ? 'LOW'
        : (oferta.nivelPreco || null);

      const decisaoAlerta = alertasRepo.deveDisparar(
        chaveAlerta,
        oferta.preco,
        precoAnterior,
        rota.preco_alvo,
        ehRecorde,
        nivelPrecoEfetivo,
        variacao.pct,
        {
          apenasAvaliar: true,
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
        const enviado = await notifierTelegram.enviarAlertaOportunidade({
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
          link: linkCanonicoRota || oferta.link,
          clima: clima.ok ? clima : null,
          semData: rota.sem_data === 1,
          labelJanela: melhorOpcaoFlexivel?.label,
          precoAlvo: rota.preco_alvo,
          horarioPartida: oferta.horarioPartida || null,
          horarioChegada: oferta.horarioChegada || null,
          numeroVoo: oferta.numeroVoo || null,
          tempoConexao: oferta.tempoConexao || null,
          escalas: oferta.escalas ?? null,
          topOfertas: oferta.topOfertas || null,
          melhorOpcaoDiretaOuRapida: oferta.melhorOpcaoDiretaOuRapida || null,
          priceInsights: oferta.priceInsights || null,
          melhorDataAlternativa: melhorDataAlternativa || null,
          rankingDestinosRegionais: rankingDestinosRegionais.length > 0 ? rankingDestinosRegionais : null,
          destinoVencedorIata: destinoVencedorIata || null,
          destinoVencedorNome: destinoVencedorNome || null
        });

        if (enviado !== false) {
          alertasRepo.registrarDisparo(chaveAlerta, oferta.preco, decisaoAlerta.tipo || 'OPORTUNIDADE');
        }
      }

    // 6. Milhas descontinuadas em prol de economia real em dinheiro
    return {
      sucesso: true,
      encontrou: true,
      oferta,
      rotaAtualizada,
      clima,
      melhorOpcaoFlexivel,
      calendarioPrecos,
      melhorDataAlternativa,
      rankingDestinosRegionais: rankingDestinosRegionais.length > 0 ? rankingDestinosRegionais : null,
      destinoVencedorIata: destinoVencedorIata || null,
      destinoVencedorNome: destinoVencedorNome || null,
      linkCanonicoRota,
      priceInsights: oferta.priceInsights || null,
      ehBugFare: analiseBug.ehBugFare,
      deltaEstatistico: analiseDelta,
      moeda: moedaEfetiva,
      milhas_estimadas: null
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
        telemetryEvents.emitirAtualizacao('rota_verificada', { rotaId: rota.id, resultado: res });
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
