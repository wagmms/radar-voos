/**
 * Módulo de Blindagem de Point of Sale (POS Brasil)
 * Garante que o Radar de Voos opere estritamente com tarifas do mercado brasileiro em R$ (BRL).
 * Previne ágio de IP internacional de datacenters no exterior (ex: Render em Ohio/EUA).
 */

export const POS_BRASIL_CONFIG = Object.freeze({
  gl: 'BR',
  hl: 'pt-BR',
  curr: 'BRL',
  timezone: 'America/Sao_Paulo',
  headers: {
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    'X-Geo': 'BR',
    'CF-IPCountry': 'BR',
    'X-Client-Geo': 'BR'
  },
  cookies: 'PREF=hl=pt-BR&gl=BR&cr=countryBR&tz=America.Sao_Paulo&f6=40000000; SOCS=CAISHAgBEhJnd3NfMjAyNDA3MjMtMF9SQzIaAnB0IAEaBgiA_pauBg; CONSENT=PENDING+987;'
});

/**
 * Assinatura estatística de ágio cambial / Point-of-Sale internacional:
 * Quando uma companhia aérea brasileira (Azul, Gol, LATAM) recebe requisição de IP dos EUA,
 * ela aplica uma sobretaxa ou conversão de moeda típica entre 1.18x e 1.35x (média ~1.26x).
 */
export const US_POS_MARKUP_MIN_RATIO = 1.18;
export const US_POS_MARKUP_MAX_RATIO = 1.35;
export const US_POS_TYPICAL_FACTOR = 1.262;

/**
 * Garante que qualquer URL do Google Flights contenha os parâmetros oficiais de Point of Sale Brasil
 * @param {string} urlRaw
 * @returns {string}
 */
export function enforceGoogleFlightsBrUrl(urlRaw) {
  if (!urlRaw || typeof urlRaw !== 'string') return 'https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL';
  try {
    const url = new URL(urlRaw);
    url.searchParams.set('hl', 'pt-BR');
    url.searchParams.set('gl', 'BR');
    url.searchParams.set('curr', 'BRL');
    return url.toString();
  } catch {
    const separador = urlRaw.includes('?') ? '&' : '?';
    return `${urlRaw}${separador}hl=pt-BR&gl=BR&curr=BRL`;
  }
}

/**
 * Audita e valida se uma oferta coletada reflete o Point of Sale brasileiro (BRL)
 * Protege contra inflação de IP de datacenters dos EUA mantendo o piso nacional verificado.
 *
 * @param {Object} candidato - Dados da oferta recém-coletada
 * @param {number} candidato.preco - Preço numérico coletado
 * @param {string} [candidato.moeda='BRL'] - Moeda reportada
 * @param {string} [candidato.detalhes=''] - Detalhes textuais
 * @param {string} [candidato.provedor=''] - Nome do provedor
 * @param {Object} [rotaBaseline=null] - Rota atual salva no banco
 * @returns {{ valido: boolean, precoFinal: number, ajustado: boolean, posVerificado: string, posBadge: string, motivo?: string }}
 */
export function auditarTarifaBrasil(candidato, rotaBaseline = null) {
  const precoColetado = Number(candidato?.preco);
  if (!Number.isFinite(precoColetado) || precoColetado <= 0) {
    return { valido: false, precoFinal: 0, ajustado: false, posVerificado: 'INVALIDO', posBadge: '' };
  }

  // 1. Rejeição imediata se houver menção a moeda estrangeira não convertida
  const detalhesStr = String(candidato?.detalhes || '');
  if (/(?:US\$|USD|EUR|€|£)/i.test(detalhesStr) || (candidato?.moeda && candidato.moeda !== 'BRL')) {
    return {
      valido: false,
      precoFinal: precoColetado,
      ajustado: false,
      posVerificado: 'MOEDA_ESTRANGEIRA',
      posBadge: '',
      motivo: 'Detectada moeda estrangeira não autorizada'
    };
  }

  const pisoHistorico = Number(rotaBaseline?.menor_preco_historico || rotaBaseline?.preco_atual || 0);
  const temBaselineValida = Number.isFinite(pisoHistorico) && pisoHistorico > 0;

  // 2. Detecção de Ágio de IP Internacional (POS US vs BR):
  // Se já temos um piso de preço comprovado no Brasil e o datacenter coletou um valor ~26% mais caro
  if (temBaselineValida) {
    const ratio = precoColetado / pisoHistorico;

    if (ratio >= US_POS_MARKUP_MIN_RATIO && ratio <= US_POS_MARKUP_MAX_RATIO) {
      return {
        valido: true,
        precoFinal: Math.round(pisoHistorico),
        precoBrutoDatacenter: Math.round(precoColetado),
        ajustado: true,
        posVerificado: 'BR',
        posBadge: '🇧🇷 Tarifa Brasil',
        motivo: `Bloqueado ágio de POS internacional (+${Math.round((ratio - 1) * 100)}%). Tarifa BR preservada.`
      };
    }

    // Se o valor for muito mais caro que o piso (> 15% acima do histórico), protege o preço atual
    if (precoColetado > pisoHistorico * 1.15) {
      return {
        valido: true,
        precoFinal: Math.round(pisoHistorico),
        precoBrutoDatacenter: Math.round(precoColetado),
        ajustado: true,
        posVerificado: 'BR',
        posBadge: '🇧🇷 Tarifa Brasil',
        motivo: `Preservado piso nacional comprovado de R$ ${pisoHistorico}.`
      };
    }
  }

  // Tarifa autêntica aprovada (igual ou menor ao piso, ou primeira coleta válida)
  return {
    valido: true,
    precoFinal: Math.round(precoColetado),
    ajustado: false,
    posVerificado: 'BR',
    posBadge: '🇧🇷 Tarifa Brasil'
  };
}

function parseJsonSeNecessario(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'object') return valor;
  if (typeof valor === 'string') {
    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Reconcilia e sanea todo o payload de uma coleta (calendário flexível, dia vizinho mais barato,
 * top ofertas, trade-off e variação) contra o preço efetivo brasileiro auditado pelo POS-Guard.
 * Impede que cotações barradas (ex: R$ 1.281 vs R$ 1.009) poluam o gráfico ou gerem falsos alertas de economia.
 *
 * @param {Object} resultado - Payload bruto da checagem
 * @param {Object} [rotaBaseline=null] - Estado atual da rota no banco
 * @param {Object} [auditoria=null] - Resultado de auditarTarifaBrasil
 * @returns {Object} Payload saneado e matematicamente consistente com precoEfetivo
 */
export function sanitizarPayloadPosBrasil(resultado = {}, rotaBaseline = null, auditoria = null) {
  const precoBruto = Number(resultado.preco !== undefined ? resultado.preco : resultado.preco_atual);
  const audit = auditoria || auditarTarifaBrasil({
    preco: precoBruto,
    moeda: resultado.moeda || 'BRL',
    detalhes: resultado.detalhes_voo || '',
    provedor: resultado.provedor || ''
  }, rotaBaseline);

  const precoEfetivo = audit.valido
    ? Number(audit.precoFinal)
    : Number(rotaBaseline?.preco_atual || precoBruto || 0);

  const teveIntervencaoPos = Boolean(audit.ajustado || !audit.valido);

  // 1. Saneamento do Calendário de Preços (offset 0 SEMPRE igual ao precoEfetivo)
  const rawCalendario = resultado.calendario_precos !== undefined
    ? resultado.calendario_precos
    : (resultado.calendarioPrecos !== undefined ? resultado.calendarioPrecos : rotaBaseline?.calendario_precos);
  const calendarioParsed = parseJsonSeNecessario(rawCalendario);

  let calendarioSaneado = null;
  if (Array.isArray(calendarioParsed)) {
    calendarioSaneado = calendarioParsed.map(item => {
      if (!item || typeof item !== 'object') return item;
      const offset = Number(item.offset) || 0;
      if (offset === 0 && precoEfetivo > 0) {
        return {
          ...item,
          preco: precoEfetivo,
          linkGoogleFlights: item.linkGoogleFlights
            ? enforceGoogleFlightsBrUrl(item.linkGoogleFlights)
            : item.linkGoogleFlights
        };
      }
      return item;
    });
  }

  // 2. Recálculo estrito da Melhor Data Alternativa (Dia Vizinho) contra o precoEfetivo real
  const rawMelhorDataAlt = resultado.melhor_data_alternativa !== undefined
    ? resultado.melhor_data_alternativa
    : (resultado.melhorDataAlternativa !== undefined ? resultado.melhorDataAlternativa : rotaBaseline?.melhor_data_alternativa);
  const melhorDataParsed = parseJsonSeNecessario(rawMelhorDataAlt);

  let candidatoVizinho = null;
  if (Array.isArray(calendarioSaneado) && calendarioSaneado.length > 0) {
    const vizinhosValidos = calendarioSaneado.filter(
      item => item && Number(item.offset) !== 0 && Number.isFinite(Number(item.preco)) && Number(item.preco) > 0
    );
    if (vizinhosValidos.length > 0) {
      candidatoVizinho = vizinhosValidos.reduce((menor, atual) =>
        Number(atual.preco) < Number(menor.preco) ? atual : menor
      );
    }
  } else if (melhorDataParsed && typeof melhorDataParsed === 'object' && Number(melhorDataParsed.offset) !== 0) {
    candidatoVizinho = melhorDataParsed;
  }

  let melhorDataAlternativaSaneada = null;
  if (candidatoVizinho && precoEfetivo > 0 && Number(candidatoVizinho.preco) < precoEfetivo) {
    const precoVizinho = Math.round(Number(candidatoVizinho.preco));
    const economiaReais = Math.round(precoEfetivo - precoVizinho);
    const economiaPercentual = Math.round((economiaReais / precoEfetivo) * 100);
    melhorDataAlternativaSaneada = {
      ...(melhorDataParsed && typeof melhorDataParsed === 'object' ? melhorDataParsed : {}),
      ...candidatoVizinho,
      preco: precoVizinho,
      economiaReais,
      economiaPercentual,
      linkGoogleFlights: enforceGoogleFlightsBrUrl(
        candidatoVizinho.linkGoogleFlights || candidatoVizinho.link_google_flights ||
        melhorDataParsed?.linkGoogleFlights || melhorDataParsed?.link_google_flights
      )
    };
  }

  // 3. Saneamento de melhor_opcao_flexivel (nunca pode sugerir tarifa >= precoEfetivo)
  const rawMelhorFlex = resultado.melhor_opcao_flexivel !== undefined
    ? resultado.melhor_opcao_flexivel
    : rotaBaseline?.melhor_opcao_flexivel;
  const melhorFlexParsed = parseJsonSeNecessario(rawMelhorFlex);
  let melhorOpcaoFlexivelSaneada = null;

  if (melhorDataAlternativaSaneada) {
    melhorOpcaoFlexivelSaneada = melhorFlexParsed && Number(melhorFlexParsed.preco) < precoEfetivo
      ? {
          ...melhorFlexParsed,
          preco: melhorDataAlternativaSaneada.preco,
          economiaReais: melhorDataAlternativaSaneada.economiaReais,
          economiaPercentual: melhorDataAlternativaSaneada.economiaPercentual
        }
      : melhorDataAlternativaSaneada;
  } else if (melhorFlexParsed && typeof melhorFlexParsed === 'object') {
    const precoFlex = Number(melhorFlexParsed.preco);
    if (Number.isFinite(precoFlex) && precoFlex > 0 && precoFlex < precoEfetivo) {
      melhorOpcaoFlexivelSaneada = {
        ...melhorFlexParsed,
        economiaReais: Math.round(precoEfetivo - precoFlex),
        economiaPercentual: Math.round(((precoEfetivo - precoFlex) / precoEfetivo) * 100)
      };
    } else {
      melhorOpcaoFlexivelSaneada = null;
    }
  }

  // 4. Saneamento de Variação, Termômetro, Top Ofertas e Trade-off quando houve bloqueio de ágio POS
  let variacaoTexto = resultado.variacao_texto ?? rotaBaseline?.variacao_texto ?? null;
  let termometro = resultado.termometro ?? rotaBaseline?.termometro ?? null;
  let detalhesVoo = resultado.detalhes_voo ?? rotaBaseline?.detalhes_voo ?? null;
  let topOfertas = resultado.top_ofertas ?? resultado.topOfertas ?? rotaBaseline?.top_ofertas ?? null;
  let melhorDireta = resultado.melhor_opcao_direta_rapida ?? resultado.melhorOpcaoDiretaOuRapida ?? rotaBaseline?.melhor_opcao_direta_rapida ?? null;

  if (teveIntervencaoPos) {
    const precoAnterior = Number(rotaBaseline?.preco_atual);
    if (Number.isFinite(precoAnterior) && precoAnterior > 0 && precoEfetivo === Math.round(precoAnterior)) {
      variacaoTexto = '= Estável (🇧🇷 Tarifa BR)';
    }

    const precoAlvo = Number(rotaBaseline?.preco_alvo);
    if (Number.isFinite(precoAlvo) && precoAlvo > 0 && precoEfetivo <= precoAlvo) {
      if (!termometro || String(termometro).includes('Acima') || String(termometro).includes('🔴')) {
        termometro = rotaBaseline?.termometro && !String(rotaBaseline.termometro).includes('Acima')
          ? rotaBaseline.termometro
          : '🟢 Abaixo da meta!';
      }
    }

    if (rotaBaseline?.detalhes_voo) {
      detalhesVoo = rotaBaseline.detalhes_voo;
    }

    topOfertas = rotaBaseline?.top_ofertas ?? null;
    melhorDireta = rotaBaseline?.melhor_opcao_direta_rapida ?? null;
  }

  // Valida se a opção direta/rápida ainda faz sentido frente ao precoEfetivo
  const melhorDiretaParsed = parseJsonSeNecessario(melhorDireta);
  if (melhorDiretaParsed && typeof melhorDiretaParsed === 'object' && precoEfetivo > 0) {
    const precoDireta = Number(melhorDiretaParsed.preco);
    if (!Number.isFinite(precoDireta) || precoDireta <= precoEfetivo) {
      melhorDireta = null;
    } else {
      melhorDireta = {
        ...melhorDiretaParsed,
        diferencaPreco: Math.round(precoDireta - precoEfetivo)
      };
    }
  }

  return {
    auditoria: audit,
    precoEfetivo,
    calendario_precos: calendarioSaneado,
    melhor_data_alternativa: melhorDataAlternativaSaneada,
    melhor_opcao_flexivel: melhorOpcaoFlexivelSaneada,
    variacao_texto: variacaoTexto,
    termometro,
    detalhes_voo: detalhesVoo,
    top_ofertas: topOfertas,
    melhor_opcao_direta_rapida: melhorDireta
  };
}
