/**
 * Interface / Classe Base para Provedores de Varredura de Voos
 */
export class FlightProviderInterface {
  constructor(nome) {
    this.nome = nome;
  }

  /**
   * Executa a busca de ofertas de voos
   * @param {Object} params
   * @param {string} params.origemCod - Código de origem (ex: GRU, SAO)
   * @param {string} params.destinoCod - Código de destino (ex: CDG, LIS, MIA)
   * @param {string} params.dataIda - Data de ida (YYYY-MM-DD)
   * @param {string|null} params.dataVolta - Data de volta (YYYY-MM-DD ou null)
   * @param {number} params.duracaoMaxHoras - Duração máxima permitida em horas
   * @param {string} params.cabine - Classe da cabine (economy, premium_economy, business, first)
   * @param {number} params.adultos - Número de passageiros adultos
   * @returns {Promise<{ ok: boolean, encontrouVoos?: boolean, oferta?: Object, erro?: boolean, mensagemErro?: string, mensagem?: string }>}
   */
  async buscarOfertas(params) {
    throw new Error(`Método buscarOfertas() deve ser implementado pelo provedor ${this.nome}`);
  }

  /**
   * Verifica se o provedor está disponível e apto a operar no momento
   * @returns {boolean}
   */
  estaDisponivel() {
    return true;
  }
}
