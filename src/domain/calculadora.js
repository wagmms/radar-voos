import { DICIONARIO_CUSTO_DESTINO, DICIONARIO_CIDADES } from './dicionarios.js';
import { normalizarTexto, ehSoIda } from './rotas.js';
import { obterInfoAeroporto } from './aeroportos.js';

export const COTACOES_PADRAO = {
  BRL: 1.0,
  USD: 5.50,
  EUR: 6.00,
  GBP: 7.00,
  CHF: 6.40,
  CAD: 4.00,
  AUD: 3.60,
  JPY: 0.037,
  ARS: 0.0055,
  CLP: 0.0058,
  UYU: 0.13,
  COP: 0.0013,
  PEN: 1.45,
  MXN: 0.28,
  AED: 1.50
};

export const SIMBOLOS_MOEDAS = {
  BRL: 'R$',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  ARS: '$',
  CLP: '$',
  UYU: '$',
  COP: '$',
  PEN: 'S/',
  MXN: '$',
  AED: 'AED'
};

export const DIARIAS_REGIONAIS_PADRAO = {
  DOMESTICO: {
    diariaBrl: 180,
    moedaOrigem: 'BRL',
    diariaMoedaOrigem: 180,
    texto: '🟢 $ Nacional (~R$ 180/dia)',
    categoria: 'ECONOMICO_NACIONAL'
  },
  AMERICA_SUL: {
    diariaBrl: 220,
    moedaOrigem: 'USD',
    diariaMoedaOrigem: 40,
    texto: '🟢 $ Econômico (~R$ 220/dia | $40)',
    categoria: 'ECONOMICO'
  },
  EUROPA: {
    diariaBrl: 510,
    moedaOrigem: 'EUR',
    diariaMoedaOrigem: 85,
    texto: '🟡 $$ Moderado Internacional (~R$ 510/dia | €85)',
    categoria: 'MODERADO_INTERNACIONAL'
  },
  AMERICA_NORTE: {
    diariaBrl: 740,
    moedaOrigem: 'USD',
    diariaMoedaOrigem: 135,
    texto: '🟠 $$$ Caro (~R$ 740/dia | $135)',
    categoria: 'CARO'
  },
  CARIBE_AMERICA_CENTRAL: {
    diariaBrl: 410,
    moedaOrigem: 'USD',
    diariaMoedaOrigem: 75,
    texto: '🟡 $$ Moderado (~R$ 410/dia | $75)',
    categoria: 'MODERADO'
  },
  ORIENTE_MEDIO: {
    diariaBrl: 660,
    moedaOrigem: 'USD',
    diariaMoedaOrigem: 120,
    texto: '🟠 $$$ Caro (~R$ 660/dia | $120)',
    categoria: 'CARO'
  },
  ASIA_OCEANIA: {
    diariaBrl: 410,
    moedaOrigem: 'USD',
    diariaMoedaOrigem: 75,
    texto: '🟡 $$ Moderado (~R$ 410/dia | $75)',
    categoria: 'MODERADO'
  },
  OUTRO: {
    diariaBrl: 300,
    moedaOrigem: 'BRL',
    diariaMoedaOrigem: 300,
    texto: '🟡 $$ Moderado (~R$ 300/dia)',
    categoria: 'MODERADO'
  }
};

export const AJUSTES_PAIS_CUSTO = {
  'Reino Unido': { moedaOrigem: 'GBP', diariaMoedaOrigem: 120, diariaBrl: 840, texto: '🔴 $$$$ Ultra Caro (~R$ 840/dia | £120)' },
  'Suíça': { moedaOrigem: 'CHF', diariaMoedaOrigem: 160, diariaBrl: 1020, texto: '🔴 $$$$ Ultra Caro (~R$ 1.020/dia | CHF 160)' },
  'Japão': { moedaOrigem: 'JPY', diariaMoedaOrigem: 16000, diariaBrl: 590, texto: '🟠 $$$ Alto (~R$ 590/dia | ¥16.000)' },
  'Canadá': { moedaOrigem: 'CAD', diariaMoedaOrigem: 160, diariaBrl: 640, texto: '🟠 $$$ Caro (~R$ 640/dia | C$160)' },
  'Austrália': { moedaOrigem: 'AUD', diariaMoedaOrigem: 170, diariaBrl: 612, texto: '🟠 $$$ Caro (~R$ 612/dia | A$170)' }
};

/**
 * Converte valores entre moedas com suporte a cotações personalizadas e fallback defensivo
 */
export function converterMoeda(valor, moedaOrigem = 'BRL', moedaDestino = 'BRL', cotacoesCustom = {}) {
  const v = typeof valor === 'number' ? valor : parseFloat(valor);
  if (!Number.isFinite(v) || v <= 0) return 0;

  const mOrigem = String(moedaOrigem || 'BRL').trim().toUpperCase();
  const mDestino = String(moedaDestino || 'BRL').trim().toUpperCase();

  if (mOrigem === mDestino) return Number(v.toFixed(2));

  const cotacoes = { ...COTACOES_PADRAO, ...cotacoesCustom };
  const taxaOrigem = Number(cotacoes[mOrigem]);
  const taxaDestino = Number(cotacoes[mDestino]);

  const taxaOrigemValida = (Number.isFinite(taxaOrigem) && taxaOrigem > 0) ? taxaOrigem : 1.0;
  const taxaDestinoValida = (Number.isFinite(taxaDestino) && taxaDestino > 0) ? taxaDestino : 1.0;

  const valorEmBrl = v * taxaOrigemValida;
  const valorFinal = valorEmBrl / taxaDestinoValida;

  return Number(valorFinal.toFixed(2));
}

/**
 * Parser resiliente de preços em formato numérico ou monetário
 */
export function parsePreco(valor) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return 0;
    return valor;
  }
  if (valor === null || valor === undefined) return 0;
  let s = String(valor).replace(/R\$|BRL/gi, '').trim();
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
  return (!Number.isFinite(num) || num < 0) ? 0 : num;
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
 * Suporta destinos fora do dicionário com inferência geográfica internacional e moedas dinâmicas.
 */
export function avaliarCustoDestinoComTotal(
  destinoReal,
  destinoOriginal,
  precoVoo = 0,
  dataIdaStr = null,
  dataVoltaStr = null,
  opcoes = {}
) {
  const busca1 = normalizarTexto(destinoReal);
  const busca2 = normalizarTexto(destinoOriginal);

  // Normalização defensiva de opções
  const opts = (typeof opcoes === 'string')
    ? { moeda: opcoes }
    : (opcoes && typeof opcoes === 'object' ? opcoes : {});

  const moedaAlvo = String(opts.moeda || 'BRL').trim().toUpperCase();
  const cotacoes = { ...COTACOES_PADRAO, ...(opts.cotacoes || {}) };

  let itemEncontrado = null;
  for (const chave in DICIONARIO_CUSTO_DESTINO) {
    if ((busca1 && busca1.includes(chave)) || (busca2 && busca2.includes(chave))) {
      itemEncontrado = DICIONARIO_CUSTO_DESTINO[chave];
      break;
    }
  }

  let textoBase = '';
  let valorDiarioBrl = 300;
  let moedaOrigem = 'BRL';
  let valorDiarioMoedaOrigem = 300;
  let regiaoEstimada = 'OUTRO';
  let origemEstimativa = 'FALLBACK_PADRAO';

  if (opts.diariaCustomizada !== undefined && opts.diariaCustomizada !== null) {
    const diariaCustom = parsePreco(opts.diariaCustomizada);
    if (diariaCustom > 0) {
      const moedaCustom = String(opts.moedaDiariaCustomizada || 'BRL').trim().toUpperCase();
      valorDiarioBrl = converterMoeda(diariaCustom, moedaCustom, 'BRL', cotacoes);
      moedaOrigem = moedaCustom;
      valorDiarioMoedaOrigem = diariaCustom;
      origemEstimativa = 'CUSTOMIZADA';
      const simCustom = SIMBOLOS_MOEDAS[moedaCustom] || moedaCustom;
      textoBase = `⚙️ Customizado (~R$ ${valorDiarioBrl.toFixed(0)}/dia${moedaCustom !== 'BRL' ? ` | ${simCustom}${diariaCustom}` : ''})`;
    }
  }

  if (origemEstimativa !== 'CUSTOMIZADA') {
    if (itemEncontrado) {
      textoBase = itemEncontrado.texto;
      valorDiarioBrl = itemEncontrado.diario;
      moedaOrigem = 'BRL';
      valorDiarioMoedaOrigem = itemEncontrado.diario;
      origemEstimativa = 'DICIONARIO';
    } else {
      // Destino fora do dicionário base: inferência geográfica e regional inteligente
      const infoAero = obterInfoAeroporto(destinoReal) || obterInfoAeroporto(destinoOriginal);
      const iataAlvo = (infoAero && infoAero.iata) ? infoAero.iata.toUpperCase() : '';

      // Verifica se é aeroporto / cidade nacional brasileira catalogada em DICIONARIO_CIDADES
      let ehCidadeNacional = false;
      for (const [cidadeNome, codIata] of Object.entries(DICIONARIO_CIDADES)) {
        if ((busca1 && busca1.includes(cidadeNome)) || (busca2 && busca2.includes(cidadeNome)) || (iataAlvo && codIata === iataAlvo)) {
          ehCidadeNacional = true;
          break;
        }
      }

      if (infoAero && infoAero.regiao && infoAero.regiao !== 'OUTRO') {
        regiaoEstimada = infoAero.regiao;
        origemEstimativa = 'REGIAO_AEROPORTO';

        if (infoAero.pais && AJUSTES_PAIS_CUSTO[infoAero.pais]) {
          const ajuste = AJUSTES_PAIS_CUSTO[infoAero.pais];
          moedaOrigem = ajuste.moedaOrigem;
          valorDiarioMoedaOrigem = ajuste.diariaMoedaOrigem;
          const taxa = Number(cotacoes[moedaOrigem]) || (ajuste.diariaBrl / ajuste.diariaMoedaOrigem);
          valorDiarioBrl = Math.round(valorDiarioMoedaOrigem * taxa);
          const sim = SIMBOLOS_MOEDAS[moedaOrigem] || moedaOrigem;
          textoBase = `${ajuste.texto.split('(')[0].trim()} (~R$ ${valorDiarioBrl}/dia | ${sim}${valorDiarioMoedaOrigem})`;
        } else {
          const regPadrao = DIARIAS_REGIONAIS_PADRAO[regiaoEstimada] || DIARIAS_REGIONAIS_PADRAO.OUTRO;
          moedaOrigem = regPadrao.moedaOrigem;
          valorDiarioMoedaOrigem = regPadrao.diariaMoedaOrigem;

          if (moedaOrigem !== 'BRL') {
            const taxa = Number(cotacoes[moedaOrigem]) || (regPadrao.diariaBrl / regPadrao.diariaMoedaOrigem);
            valorDiarioBrl = Math.round(valorDiarioMoedaOrigem * taxa);
            const sim = SIMBOLOS_MOEDAS[moedaOrigem] || moedaOrigem;
            textoBase = `${regPadrao.texto.split('(')[0].trim()} (~R$ ${valorDiarioBrl}/dia | ${sim}${valorDiarioMoedaOrigem})`;
          } else {
            valorDiarioBrl = regPadrao.diariaBrl;
            textoBase = regPadrao.texto;
          }
        }
      } else if (ehCidadeNacional) {
        regiaoEstimada = 'DOMESTICO';
        origemEstimativa = 'CIDADE_NACIONAL';
        const regPadrao = DIARIAS_REGIONAIS_PADRAO.DOMESTICO;
        valorDiarioBrl = regPadrao.diariaBrl;
        moedaOrigem = 'BRL';
        valorDiarioMoedaOrigem = regPadrao.diariaBrl;
        textoBase = regPadrao.texto;
      } else if (infoAero) {
        regiaoEstimada = 'OUTRO';
        origemEstimativa = 'REGIAO_AEROPORTO';
        const regPadrao = DIARIAS_REGIONAIS_PADRAO.OUTRO;
        valorDiarioBrl = regPadrao.diariaBrl;
        moedaOrigem = 'BRL';
        valorDiarioMoedaOrigem = regPadrao.diariaBrl;
        textoBase = regPadrao.texto;
      } else {
        // Fallback defensivo geral para destino desconhecido
        origemEstimativa = 'FALLBACK_PADRAO';
        textoBase = '🟡 $$ Moderado (~R$ 300/dia)';
        valorDiarioBrl = 300;
        moedaOrigem = 'BRL';
        valorDiarioMoedaOrigem = 300;
      }
    }
  }

  let diasViagem = 0;
  if (dataIdaStr && dataVoltaStr) {
    const [anoI, mesI, diaI] = String(dataIdaStr).split('-').map(Number);
    const [anoV, mesV, diaV] = String(dataVoltaStr).split('-').map(Number);
    const dIda = new Date(Date.UTC(anoI, mesI - 1, diaI));
    const dVolta = new Date(Date.UTC(anoV, mesV - 1, diaV));
    if (!isNaN(dIda.getTime()) && !isNaN(dVolta.getTime()) && dVolta >= dIda) {
      diasViagem = Math.round((dVolta.getTime() - dIda.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const precoVooNum = parsePreco(precoVoo);

  let valorDiarioFinal = valorDiarioBrl;
  let precoVooFinal = precoVooNum;
  let custoTerrestre = 0;
  let custoTotalEstimado = precoVooFinal;
  let simboloMoeda = 'R$';

  if (moedaAlvo !== 'BRL') {
    simboloMoeda = SIMBOLOS_MOEDAS[moedaAlvo] || moedaAlvo;
    valorDiarioFinal = converterMoeda(valorDiarioBrl, 'BRL', moedaAlvo, cotacoes);
    precoVooFinal = converterMoeda(precoVooNum, 'BRL', moedaAlvo, cotacoes);
  }

  let resumoTexto = textoBase;

  if (diasViagem > 0 && precoVooNum > 0) {
    custoTerrestre = Math.round(diasViagem * valorDiarioFinal);
    custoTotalEstimado = Math.round(precoVooFinal + custoTerrestre);
    resumoTexto = `${textoBase} | Total ${diasViagem}d: ~${simboloMoeda} ${custoTotalEstimado}`;
  } else if (!dataVoltaStr || ehSoIda(dataVoltaStr)) {
    resumoTexto = `${textoBase} (Só Ida)`;
  } else if (diasViagem > 0) {
    custoTerrestre = Math.round(diasViagem * valorDiarioFinal);
    custoTotalEstimado = custoTerrestre;
  }

  return {
    textoResumo: resumoTexto,
    textoBase: textoBase,
    valorDiario: valorDiarioFinal,
    valorDiarioBrl: valorDiarioBrl,
    diasViagem: diasViagem,
    custoTerrestre: custoTerrestre,
    custoTotalEstimado: custoTotalEstimado,
    moeda: moedaAlvo,
    simboloMoeda: simboloMoeda,
    moedaOrigem: moedaOrigem,
    valorDiarioMoedaOrigem: valorDiarioMoedaOrigem,
    taxaConversao: Number(cotacoes[moedaAlvo]) || 1.0,
    regiaoEstimada: regiaoEstimada,
    origemEstimativa: origemEstimativa
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
  const p = typeof preco === 'number' ? preco : parseFloat(preco);
  const m = typeof media === 'number' ? media : parseFloat(media);
  const dp = typeof desvioPadrao === 'number' ? desvioPadrao : parseFloat(desvioPadrao);

  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(m) || m <= 0) {
    return {
      categoria: 'INFO',
      zScore: null,
      quedaPct: 0,
      media: Number.isFinite(m) ? m : (media || null),
      desvioPadrao: Number.isFinite(dp) ? dp : (desvioPadrao || null)
    };
  }

  const quedaPct = ((m - p) / m) * 100;
  const quedaPctArredondada = Number(quedaPct.toFixed(1));
  let zScore = null;

  if (Number.isFinite(dp) && dp >= 30) {
    zScore = Number(((p - m) / dp).toFixed(2));
    if (zScore <= ZSCORE_LIMIAR_BUG_FARE) {
      return { categoria: 'BUG_FARE', zScore, quedaPct: quedaPctArredondada, media: m, desvioPadrao: dp };
    }
    if (zScore <= ZSCORE_LIMIAR_OPORTUNIDADE || quedaPctArredondada >= QUEDA_PCT_OPORTUNIDADE) {
      return { categoria: 'OPORTUNIDADE', zScore, quedaPct: quedaPctArredondada, media: m, desvioPadrao: dp };
    }
  } else if (quedaPctArredondada >= QUEDA_PCT_OPORTUNIDADE) {
    // Sem desvio padrão robusto: queda >= 30% em relação à média recente
    return { categoria: 'OPORTUNIDADE', zScore: null, quedaPct: quedaPctArredondada, media: m, desvioPadrao: Number.isFinite(dp) ? dp : (desvioPadrao || null) };
  }

  return { categoria: 'INFO', zScore, quedaPct: quedaPctArredondada, media: m, desvioPadrao: Number.isFinite(dp) ? dp : (desvioPadrao || null) };
}
