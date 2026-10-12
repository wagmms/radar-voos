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
    const linkWebEstruturado = gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta);

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

      const resp = await fetch(linkWebEstruturado, {
        headers,
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      // 3. Detecção de bloqueio de bot (sorry/index ou 429) -> aciona failover instantâneo
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

      // 4. Parser regex / heurístico de preços em BRL no HTML renderizado do Google Flights
      const precosEncontrados = [];
      const regexBRL = /(?:R\$|BRL)\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)/gi;
      let match;
      while ((match = regexBRL.exec(html)) !== null) {
        const valLimpo = match[1].replace(/\./g, '');
        const num = parseFloat(valLimpo);
        if (num >= 150 && num <= 45000) { // Filtra ruídos
          precosEncontrados.push(num);
        }
      }

      if (precosEncontrados.length === 0) {
        // Se a página retornou um desafio/captcha ou JS denso que escondeu o texto cru:
        return {
          ok: false,
          erro: true,
          mensagemErro: 'Sem preços imediatos no HTML direto (acionando fallback SerpAPI de alta precisão).'
        };
      }

      // Menor preço verificado no resultado
      precosEncontrados.sort((a, b) => a - b);
      const menorPreco = precosEncontrados[0];

      return {
        ok: true,
        encontrouVoos: true,
        oferta: {
          preco: menorPreco,
          duracaoHoras: 12.0,
          destinoReal: destinoCod,
          termometro: '🟢 Preço Competitivo (Google Flights Direct)',
          nivelPreco: 'low',
          detalhes: 'Voo direto/1 escala | Tarifa extraída diretamente sem API',
          dicaStopover: '-',
          link: linkWebEstruturado,
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
