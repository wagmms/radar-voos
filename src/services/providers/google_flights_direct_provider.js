import { FlightProviderInterface } from './flight_provider_interface.js';
import { gerarLinkGoogleFlights, gerarLinkGoogleFlightsCheapest } from '../../domain/rotas.js';
import { identificarRegiaoDestino } from '../../domain/bug_fares.js';

/**
 * Google Flights Direct Provider (v2.1)
 * Inspirado nas skills `flight-search` e `scrapling`.
 * Realiza requisições simulando um navegador moderno ou via headers stealth,
 * extraindo preços de referência sem consumir créditos da SerpAPI.
 */
const USER_AGENTS_STEALTH = [
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    platform: '"Windows"',
    chUa: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    platform: '"macOS"',
    chUa: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
  },
  {
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    platform: '"Linux"',
    chUa: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
  }
];

export function converterDuracaoParaHoras(str) {
  if (typeof str === 'number') {
    return (Number.isFinite(str) && str > 0) ? parseFloat(str.toFixed(3)) : 12.0;
  }
  if (!str) return 12.0;
  const s = String(str).trim();

  // Rejeita valores negativos em formato string (ex: "-2h", "-45min", "-2h 30m")
  if (/^[-–—]/.test(s)) return 12.0;

  // Suporte a formato relógio digital "HH:MM" (ex: "2:30", "02:30", "14:15")
  const matchRelogio = s.match(/^(\d{1,2}):(\d{2})$/);
  if (matchRelogio) {
    const h = parseInt(matchRelogio[1], 10);
    const m = parseInt(matchRelogio[2], 10);
    const total = h + (m / 60);
    return total > 0 ? parseFloat(total.toFixed(3)) : 12.0;
  }

  // Suporte a formatos decimais diretos como "2.5h", "2,5h", "2.5 h"
  const matchDecimal = s.match(/^(\d+(?:[.,]\d+)?)\s*h(?:r|s|ora)?s?$/i);
  if (matchDecimal) {
    const num = parseFloat(matchDecimal[1].replace(',', '.'));
    return (Number.isFinite(num) && num > 0) ? parseFloat(num.toFixed(3)) : 12.0;
  }

  // Suporte a formatos compactos: "2h30m", "2h30min", "2h 30m"
  const matchCompacto = s.match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (matchCompacto) {
    const h = parseInt(matchCompacto[1], 10);
    const m = parseInt(matchCompacto[2], 10);
    const total = h + (m / 60);
    return total > 0 ? parseFloat(total.toFixed(3)) : 12.0;
  }

  const matchH = s.match(/(\d+)\s*(?:h(?:r|s|ora)?s?)/i);
  const matchM = s.match(/(\d+)\s*(?:min(?:uto)?s?|m(?![a-z]))/i);
  const h = matchH ? parseInt(matchH[1], 10) : 0;
  const m = matchM ? parseInt(matchM[1], 10) : 0;
  const total = h + (m / 60);
  // Usa 3 casas decimais para preservar precisão em filtros de duração máxima
  return total > 0 ? parseFloat(total.toFixed(3)) : 12.0;
}

export function extrairPrecoNumerico(str) {
  if (str === null || str === undefined || typeof str === 'symbol') return null;

  if (typeof str === 'number') {
    if (!Number.isFinite(str) || str <= 0) return null;
    return Math.floor(str);
  }

  const limpo = String(str).trim();
  if (!limpo) return null;

  // Se for explicitamente negativo (ex: "-500", "R$ -1.250"), não é preço válido
  if (/^[-–—]|\s[-–—]/.test(limpo)) {
    return null;
  }

  // Remove centavos no final ou seguidos de delimitador/texto não-dígito (ex: ",00", ".50")
  const semCentavos = limpo.replace(/[,.]\d{2}(?!\d)/, '');
  const numeros = semCentavos.replace(/[^\d]/g, '');
  if (!numeros) return null;
  const n = parseInt(numeros, 10);
  // Zero não é preço válido para passagem aérea
  if (isNaN(n) || n === 0) return null;
  return n;
}

export function limparNomeCompanhia(ciaBruta) {
  if (!ciaBruta) return 'Companhia Aérea';
  const str = String(ciaBruta).trim();

  // Traduzir termos de múltiplas companhias
  if (/multiple\s+(?:airlines|carriers|companhias)/i.test(str)) {
    return 'Múltiplas Companhias';
  }

  let limpo = str
    // Remove prefixos de operação
    .replace(/(?:^|\s+)(?:operad[ao]\s+por|operated\s+by)\s+/gi, ' ')
    // Remove informações de escalas/paradas
    .replace(/\s+(?:com\s+\d+\s+(?:parada|escala|stop)s?|com\s+conexão|com\s+escalas)/gi, '')
    .replace(/\s+(?:com\s+1\s+parada|com\s+2\s+paradas|com\s+3\s+paradas)/gi, '')
    .replace(/\s+(?:direto|sem\s+escalas|sem\s+paradas|nonstop)/gi, '')
    // Passo 1: remove sufixos legais/corporativos isolados (não descritivos)
    .replace(/\s+(?:Holdings?|Group|S\.?A\.?|Inc\.?|Ltd\.?|Corp\.)$/gi, '')
    // Passo 2: remove sufixos descritivos de aviação somente no final
    .replace(/\s+Linhas?\s+Aéreas?$/gi, '')
    .replace(/\s+Airways?$/gi, '')
    // Remove sufixo isolado "Airline" (singular) mas preserva "Airlines" (plural em nome composto)
    .replace(/\s+Airline$/i, '')
    .trim();

  limpo = limpo.replace(/[.,;:]+$/, '').trim();
  return limpo || 'Companhia Aérea';
}

export function extrairInfoConexoes(texto) {
  if (!texto) {
    return {
      escalas: 0,
      detalhesEscalas: 'Direto',
      tempoConexao: null,
      aeroportoConexao: null
    };
  }

  const str = String(texto);

  // 1. Detecção de número de paradas/escalas ou menção a voo indireto
  let escalas = null;
  const matchNum = str.match(/(\d+)\s*(?:parada(?:s)?|escala(?:s)?|stop(?:s)?)/i);
  if (matchNum) {
    escalas = parseInt(matchNum[1], 10);
  } else if (/com\s+conexão|com\s+parada|com\s+escala|connecting|\bindireto\b/i.test(str)) {
    escalas = 1;
  }

  // 2. Se não possui escalas explícitas e não é negado, valida voo direto (com fronteira de palavra)
  const ehNaoDireto = /(?:n[aã]o\s+direto|\bindireto\b)/i.test(str);
  if (escalas === null && !ehNaoDireto && (/(?<!n[aã]o\s+)\bdireto\b|sem\s+escalas|sem\s+paradas|\bnonstop\b|\bnon-stop\b/i.test(str))) {
    return {
      escalas: 0,
      detalhesEscalas: 'Direto',
      tempoConexao: null,
      aeroportoConexao: null
    };
  }

  // 3. Detecção de tempo de conexão (layover)
  let tempoConexao = null;
  const matchTempo = str.match(/(?:conexão|parada|escala|layover|stop)\s*(?:de|of)?\s*(\d+\s*h(?:r|s)?(?:\s*\d+\s*min)?|\d+\s*min)/i);
  if (matchTempo) {
    tempoConexao = matchTempo[1].trim();
  }

  // 4. Detecção de aeroporto / cidade de conexão
  let aeroportoConexao = null;
  const matchAero = str.match(/\b(?:em|no|na|at|in)\s+([A-Za-zÀ-ÿ0-9\s-]+?\([A-Z]{3}\)|[A-Z]{3}(?:\s*,\s*[A-Z]{3})*)/i);
  if (matchAero) {
    let bruto = matchAero[1].trim();
    bruto = bruto.replace(/^(?:no|na|em|at|in)\s+/i, '').trim();
    aeroportoConexao = bruto;
  }

  const qtdEscalas = escalas !== null ? escalas : 0;
  let detalhesEscalas = 'Direto';

  if (qtdEscalas > 0) {
    const sufixoParada = qtdEscalas === 1 ? '1 parada' : `${qtdEscalas} paradas`;
    if (aeroportoConexao) {
      detalhesEscalas = `${sufixoParada} em ${aeroportoConexao}`;
    } else {
      detalhesEscalas = sufixoParada;
    }
  }

  return {
    escalas: qtdEscalas,
    detalhesEscalas,
    tempoConexao,
    aeroportoConexao
  };
}

export function extrairInfoBagagem(texto) {
  if (!texto) {
    return {
      mao: 'desconhecido',
      despachada: 'desconhecido',
      texto: null
    };
  }

  const str = String(texto);
  let mao = 'desconhecido';
  let despachada = 'desconhecido';

  // Bagagem de mão
  if (/sem\s+bagagem\s+de\s+mão|não\s+inclui\s+bagagem\s+de\s+mão|apenas\s+item\s+pessoal|item\s+pessoal\s+apenas|no\s+carry-on|personal\s+item\s+only/i.test(str)) {
    mao = 'nao_incluida';
  } else if (/(?:inclui|com)\s+(?:1\s+)?(?:mala|bagagem)\s+de\s+mão|mala\s+de\s+mão\s+incluída|bagagem\s+de\s+mão\s+incluída|carry-on\s+(?:bag\s+)?included/i.test(str)) {
    mao = 'incluida';
  }

  // Bagagem despachada
  if (/(?:inclui|com)\s+(?:1\s+)?(?:mala|bagagem)\s+despachada|bagagem\s+despachada\s+incluída|checked\s+bag\s+included/i.test(str)) {
    despachada = 'incluida';
  } else if (/sem\s+bagagem\s+despachada|bagagem\s+despachada\s+não\s+incluída|bagagem\s+despachada\s+por\s+uma\s+taxa|bagagem\s+despachada\s+paga|checked\s+bag\s+for\s+a\s+fee|no\s+checked\s+bag/i.test(str)) {
    despachada = 'paga';
  }

  let textoResumo = null;
  if (despachada === 'incluida') {
    textoResumo = mao === 'incluida' ? 'Inclui bagagem despachada e de mão' : 'Inclui bagagem despachada';
  } else if (mao === 'nao_incluida') {
    textoResumo = 'Apenas item pessoal (sem mala de mão)';
  } else if (mao === 'incluida') {
    textoResumo = despachada === 'paga' ? 'Mala de mão incluída (despachada paga)' : 'Mala de mão incluída';
  }

  return {
    mao,
    despachada,
    texto: textoResumo
  };
}

export class GoogleFlightsDirectProvider extends FlightProviderInterface {
  constructor() {
    super('Google Flights Direct (0 Custo)');
    this.ativo = true;
    this.requisicoesConsecutivas = 0;
  }

  estaDisponivel() {
    return this.ativo;
  }

  async buscarOfertas({ origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1, moeda = 'BRL', curr = null }) {
    const moedaCode = (curr || moeda || 'BRL').trim().toUpperCase();
    const linkCheapest = dataIda ? gerarLinkGoogleFlightsCheapest(origemCod, destinoCod, dataIda, dataVolta, duracaoMaxHoras, adultos, 0, cabine, moedaCode) : null;
    const linkBase = linkCheapest || gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta, moedaCode);
    let linkConsulta = linkBase;
    if (!linkConsulta.includes('&hl=')) linkConsulta += '&hl=pt-BR';
    if (!linkConsulta.includes('&gl=')) linkConsulta += '&gl=BR';
    if (linkConsulta.includes('&curr=')) {
      linkConsulta = linkConsulta.replace(/&curr=[A-Za-z]{3}/i, `&curr=${moedaCode}`);
    } else {
      linkConsulta += `&curr=${moedaCode}`;
    }

    try {
      // 1. Rotação dinâmica de fingerprint para evitar perfil estático de bot
      const perfilStealth = USER_AGENTS_STEALTH[Math.floor(Math.random() * USER_AGENTS_STEALTH.length)];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // 2. Headers autênticos de navegador real com bypass de tela de cookies do Google
      const headers = {
        'User-Agent': perfilStealth.ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': perfilStealth.chUa,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': perfilStealth.platform,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        // Injeta IP do Brasil para balanceadores geolocalizados do Google
        'X-Forwarded-For': '177.16.24.12',
        // Injeta cookie de consentimento pré-aceito para evitar redirecionamento de tela de consentimento
        'Cookie': 'SOCS=CAISHAgBEhJnd3NfMjAyNDA5MTAtMF9SQzIaAnB0IAEaBgiA_L22Bg; 1P_JAR=2026-10-12-15; NID=511=Qn'
      };

      const resp = await fetch(linkConsulta, {
        headers,
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      // 3. Detecção de bloqueio de bot (sorry/index, 429 ou consent) -> aciona failover instantâneo
      if (resp.status === 429 || resp.url.includes('sorry/index') || resp.url.includes('consent.google.com')) {
        return {
          ok: false,
          erro: true,
          mensagemErro: 'Google Flights solicitou validação anti-bot (acionando fallback SerpAPI com IP residencial).'
        };
      }

      if (!resp.ok) {
        return {
          ok: false,
          erro: true,
          mensagemErro: `Google Flights Direct HTTP ${resp.status}`
        };
      }

      const html = await resp.text();

      // 4. Parser multicamada de voos
      const voosDetalhados = [];

      // Camada 0: Extração da aba 'Cheapest' (menor tarifa de referência do Google Flights / OTAs)
      let precoCheapestTab = null;
      const regexCheapestTab = /\[\[null,\s*(\d+)\]\s*,\s*"[^"]*(?:comprehensiveness_lure|EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl)[^"]*"/i;
      const matchCheapest = html.match(regexCheapestTab);
      if (matchCheapest) {
        const p = parseInt(matchCheapest[1], 10);
        if (p >= 120 && p <= 45000) precoCheapestTab = p;
      }

      // Camada A: Detalhes ricos estruturados nos atributos aria-label e blocos de resultado
      const regexAriaBloco = /aria-label=["\x27]([^"\x27]*?(?:Preço total a partir de|A partir de|Total price from|From)\s*[0-9.,\s]+?\s*(?:Reais brasileiros|BRL|reais|Brazilian reals|USD|EUR|US dollars|euros|dólares|dolares)[^"\x27]*?)["\x27]/gi;
      let matchBloco;
      while ((matchBloco = regexAriaBloco.exec(html)) !== null) {
        const ariaTexto = matchBloco[1];
        const matchPreco = ariaTexto.match(/(?:Preço total a partir de|A partir de|Total price from|From)\s*([0-9.,\s]+?)\s*(?:Reais brasileiros|BRL|reais|Brazilian reals|USD|EUR|US dollars|euros|dólares|dolares)/i);
        const preco = matchPreco ? extrairPrecoNumerico(matchPreco[1]) : null;
        if (!preco || preco < 120 || preco > 45000) continue;

        // Contexto HTML adjacente (para inspecionar nós de escala e bagagem se ausentes no ariaTexto)
        const posIni = Math.max(0, matchBloco.index - 200);
        const posFim = Math.min(html.length, matchBloco.index + matchBloco[0].length + 800);
        const trechoHtml = html.slice(posIni, posFim);

        // Companhia Aérea
        let ciaBruta = 'Companhia Aérea';
        const matchCia = ariaTexto.match(/(?:Voo|Flight)\s*(?:[^.]*?)\s*(?:da|with|operado por|operated by)\s*([^.]+?)(?:\.|$)/i) ||
                         ariaTexto.match(/(?:Voo|Flight)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\.|\s+com|\s+direto)/i);
        if (matchCia) {
          ciaBruta = matchCia[1].trim();
        }
        const cia = limparNomeCompanhia(ciaBruta);

        // Duração
        let durTexto = '12 h';
        const matchDur = ariaTexto.match(/(?:Duração total:|Total duration:)\s*([^.]+?)(?:\.|$)/i);
        if (matchDur) {
          durTexto = matchDur[1].trim();
        } else {
          const matchDurHtml = trechoHtml.match(/(?:Duração total:|Total duration:)\s*([^<.]+?)(?:<|\.|$)/i);
          if (matchDurHtml) durTexto = matchDurHtml[1].trim();
        }
        const duracaoHoras = converterDuracaoParaHoras(durTexto);

        // Conexões e Escalas
        let conexoesInfo = extrairInfoConexoes(ariaTexto);
        if (conexoesInfo.escalas === 0 && conexoesInfo.detalhesEscalas === 'Direto' && !/direto|sem\s+escalas|sem\s+paradas|nonstop/i.test(ariaTexto)) {
          const matchEscalasHtml = trechoHtml.match(/(?:aria-label=["\x27]|>)\s*(\d+\s*(?:parada|escala|stop)s?(?:\s*(?:em|no|na|at|in)\s*[^<"\x27]+?)?)/i);
          if (matchEscalasHtml) {
            conexoesInfo = extrairInfoConexoes(matchEscalasHtml[1]);
          }
        }

        // Bagagem
        let bagagemInfo = extrairInfoBagagem(ariaTexto);
        if (!bagagemInfo.texto) {
          const matchBagHtml = trechoHtml.match(/(?:aria-label=["\x27]|>)\s*([^<"\x27]*?(?:bagagem|mala|carry-on|checked\s+bag|item\s+pessoal)[^<"\x27]*?)(?:["\x27]|<)/i);
          if (matchBagHtml) {
            bagagemInfo = extrairInfoBagagem(matchBagHtml[1]);
          }
        }

        voosDetalhados.push({
          preco,
          tipo: conexoesInfo.detalhesEscalas,
          cia,
          duracaoTexto: durTexto,
          duracaoHoras,
          escalas: conexoesInfo.escalas,
          detalhesEscalas: conexoesInfo.detalhesEscalas,
          tempoConexao: conexoesInfo.tempoConexao,
          aeroportoConexao: conexoesInfo.aeroportoConexao,
          bagagem: bagagemInfo
        });
      }

      // Camada A.2: Fallback caso regexAriaBloco não encontre nada (compatibilidade com nós antigos)
      if (voosDetalhados.length === 0) {
        const regexAriaCard = /aria-label=["\x27](?:Preço total a partir de|A partir de|Total price from|From)\s*([0-9.,\s]+?)\s*(?:Reais brasileiros|BRL|reais|Brazilian reals)[\s\S]*?(?:Voo|Flight)\s*([^.]*?)\s*(?:da|with)\s*([^.]+)\.[\s\S]*?(?:Duração total:|Total duration:)\s*([^.]+)\./gi;
        let matchCard;
        while ((matchCard = regexAriaCard.exec(html)) !== null) {
          const preco = extrairPrecoNumerico(matchCard[1]);
          if (preco && preco >= 120 && preco <= 45000) {
            const ciaBruta = matchCard[3].trim();
            const durTexto = matchCard[4].trim();
            const textoCompleto = matchCard[0];
            const conexoesInfo = extrairInfoConexoes(textoCompleto);
            const bagagemInfo = extrairInfoBagagem(textoCompleto);
            voosDetalhados.push({
              preco,
              tipo: conexoesInfo.detalhesEscalas,
              cia: limparNomeCompanhia(ciaBruta),
              duracaoTexto: durTexto,
              duracaoHoras: converterDuracaoParaHoras(durTexto),
              escalas: conexoesInfo.escalas,
              detalhesEscalas: conexoesInfo.detalhesEscalas,
              tempoConexao: conexoesInfo.tempoConexao,
              aeroportoConexao: conexoesInfo.aeroportoConexao,
              bagagem: bagagemInfo
            });
          }
        }
      }

      // Camada B: Fallback de preços gerais em aria-label (quando texto não tiver formato completo de cartão)
      if (voosDetalhados.length === 0) {
        const regexAriaPreco = /aria-label=["\x27](?:Preço total a partir de|A partir de)?\s*([0-9.,\s]+?)\s*Reais brasileiros["\x27]/gi;
        let matchPreco;
        while ((matchPreco = regexAriaPreco.exec(html)) !== null) {
          const preco = extrairPrecoNumerico(matchPreco[1]);
          if (preco && preco >= 120 && preco <= 45000) {
            voosDetalhados.push({
              preco,
              tipo: 'Voo Regular',
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

      // Camada C: Fallback para padrões textuais de BRL/R$
      if (voosDetalhados.length === 0) {
        const regexBRL = /(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)/gi;
        let matchBRL;
        while ((matchBRL = regexBRL.exec(html)) !== null) {
          const valLimpo = matchBRL[1].replace(/\./g, '');
          const num = parseFloat(valLimpo);
          if (num >= 120 && num <= 45000) {
            voosDetalhados.push({
              preco: num,
              tipo: 'Voo Regular',
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

      if (voosDetalhados.length === 0) {
        return {
          ok: false,
          erro: true,
          mensagemErro: 'Sem preços imediatos no HTML direto (acionando fallback SerpAPI de alta precisão).'
        };
      }

      // Filtrar por duração máxima estipulada pelo usuário (se aplicável)
      const duracaoMax = duracaoMaxHoras && duracaoMaxHoras > 0 && duracaoMaxHoras < 900
        ? duracaoMaxHoras
        : 999;
      const filtrados = voosDetalhados.filter(v => v.duracaoHoras <= duracaoMax);

      const listaFinal = filtrados.length > 0 ? filtrados : voosDetalhados;
      listaFinal.sort((a, b) => a.preco - b.preco);
      const melhorOferta = { ...listaFinal[0] };

      // Se a aba Cheapest do Google Flights oferecer tarifa menor que o voo direto da cia aérea,
      // prioriza o valor mais barato absoluto que atende aos critérios do usuário
      let ehCheapestTab = false;
      if (precoCheapestTab && precoCheapestTab < melhorOferta.preco) {
        melhorOferta.precoOriginal = melhorOferta.preco;
        melhorOferta.preco = precoCheapestTab;
        ehCheapestTab = true;
      }

      let partesDetalhes = [melhorOferta.cia];
      if (melhorOferta.detalhesEscalas) {
        partesDetalhes.push(melhorOferta.detalhesEscalas);
      } else if (melhorOferta.tipo && melhorOferta.tipo !== 'Voo Regular') {
        partesDetalhes.push(melhorOferta.tipo);
      }
      partesDetalhes.push(`Duração: ${melhorOferta.duracaoTexto}`);
      if (melhorOferta.bagagem?.texto) {
        partesDetalhes.push(melhorOferta.bagagem.texto);
      }

      if (ehCheapestTab) {
        partesDetalhes.push(`Menor Tarifa (Aba Cheapest Google Flights: R$ ${melhorOferta.preco})`);
      } else if (melhorOferta.cia !== 'Companhia Aérea') {
        partesDetalhes.push('Tarifa Direta Stealth');
      } else {
        partesDetalhes = [`Tarifa Direta Google Flights (${melhorOferta.duracaoTexto})`];
      }

      const detalhesVoo = partesDetalhes.join(' | ');

      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: melhorOferta.preco,
          moeda: moedaCode,
          precoOriginal: melhorOferta.precoOriginal,
          duracaoHoras: melhorOferta.duracaoHoras,
          destinoReal: destinoCod,
          termometro: '🟢 Preço Mais Barato (Google Flights Cheapest)',
          nivelPreco: 'low',
          detalhes: detalhesVoo,
          dicaStopover: '-',
          link: linkBase,
          provedor: this.nome,
          escalas: melhorOferta.escalas ?? 0,
          detalhesEscalas: melhorOferta.detalhesEscalas || 'Direto',
          tempoConexao: melhorOferta.tempoConexao || null,
          aeroportoConexao: melhorOferta.aeroportoConexao || null,
          bagagem: melhorOferta.bagagem || null,
          amostraVoos: voosDetalhados.slice(0, 10).map(v => `${v.cia}: R$ ${v.preco} (${v.duracaoTexto}, ${v.detalhesEscalas || v.tipo}${v.bagagem?.texto ? ', ' + v.bagagem.texto : ''})`)
        }
      };
    } catch (err) {
      return {
        ok: false,
        erro: true,
        mensagemErro: `Falha no provedor direto: ${err.message}`
      };
    }
  }
}
