import { FlightProviderInterface } from './flight_provider_interface.js';
import {
  gerarLinkGoogleFlightsCheapest,
  gerarLinkGoogleFlights,
  gerarTfs,
  construirTfu,
  normalizarParaSerpApi,
  resolverCodigoParaLink,
  ehSoIda,
  ehRotaDomesticaBrasil
} from '../../domain/rotas.js';
import {
  extrairPrecoNumerico,
  limparNomeCompanhia,
  converterDuracaoParaHoras,
  extrairInfoConexoes,
  extrairInfoBagagem
} from './google_flights_direct_provider.js';
import { PADROES_IGNORAR_RODAPE, NOMES_CIDADES_IATA } from '../../domain/dicionarios.js';
import { fetchComPrimpTls, verificarPrimpDisponivel } from './tls_impersonate_client.js';


/**
 * ScraplingClient v1.1 — Adaptador de Scraping Resiliente para Google Flights
 *
 * Baseado nos padrões das skills `scrapling` e `flight-search`.
 * Foco: extração da aba "Cheapest" via Protobuf tfs com evasão anti-bot,
 * cabeçalhos HTTP realistas, jitter de delay e múltiplas camadas de parsing.
 *
 * Distinção mandatória One-Way vs Round-Trip em todos os payloads gerados.
 */

/** @type {readonly {ua:string, platform:string, chUa:string, chUaFull:string, mobile:string}[]} */
const PERFIS_STEALTH = Object.freeze([
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: '"Windows"',
    chUa: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    chUaFull: '"Google Chrome";v="131.0.6778.86", "Chromium";v="131.0.6778.86", "Not_A Brand";v="24.0.0.0"',
    mobile: '?0'
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: '"macOS"',
    chUa: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    chUaFull: '"Google Chrome";v="131.0.6778.86", "Chromium";v="131.0.6778.86", "Not_A Brand";v="24.0.0.0"',
    mobile: '?0'
  },
  {
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: '"Linux"',
    chUa: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    chUaFull: '"Google Chrome";v="131.0.6778.86", "Chromium";v="131.0.6778.86", "Not_A Brand";v="24.0.0.0"',
    mobile: '?0'
  },
  {
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.105 Mobile Safari/537.36',
    platform: '"Android"',
    chUa: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    chUaFull: '"Google Chrome";v="131.0.6778.105", "Chromium";v="131.0.6778.105", "Not_A Brand";v="24.0.0.0"',
    mobile: '?1'
  }
]);

/**
 * IPs residenciais brasileiros para geolocalização realista em balanceadores do Google.
 * Não são usados para proxy — apenas como X-Forwarded-For hint.
 */
const IPS_BRASIL = Object.freeze([
  '177.16.24.12',
  '179.108.45.221',
  '200.137.82.9',
  '187.10.55.98',
  '201.22.144.77'
]);

/**
 * Cookie de consentimento pré-aceito para evitar tela de consent.google.com.
 * Formato: SOCS (Google One-tap consent), 1P_JAR e NID mínimos.
 */
const COOKIE_CONSENT = 'CONSENT=YES+cb.20240116-07-p0.pt-BR+FX+999; SOCS=CAISHAgBEhJnd3NfMjAyNDAxMTYtMF9SQzIaBXB0LUJSIAEaBgiA_LuuBg; PREF=hl=pt-BR&gl=BR&tz=America.Sao_Paulo&f6=40000000; 1P_JAR=2026-10-16-22; NID=511=Qn_gKlhOXVhGj9RTYA';

/** Tempo mínimo de jitter em ms entre tentativas (padrão scrapling anti-bot) */
const JITTER_MIN_MS = 800;
/** Tempo máximo de jitter em ms */
const JITTER_MAX_MS = 2400;
/** Timeout de conexão HTTP por tentativa */
const HTTP_TIMEOUT_MS = 15000;
/** Número máximo de tentativas com rotação de perfil */
const MAX_TENTATIVAS = 2;

/**
 * Mapa canônico de códigos IATA de 2 letras de companhias aéreas para nomes amigáveis.
 * Utilizado para decodificação rápida a partir de atributos data-*, logos e matrizes de voos.
 * @type {Readonly<Record<string, string>>}
 */
export const MAPA_CIAS_IATA = Object.freeze({
  // Nacionais / América do Sul
  G3: 'GOL',
  LA: 'LATAM',
  JJ: 'LATAM',
  AD: 'Azul',
  VO: 'Voepass',
  '2Z': 'Voepass',
  H2: 'SKY Airline',
  JA: 'JetSMART',
  WJ: 'JetSMART',
  AR: 'Aerolíneas Argentinas',
  AV: 'Avianca',
  CM: 'Copa Airlines',
  // América do Norte
  AA: 'American Airlines',
  DL: 'Delta',
  UA: 'United',
  AC: 'Air Canada',
  AM: 'Aeroméxico',
  // Europa
  TP: 'TAP Portugal',
  AF: 'Air France',
  KL: 'KLM',
  LH: 'Lufthansa',
  LX: 'Swiss',
  IB: 'Iberia',
  UX: 'Air Europa',
  BA: 'British Airways',
  AZ: 'ITA Airways',
  FR: 'Ryanair',
  U2: 'easyJet',
  VY: 'Vueling',
  W6: 'Wizz Air',
  TO: 'Transavia',
  EW: 'Eurowings',
  OS: 'Austrian Airlines',
  SN: 'Brussels Airlines',
  AY: 'Finnair',
  SK: 'SAS',
  VS: 'Virgin Atlantic',
  // Oriente Médio / Ásia / África / Oceania
  QR: 'Qatar Airways',
  EK: 'Emirates',
  TK: 'Turkish Airlines',
  ET: 'Ethiopian',
  SQ: 'Singapore Airlines',
  NH: 'ANA',
  JL: 'Japan Airlines',
  QF: 'Qantas',
  NZ: 'Air New Zealand',
  SA: 'South African Airways',
  AT: 'Royal Air Maroc'
});

/**
 * Extrai e resolve o nome ou código da companhia aérea a partir de códigos IATA de 2 letras
 * em atributos data-*, logos, números de voo e matrizes JSON do Google Flights.
 *
 * @param {string|null} trechoHtml - Trecho HTML adjacente ao elemento do voo
 * @param {string|null} [textoAuxiliar=''] - Texto opcional (ex: aria-label ou contexto)
 * @returns {string|null} Nome da companhia mapeada ou código IATA, ou null se não detectado
 */
export function extrairCiaIataDoTrecho(trechoHtml, textoAuxiliar = '') {
  const trecho = String(trechoHtml || '');
  const aux = String(textoAuxiliar || '');

  // 1. Atributos data-* específicos do Google Flights com código IATA de 2 letras
  const matchDataCode = trecho.match(/\bdata-(?:airline(?:-code)?|carrier(?:-code)?|marketing-carrier|iata|flight-code)=["']([A-Za-z0-9]{2})["']/i);
  if (matchDataCode) {
    const cod = matchDataCode[1].toUpperCase();
    return MAPA_CIAS_IATA[cod] || cod;
  }

  // 2. Atributos data-flight-number ou data-flight com código IATA e número de voo
  const matchDataFlt = trecho.match(/\bdata-(?:flight(?:-number)?|flt)=["']([A-Za-z0-9]{2})\s*\d{1,5}["']/i);
  if (matchDataFlt) {
    const cod = matchDataFlt[1].toUpperCase();
    return MAPA_CIAS_IATA[cod] || cod;
  }

  // 3. Logos de companhias aéreas do Google Flights (ex: gstatic / airline_logos)
  const matchLogo = trecho.match(/airline_logos\/(?:(?:70px|[A-Za-z0-9_-]+)\/)?([A-Za-z0-9]{2})\.(?:png|svg|webp|gif)/i);
  if (matchLogo) {
    const cod = matchLogo[1].toUpperCase();
    return MAPA_CIAS_IATA[cod] || cod;
  }

  // 4. Matrizes de voo JSON ou arrays de callback do Google Flights (ex: ["G3", 1234] ou "carrier":"LA")
  const matchJsonCarrier = trecho.match(/(?:["'](?:carrier|airline|airlineCode|carrierCode|marketingCarrier)["']\s*[:=]\s*["']([A-Za-z0-9]{2})["'])/i);
  if (matchJsonCarrier) {
    const cod = matchJsonCarrier[1].toUpperCase();
    return MAPA_CIAS_IATA[cod] || cod;
  }

  const matchMatrizArray = trecho.match(/\[\s*["']([A-Za-z0-9]{2})["']\s*,\s*["']?\d{2,4}["']?\s*\]/);
  if (matchMatrizArray) {
    const cod = matchMatrizArray[1].toUpperCase();
    if (MAPA_CIAS_IATA[cod]) return MAPA_CIAS_IATA[cod];
  }

  // 5. Padrão de número de voo no texto auxiliar ou aria-label (ex: "Voo G3 1542", "Flight LA 3000")
  const matchVooTexto = aux.match(/(?:(?:Voo|Flight)\s*(?:nº|n[oº]|#)?\s*|^|\b)([A-Za-z0-9]{2})\s*\d{2,4}\b/i) ||
                        trecho.match(/(?:(?:Voo|Flight)\s*(?:nº|n[oº]|#)?\s*)([A-Za-z0-9]{2})\s*\d{2,4}\b/i);
  if (matchVooTexto) {
    const cod = matchVooTexto[1].toUpperCase();
    if (MAPA_CIAS_IATA[cod]) return MAPA_CIAS_IATA[cod];
  }

  // 6. Atributos alt ou title com código IATA conhecido
  const matchAlt = trecho.match(/(?:alt|title)=["']([A-Za-z0-9]{2})["']/i);
  if (matchAlt) {
    const cod = matchAlt[1].toUpperCase();
    if (MAPA_CIAS_IATA[cod]) return MAPA_CIAS_IATA[cod];
  }

  return null;
}

/**
 * Gera delay com jitter aleatório (comportamento humano scrapling)
 * @param {number} min
 * @param {number} max
 * @returns {Promise<void>}
 */
async function jitterDelay(min = JITTER_MIN_MS, max = JITTER_MAX_MS) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Seleciona perfil stealth pseudoaleatório diferente do último usado
 * @param {number} ultimoIdx
 * @returns {{ perfil: object, idx: number }}
 */
function selecionarPerfilStealth(ultimoIdx = -1) {
  let idx;
  do {
    idx = Math.floor(Math.random() * PERFIS_STEALTH.length);
  } while (idx === ultimoIdx && PERFIS_STEALTH.length > 1);
  return { perfil: PERFIS_STEALTH[idx], idx };
}

/**
 * Monta headers HTTP completos de navegador real (padrão scrapling anti-bot)
 * @param {object} perfil
 * @returns {Record<string, string>}
 */
export function montarHeaders(perfil) {
  const ip = IPS_BRASIL[Math.floor(Math.random() * IPS_BRASIL.length)];
  return {
    'User-Agent': perfil.ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': perfil.chUa,
    'Sec-Ch-Ua-Full-Version-List': perfil.chUaFull,
    'Sec-Ch-Ua-Mobile': perfil.mobile,
    'Sec-Ch-Ua-Platform': perfil.platform,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'X-Geo': 'a w+CAIQICIQU2FvIFBhdWxvLEJyYXppbA',
    'CF-IPCountry': 'BR',
    'X-Forwarded-For': ip,
    'Cookie': COOKIE_CONSENT
  };
}

/**
 * Detecta se a resposta indica bloqueio de bot (Google sorry/consent/429)
 * @param {{ status: number, url: string }} resp
 * @returns {boolean}
 */
export function detectarBloqueioBot(resp) {
  if (resp.status === 429 || resp.status === 503) return true;
  const url = String(resp.url || '');
  if (url.includes('sorry/index') || url.includes('consent.google.com')) return true;
  return false;
}

/**
 * Decodifica o menor preço embutido no payload Protobuf tfu (base64url) do Google Flights.
 *
 * Estrutura do Protobuf tfu:
 * - Field 3 (length-delimited): Submensagem de moeda/tarifa
 *   - Subfield 1 (varint): Preço em centavos (ou unidades)
 *   - Subfield 2 (varint): Escala/casas decimais (normalmente 2 para centavos)
 *   - Subfield 3 (string/bytes): Código ISO da moeda ("BRL", "USD", etc.)
 *
 * @param {string} tokenOuUrl - String contendo o token tfu em base64/base64url ou URL completa
 * @returns {number|null} Menor preço inteiro em BRL ou null se não decodificável
 */
export function decodificarPrecoDoTfu(tokenOuUrl) {
  if (!tokenOuUrl || typeof tokenOuUrl !== 'string') return null;

  let token = tokenOuUrl.trim();
  // Se for uma URL ou fragmento com parâmetro tfu, extrai o valor do parâmetro
  const matchParam = token.match(/(?:[?&]tfu=|"tfu"\s*:\s*"|tfu=)([A-Za-z0-9+/=_-]{16,})/i);
  if (matchParam) {
    token = matchParam[1];
  }

  // Desfaz URL encoding caso esteja percent-encoded
  try {
    token = decodeURIComponent(token);
  } catch {}

  // Remove eventuais delimitadores residuais
  token = token.replace(/["'\s;,].*$/, '');

  try {
    // Normaliza Base64URL (- _) para Base64 padrão (+ /) com padding
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(pad);
    const buf = Buffer.from(padded, 'base64');
    if (buf.length < 12) return null;

    // Estratégia 1: Varredura orientada por âncoras de moedas conhecidas
    const moedas = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'CLP'];
    for (const moeda of moedas) {
      const idxMoeda = buf.indexOf(Buffer.from(moeda));
      if (idxMoeda !== -1) {
        const inicioJanela = Math.max(0, idxMoeda - 20);
        for (let i = inicioJanela; i < idxMoeda; i++) {
          if (buf[i] === 0x08) { // Tag 1 (varint do preço)
            let val = 0;
            let shift = 0;
            let j = i + 1;
            while (j < idxMoeda && j < buf.length) {
              const b = buf[j++];
              val |= (b & 0x7f) << shift;
              shift += 7;
              if ((b & 0x80) === 0) break;
            }
            if (val > 0) {
              let escala = 2; // Google Flights padrão para centavos
              if (j < idxMoeda && buf[j] === 0x10) { // Tag 2 (escala)
                escala = buf[j + 1];
              }
              const taxaUsd = Number(process.env.USD_BRL_RATE) || 5.80;
              const precoComEscala = Math.round(val / (10 ** escala));
              const precoEscalaBrl = (moeda === 'USD') ? Math.round(precoComEscala * taxaUsd) : precoComEscala;
              if (precoEscalaBrl >= 80 && precoEscalaBrl <= 60000) {
                return precoEscalaBrl;
              }
              const valBrl = (moeda === 'USD') ? Math.round(val * taxaUsd) : val;
              if (valBrl >= 80 && valBrl <= 60000) {
                return valBrl;
              }
            }
          }
        }
      }
    }

    // Estratégia 2: Decodificação estruturada do Protobuf raiz (Field 3 = Price message)
    let offset = 0;
    while (offset < buf.length) {
      const tagByte = buf[offset++];
      const wire = tagByte & 7;
      const field = tagByte >> 3;
      if (wire === 2) { // length-delimited
        let len = 0;
        let shift = 0;
        while (offset < buf.length) {
          const b = buf[offset++];
          len |= (b & 0x7f) << shift;
          shift += 7;
          if ((b & 0x80) === 0) break;
        }
        if (field === 3) {
          const sub = buf.subarray(offset, offset + len);
          let subOff = 0;
          let valor = null;
          let escala = 2;
          while (subOff < sub.length) {
            const subTag = sub[subOff++];
            const subWire = subTag & 7;
            const subField = subTag >> 3;
            if (subWire === 0) {
              let v = 0;
              let s = 0;
              while (subOff < sub.length) {
                const b = sub[subOff++];
                v |= (b & 0x7f) << s;
                s += 7;
                if ((b & 0x80) === 0) break;
              }
              if (subField === 1) valor = v;
              if (subField === 2) escala = v;
            } else if (subWire === 2) {
              let l = 0;
              let s = 0;
              while (subOff < sub.length) {
                const b = sub[subOff++];
                l |= (b & 0x7f) << s;
                s += 7;
                if ((b & 0x80) === 0) break;
              }
              subOff += l;
            } else {
              break;
            }
          }
          if (valor !== null && valor > 0) {
            const finalPreco = Math.round(valor / (10 ** escala));
            if (finalPreco >= 80 && finalPreco <= 60000) return finalPreco;
            if (valor >= 80 && valor <= 60000) return valor;
          }
        }
        offset += len;
      } else if (wire === 0) {
        while (offset < buf.length && (buf[offset++] & 0x80) !== 0) {}
      } else {
        break;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extrai preço da aba Cheapest do Google Flights a partir do HTML raw ou URL de resposta.
 *
 * Múltiplas camadas de extração:
 * 1. Padrão canônico comprehensiveness_lure em array JS: [[null, PRECO], "...comprehensiveness_lure..."]
 * 2. Padrão ampliado: [[null, PRECO], "base64long"]
 * 3. Padrão compacto minificado: [null, PRECO], "EhZ..."
 * 4. Decode base64url do parâmetro canônico `tfu` da URL de resposta ou embutido em respostas AJAX de redirecionamento.
 *
 * @param {string|null} html
 * @param {string|null} [urlResposta=null]
 * @returns {number|null}
 */
export function extrairPrecoCheapestTab(html, urlResposta = null) {
  if (!html && !urlResposta) return null;

  if (html) {
    // Camada 1: Padrão canônico com comprehensiveness_lure — tolerante a espaços extras
    const r1 = /\[\[null,\s*(\d+)\s*\]\s*,\s*"[^"]*(?:comprehensiveness_lure|EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl)[^"]*"/i;
    const m1 = html.match(r1);
    if (m1) {
      const p = parseInt(m1[1], 10);
      if (p >= 80 && p <= 60000) return p;
    }

    // Camada 2: Padrão ampliado com validação de token da aba Cheapest (evita callbacks genéricos de rodapé)
    const r2 = /\[\[null,\s*(\d{3,6})\s*\]\s*,\s*"(?:EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl|[A-Za-z0-9+/=_-]{16,}(?:comprehensiveness|lure|cheapest))[^"]*"/i;
    const m2 = html.match(r2);
    if (m2) {
      const p = parseInt(m2[1], 10);
      if (p >= 80 && p <= 60000) return p;
    }

    // Camada 3: Padrão compacto minificado — [null,NUM],"EhZ..." ou com palavras literais
    // EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl = token base64 canônico de comprehensiveness_lure
    const r3 = /\[null,\s*(\d{3,6})\s*\],\s*"(?:EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl|[A-Za-z0-9+/=_-]{16,}(?:comprehensiveness|lure|cheapest))/i;
    const m3 = html.match(r3);
    if (m3) {
      const p = parseInt(m3[1], 10);
      if (p >= 80 && p <= 60000) return p;
    }
  }

  // Camada 4: Decode base64url do parâmetro canônico tfu da URL de resposta ou embutido em AJAX/redirect
  if (urlResposta) {
    const precoTfuUrl = decodificarPrecoDoTfu(urlResposta);
    if (precoTfuUrl) return precoTfuUrl;
  }

  if (html) {
    // Se o HTML contiver links ou redirecionamentos com tfu (ex: AJAX responses sem corpo rico)
    const regexTfu = /(?:[?&]tfu=|"tfu"\s*:\s*"|tfu=)([A-Za-z0-9+/=_-]{20,})/gi;
    let matchTfu;
    while ((matchTfu = regexTfu.exec(html)) !== null) {
      const precoTfu = decodificarPrecoDoTfu(matchTfu[1]);
      if (precoTfu) return precoTfu;
    }
  }

  return null;
}

/**
 * Constrói URL para a aba Cheapest do Google Flights com Protobuf tfs,
 * garantindo distinção precisa entre One-Way e Round-Trip no payload binário
 * e propagando filtros avançados (passageiros, cabine, maxStops, layover, bagagem).
 *
 * @param {string} origemCod - Código de origem (IATA ou metrópole)
 * @param {string} destinoCod - Código de destino (IATA, metrópole ou KGMID)
 * @param {string} dataIda - Data de ida YYYY-MM-DD
 * @param {string|null} dataVolta - Data de volta YYYY-MM-DD, ou null/string de só-ida
 * @param {number|null} duracaoMaxHoras - Duração máxima em horas (filtro opcional)
 * @param {string} [moeda='BRL'] - Moeda ISO (padrão 'BRL')
 * @param {object} [opcoesExtras={}] - Filtros avançados: { adultos, criancas, bebes, cabine, classeViagem, maxStops, carryOnBags, maxLayoverMinutes }
 * @returns {{ url: string, tipoViagem: 'one_way'|'round_trip', tfs: string }}
 */
export function construirUrlCheapest(
  origemCod,
  destinoCod,
  dataIda,
  dataVolta = null,
  duracaoMaxHoras = null,
  moeda = 'BRL',
  opcoesExtras = {}
) {
  let moedaArg = moeda;
  let opts = opcoesExtras;
  if (typeof moedaArg === 'object' && moedaArg !== null) {
    opts = moedaArg;
    moedaArg = opts.moeda || 'BRL';
  }
  const origResolvido = resolverCodigoParaLink(origemCod);
  const destResolvido = resolverCodigoParaLink(destinoCod);
  const domestica = ehRotaDomesticaBrasil(origemCod, destinoCod) || ehRotaDomesticaBrasil(origResolvido, destResolvido);
  const moedaBruta = (typeof moedaArg === 'string' && moedaArg.trim()) ? moedaArg.trim().toUpperCase() : 'BRL';
  const moedaEfetiva = domestica ? 'BRL' : moedaBruta;

  const origens = normalizarParaSerpApi(origResolvido).split(',').map(s => s.trim()).filter(Boolean);
  const destinos = normalizarParaSerpApi(destResolvido).split(',').map(s => s.trim()).filter(Boolean);

  // Determinação canônica do tipo de viagem
  const voltaEfetiva = ehSoIda(dataVolta) ? null : dataVolta;
  const tipoViagem = voltaEfetiva ? 'round_trip' : 'one_way';

  const maxMin = duracaoMaxHoras && duracaoMaxHoras > 0 && duracaoMaxHoras < 900
    ? Math.round(duracaoMaxHoras * 60)
    : null;

  const {
    adultos = 1,
    criancas = 0,
    bebes = 0,
    infantsInSeat = null,
    infantsOnLap = null,
    cabine = 'economy',
    classeViagem = 'economy',
    maxStops = null,
    carryOnBags = null,
    checkedBags = null,
    maxPrice = null,
    hideSeparateAndSelfTransfer = null,
    excludeBasicEconomy = null,
    airlines = null,
    connectingAirports = null,
    minLayoverMinutes = null,
    maxLayoverMinutes = null,
    earliestDepartureHour = null,
    latestDepartureHour = null,
    earliestArrivalHour = null,
    latestArrivalHour = null
  } = opts || {};

  const cabineFinal = classeViagem || cabine || 'economy';
  const hideTransferFinal = (hideSeparateAndSelfTransfer !== null && hideSeparateAndSelfTransfer !== undefined)
    ? Boolean(hideSeparateAndSelfTransfer)
    : true;

  const tfsPayload = gerarTfs({
    origens,
    destinos,
    dataIda,
    dataVolta: voltaEfetiva,
    maxDurationMinutes: maxMin,
    adultos,
    criancas,
    bebes,
    infantsInSeat,
    infantsOnLap,
    classeViagem: cabineFinal,
    maxStops,
    carryOnBags,
    checkedBags,
    maxPrice,
    hideSeparateAndSelfTransfer: hideTransferFinal,
    excludeBasicEconomy,
    airlines,
    connectingAirports,
    minLayoverMinutes,
    maxLayoverMinutes,
    earliestDepartureHour,
    latestDepartureHour,
    earliestArrivalHour,
    latestArrivalHour
  });

  const tfuPayload = (adultos > 1 || criancas > 0 || bebes > 0 || (cabineFinal && cabineFinal !== 'economy'))
    ? construirTfu(adultos, criancas, bebes, cabineFinal)
    : 'EgoIABAAGAAgAigD';

  const url = `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=${moedaEfetiva}&tfs=${tfsPayload}&tfu=${tfuPayload}`;

  return { url, tipoViagem, tfs: tfsPayload };
}

/**
 * Constrói a URL completa para busca no Google Flights (helper direto).
 */
export function construirUrlBuscaScrapling(origem, destino, dataIda, dataVolta = null, opcoesAvancadas = {}) {
  const opts = (opcoesAvancadas && typeof opcoesAvancadas === 'object') ? opcoesAvancadas : {};
  const res = construirUrlCheapest(origem, destino, dataIda, dataVolta, opts.duracaoMaxHoras || null, opts.moeda || 'BRL', opts);
  return res.url;
}

/**
 * Extrai { h, m } de um array de horário JSPB do Google Flights.
 * Suporta Sparse Time Arrays onde zeros são omitidos ou nulos:
 * - [8] -> { h: 8, m: 0 }
 * - [null, 31] -> { h: 0, m: 31 }
 * - [14, 5] -> { h: 14, m: 5 }
 * - [] -> { h: 0, m: 0 }
 */
export function extrairHoraMinutoTrecho(arr) {
  if (!Array.isArray(arr) || arr.length > 2) return null;
  const h = arr[0] ?? 0;
  const m = arr[1] ?? 0;
  if (typeof h !== 'number' || typeof m !== 'number' || !Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Formata horário de trecho (incluindo sparse arrays do JSPB) para string "HH:MM".
 * @param {Array<number|null>|null} arr
 * @returns {string|null}
 */
export function formatarHorarioTrecho(arr) {
  const hm = extrairHoraMinutoTrecho(arr);
  if (!hm) return null;
  return `${String(hm.h).padStart(2, '0')}:${String(hm.m).padStart(2, '0')}`;
}

/**
 * Formata um array de data [YYYY, M, D] do Google Flights em string ISO "YYYY-MM-DD".
 * @param {Array<number>|null} arr
 * @returns {string|null}
 */
export function formatarDataTrecho(arr) {
  if (!Array.isArray(arr) || arr.length < 3) return null;
  const [ano, mes, dia] = arr;
  if (
    typeof ano !== 'number' || !Number.isInteger(ano) || ano < 2000 || ano > 2100 ||
    typeof mes !== 'number' || !Number.isInteger(mes) || mes < 1 || mes > 12 ||
    typeof dia !== 'number' || !Number.isInteger(dia) || dia < 1 || dia > 31
  ) {
    return null;
  }
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Calcula quantos dias após a partida o voo pousa no destino final (ex: 0 = mesmo dia, 1 = +1 dia).
 * @param {string|null} dataPartidaIso
 * @param {string|null} dataChegadaIso
 * @returns {number}
 */
export function calcularDiasExtrasChegada(dataPartidaIso, dataChegadaIso) {
  if (typeof dataPartidaIso !== 'string' || typeof dataChegadaIso !== 'string') return 0;
  const tPartida = Date.parse(`${dataPartidaIso}T00:00:00Z`);
  const tChegada = Date.parse(`${dataChegadaIso}T00:00:00Z`);
  if (Number.isNaN(tPartida) || Number.isNaN(tChegada)) return 0;
  const diffDias = Math.round((tChegada - tPartida) / 86400000);
  return diffDias > 0 ? diffDias : 0;
}

/**
 * Extrai dados de emissão de carbono do bloco flight[22] (em gramas -> kg e variação percentual).
 * @param {Array|null} flight
 * @returns {{ kg: number|null, tipicaKg: number|null, variacaoPct: number|null }|null}
 */
export function extrairEmissoesCarbono(flight) {
  const extras = Array.isArray(flight?.[22]) ? flight[22] : null;
  if (!extras) return null;

  const gramas = typeof extras[7] === 'number' && Number.isFinite(extras[7]) && extras[7] > 0 ? extras[7] : null;
  const tipicaGramas = typeof extras[8] === 'number' && Number.isFinite(extras[8]) && extras[8] > 0 ? extras[8] : null;

  if (gramas === null && tipicaGramas === null) return null;

  const kg = gramas !== null ? Math.round(gramas / 1000) : null;
  const tipicaKg = tipicaGramas !== null ? Math.round(tipicaGramas / 1000) : null;
  const variacaoPct = (gramas !== null && tipicaGramas !== null && tipicaGramas > 0)
    ? Math.round(((gramas - tipicaGramas) / tipicaGramas) * 100)
    : null;

  return { kg, tipicaKg, variacaoPct };
}

/**
 * Extrai número de voo do trecho (legs[0][22]), ex: ["LA", "8004"] -> "LA 8004".
 * @param {Array|null} leg
 * @returns {string|null}
 */
export function extrairNumeroVooTrecho(leg) {
  if (!Array.isArray(leg) || !leg[22]) return null;
  const raw = leg[22];
  if (Array.isArray(raw)) {
    const cod = raw[0];
    const num = raw[1];
    if (cod && num) return `${String(cod).trim()} ${String(num).trim()}`.trim();
    if (cod) return String(cod).trim();
    if (num) return String(num).trim();
  } else if (typeof raw === 'string') {
    return raw.trim() || null;
  }
  return null;
}

/**
 * Calcula a diferença real em minutos entre a chegada do trecho anterior e a partida do seguinte.
 * Suporta sparse time arrays.
 * @param {Array|null} legChegada
 * @param {Array|null} legPartida
 * @returns {number|null}
 */
export function calcularTempoConexaoTrechos(legChegada, legPartida) {
  const hmChegada = extrairHoraMinutoTrecho(legChegada?.[10]);
  const hmPartida = extrairHoraMinutoTrecho(legPartida?.[8]);
  if (!hmChegada || !hmPartida) return null;

  const dataChegada = legChegada?.[21];
  const dataPartida = legPartida?.[20];

  if (
    Array.isArray(dataChegada) && dataChegada.length >= 3 &&
    Array.isArray(dataPartida) && dataPartida.length >= 3
  ) {
    const utcChegada = Date.UTC(dataChegada[0], dataChegada[1] - 1, dataChegada[2], hmChegada.h, hmChegada.m);
    const utcPartida = Date.UTC(dataPartida[0], dataPartida[1] - 1, dataPartida[2], hmPartida.h, hmPartida.m);
    const diffMin = Math.round((utcPartida - utcChegada) / 60000);
    return (diffMin >= 0 && diffMin <= 2880) ? diffMin : null;
  }

  let diffMin = (hmPartida.h * 60 + hmPartida.m) - (hmChegada.h * 60 + hmChegada.m);
  if (diffMin < 0) diffMin += 1440; // transição da meia-noite
  return (diffMin >= 0 && diffMin <= 1440) ? diffMin : null;
}

/**
 * Formata minutos em string amigável "Xh Ymin", "Xh" ou "Ymin".
 * @param {number|null} minutos
 * @returns {string|null}
 */
export function formatarTempoConexaoTexto(minutos) {
  if (!Number.isFinite(minutos) || minutos <= 0) return null;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * Extrai e faz o parse defensivo do array JSON contido em script.ds:1 ou AF_initDataCallback(ds:1).
 * Tolera tanto a captura do interior da tag `<script>` quanto a captura direta do array `data: [...]`.
 *
 * @param {string} html
 * @returns {Array|null}
 */
function extrairArrayPayloadDs1(html) {
  if (!html || typeof html !== 'string') return null;

  const matchScript = html.match(/<script[^>]*class=["'][^"']*ds:1[^"']*["'][^>]*>([\s\S]*?)<\/script>/i) ||
                      html.match(/AF_initDataCallback\s*\(\s*\{[^}]*?key:\s*['"]ds:1['"][\s\S]*?data:\s*(\[[\s\S]*?\])\s*(?:,\s*sideChannel\s*:[\s\S]*?)?\}\s*\)\s*;/i);
  if (!matchScript) return null;

  const scriptContent = (matchScript[1] || matchScript[0]).trim();
  let dataStr = '';

  if (scriptContent.startsWith('[')) {
    dataStr = scriptContent;
  } else {
    const idxData = scriptContent.indexOf('data:');
    if (idxData === -1) return null;

    const resto = scriptContent.slice(idxData + 5).trim();
    const idxSc = resto.lastIndexOf(', sideChannel:');
    const idxSc2 = resto.lastIndexOf(',sideChannel:');
    const corte = Math.max(idxSc, idxSc2);
    if (corte !== -1) {
      dataStr = resto.slice(0, corte).trim();
    } else {
      const lastComma = resto.lastIndexOf(',');
      dataStr = (lastComma !== -1 ? resto.slice(0, lastComma) : resto).trim();
    }
  }

  if (!dataStr.startsWith('[') || dataStr.includes('errorHasStatus: true')) {
    return null;
  }

  const dataStrLimpo = dataStr.replace(/^\s*\/\/.*$/gm, '');
  try {
    const parsed = JSON.parse(dataStrLimpo);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extrai voos diretamente do payload JSON nativo (script.ds:1 / AF_initDataCallback) do Google Flights.
 * Padrão de alta precisão absorvido do `fast-flights` (v3.0): extrai diretamente do modelo de dados interno
 * do Google sem dependência de seletores DOM, atributos aria-label ou variações linguísticas de layout.
 *
 * @param {string} html
 * @returns {Array<{preco:number, precoOriginal:number|null, moeda:string, moedaOriginal:string, cia:string, numeroVoo:string|null, horarioPartida:string|null, horarioChegada:string|null, duracaoTexto:string, duracaoHoras:number, escalas:number, detalhesEscalas:string, tempoConexao:string|null, tempoConexaoMinutos:number|null, aeroportoConexao:string|null, aeroportoOrigem:string|null, aeroportoDestino:string|null, isBest:boolean, bagagem:object}>}
 */
export function extrairVoosDoPayloadJs(html) {
  if (!html || typeof html !== 'string') return [];

  try {
    const payload = extrairArrayPayloadDs1(html);
    if (!Array.isArray(payload) || payload.length < 3) return [];

    const groups = [];
    for (const index of [2, 3]) {
      if (!Array.isArray(payload[index])) continue;
      for (const [bucket, list] of payload[index].entries()) {
        if (Array.isArray(list)) groups.push({ list, isBest: index === 2 && bucket === 0 });
      }
    }

    const voos = [];
    for (const group of groups) {
      const g = group.list;
      const isBest = group.isBest;
      if (!Array.isArray(g)) continue;
      for (const k of g) {
        if (!Array.isArray(k) || k.length < 2) continue;
        const flight = k[0];
        if (!Array.isArray(flight) || flight.length < 3) continue;
        const trechos = flight[2];
        if (typeof flight[0] !== 'string' || !Array.isArray(trechos) || trechos.length === 0 ||
            !trechos.every(t => Array.isArray(t) && typeof t[3] === 'string' && typeof t[6] === 'string')) continue;

        // Tarifa / Preço: inspeciona k[1][0] e, se ausente, varre todos os slots de k[1] (OTAs/parceiros da aba Cheapest)
        let fare = null;
        if (Array.isArray(k[1])) {
          for (const slot of k[1]) {
            if (Array.isArray(slot) && Number.isFinite(slot[1]) && slot[1] > 0) {
              fare = slot;
              break;
            }
          }
          if (!fare && Array.isArray(k[1][0])) {
            fare = k[1][0];
          }
        }

        const precoBruto = (Array.isArray(fare) && Number.isFinite(fare[1])) ? Math.round(fare[1]) : null;
        if (!precoBruto) continue;

        const taxaUsd = Number(process.env.USD_BRL_RATE) || 5.80;
        const taxaEur = Number(process.env.EUR_BRL_RATE) || 6.30;
        const taxaGbp = Number(process.env.GBP_BRL_RATE) || 7.40;
        const mapaTaxasParaBrl = { USD: taxaUsd, EUR: taxaEur, GBP: taxaGbp, BRL: 1 };

        let moedaDetectada = (fare && typeof fare[0] === 'string' && fare[0].trim()) ? fare[0].trim().toUpperCase() : null;
        if (!moedaDetectada && typeof flight[0] === 'string') {
          const f0Upper = flight[0].toUpperCase();
          if (mapaTaxasParaBrl[f0Upper]) moedaDetectada = f0Upper;
        }

        const moedaOrig = (moedaDetectada || 'BRL').toUpperCase();
        const fatorConversao = mapaTaxasParaBrl[moedaOrig] || 1;
        const ehUsd = moedaOrig === 'USD';
        const preco = Math.round(precoBruto * fatorConversao);
        if (preco < 80 || preco > 60000) continue;

        // Companhia aérea: flight[1] (array de nomes de cias) ou código do flight[0]
        const airlines = Array.isArray(flight[1]) ? flight[1] : [];
        let cia = (airlines[0] && typeof airlines[0] === 'string') ? airlines[0] : (flight[0] || 'Companhia Aérea');
        cia = limparNomeCompanhia(cia);

        // Fallback por código IATA se necessário
        if (MAPA_CIAS_IATA[cia.toUpperCase()]) {
          cia = MAPA_CIAS_IATA[cia.toUpperCase()];
        }

        // Duração total em minutos: flight[9]
        const durMin = Number.isFinite(flight[9]) && flight[9] > 0 ? flight[9] : null;
        const duracaoHoras = durMin ? Math.round((durMin / 60) * 10) / 10 : 12.0;
        const h = Math.floor(duracaoHoras);
        const m = durMin ? (durMin % 60) : 0;
        const duracaoTexto = durMin ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${duracaoHoras} h`;

        // Trechos / Escalas: flight[2]
        const legs = Array.isArray(flight[2]) ? flight[2] : [];
        const escalas = Math.max(0, legs.length - 1);
        let detalhesEscalas = 'Direto';
        let aeroportoConexao = null;
        let tempoConexao = null;
        let tempoConexaoMinutos = null;

        const horarioPartida = legs.length > 0 ? formatarHorarioTrecho(legs[0]?.[8]) : null;
        const horarioChegada = legs.length > 0 ? formatarHorarioTrecho(legs[legs.length - 1]?.[10]) : null;
        const dataPartida = legs.length > 0 ? formatarDataTrecho(legs[0]?.[20]) : null;
        const dataChegada = legs.length > 0 ? formatarDataTrecho(legs[legs.length - 1]?.[21]) : null;
        const diasExtrasChegada = calcularDiasExtrasChegada(dataPartida, dataChegada);
        const aeronaves = legs
          .map(leg => (typeof leg?.[17] === 'string' && leg[17].trim()) ? leg[17].trim() : null)
          .filter(Boolean);
        const aeronave = aeronaves[0] || null;
        const emissoes = extrairEmissoesCarbono(flight);
        const numeroVoo = legs.length > 0 ? extrairNumeroVooTrecho(legs[0]) : null;
        const aeroportoOrigem = (legs.length > 0 && typeof legs[0]?.[3] === 'string')
          ? legs[0][3].trim().toUpperCase()
          : null;
        const aeroportoDestino = (legs.length > 0 && typeof legs[legs.length - 1]?.[6] === 'string')
          ? legs[legs.length - 1][6].trim().toUpperCase()
          : null;

        if (escalas > 0) {
          const conexoesIatas = [];
          for (let i = 0; i < escalas; i++) {
            const legAnterior = legs[i];
            const legSeguinte = legs[i + 1];
            const iataConexao = (Array.isArray(legAnterior) && legAnterior[6]) ||
                                (Array.isArray(legSeguinte) && legSeguinte[3]);
            if (iataConexao && typeof iataConexao === 'string') {
              conexoesIatas.push(iataConexao.toUpperCase());
            }
          }
          aeroportoConexao = conexoesIatas[0] || null;
          detalhesEscalas = `${escalas} ${escalas === 1 ? 'parada' : 'paradas'}${aeroportoConexao ? ` em ${aeroportoConexao}` : ''}`;

          if (legs.length >= 2) {
            const minConexao = calcularTempoConexaoTrechos(legs[0], legs[1]);
            if (minConexao !== null) {
              tempoConexaoMinutos = minConexao;
              tempoConexao = formatarTempoConexaoTexto(minConexao);
            }
          }
        }

        voos.push({
          preco,
          precoOriginal: ehUsd ? precoBruto : null,
          moeda: 'BRL',
          moedaOriginal: moedaDetectada || 'BRL',
          cia,
          numeroVoo,
          horarioPartida,
          horarioChegada,
          dataPartida,
          dataChegada,
          diasExtrasChegada,
          aeronave,
          aeronaves,
          emissoes,
          duracaoTexto,
          duracaoHoras,
          escalas,
          detalhesEscalas,
          tempoConexao,
          tempoConexaoMinutos,
          aeroportoConexao,
          aeroportoOrigem,
          aeroportoDestino,
          isBest,
          bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
        });
      }
    }

    return voos;
  } catch {
    return [];
  }
}

/**
 * Extrai dados de termômetro de preço (priceInsights) do modelo de dados interno do Google (script ds:1).
 * Identifica o nível ('baixo' | 'tipico' | 'alto') e a faixa típica de tarifas (faixaMinima, faixaMaxima).
 *
 * @param {Array|string} payloadOuHtml
 * @returns {{ nivel: 'baixo'|'tipico'|'alto', faixaMinima: number|null, faixaMaxima: number|null, moeda: string, moedaOriginal: string } | null}
 */
export function extrairPriceInsightsDoPayloadJs(payloadOuHtml) {
  if (!payloadOuHtml) return null;

  let payload = payloadOuHtml;

  // Se receber string HTML, extrai o JSON da tag script ds:1
  if (typeof payloadOuHtml === 'string') {
    payload = extrairArrayPayloadDs1(payloadOuHtml);
  }

  if (!Array.isArray(payload) || payload.length < 3) return null;

  try {
    const normalizarNivel = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') {
        if (val === 1 || val === 0) return 'baixo';
        if (val === 2) return 'tipico';
        if (val === 3) return 'alto';
      }
      const str = String(val).toLowerCase().trim();
      if (str === 'low' || str === 'baixo' || str === 'lowest') return 'baixo';
      if (str === 'typical' || str === 'tipico' || str === 'médio' || str === 'medio') return 'tipico';
      if (str === 'high' || str === 'alto' || str === 'highest') return 'alto';
      return null;
    };

    const extrairParFaixa = (arr) => {
      if (!Array.isArray(arr)) return null;
      if (arr.length >= 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1]) && arr[0] > 0 && arr[1] > 0) {
        const min = Math.round(Math.min(arr[0], arr[1]));
        const max = Math.round(Math.max(arr[0], arr[1]));
        return { min, max };
      }
      if (Array.isArray(arr[0]) && arr[0].length >= 2 && Number.isFinite(arr[0][0]) && Number.isFinite(arr[0][1])) {
        const min = Math.round(Math.min(arr[0][0], arr[0][1]));
        const max = Math.round(Math.max(arr[0][0], arr[0][1]));
        return { min, max };
      }
      return null;
    };

    const candidatos = [payload[5], payload[4], payload[6]].filter(Boolean);

    for (const bloco of candidatos) {
      if (!Array.isArray(bloco)) continue;

      let nivelEncontrado = null;
      let faixaEncontrada = null;

      for (const item of bloco) {
        if (nivelEncontrado === null) {
          const nivel = normalizarNivel(item);
          if (nivel) {
            nivelEncontrado = nivel;
            continue;
          }
        }
        if (faixaEncontrada === null) {
          const faixa = extrairParFaixa(item);
          if (faixa) {
            faixaEncontrada = faixa;
            continue;
          }
        }
      }

      if (nivelEncontrado !== null || faixaEncontrada !== null) {
        const taxaUsd = Number(process.env.USD_BRL_RATE) || 5.80;
        let moedaDetectada = 'BRL';
        for (const item of bloco) {
          if (typeof item === 'string' && item.trim().toUpperCase() === 'USD') {
            moedaDetectada = 'USD';
            break;
          }
        }
        if (moedaDetectada !== 'USD') {
          try {
            const rawStr = JSON.stringify(bloco);
            if (rawStr.includes('"USD"') || rawStr.includes('USD')) {
              moedaDetectada = 'USD';
            }
          } catch (_) {}
        }
        const ehUsd = moedaDetectada === 'USD';
        const faixaMinima = faixaEncontrada ? (ehUsd ? Math.round(faixaEncontrada.min * taxaUsd) : faixaEncontrada.min) : null;
        const faixaMaxima = faixaEncontrada ? (ehUsd ? Math.round(faixaEncontrada.max * taxaUsd) : faixaEncontrada.max) : null;

        return {
          nivel: nivelEncontrado || 'tipico',
          faixaMinima,
          faixaMaxima,
          moeda: 'BRL',
          moedaOriginal: moedaDetectada
        };
      }
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Extrai lista de voos detalhados do HTML do Google Flights.
 * Multicamada: Camada 0 (JSON ds:1 nativo / fast-flights) → Camada A (aria-label rico) → fallback simples → BRL raw.
 *
 * @param {string} html
 * @returns {Array<{preco:number, cia:string, duracaoTexto:string, duracaoHoras:number, escalas:number, detalhesEscalas:string, tempoConexao:string|null, aeroportoConexao:string|null, bagagem:object}>}
 */
export function extrairVoosDoHtml(html) {
  // Camada 0: Extração direta via payload JSON nativo (script.ds:1 / fast-flights)
  const voosJs = extrairVoosDoPayloadJs(html);
  if (voosJs && voosJs.length > 0) {
    return voosJs;
  }

  const voos = [];
  const taxaUsd = Number(process.env.USD_BRL_RATE) || 5.80;

  // Camada A: Blocos completos com preço, cia, duração e detalhes
  const regexAriaBloco = /aria-label=["']((?:[^"']|\\.)*?(?:Preço total a partir de|A partir de|Total price from|From)\s*(?:(?:R\$|BRL|US\$|U\$S|USD|(?<!R)\$)\s*[0-9.,\s]+|[0-9.,\s]+?\s*(?:Reais brasileiros|BRL|reais|Brazilian reals|USD|EUR|US dollars|euros|dólares|dolares))(?:[^"']|\\.)*?)["']/gi;
  let m;

  while ((m = regexAriaBloco.exec(html)) !== null) {
    const ariaTexto = m[1];
    if (PADROES_IGNORAR_RODAPE.test(ariaTexto)) continue;
    const matchPreco = ariaTexto.match(/(?:Preço total a partir de|A partir de|Total price from|From)\s*(?:(?:R\$|BRL|US\$|U\$S|USD|(?<!R)\$)\s*([0-9.,\s]+?)(?=\s*[^\d.,]|$)|([0-9.,\s]+?)\s*(?:Reais brasileiros|BRL|reais|Brazilian reals|USD|EUR|US dollars|euros|dólares|dolares))/i);
    const precoBruto = matchPreco ? extrairPrecoNumerico(matchPreco[1] || matchPreco[2]) : null;
    if (!precoBruto) continue;

    // Prevenção de Dupla Conversão: avalia primeiro se é BRL
    const ehBrl = /R\$|BRL|\breais\b|Brazilian reals/i.test(ariaTexto);
    const ehUsd = !ehBrl && /(?:US\$|U\$S|\bUSD\b|US dollars|\bdolares\b|\bdólares\b|(?<!R)\$)/i.test(ariaTexto);
    const preco = ehUsd ? Math.round(precoBruto * taxaUsd) : precoBruto;
    if (preco < 80 || preco > 60000) continue;

    // Contexto HTML adjacente para bagagem e escalas
    const posIni = Math.max(0, m.index - 250);
    const posFim = Math.min(html.length, m.index + m[0].length + 900);
    const trecho = html.slice(posIni, posFim);
    if (PADROES_IGNORAR_RODAPE.test(trecho)) continue;

    // Companhia aérea
    let ciaBruta = 'Companhia Aérea';
    const mCia = ariaTexto.match(/(?:Voo|Flight)\s*(?:[^.]*?)\s*(?:da|with|operado por|operated by)\s*([^.]+?)(?:\.|$)/i) ||
                 ariaTexto.match(/(?:Voo|Flight)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\.|com\s|\s+direto)/i);
    if (mCia) ciaBruta = mCia[1].trim();
    let cia = limparNomeCompanhia(ciaBruta);

    // Se a cia for um código de voo (ex: "G3 1542" ou "LA 3210") ou código IATA isolado ("G3", "LA")
    const matchCodVoo = cia.match(/^([A-Za-z0-9]{2})(?:\s*\d{1,4})?$/i);
    if (matchCodVoo && MAPA_CIAS_IATA[matchCodVoo[1].toUpperCase()]) {
      cia = MAPA_CIAS_IATA[matchCodVoo[1].toUpperCase()];
    }

    // Fallback defensivo por código IATA (data-*, logos, matrizes de voos) quando o nome for genérico
    if (cia === 'Companhia Aérea') {
      const ciaIata = extrairCiaIataDoTrecho(trecho, ariaTexto);
      if (ciaIata) {
        cia = ciaIata;
      }
    }

    // Duração
    let durTexto = '12 h';
    const mDur = ariaTexto.match(/(?:Duração total:|Total duration:)\s*([^.]+?)(?:\.|$)/i);
    if (mDur) {
      durTexto = mDur[1].trim();
    } else {
      const mDurH = trecho.match(/(?:Duração total:|Total duration:)\s*([^<.]+?)(?:<|\.|$)/i);
      if (mDurH) durTexto = mDurH[1].trim();
    }
    const duracaoHoras = converterDuracaoParaHoras(durTexto);

    // Conexões/escalas
    let conexoes = extrairInfoConexoes(ariaTexto);
    if (conexoes.escalas === 0 && !/direto|sem\s+escalas|sem\s+paradas|nonstop/i.test(ariaTexto)) {
      const mEscH = trecho.match(/(?:aria-label=["']|>)\s*(\d+\s*(?:parada|escala|stop)s?(?:\s*(?:em|no|na|at|in)\s*[^<"']+?)?)/i);
      if (mEscH) conexoes = extrairInfoConexoes(mEscH[1]);
    }

    // Bagagem
    let bagagem = extrairInfoBagagem(ariaTexto);
    if (!bagagem.texto) {
      const mBag = trecho.match(/(?:aria-label=["']|>)\s*([^<"']*?(?:bagagem|mala|carry-on|checked\s+bag|item\s+pessoal)[^<"']*?)(?:["']|<)/i);
      if (mBag) bagagem = extrairInfoBagagem(mBag[1]);
    }

    voos.push({
      preco,
      cia,
      numeroVoo: null,
      horarioPartida: null,
      horarioChegada: null,
      duracaoTexto: durTexto,
      duracaoHoras,
      escalas: conexoes.escalas,
      detalhesEscalas: conexoes.detalhesEscalas,
      tempoConexao: conexoes.tempoConexao,
      tempoConexaoMinutos: null,
      aeroportoConexao: conexoes.aeroportoConexao,
      aeroportoOrigem: null,
      aeroportoDestino: null,
      isBest: false,
      bagagem
    });
  }

  // Camada B: Fallback aria-label simples com preço e currency
  if (voos.length === 0) {
    const regexSimples = /aria-label=["'](?:Preço total a partir de|A partir de)?\s*(?:R\$|BRL|US\$|U\$S|USD|(?<!R)\$)?\s*([0-9.,\s]+?)\s*(?:Reais brasileiros|BRL|reais|Brazilian reals|USD|US dollars|dólares|dolares)?["']/gi;
    let ms;
    while ((ms = regexSimples.exec(html)) !== null) {
      if (PADROES_IGNORAR_RODAPE.test(ms[0])) continue;
      const matchPrecoSimples = ms[0].match(/([0-9.,\s]+)/);
      const precoBruto = matchPrecoSimples ? extrairPrecoNumerico(matchPrecoSimples[1]) : null;
      if (!precoBruto) continue;

      const ehBrl = /R\$|BRL|\breais\b|Brazilian reals/i.test(ms[0]);
      const ehUsd = !ehBrl && /(?:US\$|U\$S|\bUSD\b|US dollars|\bdolares\b|\bdólares\b|(?<!R)\$)/i.test(ms[0]);
      const preco = ehUsd ? Math.round(precoBruto * taxaUsd) : precoBruto;
      if (preco >= 80 && preco <= 60000) {
        const posIni = Math.max(0, ms.index - 250);
        const posFim = Math.min(html.length, ms.index + ms[0].length + 900);
        const trecho = html.slice(posIni, posFim);
        if (PADROES_IGNORAR_RODAPE.test(trecho)) continue;
        const cia = extrairCiaIataDoTrecho(trecho, ms[0]) || 'Companhia Aérea';
        voos.push({
          preco,
          cia,
          numeroVoo: null,
          horarioPartida: null,
          horarioChegada: null,
          duracaoTexto: '12 h',
          duracaoHoras: 12.0,
          escalas: 0,
          detalhesEscalas: 'Direto',
          tempoConexao: null,
          tempoConexaoMinutos: null,
          aeroportoConexao: null,
          aeroportoOrigem: null,
          aeroportoDestino: null,
          isBest: false,
          bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
        });
      }
    }
  }

  // Camada C: Fallback BRL/R$ raw no HTML (prioridade mandatória para R$)
  if (voos.length === 0) {
    const regexBRL = /(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)/gi;
    let mb;
    while ((mb = regexBRL.exec(html)) !== null) {
      const posIni = Math.max(0, mb.index - 250);
      const posFim = Math.min(html.length, mb.index + mb[0].length + 900);
      const trecho = html.slice(posIni, posFim);
      if (PADROES_IGNORAR_RODAPE.test(trecho)) continue;
      const num = parseFloat(mb[1].replace(/\./g, ''));
      if (num >= 80 && num <= 60000) {
        const cia = extrairCiaIataDoTrecho(trecho, mb[0]) || 'Companhia Aérea';
        voos.push({
          preco: num,
          cia,
          numeroVoo: null,
          horarioPartida: null,
          horarioChegada: null,
          duracaoTexto: '12 h',
          duracaoHoras: 12.0,
          escalas: 0,
          detalhesEscalas: 'Direto',
          tempoConexao: null,
          tempoConexaoMinutos: null,
          aeroportoConexao: null,
          aeroportoOrigem: null,
          aeroportoDestino: null,
          isBest: false,
          bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
        });
      }
    }

    // Se nenhum preço em R$ for encontrado no HTML, busca marcadores explícitos de USD (US$, U$S, USD)
    // Evita `(?<!R)\$` isolado para não capturar variáveis JS minificadas como `$100`
    if (voos.length === 0) {
      const regexUSD = /(?:US\$|U\$S|\bUSD\b)\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)/gi;
      let mu;
      while ((mu = regexUSD.exec(html)) !== null) {
        const posIni = Math.max(0, mu.index - 250);
        const posFim = Math.min(html.length, mu.index + mu[0].length + 900);
        const trecho = html.slice(posIni, posFim);
        if (PADROES_IGNORAR_RODAPE.test(trecho)) continue;
        const numBruto = parseFloat(mu[1].replace(/\./g, ''));
        const numConvertido = Math.round(numBruto * taxaUsd);
        if (numConvertido >= 80 && numConvertido <= 60000) {
          const cia = extrairCiaIataDoTrecho(trecho, mu[0]) || 'Companhia Aérea';
          voos.push({
            preco: numConvertido,
            precoOriginal: numBruto,
            moeda: 'BRL',
            moedaOriginal: 'USD',
            cia,
            numeroVoo: null,
            horarioPartida: null,
            horarioChegada: null,
            duracaoTexto: '12 h',
            duracaoHoras: 12.0,
            escalas: 0,
            detalhesEscalas: 'Direto',
            tempoConexao: null,
            tempoConexaoMinutos: null,
            aeroportoConexao: null,
            aeroportoOrigem: null,
            aeroportoDestino: null,
            isBest: false,
            bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
          });
        }
      }
    }
  }

  return voos;
}

/**
 * ScraplingProvider — Provedor de scraping resiliente para Google Flights.
 *
 * Fluxo de operação:
 * 1. Constrói URL da aba Cheapest com payload Protobuf tfs (One-Way ou Round-Trip).
 * 2. Executa requisição HTTP com headers stealth e jitter de delay.
 * 3. Detecta bloqueio de bot → retry com novo perfil stealth.
 * 4. Extrai preço da aba Cheapest do HTML (regex multicamada).
 * 5. Extrai lista de voos detalhados (JSON ds:1 → aria-label → BRL fallback).
 * 6. Retorna resultado compatível com FlightProviderManager.
 *
 * Em caso de bloqueio persistente, retorna { ok: false } para acionar failover SerpAPI.
 */
export class ScraplingProvider extends FlightProviderInterface {
  constructor() {
    super('Scrapling Stealth (Google Flights Cheapest)');
    this.ativo = true;
    this._ultimoPerfilIdx = -1;
    this._requisicoesCiclo = 0;
  }

  estaDisponivel() {
    return this.ativo;
  }

  /**
   * Busca ofertas via scraping stealth do Google Flights com payload tfs Cheapest.
   *
   * @param {Object} params
   * @param {string} params.origemCod
   * @param {string} params.destinoCod
   * @param {string} params.dataIda
   * @param {string|null} params.dataVolta
   * @param {number} [params.duracaoMaxHoras]
   * @param {string} [params.cabine]
   * @param {number} [params.adultos]
   * @param {string} [params.moeda]
   * @param {string} [params.curr]
   * @returns {Promise<{ok:boolean, encontrouVoos?:boolean, oferta?:object, erro?:boolean, mensagemErro?:string}>}
   */
  async buscarOfertas({
    origemCod,
    destinoCod,
    dataIda,
    dataVolta = null,
    duracaoMaxHoras = 999,
    cabine = 'economy',
    adultos = 1,
    moeda = 'BRL',
    curr = null,
    criancas = 0,
    bebes = 0,
    infantsInSeat = null,
    infantsOnLap = null,
    maxStops = null,
    carryOnBags = null,
    checkedBags = null,
    maxPrice = null,
    hideSeparateAndSelfTransfer = null,
    excludeBasicEconomy = null,
    airlines = null,
    connectingAirports = null,
    minLayoverMinutes = null,
    maxLayoverMinutes = null,
    earliestDepartureHour = null,
    latestDepartureHour = null,
    earliestArrivalHour = null,
    latestArrivalHour = null
  }) {
    // Validação de entrada defensiva
    if (!origemCod || !destinoCod || !dataIda) {
      return { ok: false, erro: true, mensagemErro: 'ScraplingProvider: parâmetros de busca incompletos (origemCod, destinoCod e dataIda são obrigatórios).' };
    }

    const moedaEfetiva = (curr || moeda || 'BRL').trim().toUpperCase();

    // Constrói URL Cheapest com distinção One-Way vs Round-Trip e propagação de filtros avançados
    const { url: urlCheapest, tipoViagem } = construirUrlCheapest(
      origemCod,
      destinoCod,
      dataIda,
      dataVolta,
      duracaoMaxHoras,
      moedaEfetiva,
      {
        adultos,
        criancas,
        bebes,
        infantsInSeat,
        infantsOnLap,
        classeViagem: cabine,
        maxStops,
        carryOnBags,
        checkedBags,
        maxPrice,
        hideSeparateAndSelfTransfer,
        excludeBasicEconomy,
        airlines,
        connectingAirports,
        minLayoverMinutes,
        maxLayoverMinutes,
        earliestDepartureHour,
        latestDepartureHour,
        earliestArrivalHour,
        latestArrivalHour
      }
    );

    // Link canônico de fallback para exibição
    const linkCanônico = dataIda
      ? gerarLinkGoogleFlightsCheapest(
          origemCod,
          destinoCod,
          dataIda,
          dataVolta,
          duracaoMaxHoras,
          adultos,
          criancas,
          cabine,
          moedaEfetiva,
          {
            bebes,
            infantsInSeat,
            infantsOnLap,
            maxStops,
            carryOnBags,
            checkedBags,
            maxPrice,
            hideSeparateAndSelfTransfer,
            excludeBasicEconomy,
            airlines,
            connectingAirports,
            minLayoverMinutes,
            maxLayoverMinutes,
            earliestDepartureHour,
            latestDepartureHour,
            earliestArrivalHour,
            latestArrivalHour
          }
        ) || gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta, moedaEfetiva)
      : gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta, moedaEfetiva);

    let ultimoErro = 'Nenhuma tentativa realizada';

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      // Jitter de delay scrapling (exceto na primeira tentativa fria)
      if (tentativa > 0) {
        await jitterDelay(JITTER_MIN_MS, JITTER_MAX_MS);
      }

      // Rotação de perfil stealth diferente a cada tentativa
      const { perfil, idx } = selecionarPerfilStealth(this._ultimoPerfilIdx);
      this._ultimoPerfilIdx = idx;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      try {
        const resp = await fetch(urlCheapest, {
          headers: montarHeaders(perfil),
          signal: controller.signal,
          redirect: 'follow'
        });

        clearTimeout(timeoutId);
        this._requisicoesCiclo++;

        let respOk = resp.ok;
        let html = respOk ? await resp.text() : '';

        // Se detectar bloqueio anti-bot ou HTML vazio e primp estiver disponível no sistema (produção/live),
        // aciona failover instantâneo para TLS Impersonation de Chrome 145 (padrão primp / fast-flights)
        if (process.env.NODE_ENV !== 'test' && (detectarBloqueioBot(resp) || html.length < 5000) && await verificarPrimpDisponivel()) {
          const resPrimp = await fetchComPrimpTls(urlCheapest, { timeoutMs: HTTP_TIMEOUT_MS });
          if (resPrimp.ok && resPrimp.text.length > 5000) {
            html = resPrimp.text;
            respOk = true;
          }
        }

        // Detecção de bloqueio anti-bot persistente → retry imediato com novo perfil
        if (detectarBloqueioBot(resp) && !respOk) {
          ultimoErro = `Bloqueio anti-bot detectado (HTTP ${resp.status}, URL: ${resp.url}) — tentativa ${tentativa + 1}/${MAX_TENTATIVAS}`;
          continue;
        }

        if (!respOk) {
          ultimoErro = `HTTP ${resp.status} na tentativa ${tentativa + 1}`;
          continue;
        }

        // Extração do preço da aba Cheapest (camadas 1-3 no HTML + camada 4 via URL de resposta/tfu)
        const precoCheapest = extrairPrecoCheapestTab(html, resp.url);

        // Extração da lista de voos detalhados
        const voosDetalhados = extrairVoosDoHtml(html);

        if (voosDetalhados.length === 0 && !precoCheapest) {
          ultimoErro = `HTML sem preços extraíveis na tentativa ${tentativa + 1} — acionar fallback SerpAPI.`;
          continue;
        }

        // Filtragem por duração máxima
        const duracaoMax = duracaoMaxHoras && duracaoMaxHoras > 0 && duracaoMaxHoras < 900
          ? duracaoMaxHoras
          : 999;

        let listaFinal = voosDetalhados.filter(v => v.duracaoHoras <= duracaoMax);
        if (listaFinal.length === 0) listaFinal = voosDetalhados;
        listaFinal.sort((a, b) => a.preco - b.preco);

        // Composição da melhor oferta
        let melhorOferta = listaFinal.length > 0 ? { ...listaFinal[0] } : null;
        let ehCheapestTab = false;

        if (precoCheapest) {
          if (!melhorOferta || precoCheapest < melhorOferta.preco) {
            // A aba Cheapest encontrou tarifa menor que qualquer voo parseado
            if (melhorOferta) {
              melhorOferta.precoOriginal = melhorOferta.preco;
              melhorOferta.preco = precoCheapest;
            } else {
              melhorOferta = {
                preco: precoCheapest,
                cia: 'Companhia Aérea',
                duracaoTexto: '12 h',
                duracaoHoras: 12.0,
                escalas: 0,
                detalhesEscalas: 'Direto',
                tempoConexao: null,
                aeroportoConexao: null,
                aeroportoOrigem: null,
                aeroportoDestino: null,
                bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
              };
            }
            ehCheapestTab = true;
          }
        }

        if (!melhorOferta) {
          ultimoErro = 'Nenhuma oferta válida extraída do HTML.';
          continue;
        }

        // Composição do texto de detalhes do voo
        const partesDetalhes = [melhorOferta.cia];
        if (melhorOferta.detalhesEscalas) partesDetalhes.push(melhorOferta.detalhesEscalas);
        partesDetalhes.push(`Duração: ${melhorOferta.duracaoTexto}`);
        if (melhorOferta.bagagem?.texto) partesDetalhes.push(melhorOferta.bagagem.texto);

        // Badge de tipo de viagem (One-Way vs Round-Trip)
        partesDetalhes.push(tipoViagem === 'one_way' ? 'Só Ida' : 'Ida e Volta');

        if (ehCheapestTab) {
          partesDetalhes.push(`Menor Tarifa (Aba Cheapest Google Flights: R$ ${melhorOferta.preco})`);
        } else {
          partesDetalhes.push('Tarifa Scrapling Stealth');
        }

        const detalhesVoo = partesDetalhes.join(' | ');

        // Top 3 ofertas estruturadas
        const topOfertas = listaFinal.slice(0, 3).map(v => ({
          preco: v.preco,
          cia: v.cia,
          numeroVoo: v.numeroVoo ?? null,
          horarioPartida: v.horarioPartida ?? null,
          horarioChegada: v.horarioChegada ?? null,
          duracaoTexto: v.duracaoTexto,
          duracaoHoras: v.duracaoHoras,
          escalas: v.escalas ?? 0,
          detalhesEscalas: v.detalhesEscalas || 'Direto',
          tempoConexao: v.tempoConexao ?? null,
          aeroportoConexao: v.aeroportoConexao ?? null,
          aeroportoOrigem: v.aeroportoOrigem ?? null,
          aeroportoDestino: v.aeroportoDestino ?? null,
          isBest: Boolean(v.isBest)
        }));

        // Comparativo "Mais Barato vs. Melhor Voo Direto/Rápido":
        // Se a melhorOferta tiver conexão (escalas > 0), busca a opção direta mais barata
        // ou uma opção significativamente mais rápida.
        let melhorOpcaoDiretaOuRapida = null;
        if (melhorOferta.escalas > 0) {
          const opcaoDireta = listaFinal.find(v => v.escalas === 0);
          const opcaoCandidata = opcaoDireta || listaFinal.find(v => v.duracaoHoras <= melhorOferta.duracaoHoras - 1.0);
          if (opcaoCandidata && (opcaoCandidata.preco !== melhorOferta.preco || opcaoCandidata.duracaoHoras !== melhorOferta.duracaoHoras)) {
            const diferencaPreco = opcaoCandidata.preco - melhorOferta.preco;
            const economiaHoras = Math.round((melhorOferta.duracaoHoras - opcaoCandidata.duracaoHoras) * 10) / 10;
            melhorOpcaoDiretaOuRapida = {
              preco: opcaoCandidata.preco,
              cia: opcaoCandidata.cia,
              numeroVoo: opcaoCandidata.numeroVoo ?? null,
              horarioPartida: opcaoCandidata.horarioPartida ?? null,
              horarioChegada: opcaoCandidata.horarioChegada ?? null,
              duracaoTexto: opcaoCandidata.duracaoTexto,
              duracaoHoras: opcaoCandidata.duracaoHoras,
              escalas: opcaoCandidata.escalas ?? 0,
              detalhesEscalas: opcaoCandidata.detalhesEscalas || 'Direto',
              tempoConexao: opcaoCandidata.tempoConexao ?? null,
              aeroportoConexao: opcaoCandidata.aeroportoConexao ?? null,
              aeroportoOrigem: opcaoCandidata.aeroportoOrigem ?? null,
              aeroportoDestino: opcaoCandidata.aeroportoDestino ?? null,
              isBest: Boolean(opcaoCandidata.isBest),
              diferencaPreco,
              economiaHoras
            };
          }
        }

        const iataDestReal = melhorOferta.aeroportoDestino || null;
        const destinoRealResolvido = (iataDestReal && NOMES_CIDADES_IATA && NOMES_CIDADES_IATA[iataDestReal])
          ? NOMES_CIDADES_IATA[iataDestReal]
          : (iataDestReal || destinoCod);

        return {
          ok: true,
          encontrouVoos: true,
          oferta: {
            preco: melhorOferta.preco,
            cia: melhorOferta.cia,
            moeda: moedaEfetiva,
            precoOriginal: melhorOferta.precoOriginal,
            duracaoHoras: melhorOferta.duracaoHoras,
            codigoDestinoReal: iataDestReal || destinoCod,
            destinoReal: destinoRealResolvido,
            aeroportoOrigemReal: melhorOferta.aeroportoOrigem || origemCod,
            termometro: '🟢 Preço Mais Barato (Scrapling Cheapest)',
            nivelPreco: 'low',
            detalhes: detalhesVoo,
            dicaStopover: '-',
            link: linkCanônico,
            provedor: this.nome,
            tipoViagem,
            escalas: melhorOferta.escalas ?? 0,
            detalhesEscalas: melhorOferta.detalhesEscalas || 'Direto',
            tempoConexao: melhorOferta.tempoConexao || null,
            aeroportoConexao: melhorOferta.aeroportoConexao || null,
            horarioPartida: melhorOferta.horarioPartida || null,
            horarioChegada: melhorOferta.horarioChegada || null,
            numeroVoo: melhorOferta.numeroVoo || null,
            bagagem: melhorOferta.bagagem || null,
            cheapestTabAtivada: ehCheapestTab,
            topOfertas,
            melhorOpcaoDiretaOuRapida,
            priceInsights: extrairPriceInsightsDoPayloadJs(html) || null,
            amostraVoos: voosDetalhados.slice(0, 10).map(v =>
              `${v.cia}: R$ ${v.preco} (${v.duracaoTexto}, ${v.detalhesEscalas || 'Direto'}${v.bagagem?.texto ? ', ' + v.bagagem.texto : ''})`
            )
          }
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          ultimoErro = `Timeout de ${HTTP_TIMEOUT_MS}ms na tentativa ${tentativa + 1}`;
        } else {
          ultimoErro = `Erro de rede na tentativa ${tentativa + 1}: ${err.message}`;
        }
      }
    }

    // Todas as tentativas falharam → aciona failover para SerpAPI
    return {
      ok: false,
      erro: true,
      mensagemErro: `ScraplingProvider falhou após ${MAX_TENTATIVAS} tentativas. Último erro: ${ultimoErro}`
    };
  }

  /** Estatísticas de uso do provedor */
  obterEstatisticas() {
    return {
      provedor: this.nome,
      requisicoesCiclo: this._requisicoesCiclo,
      ativo: this.ativo
    };
  }
}

export default ScraplingProvider;
