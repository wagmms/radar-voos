import { config } from '../config.js';
import { rotasRepo } from '../db.js';
import { FlightScanner } from './flight_scanner.js';

class Scheduler {
  constructor() {
    this.timer = null;
    this.executando = false;
    this.intervaloMinutos = config.radar.scanIntervalMinutes;
    this.ultimaExecucao = null;
  }

  iniciar() {
    if (this.timer) return;
    console.log(`⏰ Agendador autônomo iniciado (ciclo a cada ${this.intervaloMinutos} minutos)`);

    // Primeira varredura leve 15 segundos após startup
    setTimeout(() => {
      this.executarCiclo(false);
    }, 15000);

    this.timer = setInterval(() => {
      this.executarCiclo(false);
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
        console.log(`🛫 Verificando rota: ${rota.origem} ➔ ${rota.destino} (${rota.data_ida})`);
        const res = await FlightScanner.escanearRota(rota);

        if (res.sucesso && res.encontrou) {
          console.log(`✅ Preço obtido: R$ ${res.oferta.preco.toFixed(2)} (${res.oferta.termometro})`);
        } else if (res.sucesso && !res.encontrou) {
          console.log(`⚪ Sem voos no filtro: ${res.mensagem}`);
        } else {
          console.log(`⚠️ Falha na checagem: ${res.erro}`);
        }

        processadas++;
        // Pausa defensiva de 2 segundos entre consultas para não estressar a API
        if (rotas.length > 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      return { ok: true, processadas };
    } finally {
      this.executando = false;
    }
  }
}

export const scheduler = new Scheduler();
