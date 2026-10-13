import { FlightProviderInterface } from './flight_provider_interface.js';
import {
  gerarLinkGoogleFlightsCheapest,
  gerarLinkGoogleFlights,
  gerarTfs,
  normalizarParaSerpApi,
  resolverCodigoParaLink,
  ehSoIda
} from '../../domain/rotas.js';
import {
  extrairPrecoNumerico,
  limparNomeCompanhia,
  converterDuracaoParaHoras,
  extrairInfoConexoes,
  extrairInfoBagagem
} from './google_flights_direct_provider.js';

/**
 * ScraplingClient v1.0 — Adaptador de Scraping Resiliente para Google Flights
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
const COOKIE_CONSENT = 'SOCS=CAISHAgBEhJnd3NfMjAyNDA5MTAtMF9SQzIaAnB0IAEaBgiA_L22Bg; 1P_JAR=2026-10-12-15; NID=511=Qn_gKlhOXVhGj9RTYA';

/** Tempo mínimo de jitter em ms entre tentativas (padrão scrapling anti-bot) */
const JITTER_MIN_MS = 800;
/** Tempo máximo de jitter em ms */
const JITTER_MAX_MS = 2400;
/** Timeout de conexão HTTP por tentativa */
const HTTP_TIMEOUT_MS = 15000;
/** Número máximo de tentativas com rotação de perfil */
const MAX_TENTATIVAS = 2;

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
function montarHeaders(perfil) {
  const ip = IPS_BRASIL[Math.floor(Math.random() * IPS_BRASIL.length)];
  return {
    'User-Agent': perfil.ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': perfil.chUa,
    'Sec-Ch-Ua-Full-Version-List': perfil.chUaFull,
    'Sec-Ch-Ua-Mobile': perfil.mobile,
    'Sec-Ch-Ua-Platform': perfil.platform,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
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
 * Extrai preço da aba Cheapest do Google Flights a partir do HTML raw.
 *
 * O Google Flights embute o menor preço da aba "Cheapest" em um array JS
 * no formato: [[null, PRECO], "...comprehensiveness_lure..."]
 * que é codificado em base64 dentro do parâmetro tfu da URL.
 *
 * Regex multicamada para capturar variações de formato encontradas em campo.
 *
 * @param {string} html
 * @returns {number|null}
 */
export function extrairPrecoCheapestTab(html) {
  if (!html) return null;

  // Camada 1: Padrão canônico com comprehensiveness_lure — tolerante a espaços extras
  const r1 = /\[\[null,\s*(\d+)\s*\]\s*,\s*"[^"]*(?:comprehensiveness_lure|EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl)[^"]*"/i;
  const m1 = html.match(r1);
  if (m1) {
    const p = parseInt(m1[1], 10);
    if (p >= 80 && p <= 60000) return p;
  }

  // Camada 2: Padrão ampliado — captura [[null,NUM],"base64long"] em qualquer contexto de callback
  const r2 = /\[\[null,\s*(\d{3,6})\s*\]\s*,\s*"[A-Za-z0-9+/=_-]{20,}"/;
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

  return null;
}

/**
 * Constrói URL para a aba Cheapest do Google Flights com Protobuf tfs,
 * garantindo distinção precisa entre One-Way e Round-Trip no payload binário.
 *
 * @param {string} origemCod - Código de origem (IATA ou metrópole)
 * @param {string} destinoCod - Código de destino (IATA, metrópole ou KGMID)
 * @param {string} dataIda - Data de ida YYYY-MM-DD
 * @param {string|null} dataVolta - Data de volta YYYY-MM-DD, ou null/string de só-ida
 * @param {number|null} duracaoMaxHoras - Duração máxima em horas (filtro opcional)
 * @returns {{ url: string, tipoViagem: 'one_way'|'round_trip', tfs: string }}
 */
export function construirUrlCheapest(origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = null) {
  const origResolvido = resolverCodigoParaLink(origemCod);
  const destResolvido = resolverCodigoParaLink(destinoCod);

  const origens = normalizarParaSerpApi(origResolvido).split(',').map(s => s.trim()).filter(Boolean);
  const destinos = normalizarParaSerpApi(destResolvido).split(',').map(s => s.trim()).filter(Boolean);

  // Determinação canônica do tipo de viagem
  const voltaEfetiva = ehSoIda(dataVolta) ? null : dataVolta;
  const tipoViagem = voltaEfetiva ? 'round_trip' : 'one_way';

  const maxMin = duracaoMaxHoras && duracaoMaxHoras > 0 && duracaoMaxHoras < 900
    ? Math.round(duracaoMaxHoras * 60)
    : null;

  const tfsPayload = gerarTfs({
    origens,
    destinos,
    dataIda,
    dataVolta: voltaEfetiva,
    maxDurationMinutes: maxMin
  });

  const url = `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL&tfs=${tfsPayload}&tfu=EgoIABAAGAAgAigD`;

  return { url, tipoViagem, tfs: tfsPayload };
}

/**
 * Extrai lista de voos detalhados do HTML do Google Flights.
 * Multicamada: aria-label rico → fallback aria-label simples → BRL raw.
 *
 * @param {string} html
 * @returns {Array<{preco:number, cia:string, duracaoTexto:string, duracaoHoras:number, escalas:number, detalhesEscalas:string, tempoConexao:string|null, aeroportoConexao:string|null, bagagem:object}>}
 */
export function extrairVoosDoHtml(html) {
  const voos = [];

  // Camada A: Blocos completos com preço, cia, duração e detalhes
  const regexAriaBloco = /aria-label=["']((?:[^"']|\\.)*?(?:Preço total a partir de|A partir de|Total price from|From)\s*[0-9.,\s]+?\s*(?:Reais brasileiros|BRL|reais|Brazilian reals)(?:[^"']|\\.)*?)["']/gi;
  let m;

  while ((m = regexAriaBloco.exec(html)) !== null) {
    const ariaTexto = m[1];
    const matchPreco = ariaTexto.match(/(?:Preço total a partir de|A partir de|Total price from|From)\s*([0-9.,\s]+?)\s*(?:Reais brasileiros|BRL|reais|Brazilian reals)/i);
    const preco = matchPreco ? extrairPrecoNumerico(matchPreco[1]) : null;
    if (!preco || preco < 80 || preco > 60000) continue;

    // Contexto HTML adjacente para bagagem e escalas
    const posIni = Math.max(0, m.index - 250);
    const posFim = Math.min(html.length, m.index + m[0].length + 900);
    const trecho = html.slice(posIni, posFim);

    // Companhia aérea
    let ciaBruta = 'Companhia Aérea';
    const mCia = ariaTexto.match(/(?:Voo|Flight)\s*(?:[^.]*?)\s*(?:da|with|operado por|operated by)\s*([^.]+?)(?:\.|$)/i) ||
                 ariaTexto.match(/(?:Voo|Flight)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\.|com\s|\s+direto)/i);
    if (mCia) ciaBruta = mCia[1].trim();
    const cia = limparNomeCompanhia(ciaBruta);

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
      duracaoTexto: durTexto,
      duracaoHoras,
      escalas: conexoes.escalas,
      detalhesEscalas: conexoes.detalhesEscalas,
      tempoConexao: conexoes.tempoConexao,
      aeroportoConexao: conexoes.aeroportoConexao,
      bagagem
    });
  }

  // Camada B: Fallback aria-label simples com preço e currency
  if (voos.length === 0) {
    const regexSimples = /aria-label=["'](?:Preço total a partir de|A partir de)?\s*([0-9.,\s]+?)\s*Reais brasileiros["']/gi;
    let ms;
    while ((ms = regexSimples.exec(html)) !== null) {
      const preco = extrairPrecoNumerico(ms[1]);
      if (preco && preco >= 80 && preco <= 60000) {
        voos.push({
          preco,
          cia: 'Companhia Aérea',
          duracaoTexto: '12 h',
          duracaoHoras: 12.0,
          escalas: 0,
          detalhesEscalas: 'Direto',
          tempoConexao: null,
          aeroportoConexao: null,
          bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
        });
      }
    }
  }

  // Camada C: Fallback BRL/R$ raw no HTML
  if (voos.length === 0) {
    const regexBRL = /(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)/gi;
    let mb;
    while ((mb = regexBRL.exec(html)) !== null) {
      const num = parseFloat(mb[1].replace(/\./g, ''));
      if (num >= 80 && num <= 60000) {
        voos.push({
          preco: num,
          cia: 'Companhia Aérea',
          duracaoTexto: '12 h',
          duracaoHoras: 12.0,
          escalas: 0,
          detalhesEscalas: 'Direto',
          tempoConexao: null,
          aeroportoConexao: null,
          bagagem: { mao: 'desconhecido', despachada: 'desconhecido', texto: null }
        });
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
 * 5. Extrai lista de voos detalhados (aria-label → BRL fallback).
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
   * @returns {Promise<{ok:boolean, encontrouVoos?:boolean, oferta?:object, erro?:boolean, mensagemErro?:string}>}
   */
  async buscarOfertas({ origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1 }) {
    // Validação de entrada defensiva
    if (!origemCod || !destinoCod || !dataIda) {
      return { ok: false, erro: true, mensagemErro: 'ScraplingProvider: parâmetros de busca incompletos (origemCod, destinoCod e dataIda são obrigatórios).' };
    }

    // Constrói URL Cheapest com distinção One-Way vs Round-Trip
    const { url: urlCheapest, tipoViagem } = construirUrlCheapest(origemCod, destinoCod, dataIda, dataVolta, duracaoMaxHoras);

    // Link canônico de fallback para exibição (sem tfs)
    const linkCanônico = dataIda
      ? gerarLinkGoogleFlightsCheapest(origemCod, destinoCod, dataIda, dataVolta, duracaoMaxHoras) || gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta)
      : gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta);

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

        // Detecção de bloqueio anti-bot → retry imediato com novo perfil
        if (detectarBloqueioBot(resp)) {
          ultimoErro = `Bloqueio anti-bot detectado (HTTP ${resp.status}, URL: ${resp.url}) — tentativa ${tentativa + 1}/${MAX_TENTATIVAS}`;
          continue;
        }

        if (!resp.ok) {
          ultimoErro = `HTTP ${resp.status} na tentativa ${tentativa + 1}`;
          continue;
        }

        const html = await resp.text();

        // Extração do preço da aba Cheapest (camada prioritária)
        const precoCheapest = extrairPrecoCheapestTab(html);

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

        return {
          ok: true,
          encontrouVoos: true,
          oferta: {
            preco: melhorOferta.preco,
            precoOriginal: melhorOferta.precoOriginal,
            duracaoHoras: melhorOferta.duracaoHoras,
            destinoReal: destinoCod,
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
            bagagem: melhorOferta.bagagem || null,
            cheapestTabAtivada: ehCheapestTab,
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
