import { SerpApiProvider } from './serpapi_provider.js';
import { GoogleFlightsDirectProvider } from './google_flights_direct_provider.js';

export class FlightProviderManager {
  constructor() {
    this.providers = [
      new GoogleFlightsDirectProvider(),
      new SerpApiProvider()
    ];
    this.stats = {
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
    let ultimoErro = 'Nenhum provedor disponível';

    for (const provider of this.providers) {
      if (!provider.estaDisponivel()) {
        continue;
      }

      try {
        const resultado = await provider.buscarOfertas(params);

        if (resultado.ok) {
          if (provider instanceof GoogleFlightsDirectProvider) {
            this.stats.buscasDiretasSucesso++;
          } else if (provider instanceof SerpApiProvider) {
            this.stats.buscasSerpApiSucesso++;
          }
          return resultado;
        }

        // Se o provedor reportou erro ou indisponibilidade, registra e tenta o próximo
        ultimoErro = resultado.mensagemErro || 'Erro desconhecido';
      } catch (err) {
        ultimoErro = err.message;
      }
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
