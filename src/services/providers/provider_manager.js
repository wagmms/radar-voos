import { SerpApiProvider } from './serpapi_provider.js';
import { GoogleFlightsDirectProvider } from './google_flights_direct_provider.js';
import { ScraplingProvider } from './scrapling_client.js';

export class FlightProviderManager {
  constructor() {
    this.providers = [
      new ScraplingProvider(),
      new GoogleFlightsDirectProvider(),
      new SerpApiProvider()
    ];
    this.stats = {
      buscasScraplingsSucesso: 0,
      buscasDiretasSucesso: 0,
      buscasSerpApiSucesso: 0,
      falhasTotais: 0
    };
  }

  /**
   * Adiciona um provedor customizado (ex: MockProvider para testes)
   */
  adicionarProvedor(provider, inicio = false) {
    if (inicio) {
      this.providers.unshift(provider);
    } else {
      this.providers.push(provider);
    }
  }

  /**
   * Busca ofertas iterando pelos provedores disponíveis na ordem de prioridade
   */
  async buscarOfertas(params) {
    let melhorResultado = null;
    let ultimoErro = 'Nenhum provedor disponível';

    for (const provider of this.providers) {
      if (!provider.estaDisponivel()) {
        continue;
      }

      try {
        const resultado = await provider.buscarOfertas(params);

        if (resultado.ok && resultado.encontrouVoos && resultado.oferta?.preco) {
          if (provider instanceof ScraplingProvider) {
            this.stats.buscasScraplingsSucesso++;
          } else if (provider instanceof GoogleFlightsDirectProvider) {
            this.stats.buscasDiretasSucesso++;
          } else if (provider instanceof SerpApiProvider) {
            this.stats.buscasSerpApiSucesso++;
          }

          if (!melhorResultado || resultado.oferta.preco < melhorResultado.oferta.preco) {
            melhorResultado = resultado;
          }

          // Provedores diretos (Scrapling ou GoogleFlightsDirect) com tarifa Cheapest capturam
          // o menor preço disponível — encerra a cadeia sem precisar da SerpAPI.
          // Caso contrário, deixa a SerpAPI buscar descontos adicionais de parceiros/OTAs.
          const ehProveedorDireto = provider instanceof ScraplingProvider || provider instanceof GoogleFlightsDirectProvider;
          const temSerpApiDisponivel = this.providers.some(p => p instanceof SerpApiProvider && p.estaDisponivel());
          const jaTemDescontoOta = resultado.oferta.cheapestTabAtivada ||
            resultado.oferta.detalhes?.includes('Aba Cheapest') ||
            Boolean(resultado.oferta.precoOriginal);

          if (!ehProveedorDireto || !temSerpApiDisponivel || jaTemDescontoOta) {
            return melhorResultado;
          }
        } else if (resultado.ok && !melhorResultado) {
          melhorResultado = resultado;
        }

        ultimoErro = resultado.mensagemErro || 'Erro desconhecido';
      } catch (err) {
        ultimoErro = err.message;
      }
    }

    if (melhorResultado) {
      return melhorResultado;
    }

    this.stats.falhasTotais++;
    return {
      ok: false,
      erro: true,
      mensagemErro: `Todos os provedores de voo falharam. Último erro: ${ultimoErro}`
    };
  }

  obterEstatisticas() {
    return { ...this.stats, provedoresAtivos: this.providers.map(p => p.nome) };
  }
}

export const flightProviderManager = new FlightProviderManager();
