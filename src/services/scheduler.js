import { config } from '../config.js';
import { rotasRepo } from '../db.js';
import { FlightScanner } from './flight_scanner.js';
import { bugFareHunter } from './bug_fare_hunter.js';
import { BugFareFeedWatcher } from './bug_fare_feed_watcher.js';

class Scheduler {
  constructor() {
    this.timer = null;
    this.executando = false;
    this.intervaloMinutos = config.radar.scanIntervalMinutes;
    this.ultimaExecucao = null;
    this.ciclosContador = 0;
  }

  iniciar() {
    if (this.timer) return;
    console.log(`⏰ Agendador autônomo iniciado (ciclo a cada ${this.intervaloMinutos} minutos)`);

    // Primeira varredura 15 segundos após startup
    setTimeout(() => {
      this.executarCiclo(true).catch(err => console.error('❌ Erro no ciclo inicial do scheduler:', err));
    }, 15000);

    this.timer = setInterval(() => {
      this.executarCiclo(true).catch(err => console.error('❌ Erro no ciclo periódico do scheduler:', err));
    }, this.intervaloMinutos * 60 * 1000);
  }

  parar() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 Agendador autônomo pausado.');
    }
  }

  /**
   * Executa ciclo de monitoramento
   * @param {boolean} forcarTodas Se true, verifica todas as rotas ativas em fila
   * @param {Object} [opcoes]
   * @param {string} [opcoes.moeda] Moeda opcional para cotação
   * @param {string} [opcoes.curr] Alias para moeda
   */
  async executarCiclo(forcarTodas = false, { moeda = null, curr = null } = {}) {
    if (this.executando) {
      console.warn('⚠️ Varredura anterior ainda em andamento. Ignorando novo disparo concorrente.');
      return { ok: false, mensagem: 'Execução já em andamento' };
    }

    this.executando = true;
    this.ultimaExecucao = new Date().toISOString();
    console.log(`🔍 [${new Date().toLocaleTimeString('pt-BR')}] Iniciando ciclo de varredura do Radar de Voos...`);

    try {
      // Fila justa LRU de rotas (varre voos diretamente no motor com detecção de Bug Fares)
      const resultadoVarredura = await FlightScanner.executarCicloVarredura({
        forcarTodas,
        limite: 1,
        aplicarJitter: true,
        moeda: moeda || curr
      });

      const processadas = resultadoVarredura.processadas;
      if (processadas === 0) {
        console.log('ℹ️ Nenhuma rota ativa aguardando checagem.');
      } else {
        for (const item of resultadoVarredura.resultados) {
          if (item.res?.sucesso && item.res.encontrou) {
            console.log(`✅ [${item.rota}] Preço obtido: R$ ${item.res.oferta.preco.toFixed(2)} (${item.res.oferta.termometro})`);
          } else if (item.res?.sucesso && !item.res.encontrou) {
            console.log(`⚪ [${item.rota}] Sem voos no filtro: ${item.res.mensagem}`);
          } else if (item.res && !item.res.sucesso) {
            console.log(`⚠️ [${item.rota}] Falha na checagem: ${item.res.erro}`);
          } else if (item.erro) {
            console.error(`❌ [${item.rota}] Erro inesperado:`, item.erro);
          }
        }
      }

      // Prospecção autônoma leve de Bug Fares (intercalada a cada 2 ciclos ou se forçado)
      this.ciclosContador++;
      if (this.ciclosContador % 2 === 0 || forcarTodas) {
        try {
          console.log('🧭 [Scheduler] Disparando sonda autônoma proativa de Bug Fares em corredores mundiais...');
          await bugFareHunter.executarVarreduraProativa({ limiteRotas: 2, notificar: true });
          await BugFareFeedWatcher.escanearFeeds({ notificar: true });
        } catch (errHunter) {
          console.warn('⚠️ [Scheduler] Falha na sonda proativa de bug fares:', errHunter.message);
        }
      }

      return { ok: true, processadas };
    } finally {
      this.executando = false;
    }
  }
}

export const scheduler = new Scheduler();
