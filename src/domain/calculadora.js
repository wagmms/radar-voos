import { DICIONARIO_CUSTO_DESTINO } from './dicionarios.js';
import { normalizarTexto, ehSoIda } from './rotas.js';

/**
 * Parser resiliente de preços em formato numérico ou monetário
 */
export function parsePreco(valor) {
  if (typeof valor === 'number' && !isNaN(valor)) return valor;
  if (valor === null || valor === undefined) return 0;
  let s = String(valor).replace(/R\$/gi, '').trim();
  if (!s) return 0;

  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Calcula a variação percentual e textual entre preços
 */
export function calcularVariacao(precoAtual, precoAnterior, gatilhoQuedaPct = 15) {
  if (!precoAnterior || precoAnterior <= 0) {
    return {
      texto: 'Primeira Checagem',
      pct: 0,
      diff: 0,
      ehQuedaRelampago: false
    };
  }

  const diff = precoAtual - precoAnterior;
  const pct = (diff / precoAnterior) * 100;

  let texto = 'Estável';
  let ehQuedaRelampago = false;

  if (pct <= -gatilhoQuedaPct) {
    texto = `🟢 ${pct.toFixed(1)}% (Caiu R$ ${Math.abs(diff).toFixed(0)})`;
    ehQuedaRelampago = true;
  } else if (pct < 0) {
    texto = `🟢 ${pct.toFixed(1)}% (Caiu R$ ${Math.abs(diff).toFixed(0)})`;
  } else if (pct > 0) {
    texto = `🔴 +${pct.toFixed(1)}% (Subiu R$ ${diff.toFixed(0)})`;
  }

  return {
    texto,
    pct,
    diff,
    ehQuedaRelampago
  };
}

/**
 * Avalia o custo diário no destino e calcula o Custo Total da Viagem (Voo + Diária x Dias)
 */
export function avaliarCustoDestinoComTotal(destinoReal, destinoOriginal, precoVoo = 0, dataIdaStr = null, dataVoltaStr = null) {
  const busca1 = normalizarTexto(destinoReal);
  const busca2 = normalizarTexto(destinoOriginal);

  let itemEncontrado = null;
  for (const chave in DICIONARIO_CUSTO_DESTINO) {
    if (busca1.includes(chave) || busca2.includes(chave)) {
      itemEncontrado = DICIONARIO_CUSTO_DESTINO[chave];
      break;
    }
  }

  const textoBase = itemEncontrado ? itemEncontrado.texto : '🟡 $$ Moderado (~R$ 300/dia)';
  const valorDiario = itemEncontrado ? itemEncontrado.diario : 300;

  let diasViagem = 0;
  if (dataIdaStr && dataVoltaStr) {
    const [anoI, mesI, diaI] = dataIdaStr.split('-').map(Number);
    const [anoV, mesV, diaV] = dataVoltaStr.split('-').map(Number);
    const dIda = new Date(Date.UTC(anoI, mesI - 1, diaI));
    const dVolta = new Date(Date.UTC(anoV, mesV - 1, diaV));
    if (!isNaN(dIda.getTime()) && !isNaN(dVolta.getTime()) && dVolta >= dIda) {
      diasViagem = Math.round((dVolta.getTime() - dIda.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  let custoTotalEstimado = precoVoo;
  let custoTerrestre = 0;
  let resumoTexto = textoBase;

  if (diasViagem > 0 && precoVoo > 0) {
    custoTerrestre = diasViagem * valorDiario;
    custoTotalEstimado = precoVoo + custoTerrestre;
    resumoTexto = `${textoBase} | Total ${diasViagem}d: ~R$ ${custoTotalEstimado.toFixed(0)}`;
  } else if (!dataVoltaStr || ehSoIda(dataVoltaStr)) {
    resumoTexto = `${textoBase} (Só Ida)`;
  }

  return {
    textoResumo: resumoTexto,
    textoBase: textoBase,
    valorDiario: valorDiario,
    diasViagem: diasViagem,
    custoTerrestre: custoTerrestre,
    custoTotalEstimado: custoTotalEstimado
  };
}

/**
 * Avalia o termômetro do voo com base nos insights de preço do Google Flights
 */
export function avaliarTermometro(priceInsights) {
  let nivelPreco = 'NORMAL';
  let termometro = '⚪ Preço Normal';

  if (priceInsights && priceInsights.price_level) {
    nivelPreco = priceInsights.price_level;
    if (nivelPreco === 'LOW') {
      termometro = '🟢 Super Barato (Promoção!)';
    } else if (nivelPreco === 'HIGH') {
      termometro = '🔴 Caro (Acima da média)';
    } else {
      termometro = '⚪ Preço Normal / Típico';
    }
  }

  return { nivelPreco, termometro };
}

/**
 * Identifica oportunidades de conexão longa / Stopover (2 destinos em 1 viagem)
 */
export function analisarLayoversEStopover(voo) {
  const layovers = (voo && typeof voo === 'object' && Array.isArray(voo.layovers)) ? voo.layovers : [];
  const layoversValidos = layovers
    .filter(l => l && typeof l === 'object')
    .map(l => {
      const dur = typeof l.duration === 'number' ? l.duration : parseFloat(l.duration);
      return {
        aeroporto: (l.id && typeof l.id === 'string') ? l.id.trim() : 'N/A',
        nome: (l.name && typeof l.name === 'string') ? l.name.trim() : 'Aeroporto não informado',
        minutos: dur,
        overnight: Boolean(l.overnight)
      };
    })
    .filter(l => Number.isFinite(l.minutos) && l.minutos > 0);

  let dicaStopover = '-';
  if (layoversValidos.length > 0) {
    const longas = layoversValidos.filter(l => l.minutos >= 480); // 8 horas ou mais
    if (longas.length > 0) {
      const principal = longas[0];
      const tipo = principal.overnight ? 'noturna' : 'longa';
      const duracaoH = Math.floor(principal.minutos / 60);
      dicaStopover = `Possível conexão ${tipo} de ${duracaoH}h em ${principal.aeroporto} (${principal.nome}). Dica de Stopover 2-em-1!`;
    }
  }

  return { layoversValidos, dicaStopover };
}

export const ZSCORE_LIMIAR_BUG_FARE = -2.5;
export const ZSCORE_LIMIAR_OPORTUNIDADE = -1.5;
export const QUEDA_PCT_OPORTUNIDADE = 30; // 30%

/**
 * Classifica a variação estatística de uma tarifa frente à série histórica da rota monitorada.
 * Padrão proactive-agent (Zero Ruído):
 * - BUG_FARE: Z-Score <= -2.5 (anomalia estatística severa)
 * - OPORTUNIDADE: Z-Score <= -1.5 OU queda >= 30% em relação à média recente
 * - INFO: Oscilação normal de mercado (sem anomalia)
 *
 * @param {Object} params
 * @param {number} params.preco Preço atual obtido
 * @param {number|null} [params.media] Média de preço histórica
 * @param {number|null} [params.desvioPadrao] Desvio padrão amostral
 * @returns {{ categoria: 'INFO'|'OPORTUNIDADE'|'BUG_FARE', zScore: number|null, quedaPct: number, media: number|null, desvioPadrao: number|null }}
 */
export function classificarDeltaPreco({ preco, media = null, desvioPadrao = null } = {}) {
  if (!preco || preco <= 0 || !media || media <= 0) {
    return {
      categoria: 'INFO',
      zScore: null,
      quedaPct: 0,
      media: media || null,
      desvioPadrao: desvioPadrao || null
    };
  }

  const quedaPct = ((media - preco) / media) * 100;
  let zScore = null;

  if (desvioPadrao && desvioPadrao >= 30) {
    zScore = Number(((preco - media) / desvioPadrao).toFixed(2));
    if (zScore <= ZSCORE_LIMIAR_BUG_FARE) {
      return { categoria: 'BUG_FARE', zScore, quedaPct: Number(quedaPct.toFixed(1)), media, desvioPadrao };
    }
    if (zScore <= ZSCORE_LIMIAR_OPORTUNIDADE) {
      return { categoria: 'OPORTUNIDADE', zScore, quedaPct: Number(quedaPct.toFixed(1)), media, desvioPadrao };
    }
  } else if (quedaPct >= QUEDA_PCT_OPORTUNIDADE) {
    // Sem desvio padrão robusto: queda >= 30% em relação à média recente
    return { categoria: 'OPORTUNIDADE', zScore: null, quedaPct: Number(quedaPct.toFixed(1)), media, desvioPadrao };
  }

  return { categoria: 'INFO', zScore, quedaPct: Number(quedaPct.toFixed(1)), media, desvioPadrao };
}
