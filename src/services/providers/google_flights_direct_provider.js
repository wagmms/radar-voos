import { FlightProviderInterface } from './flight_provider_interface.js';
import { gerarLinkGoogleFlights } from '../../domain/rotas.js';

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

function converterDuracaoParaHoras(str) {
  if (!str) return 12.0;
  const matchH = str.match(/(\d+)\s*h/i);
  const matchM = str.match(/(\d+)\s*min/i);
  const h = matchH ? parseInt(matchH[1], 10) : 0;
  const m = matchM ? parseInt(matchM[1], 10) : 0;
  const total = h + (m / 60);
  return total > 0 ? parseFloat(total.toFixed(1)) : 12.0;
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

  async buscarOfertas({ origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1 }) {
    const linkBase = gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta);
    const linkConsulta = `${linkBase}&hl=pt-BR&curr=BRL`;

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

      // Camada A: Detalhes ricos estruturados nos atributos aria-label
      const regexAriaCard = /aria-label=["\x27](?:Preço total a partir de|A partir de|Total price from|From)\s*(\d+)\s*(?:Reais brasileiros|BRL|reais|Brazilian reals)[\s\S]*?(?:Voo|Flight)\s*([^.]*?)\s*(?:da|with)\s*([^.]+)\.[\s\S]*?(?:Duração total:|Total duration:)\s*([^.]+)\./gi;
      let matchCard;
      while ((matchCard = regexAriaCard.exec(html)) !== null) {
        const preco = parseInt(matchCard[1], 10);
        if (preco >= 120 && preco <= 45000) {
          const tipoBruto = matchCard[2].trim();
          const ciaBruta = matchCard[3].trim();
          const durTexto = matchCard[4].trim();
          voosDetalhados.push({
            preco,
            tipo: tipoBruto,
            cia: ciaBruta,
            duracaoTexto: durTexto,
            duracaoHoras: converterDuracaoParaHoras(durTexto)
          });
        }
      }

      // Camada B: Fallback de preços gerais em aria-label (quando texto não tiver formato completo de cartão)
      if (voosDetalhados.length === 0) {
        const regexAriaPreco = /aria-label=["\x27](?:Preço total a partir de|A partir de)?\s*(\d+)\s*Reais brasileiros["\x27]/gi;
        let matchPreco;
        while ((matchPreco = regexAriaPreco.exec(html)) !== null) {
          const preco = parseInt(matchPreco[1], 10);
          if (preco >= 120 && preco <= 45000) {
            voosDetalhados.push({
              preco,
              tipo: 'Voo Regular',
              cia: 'Companhia Aérea',
              duracaoTexto: '12 h',
              duracaoHoras: 12.0
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
              duracaoHoras: 12.0
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

      const detalhesVoo = ehCheapestTab
        ? `${melhorOferta.cia} | Duração: ${melhorOferta.duracaoTexto} | Menor Tarifa (Aba Cheapest Google Flights: R$ ${melhorOferta.preco})`
        : (melhorOferta.cia !== 'Companhia Aérea'
            ? `${melhorOferta.cia} | ${melhorOferta.tipo} | Duração: ${melhorOferta.duracaoTexto} | Tarifa Direta Stealth`
            : `Tarifa Direta Google Flights (${melhorOferta.duracaoTexto})`);

      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: melhorOferta.preco,
          duracaoHoras: melhorOferta.duracaoHoras,
          destinoReal: destinoCod,
          termometro: '🟢 Preço Mais Barato (Google Flights Cheapest)',
          nivelPreco: 'low',
          detalhes: detalhesVoo,
          dicaStopover: '-',
          link: linkBase,
          provedor: this.nome
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
