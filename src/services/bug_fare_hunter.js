import { GoogleFlightsDirectProvider } from './providers/google_flights_direct_provider.js';
import { detectarBugFareEstatistico } from '../domain/bug_fares.js';
import { montarCardBugFare } from '../domain/aeroportos.js';
import { bugFaresRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';
import { telemetryEvents } from './telemetry_events.js';

/**
 * Matriz de Corredores Globais de Alta Sensibilidade a Bug Fares
 * Focada nas principais rotas emissoras do Brasil e destinos mundiais com maior histórico de falha tarifária GDS
 */
export const CORREDORES_GLOBAIS_SWEET_SPOT = [
  // Europa (Piso Econômica R$ 1.950 ida/volta)
  { origem: 'SAO', destino: '/m/02j9z', labelDestino: 'Europa (Geral)', regiao: 'EUROPA', diasEstadia: 12 },
  { origem: 'SAO', destino: 'LIS', labelDestino: 'Lisboa', regiao: 'EUROPA', diasEstadia: 10 },
  { origem: 'SAO', destino: 'MAD', labelDestino: 'Madrid', regiao: 'EUROPA', diasEstadia: 10 },
  { origem: 'SAO', destino: 'PAR', labelDestino: 'Paris', regiao: 'EUROPA', diasEstadia: 12 },
  { origem: 'SAO', destino: 'ROM', labelDestino: 'Roma', regiao: 'EUROPA', diasEstadia: 11 },
  { origem: 'RIO', destino: 'LIS', labelDestino: 'Lisboa', regiao: 'EUROPA', diasEstadia: 10 },
  { origem: 'RIO', destino: 'PAR', labelDestino: 'Paris', regiao: 'EUROPA', diasEstadia: 12 },

  // América do Norte (Piso Econômica R$ 1.700 ida/volta)
  { origem: 'SAO', destino: '/m/09c7w0', labelDestino: 'Estados Unidos (Geral)', regiao: 'AMERICA_NORTE', diasEstadia: 10 },
  { origem: 'SAO', destino: 'MIA', labelDestino: 'Miami', regiao: 'AMERICA_NORTE', diasEstadia: 9 },
  { origem: 'SAO', destino: 'MCO', labelDestino: 'Orlando', regiao: 'AMERICA_NORTE', diasEstadia: 10 },
  { origem: 'SAO', destino: 'NYC', labelDestino: 'Nova York', regiao: 'AMERICA_NORTE', diasEstadia: 8 },
  { origem: 'RIO', destino: 'MIA', labelDestino: 'Miami', regiao: 'AMERICA_NORTE', diasEstadia: 9 },

  // Caribe & América Central (Piso Econômica R$ 1.300 ida/volta)
  { origem: 'SAO', destino: 'CUN', labelDestino: 'Cancún', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },
  { origem: 'SAO', destino: 'PUJ', labelDestino: 'Punta Cana', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },
  { origem: 'BSB', destino: 'CUN', labelDestino: 'Cancún', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },

  // América do Sul (Piso Econômica R$ 850 ida/volta)
  { origem: 'SAO', destino: 'BUE', labelDestino: 'Buenos Aires', regiao: 'AMERICA_SUL', diasEstadia: 5 },
  { origem: 'SAO', destino: 'SCL', labelDestino: 'Santiago', regiao: 'AMERICA_SUL', diasEstadia: 6 },
  { origem: 'SAO', destino: 'MVD', labelDestino: 'Montevidéu', regiao: 'AMERICA_SUL', diasEstadia: 4 },
  { origem: 'RIO', destino: 'BUE', labelDestino: 'Buenos Aires', regiao: 'AMERICA_SUL', diasEstadia: 5 },

  // Ásia & Oriente Médio (Pisos R$ 2.800 a R$ 3.000)
  { origem: 'SAO', destino: 'DXB', labelDestino: 'Dubai', regiao: 'ORIENTE_MEDIO', diasEstadia: 10 },
  { origem: 'SAO', destino: 'DOH', labelDestino: 'Doha', regiao: 'ORIENTE_MEDIO', diasEstadia: 10 },
  { origem: 'SAO', destino: 'TYO', labelDestino: 'Tóquio', regiao: 'ASIA_OCEANIA', diasEstadia: 15 },

  // Doméstico Nacional (Piso Econômica R$ 250 ida/volta)
  { origem: 'SAO', destino: 'SSA', labelDestino: 'Salvador', regiao: 'DOMESTICO', diasEstadia: 5 },
  { origem: 'SAO', destino: 'REC', labelDestino: 'Recife', regiao: 'DOMESTICO', diasEstadia: 6 },
  { origem: 'SAO', destino: 'FOR', labelDestino: 'Fortaleza', regiao: 'DOMESTICO', diasEstadia: 6 },
  { origem: 'SAO', destino: 'FLN', labelDestino: 'Florianópolis', regiao: 'DOMESTICO', diasEstadia: 4 }
];

export class BugFareHunter {
  constructor() {
    this.provedorDirect = new GoogleFlightsDirectProvider();
    this.indiceRotacao = 0;
  }

  /**
   * Calcula datas estratégicas futuras (terça ou quarta-feira, entre 45 e 120 dias)
   */
  gerarDatasEstrategicas(diasNoFuturo = 60, diasEstadia = 10) {
    const dataPartida = new Date();
    dataPartida.setDate(dataPartida.getDate() + diasNoFuturo);

    // Ajusta para a próxima terça-feira (dia com histórico menor de tarifas corporativas infladas)
    const diaSemana = dataPartida.getDay();
    const diffTerca = (2 - diaSemana + 7) % 7;
    dataPartida.setDate(dataPartida.getDate() + diffTerca);

    const dataRetorno = new Date(dataPartida);
    dataRetorno.setDate(dataRetorno.getDate() + diasEstadia);

    const fmt = (d) => d.toISOString().split('T')[0];
    return { dataIda: fmt(dataPartida), dataVolta: fmt(dataRetorno) };
  }

  /**
   * Executa varredura proativa em lote nos corredores estratégicos
   * @param {Object} params
   * @param {number} params.limiteRotas Quantidade de corredores a escanear nesta rodada
   * @param {boolean} params.notificar Se deve enviar notificações no Telegram
   */
  async executarVarreduraProativa({ limiteRotas = 5, notificar = true } = {}) {
    console.log(`🧭 [BugFareHunter] Iniciando caçada proativa global (amostra de ${limiteRotas} corredores)...`);

    const bugsEncontrados = [];
    const corredoresAmostra = [];

    // Seleção em anel round-robin para cobrir todos os continentes ao longo do tempo
    const totalCorredores = CORREDORES_GLOBAIS_SWEET_SPOT.length;
    for (let i = 0; i < limiteRotas; i++) {
      const idx = (this.indiceRotacao + i) % totalCorredores;
      corredoresAmostra.push(CORREDORES_GLOBAIS_SWEET_SPOT[idx]);
    }
    this.indiceRotacao = (this.indiceRotacao + limiteRotas) % totalCorredores;

    let totalChecados = 0;
    for (const corredor of corredoresAmostra) {
      totalChecados++;
      const { dataIda, dataVolta } = this.gerarDatasEstrategicas(
        50 + (totalChecados * 12),
        corredor.diasEstadia || 10
      );

      try {
        console.log(`🔍 Investigando corredor: ${corredor.origem} ➔ ${corredor.labelDestino} (${dataIda} a ${dataVolta})`);
        const resultado = await this.provedorDirect.buscarOfertas({
          origemCod: corredor.origem,
          destinoCod: corredor.destino,
          dataIda,
          dataVolta,
          cabine: 'economy',
          adultos: 1
        });

        if (resultado.ok && resultado.encontrouVoos && resultado.oferta?.preco > 0) {
          const preco = resultado.oferta.preco;
          const destinoReal = resultado.oferta.destinoReal || corredor.labelDestino;

          const analise = detectarBugFareEstatistico({
            origemCod: corredor.origem,
            destinoCod: corredor.destino,
            preco,
            dataVolta,
            cabine: 'economy'
          });

          if (analise.ehBugFare) {
            const bugCard = montarCardBugFare({
              origem: corredor.origem,
              codigoOrigem: corredor.origem,
              destino: corredor.labelDestino,
              codigoDestino: corredor.destino,
              dataIda,
              dataVolta,
              preco,
              motivo: analise.motivo,
              tipo: analise.tipo,
              destinoReal: resultado.oferta.destinoReal || corredor.labelDestino,
              linkOriginal: resultado.oferta.link
            });

            // Persistência defensiva com deduplicação por link
            const jaCadastrado = bugFaresRepo.linkJaExiste(bugCard.link);
            if (!jaCadastrado) {
              bugFaresRepo.inserir(bugCard);

              telemetryEvents.emitirAtualizacao('bug_fare_detectado', {
                ...bugCard,
                severidade: analise.severidade || 'CRITICA'
              });

              if (notificar) {
                await notifierTelegram.enviarAlertaBugFare(bugCard);
              }

              bugsEncontrados.push(bugCard);
              console.log(`💥 [BUG FARE ENCONTRADO!] ${bugCard.titulo}`);
            }
          } else {
            console.log(`ℹ️ Corredor ${corredor.origem} ➔ ${corredor.labelDestino}: R$ ${preco.toFixed(0)} (Normal / Sem erro)`);
          }
        }
      } catch (err) {
        console.warn(`⚠️ Falha ao checar corredor ${corredor.origem} ➔ ${corredor.labelDestino}: ${err.message}`);
      }

      // Pausa defensiva jitter para não levantar suspeitas no Google Flights
      if (totalChecados < corredoresAmostra.length) {
        const jitter = 1500 + Math.floor(Math.random() * 1500);
        await new Promise(r => setTimeout(r, jitter));
      }
    }

    return {
      sucesso: true,
      corredoresVarridos: totalChecados,
      totalBugsEncontrados: bugsEncontrados.length,
      bugs: bugsEncontrados
    };
  }
}

export const bugFareHunter = new BugFareHunter();
