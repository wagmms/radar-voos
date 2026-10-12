import { TERMOS_BUG_FARE, TERMOS_MARKETING_BANIDOS } from './dicionarios.js';

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
 * Pisos Estruturais Mínimos de Preço (R$)
 * Valores abaixo destes limites representam anomalia quase certa de tarifa (GDS Bug Fare).
 */
export const PISOS_ESTRUTURAIS_BUG_FARE = {
  EUROPA: { idaEVolta: 1950, soIda: 1150 },
  AMERICA_NORTE: { idaEVolta: 1700, soIda: 950 },
  AMERICA_SUL: { idaEVolta: 850, soIda: 450 },
  ASIA_OCEANIA: { idaEVolta: 3000, soIda: 1800 },
  DOMESTICO: { idaEVolta: 250, soIda: 130 }
};

/**
 * Identifica a macrorregião a partir do código do aeroporto de destino
 */
export function identificarRegiaoDestino(destinoCod) {
  if (!destinoCod) return 'OUTRO';
  const cod = String(destinoCod).toUpperCase();
  const europa = ['LIS', 'OPO', 'MAD', 'BCN', 'CDG', 'ORY', 'PAR', 'LHR', 'LGW', 'LON', 'FCO', 'MXP', 'ROM', 'MIL', 'AMS', 'FRA', 'BER', 'MUC', 'ZRH', 'VIE', '/M/02J9Z'];
  const amNorte = ['MIA', 'MCO', 'JFK', 'EWR', 'LGA', 'NYC', 'LAX', 'SFO', 'ORD', 'CHI', 'WAS', 'IAD', 'YYZ', '/M/09C7W0'];
  const amSul = ['BUE', 'EZE', 'AEP', 'SCL', 'MVD', 'LIM', 'BOG'];
  const asia = ['TYO', 'NRT', 'HND', 'DXB', 'DOH', 'SYD'];
  const brasil = ['SAO', 'GRU', 'CGH', 'VCP', 'RIO', 'GIG', 'SDU', 'BSB', 'BHZ', 'CNF', 'SSA', 'REC', 'FOR', 'FLN', 'POA', 'CWB', 'BEL', 'MAO', 'IGU'];

  if (europa.some(e => cod.includes(e))) return 'EUROPA';
  if (amNorte.some(e => cod.includes(e))) return 'AMERICA_NORTE';
  if (amSul.some(e => cod.includes(e))) return 'AMERICA_SUL';
  if (asia.some(e => cod.includes(e))) return 'ASIA_OCEANIA';
  if (brasil.some(e => cod.includes(e))) return 'DOMESTICO';
  return 'OUTRO';
}

/**
 * Analisa uma tarifa encontrada pelo scanner e determina se é um Bug Fare em tempo real
 */
export function detectarBugFareEstatistico({
  origemCod,
  destinoCod,
  preco,
  precoMedioHistorico = null,
  dataVolta = null
}) {
  if (!preco || preco <= 0) return { ehBugFare: false };

  const ehIdaEVolta = Boolean(dataVolta);
  const regiao = identificarRegiaoDestino(destinoCod);
  const piso = PISOS_ESTRUTURAIS_BUG_FARE[regiao];

  // 1. Piso estrutural de preço irreal no GDS para a rota
  if (piso) {
    const valorPiso = ehIdaEVolta ? piso.idaEVolta : piso.soIda;
    if (preco <= valorPiso) {
      return {
        ehBugFare: true,
        tipo: '🚨 BUG FARE ESTRUTURAL (TARIFA IRREAL)',
        motivo: `Preço R$ ${preco.toFixed(0)} está abaixo do piso estrutural de R$ ${valorPiso} para ${regiao}`
      };
    }
  }

  // 2. Queda percentual extrema (anomalia de > 50% abaixo da média histórica da rota)
  if (precoMedioHistorico && precoMedioHistorico > 0) {
    const quedaPct = ((precoMedioHistorico - preco) / precoMedioHistorico) * 100;
    if (quedaPct >= 50) {
      return {
        ehBugFare: true,
        tipo: '🚨 BUG FARE POR ANOMALIA ESTATÍSTICA',
        motivo: `Queda anômala de ${quedaPct.toFixed(0)}% em relação à média histórica (R$ ${precoMedioHistorico.toFixed(0)})`
      };
    }
  }

  return { ehBugFare: false };
}

