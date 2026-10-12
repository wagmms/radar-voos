import { flightProviderManager } from './providers/provider_manager.js';
import { weatherService } from './weather_service.js';
import {
  parsePreco,
  calcularVariacao,
  avaliarCustoDestinoComTotal
} from '../domain/calculadora.js';
import { rotasRepo, alertasRepo, bugFaresRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';
import { detectarBugFareEstatistico } from '../domain/bug_fares.js';
import { gerarCombinacoesFlexibilidade } from '../domain/rotas.js';
import { telemetryEvents } from './telemetry_events.js';

export class FlightScanner {
  /**
   * Consulta os provedores de voo através do gerenciador de estratégias
   */
  static async buscarOfertas(origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1) {
    return flightProviderManager.buscarOfertas({
      origemCod,
      destinoCod,
      dataIda,
      dataVolta,
      duracaoMaxHoras,
      cabine,
      adultos
    });
  }

  /**
   * Executa varredura de uma rota cadastrada no banco de dados com flexibilidade de datas e detecção de Bug Fares
   */
  static async escanearRota(rota) {
    try {
      // 1. Consulta meteorológica do destino em paralelo
      const climaPromise = weatherService.obterClimaDestino(rota.codigo_destino || rota.destino, rota.data_ida);

      // 2. Busca de ofertas da data base
      const resultadoBase = await FlightScanner.buscarOfertas(
        rota.codigo_origem,
        rota.codigo_destino,
        rota.data_ida,
        rota.data_volta,
        rota.duracao_max_horas,
        rota.cabine || 'economy',
        1
      );

      const clima = await climaPromise.catch(() => ({ ok: false, resumo: 'Clima indisponível' }));

      if (!resultadoBase.ok) {
        rotasRepo.marcarFalhaChecagem(rota.id, resultadoBase.mensagemErro || 'Falha na checagem');
        return { sucesso: false, erro: resultadoBase.mensagemErro };
      }

    if (!resultadoBase.encontrouVoos) {
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

    let { oferta } = resultadoBase;
    let melhorOpcaoFlexivel = null;

    // 3. Matriz de Flexibilidade de Datas (se flexibilidade_dias > 0)
    const flexDias = rota.flexibilidade_dias || 0;
    if (flexDias > 0) {
      const combinacoes = gerarCombinacoesFlexibilidade(rota.data_ida, rota.data_volta, flexDias);
      // Analisa até 2 combinações adjacentes na janela para encontrar tarifas ainda menores
      for (const comb of combinacoes.slice(1, 3)) {
        try {
          const resAdj = await FlightScanner.buscarOfertas(
            rota.codigo_origem,
            rota.codigo_destino,
            comb.dataIda,
            comb.dataVolta,
            rota.duracao_max_horas,
            rota.cabine || 'economy',
            1
          );

          if (resAdj.ok && resAdj.encontrouVoos && resAdj.oferta.preco < oferta.preco) {
            const economia = oferta.preco - resAdj.oferta.preco;
            const economiaPct = Math.round((economia / oferta.preco) * 100);
            melhorOpcaoFlexivel = {
              dataIda: comb.dataIda,
              dataVolta: comb.dataVolta,
              preco: resAdj.oferta.preco,
              economia,
              economiaPct,
              deltaDias: comb.deltaDias,
              link: resAdj.oferta.link
            };
            break; // Encontrou economia na janela
          }
        } catch (_) {}
      }
    }

    const precoAnterior = parsePreco(rota.preco_atual);
    const variacao = calcularVariacao(oferta.preco, precoAnterior);

    const custoInfo = avaliarCustoDestinoComTotal(
      oferta.destinoReal,
      rota.destino,
      oferta.preco,
      rota.data_ida,
      rota.data_volta
    );

    // 4. Detecção Estatística de Bug Fares em Tempo Real (Zero Delay)
    const analiseBug = detectarBugFareEstatistico({
      origemCod: rota.codigo_origem,
      destinoCod: rota.codigo_destino,
      preco: oferta.preco,
      precoMedioHistorico: rota.menor_preco_historico || precoAnterior,
      dataVolta: rota.data_volta
    });

    if (analiseBug.ehBugFare) {
      const tituloBug = `🚨 BUG FARE: ${rota.origem} ➔ ${rota.destino} por R$ ${oferta.preco.toFixed(0)}! (${analiseBug.motivo})`;
      bugFaresRepo.inserir(tituloBug, oferta.link, analiseBug.tipo);

      telemetryEvents.emitirAtualizacao('bug_fare_detectado', {
        titulo: tituloBug,
        link: oferta.link,
        preco: oferta.preco,
        rotaId: rota.id,
        origem: rota.origem,
        destino: rota.destino
      });

      // Alerta de urgência máxima no Telegram (quebra modo noturno)
      await notifierTelegram.enviarAlertaBugFare(
        tituloBug,
        oferta.link,
        `🚨 ${analiseBug.tipo}`
      );
    }

    const rotaAtualizada = rotasRepo.atualizarResultadoChecagem(rota.id, {
      preco: oferta.preco,
      variacao_texto: variacao.texto,
      termometro: analiseBug.ehBugFare ? '🚨 BUG FARE CONFIRMADO' : oferta.termometro,
      custo_destino_texto: custoInfo.textoResumo,
      detalhes_voo: `${oferta.duracaoHoras.toFixed(1)}h | ${oferta.detalhes}`,
      dica_stopover: oferta.dicaStopover,
      link_google_flights: oferta.link,
      clima_destino_resumo: clima.ok ? clima.resumo : null,
      clima_temp_media: clima.ok ? clima.tempMedia : null,
      melhor_opcao_flexivel: melhorOpcaoFlexivel
    });

    // 5. Inteligência de Alertas Regulares
    const chaveAlerta = `${rota.codigo_origem}_${rota.codigo_destino}_${rota.data_ida}_${rota.data_volta || 'SO_IDA'}`;
    const ehRecorde = !rota.menor_preco_historico || oferta.preco < rota.menor_preco_historico;

    const decisaoAlerta = alertasRepo.deveDisparar(
      chaveAlerta,
      oferta.preco,
      precoAnterior,
      rota.preco_alvo,
      ehRecorde,
      oferta.nivelPreco,
      variacao.pct
    );

    const rotaSilenciada = rotasRepo.estaSilenciada(rotaAtualizada);

    if (decisaoAlerta.deve && !rotaSilenciada && !analiseBug.ehBugFare) {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: rota.id,
        origem: rota.origem,
        destinoReal: oferta.destinoReal,
        dataIda: rota.data_ida,
        dataVolta: rota.data_volta,
        preco: oferta.preco,
        variacaoTexto: variacao.texto,
        ehRecorde,
        custoInfo,
        duracaoHoras: oferta.duracaoHoras,
        detalhes: oferta.detalhes,
        dicaStopover: oferta.dicaStopover,
        link: oferta.link,
        clima: clima.ok ? clima : null
      });
    }

    return {
      sucesso: true,
      encontrou: true,
      oferta,
      rotaAtualizada,
      clima,
      melhorOpcaoFlexivel,
      ehBugFare: analiseBug.ehBugFare
    };
  } catch (err) {
    rotasRepo.marcarFalhaChecagem(rota.id, `Erro inesperado: ${err.message}`);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}
}
