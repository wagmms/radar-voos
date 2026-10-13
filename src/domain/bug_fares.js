import { TERMOS_BUG_FARE, TERMOS_MARKETING_BANIDOS } from './dicionarios.js';
import { ehSoIda, resolverDestino } from './rotas.js';
import { parsePreco } from './calculadora.js';

/**
 * Classifica um item do feed RSS como Bug Fare autêntico, promoção comercial ou lixo de marketing
 */
export function classificarItemFeed(titulo, link) {
  const tituloLower = String(titulo || '').toLowerCase();
  const linkLower = String(link || '').toLowerCase();

  // 1. Filtro implacável contra lixo de marketing, pacotes, hotéis, cupons e afiliados
  const ehMarketing = TERMOS_MARKETING_BANIDOS.some(
    t => tituloLower.includes(t) || linkLower.includes(t)
  );

  if (ehMarketing) {
    return {
      valido: false,
      ehBugFare: false,
      motivo: 'Conteúdo de marketing ou publieditorial banido'
    };
  }

  // 2. Filtro estrito: exige positivamente termos de erro de tarifa
  const ehBugFare = TERMOS_BUG_FARE.some(t => tituloLower.includes(t));

  if (ehBugFare) {
    return {
      valido: true,
      ehBugFare: true,
      tipo: '🚨 BUG FARE (ERRO DE TARIFA!)'
    };
  }

  // 3. Opcional: megapromoções legítimas que não contenham termos de marketing
  const ehMegapromocao =
    tituloLower.includes('megapromocao') ||
    tituloLower.includes('megapromoção') ||
    tituloLower.includes('passagens baratas') ||
    tituloLower.includes('super desconto');

  return {
    valido: ehMegapromocao,
    ehBugFare: false,
    tipo: ehMegapromocao ? '✈️ MEGAPROMOÇÃO' : 'Descartado'
  };
}

/**
 * Pisos Estruturais Mínimos de Preço (R$) para Classe Econômica
 * Valores abaixo destes limites representam anomalia quase certa de tarifa (GDS Bug Fare).
 */
export const PISOS_ESTRUTURAIS_BUG_FARE = {
  EUROPA: { idaEVolta: 1950, soIda: 1150 },
  AMERICA_NORTE: { idaEVolta: 1700, soIda: 950 },
  AMERICA_SUL: { idaEVolta: 850, soIda: 450 },
  CARIBE_AMERICA_CENTRAL: { idaEVolta: 1300, soIda: 750 },
  ORIENTE_MEDIO: { idaEVolta: 2800, soIda: 1600 },
  AFRICA: { idaEVolta: 2200, soIda: 1300 },
  ASIA_OCEANIA: { idaEVolta: 3000, soIda: 1800 },
  DOMESTICO: { idaEVolta: 250, soIda: 130 }
};

/**
 * Multiplicadores de Piso por Classe de Cabine
 * Permite detectar Bug Fares em Executiva e Premium Economy
 */
export const MULTIPLICADORES_CABINE_BUG_FARE = {
  economy: 1.0,
  premium_economy: 1.6,
  business: 2.8,
  first: 4.5
};

/**
 * Pisos Mínimos Plausíveis de Preço (R$) para Evitar Tarifas Espúrias e Erros de Scraping
 * Tarifas abaixo desses valores em rotas comerciais são comprovadamente irreais (ex: taxas isoladas,
 * voos domésticos parseados por engano em rotas internacionais, moedas incorretas ou erros de scraping).
 * Devem ser SUMARIAMENTE DESCARTADAS e JAMAIS anunciadas como Bug Fare autêntico.
 */
export const PISOS_MINIMOS_PLAUSIVEIS_BUG_FARE = {
  EUROPA: { idaEVolta: 1000, soIda: 600 },
  AMERICA_NORTE: { idaEVolta: 900, soIda: 550 },
  AMERICA_SUL: { idaEVolta: 450, soIda: 250 },
  CARIBE_AMERICA_CENTRAL: { idaEVolta: 700, soIda: 400 },
  ORIENTE_MEDIO: { idaEVolta: 1300, soIda: 750 },
  AFRICA: { idaEVolta: 1100, soIda: 700 },
  ASIA_OCEANIA: { idaEVolta: 1400, soIda: 850 },
  DOMESTICO: { idaEVolta: 130, soIda: 70 },
  OUTRO: { idaEVolta: 800, soIda: 450 }
};

/**
 * Identifica a macrorregião a partir do código do aeroporto ou nome de destino
 */
export function identificarRegiaoDestino(destinoCod) {
  if (destinoCod === null || destinoCod === undefined) return 'OUTRO';
  if (typeof destinoCod !== 'string' && typeof destinoCod !== 'number') return 'OUTRO';
  const str = String(destinoCod).trim();
  if (!str) return 'OUTRO';

  const cod = str.toUpperCase();
  const nomeLower = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const destinoResolvido = resolverDestino(str);
  const codResolvido = destinoResolvido ? String(destinoResolvido).toUpperCase().trim() : null;

  const europa = [
    'LIS', 'OPO', 'MAD', 'BCN', 'CDG', 'ORY', 'PAR', 'LHR', 'LGW', 'LON', 'FCO', 'MXP', 'ROM', 'MIL',
    'AMS', 'FRA', 'BER', 'MUC', 'ZRH', 'VIE', 'ATH', 'DUB', 'OSL', 'CPH', 'ARN', 'HEL', 'PRG', 'BUD',
    'WAW', 'EDI', 'MAN', 'BRU', 'VLC', 'SVQ', 'AGP', 'PSA', 'NAP', 'BLQ', 'VCE', 'FAO', 'FNC',
    '/M/02J9Z', '/M/05R4W', '/M/06MKJ', '/M/0F8L9C', '/M/03RJJ'
  ];

  const amNorte = [
    'MIA', 'MCO', 'JFK', 'EWR', 'LGA', 'NYC', 'LAX', 'SFO', 'ORD', 'CHI', 'WAS', 'IAD', 'DCA', 'YYZ',
    'BOS', 'ATL', 'DFW', 'LAS', 'PHX', 'SEA', 'YVR', 'YUL', 'DEN', 'IAH', 'SAN', 'HNL',
    '/M/09C7W0'
  ];

  const caribe = [
    'CUN', 'PUJ', 'PTY', 'SJO', 'HAV', 'SJU', 'SDQ', 'AUA', 'CUR', 'SXM', 'NAS', 'MBJ', 'GCM',
    'BGI', 'POS', '/M/02K_W'
  ];

  const amSul = [
    'BUE', 'EZE', 'AEP', 'SCL', 'MVD', 'LIM', 'BOG', 'COR', 'ROS', 'MDZ', 'BRC', 'ASU', 'LPB', 'VVI',
    'UIO', 'GYE', 'CTG', 'MDE', 'CLO', '/M/06_1', '/M/01N7Q'
  ];

  const orienteMedio = [
    'DXB', 'DOH', 'AUH', 'TLV', 'IST', 'SAW', 'AMM', 'MCT', 'RUH', 'JED', 'BAH', 'KWI'
  ];

  const africa = [
    'JNB', 'CPT', 'CAI', 'CMN', 'RAK', 'NBO', 'DKR', 'LOS', 'ADD', 'ZNZ', 'SEZ', 'MRU',
    '/M/02K_8'
  ];

  const asia = [
    'TYO', 'NRT', 'HND', 'SYD', 'SIN', 'BKK', 'KUL', 'ICN', 'DPS', 'HKG', 'PEK', 'PVG',
    'MEL', 'AKL', '/M/02J1X'
  ];

  const brasil = [
    'SAO', 'GRU', 'CGH', 'VCP', 'RIO', 'GIG', 'SDU', 'BSB', 'BHZ', 'CNF', 'SSA', 'REC', 'FOR', 'FLN',
    'POA', 'CWB', 'BEL', 'MAO', 'IGU', 'RAO', 'SJP', 'JTC', 'MII', 'PPB', 'UDI', 'VIX', 'PVH', 'PMW',
    'MCP', 'BVB', 'RBR', 'NAT', 'MCZ', 'JPA', 'AJU', 'THE', 'SLZ', 'BPS', 'FEN', 'GYN', 'CGB', 'CGR',
    'NVT', 'LDB', 'MGF', 'XAP', 'CXJ', 'JOI'
  ];

  const casarRegiao = (lista) => {
    return lista.some(item => {
      if (item.startsWith('/M/') || item.startsWith('/G/')) {
        return cod === item || (codResolvido && codResolvido === item) || cod.includes(item);
      }
      if (codResolvido && (codResolvido === item || codResolvido.split(',').includes(item))) return true;
      if (cod === item) return true;
      // Match estrito com fronteira de palavra/não-alfanumérico (evita que "CHI" case em "CHILE" ou "SAN" em "SANTIAGO")
      const regexToken = new RegExp(`(^|[^A-Z0-9])${item}([^A-Z0-9]|$)`);
      return regexToken.test(cod);
    });
  };

  if (casarRegiao(europa)) return 'EUROPA';
  if (casarRegiao(amNorte)) return 'AMERICA_NORTE';
  if (casarRegiao(caribe)) return 'CARIBE_AMERICA_CENTRAL';
  if (casarRegiao(orienteMedio)) return 'ORIENTE_MEDIO';
  if (casarRegiao(africa)) return 'AFRICA';
  if (casarRegiao(amSul)) return 'AMERICA_SUL';
  if (casarRegiao(asia)) return 'ASIA_OCEANIA';
  if (casarRegiao(brasil)) return 'DOMESTICO';

  // Fallback por correspondência semântica de nomes
  if (nomeLower.includes('europa') || nomeLower.includes('portugal') || nomeLower.includes('espanha') || nomeLower.includes('franca') || nomeLower.includes('italia')) return 'EUROPA';
  if (nomeLower.includes('estados unidos') || nomeLower.includes('eua') || nomeLower.includes('usa') || nomeLower.includes('orlando') || nomeLower.includes('miami')) return 'AMERICA_NORTE';
  if (nomeLower.includes('cancun') || nomeLower.includes('punta cana') || nomeLower.includes('caribe')) return 'CARIBE_AMERICA_CENTRAL';
  if (nomeLower.includes('argentina') || nomeLower.includes('chile') || nomeLower.includes('uruguai') || nomeLower.includes('peru') || nomeLower.includes('colombia')) return 'AMERICA_SUL';
  if (nomeLower.includes('japao') || nomeLower.includes('toquio') || nomeLower.includes('asia') || nomeLower.includes('australia')) return 'ASIA_OCEANIA';
  if (nomeLower.includes('dubai') || nomeLower.includes('doha') || nomeLower.includes('istambul')) return 'ORIENTE_MEDIO';
  if (nomeLower.includes('africa') || nomeLower.includes('marrocos') || nomeLower.includes('egito')) return 'AFRICA';

  return 'OUTRO';
}

/**
 * Analisa uma tarifa encontrada pelo scanner e determina se é um Bug Fare em tempo real
 */
export function detectarBugFareEstatistico(params = {}) {
  if (!params || typeof params !== 'object') {
    return { ehBugFare: false };
  }

  const {
    origemCod,
    destinoCod,
    preco,
    precoMedioHistorico = null,
    desvioPadrao = null,
    cabine = 'economy',
    dataVolta = null
  } = params;

  const precoNum = typeof preco === 'number' ? preco : parsePreco(preco);
  // Filtro de ruído: valores inferiores a R$ 40 geralmente são taxas isoladas ou erros de parsing de centavos
  if (!Number.isFinite(precoNum) || precoNum < 40) return { ehBugFare: false };

  const ehIdaEVolta = Boolean(dataVolta) && !ehSoIda(dataVolta);
  const regiao = identificarRegiaoDestino(destinoCod);
  const pisoBase = PISOS_ESTRUTURAIS_BUG_FARE[regiao];

  const cabineRaw = typeof cabine === 'string' ? cabine.trim().toLowerCase() : 'economy';
  const ALIASES_CABINE = {
    executiva: 'business',
    primeira_classe: 'first',
    primeira: 'first',
    premium: 'premium_economy'
  };
  const cabineNormalizada = ALIASES_CABINE[cabineRaw] || (MULTIPLICADORES_CABINE_BUG_FARE[cabineRaw] ? cabineRaw : 'economy');
  const multCabine = MULTIPLICADORES_CABINE_BUG_FARE[cabineNormalizada] || 1.0;

  // Filtro de Inviabilidade e Tarifa Espúria:
  // Se o preço for inferior ao piso mínimo plausível de segurança da região (ajustado por cabine),
  // trata-se de ruído/erro de extração de scraping (ex: R$ 362 para Europa quando as taxas já somam > R$ 500)
  const pisoMinimoObj = PISOS_MINIMOS_PLAUSIVEIS_BUG_FARE[regiao] || PISOS_MINIMOS_PLAUSIVEIS_BUG_FARE.OUTRO;
  const valorPisoMinimo = Math.round((ehIdaEVolta ? pisoMinimoObj.idaEVolta : pisoMinimoObj.soIda) * multCabine);
  if (precoNum < valorPisoMinimo) {
    return {
      ehBugFare: false,
      descartadoPorInviabilidade: true,
      motivo: `Tarifa de R$ ${precoNum} abaixo do piso mínimo plausível de R$ ${valorPisoMinimo} para ${regiao} (dado espúrio/ruído de extração)`
    };
  }

  // 1. Piso estrutural de preço irreal no GDS ajustado por cabine
  if (pisoBase) {
    const valorPiso = Math.round((ehIdaEVolta ? pisoBase.idaEVolta : pisoBase.soIda) * multCabine);
    if (precoNum <= valorPiso) {
      const labelCabine = cabineNormalizada !== 'economy' ? ` em ${cabineNormalizada.toUpperCase()}` : '';
      const descontoEstimado = Math.round(((valorPiso * 1.8 - precoNum) / (valorPiso * 1.8)) * 100);
      return {
        ehBugFare: true,
        severidade: 'CRITICA',
        tipo: '🚨 BUG FARE ESTRUTURAL (TARIFA IRREAL)',
        motivo: `Preço R$ ${precoNum.toFixed(0)}${labelCabine} está abaixo do piso estrutural de R$ ${valorPiso} para ${regiao}`,
        regiao,
        pisoReferencia: valorPiso,
        descontoEstimadoPct: Math.max(descontoEstimado, 40)
      };
    }
  }

  const numMedio = typeof precoMedioHistorico === 'number'
    ? precoMedioHistorico
    : (precoMedioHistorico !== null && precoMedioHistorico !== undefined ? parsePreco(precoMedioHistorico) : null);
  const numDesvio = typeof desvioPadrao === 'number'
    ? desvioPadrao
    : (desvioPadrao !== null && desvioPadrao !== undefined ? parsePreco(desvioPadrao) : null);

  // 2. Anomalia estatística baseada em Z-Score (quando há desvio padrão amostral robusto)
  if (Number.isFinite(numMedio) && numMedio > 0 && Number.isFinite(numDesvio) && numDesvio >= 50) {
    const zScore = (precoNum - numMedio) / numDesvio;
    if (zScore <= -2.2) {
      const quedaPct = Math.round(((numMedio - precoNum) / numMedio) * 100);
      return {
        ehBugFare: true,
        severidade: 'ALTA',
        tipo: '🚨 BUG FARE POR ANOMALIA ESTATÍSTICA (Z-SCORE)',
        motivo: `Tarifa a ${Math.abs(zScore).toFixed(1)} desvios padrão da média (${quedaPct}% abaixo da média de R$ ${numMedio.toFixed(0)})`,
        regiao,
        pisoReferencia: numMedio,
        descontoEstimadoPct: quedaPct
      };
    }
  }

  // 3. Queda percentual extrema (anomalia de >= 50% abaixo da média histórica da rota)
  if (Number.isFinite(numMedio) && numMedio > 0) {
    const quedaPct = ((numMedio - precoNum) / numMedio) * 100;
    if (quedaPct >= 50) {
      return {
        ehBugFare: true,
        severidade: 'ALTA',
        tipo: '🚨 BUG FARE POR ANOMALIA ESTATÍSTICA',
        motivo: `Queda anômala de ${quedaPct.toFixed(0)}% em relação à média histórica (R$ ${numMedio.toFixed(0)})`,
        regiao,
        pisoReferencia: numMedio,
        descontoEstimadoPct: Math.round(quedaPct)
      };
    }
  }

  return { ehBugFare: false };
}


