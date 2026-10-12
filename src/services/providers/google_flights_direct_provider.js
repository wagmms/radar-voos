import { FlightProviderInterface } from './flight_provider_interface.js';
import { gerarLinkGoogleFlights } from '../../domain/rotas.js';

/**
 * Google Flights Direct Provider (v2.1)
 * Inspirado nas skills `flight-search` e `scrapling`.
 * Realiza requisições simulando um navegador moderno ou via headers stealth,
 * extraindo preços de referência sem consumir créditos da SerpAPI.
 */
export class GoogleFlightsDirectProvider extends FlightProviderInterface {
  constructor() {
    super('Google Flights Direct (0 Custo)');
    this.ativo = true;
  }

  estaDisponivel() {
    return this.ativo;
  }

  async buscarOfertas({ origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = 999, cabine = 'economy', adultos = 1 }) {
    const linkWebEstruturado = gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta);

    try {
      // Monta busca direta via endpoint estruturado do Google Flights com headers stealth
      const urlGoogle = linkWebEstruturado;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Linux"'
      };

      const resp = await fetch(urlGoogle, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        return {
          ok: false,
          erro: true,
          mensagemErro: `Google Flights Direct HTTP ${resp.status}`
        };
      }

      const html = await resp.text();

      // Parser regex / heurístico de preços em BRL no HTML renderizado do Google Flights
      // Exemplos comuns: "R$ 1.840", "R$ 2.450", "BRL 3.200"
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
          mensagemErro: 'Sem preços imediatos no HTML direto (necessita fallback para SerpAPI ou navegador completo).'
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
          detalhes: 'Voo direto/1 escala | Tarifa extraída diretamente',
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
