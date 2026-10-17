import { config } from '../config.js';
import { rotasRepo } from '../db.js';
import { FlightScanner } from './flight_scanner.js';
import { bugFareHunter } from './bug_fare_hunter.js';
import { BugFareFeedWatcher } from './bug_fare_feed_watcher.js';

class Scheduler {
  constructor() {
    this.timer = null;
    this.timerScanner = null;
    this.timerFeeds = null;
    this.timerHunter = null;
    this.timeoutInicialFeeds = null;
    this.timeoutInicialScanner = null;
    this.timeoutInicialHunter = null;

    this.executando = false;
    this.executandoFeeds = false;
    this.executandoHunter = false;

    // Cadências de Alta Performance calibradas via Gemini 4 Argon:
    // Pista 1 (Feeds RSS): a cada 3 min (custo zero no Google Flights, reação instantânea a bugs comunitários)
    // Pista 2 (Scanner de rotas): a cada 8 min (micro-lotes LRU, tráfego diluído e orgânico)
    // Pista 3 (Hunter de corredores): a cada 15 min (sonda contínua em anel round-robin)
    this.intervaloMinutos = Math.max(2, parseInt(config.radar.scanIntervalMinutes || '8', 10));
    this.intervaloFeedsMinutos = Math.max(1, parseInt(process.env.FEEDS_INTERVAL_MINUTES || '3', 10));
    this.intervaloHunterMinutos = Math.max(5, parseInt(process.env.HUNTER_INTERVAL_MINUTES || '15', 10));

    this.ultimaExecucao = null;
    this.ultimaExecucaoFeeds = null;
    this.ultimaExecucaoHunter = null;
    this.ciclosContador = 0;
  }

  iniciar() {
    if (this.timerScanner || this.timer) return;
    console.log(`⏰ Agendador autônomo multi-tier iniciado:`);
    console.log(`   ⚡ Pista 1 (Feeds RSS): a cada ${this.intervaloFeedsMinutos} min`);
    console.log(`   🎯 Pista 2 (Scanner LRU): a cada ${this.intervaloMinutos} min`);
    console.log(`   🧭 Pista 3 (Hunter Corredores): a cada ${this.intervaloHunterMinutos} min`);

    // Pista 1: Feeds de Bug Fares (ultrarrápido, inicia aos 5s)
    this.timeoutInicialFeeds = setTimeout(() => {
      this.executarCicloFeeds().catch(err => console.error('❌ Erro no ciclo inicial de feeds:', err));
    }, 5000);
    this.timerFeeds = setInterval(() => {
      this.executarCicloFeeds().catch(err => console.error('❌ Erro periódico de feeds:', err));
    }, this.intervaloFeedsMinutos * 60 * 1000);

    // Pista 2: Scanner de Rotas em micro-lotes (inicia aos 15s)
    this.timeoutInicialScanner = setTimeout(() => {
      this.executarCiclo(false).catch(err => console.error('❌ Erro no ciclo inicial do scanner:', err));
    }, 15000);
    this.timerScanner = setInterval(() => {
      this.executarCiclo(false).catch(err => console.error('❌ Erro periódico do scanner:', err));
    }, this.intervaloMinutos * 60 * 1000);
    this.timer = this.timerScanner; // retrocompatibilidade

    // Pista 3: Hunter de Corredores Globais (inicia aos 35s)
    this.timeoutInicialHunter = setTimeout(() => {
      this.executarCicloHunter().catch(err => console.error('❌ Erro no ciclo inicial do hunter:', err));
    }, 35000);
    this.timerHunter = setInterval(() => {
      this.executarCicloHunter().catch(err => console.error('❌ Erro periódico do hunter:', err));
    }, this.intervaloHunterMinutos * 60 * 1000);
  }

  parar() {
    if (this.timeoutInicialFeeds) { clearTimeout(this.timeoutInicialFeeds); this.timeoutInicialFeeds = null; }
    if (this.timeoutInicialScanner) { clearTimeout(this.timeoutInicialScanner); this.timeoutInicialScanner = null; }
    if (this.timeoutInicialHunter) { clearTimeout(this.timeoutInicialHunter); this.timeoutInicialHunter = null; }

    if (this.timerScanner) { clearInterval(this.timerScanner); this.timerScanner = null; }
    if (this.timerFeeds) { clearInterval(this.timerFeeds); this.timerFeeds = null; }
    if (this.timerHunter) { clearInterval(this.timerHunter); this.timerHunter = null; }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }

    console.log('🛑 Agendador autônomo pausado (todas as 3 pistas canceladas).');
  }

  /**
   * Pista Expressa: Monitoramento de feeds RSS de comunidades de Bug Fares (custo zero no Google)
   */
  async executarCicloFeeds() {
    if (this.executandoFeeds) return { ok: false, motivo: 'Feeds já em execução' };
    this.executandoFeeds = true;
    this.ultimaExecucaoFeeds = new Date().toISOString();

    try {
      const res = await BugFareFeedWatcher.escanearFeeds({ notificar: true });
      return { ok: true, resultado: res };
    } catch (err) {
      console.warn('⚠️ [Scheduler/Feeds] Falha ao escanear feeds RSS:', err.message);
      return { ok: false, erro: err.message };
    } finally {
      this.executandoFeeds = false;
    }
  }

  /**
   * Pista Sniper: Sonda de corredores mundiais em busca de tarifas erro estruturais
   */
  async executarCicloHunter(limiteRotas = 3) {
    if (this.executandoHunter) return { ok: false, motivo: 'Hunter já em execução' };
    this.executandoHunter = true;
    this.ultimaExecucaoHunter = new Date().toISOString();

    try {
      console.log('🧭 [Scheduler/Hunter] Disparando sonda autônoma proativa de Bug Fares em corredores mundiais...');
      const res = await bugFareHunter.executarVarreduraProativa({ limiteRotas, notificar: true });
      return { ok: true, resultado: res };
    } catch (err) {
      console.warn('⚠️ [Scheduler/Hunter] Falha na sonda de corredores:', err.message);
      return { ok: false, erro: err.message };
    } finally {
      this.executandoHunter = false;
    }
  }

  /**
   * Pista Tática: Executa ciclo de monitoramento de rotas em micro-lotes LRU
   * @param {boolean} forcarTodas Se true, verifica todas as rotas ativas em fila
   * @param {Object} [opcoes]
   * @param {string} [opcoes.moeda] Moeda opcional para cotação
   * @param {string} [opcoes.curr] Alias para moeda
   * @param {number} [opcoes.limite] Limite de rotas por lote
   */
  async executarCiclo(forcarTodas = false, { moeda = null, curr = null, limite = null } = {}) {
    if (this.executando) {
      console.warn('⚠️ Varredura de rotas anterior ainda em andamento. Ignorando novo disparo concorrente.');
      return { ok: false, mensagem: 'Execução já em andamento' };
    }

    this.executando = true;
    this.ultimaExecucao = new Date().toISOString();
    console.log(`🔍 [${new Date().toLocaleTimeString('pt-BR')}] Iniciando ciclo de varredura do Radar de Voos...`);

    try {
      // Micro-lote LRU: processa 2 rotas por ciclo para diluir o tráfego ao longo da hora
      const limiteEfetivo = forcarTodas ? 0 : (limite !== null ? limite : 2);
      const resultadoVarredura = await FlightScanner.executarCicloVarredura({
        forcarTodas,
        limite: limiteEfetivo,
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

      this.ciclosContador++;
      return { ok: true, processadas, resultados: resultadoVarredura.resultados || [] };
    } finally {
      this.executando = false;
    }
  }
}

export const scheduler = new Scheduler();
