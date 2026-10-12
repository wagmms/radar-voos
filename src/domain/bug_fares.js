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
