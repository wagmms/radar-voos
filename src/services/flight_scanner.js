import { serpApiPool } from './serpapi_pool.js';
import { normalizarParaSerpApi, gerarLinkGoogleFlights } from '../domain/rotas.js';
import {
  parsePreco,
  calcularVariacao,
  avaliarCustoDestinoComTotal,
  avaliarTermometro,
  analisarLayoversEStopover
} from '../domain/calculadora.js';
import { rotasRepo, alertasRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';

export class FlightScanner {
  /**
   * Consulta a API SerpAPI para uma busca específica
   */
  static async buscarOfertas(origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999) {
    const chaveInfo = serpApiPool.obterChaveDisponivel();
    if (!chaveInfo) {
      return {
        ok: false,
        erro: true,
        mensagemErro: 'Pool esgotado: todas as chaves atingiram o limite diário/mensal ou estão em cooldown.'
      };
    }

    serpApiPool.registrarUso(chaveInfo.indice);

    const origemSerp = normalizarParaSerpApi(origemCod);
    const destinoSerp = normalizarParaSerpApi(destinoCod);
    const duracaoMaxMinutos = duracaoMaxHoras && duracaoMaxHoras > 0 ? Math.round(duracaoMaxHoras * 60) : Infinity;

    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: origemSerp,
      arrival_id: destinoSerp,
      outbound_date: dataIda,
      currency: 'BRL',
      hl: 'pt',
      type: dataVolta ? '1' : '2',
      api_key: chaveInfo.chave
    });

    if (duracaoMaxMinutos !== Infinity) {
      params.append('max_duration', String(duracaoMaxMinutos));
    }

    if (dataVolta) {
      params.append('return_date', dataVolta);
    }

    const url = `https://serpapi.com/search.json?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const resposta = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const codigoHttp = resposta.status;
      const textoResposta = await resposta.text();

      if (codigoHttp === 429) {
        serpApiPool.registrarRateLimit(chaveInfo.indice, 30);
        return {
          ok: false,
          erro: true,
          mensagemErro: `HTTP 429 Rate Limit atingido na Chave ${chaveInfo.indice + 1}. Cooldown ativado por 30m.`
        };
      }

      if (codigoHttp >= 400) {
        return {
          ok: false,
          erro: true,
          mensagemErro: `HTTP ${codigoHttp}: ${textoResposta.slice(0, 150)}`
        };
      }

      let json;
      try {
        json = JSON.parse(textoResposta);
      } catch (e) {
        return { ok: false, erro: true, mensagemErro: 'Resposta da SerpAPI não é um JSON válido.' };
      }

      if (json.error) {
        const errStr = String(json.error).toLowerCase();
        if (
          errStr.includes("hasn't returned any results") ||
          errStr.includes('no results') ||
          errStr.includes("hasn't returned any flight")
        ) {
          return {
            ok: true,
            encontrouVoos: false,
            mensagem: 'Sem voos para esta rota/filtro no Google Flights'
          };
        }
        return { ok: false, erro: true, mensagemErro: `SerpAPI: ${json.error}` };
      }

      const { nivelPreco, termometro } = avaliarTermometro(json.price_insights);
      const todosVoos = [...(json.best_flights || []), ...(json.other_flights || [])];

      if (todosVoos.length === 0) {
        return {
          ok: true,
          encontrouVoos: false,
          mensagem: 'Sem voos disponíveis no Google Flights para esta data'
        };
      }

      let melhorOpcao = null;
      const linkWebEstruturado = gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta);

      for (const voo of todosVoos) {
        const duracaoMinutos = Number(voo.total_duration);
        const preco = Number(voo.price);

        if (!Number.isFinite(duracaoMinutos) || !Number.isFinite(preco) || preco <= 0) continue;
        if (duracaoMinutos > duracaoMaxMinutos) continue;

        let destinoFinal = destinoCod;
        const segmentos = Array.isArray(voo.flights) ? voo.flights : [];
        if (segmentos.length > 0) {
          const ult = segmentos[segmentos.length - 1];
          if (ult && ult.arrival_airport) {
            destinoFinal = `${ult.arrival_airport.name} (${ult.arrival_airport.id})`;
          }
        }

        const cias = [...new Set(
          segmentos
            .map(f => (f && (f.airline || f.airline_code)) || null)
            .filter(Boolean)
        )].join(', ') || 'Companhia não informada';

        const escalas = Math.max(0, segmentos.length - 1);
        const { dicaStopover } = analisarLayoversEStopover(voo);

        if (!melhorOpcao || preco < melhorOpcao.preco) {
          melhorOpcao = {
            preco,
            duracaoHoras: duracaoMinutos / 60,
            destinoReal: destinoFinal,
            termometro,
            nivelPreco,
            detalhes: `${escalas} escala(s) | ${cias}`,
            dicaStopover,
            link: linkWebEstruturado
          };
        }
      }

      if (!melhorOpcao) {
        return {
          ok: true,
          encontrouVoos: false,
          mensagem: `Sem voos dentro da duração máxima solicitada (${duracaoMaxHoras}h)`
        };
      }

      return {
        ok: true,
        encontrouVoos: true,
        oferta: melhorOpcao
      };
    } catch (err) {
      return {
        ok: false,
        erro: true,
        mensagemErro: `Erro de rede ao conectar à SerpAPI: ${err.message}`
      };
    }
  }

  /**
   * Executa varredura de uma rota cadastrada no banco de dados
   */
  static async escanearRota(rota) {
    const resultado = await FlightScanner.buscarOfertas(
      rota.codigo_origem,
      rota.codigo_destino,
      rota.data_ida,
      rota.data_volta,
      rota.duracao_max_horas
    );

    if (!resultado.ok) {
      rotasRepo.marcarFalhaChecagem(rota.id, resultado.mensagemErro || 'Falha na checagem');
      return { sucesso: false, erro: resultado.mensagemErro };
    }

    if (!resultado.encontrouVoos) {
      rotasRepo.atualizarResultadoChecagem(rota.id, {
        preco: 0,
        variacao_texto: '-',
        termometro: resultado.mensagem || '⚪ Sem voos no filtro',
        custo_destino_texto: '-',
        detalhes_voo: '-',
        dica_stopover: '-',
        link_google_flights: rota.link_google_flights
      });
      return { sucesso: true, encontrou: false, mensagem: resultado.mensagem };
    }

    const { oferta } = resultado;
    const precoAnterior = parsePreco(rota.preco_atual);
    const variacao = calcularVariacao(oferta.preco, precoAnterior);

    const custoInfo = avaliarCustoDestinoComTotal(
      oferta.destinoReal,
      rota.destino,
      oferta.preco,
      rota.data_ida,
      rota.data_volta
    );

    const rotaAtualizada = rotasRepo.atualizarResultadoChecagem(rota.id, {
      preco: oferta.preco,
      variacao_texto: variacao.texto,
      termometro: oferta.termometro,
      custo_destino_texto: custoInfo.textoResumo,
      detalhes_voo: `${oferta.duracaoHoras.toFixed(1)}h | ${oferta.detalhes}`,
      dica_stopover: oferta.dicaStopover,
      link_google_flights: oferta.link
    });

    // Inteligência de Alertas
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

    if (decisaoAlerta.deve) {
      await notifierTelegram.enviarAlertaOportunidade({
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
        link: oferta.link
      });
    }

    return { sucesso: true, encontrou: true, oferta, rotaAtualizada };
  }
}
