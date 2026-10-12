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
   */
  async executarCiclo(forcarTodas = false) {
    if (this.executando) {
      console.warn('⚠️ Varredura anterior ainda em andamento. Ignorando novo disparo concorrente.');
      return { ok: false, mensagem: 'Execução já em andamento' };
    }

    this.executando = true;
    this.ultimaExecucao = new Date().toISOString();
    console.log(`🔍 [${new Date().toLocaleTimeString('pt-BR')}] Iniciando ciclo de varredura do Radar de Voos...`);

    try {
      // Fila justa LRU de rotas (varre voos diretamente no motor com detecção de Bug Fares)
      const rotas = forcarTodas
        ? rotasRepo.listarTodas(true)
        : rotasRepo.obterFilaLru(1);

      if (rotas.length === 0) {
        console.log('ℹ️ Nenhuma rota ativa aguardando checagem.');
        return { ok: true, processadas: 0 };
      }

      let processadas = 0;
      for (const rota of rotas) {
        try {
          console.log(`🛫 Verificando rota: ${rota.origem} ➔ ${rota.destino} (${rota.data_ida})`);
          const res = await FlightScanner.escanearRota(rota);

          if (res.sucesso && res.encontrou) {
            console.log(`✅ Preço obtido: R$ ${res.oferta.preco.toFixed(2)} (${res.oferta.termometro})`);
          } else if (res.sucesso && !res.encontrou) {
            console.log(`⚪ Sem voos no filtro: ${res.mensagem}`);
          } else {
            console.log(`⚠️ Falha na checagem: ${res.erro}`);
          }
        } catch (err) {
          console.error(`❌ Erro inesperado ao escanear rota ${rota.origem} ➔ ${rota.destino}:`, err.message);
        }

        processadas++;
        // Pausa defensiva com jitter pseudo-aleatório (2.5s a 4.5s) para simular comportamento humano e quebrar cadência de bot
        if (rotas.length > 1) {
          const jitterMs = 2500 + Math.floor(Math.random() * 2000);
          await new Promise(r => setTimeout(r, jitterMs));
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
