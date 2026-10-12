import { config } from '../config.js';
import { chavesRepo } from '../db.js';

class SerpApiPool {
  constructor() {
    this.keys = config.serpApi.keys;
    this.limiteDiario = config.serpApi.limiteDiarioPorChave;
    this.limiteMensal = config.serpApi.limiteMensalPorChave;
    this.indiceAtual = 0;
    this.inicializado = false;
  }

  inicializar() {
    if (this.inicializado) return;
    chavesRepo.sincronizar(this.keys);
    this.inicializado = true;
  }

  obterChaveDisponivel() {
    this.inicializar();
    chavesRepo.sincronizar(this.keys);
    const status = chavesRepo.listarStatus();
    const agora = Date.now();

    for (let i = 0; i < status.length; i++) {
      const idx = (this.indiceAtual + i) % status.length;
      const chaveItem = status[idx];

      // Verificar cooldown
      if (chaveItem.cooldown_ate && chaveItem.cooldown_ate > agora) {
        continue;
      }

      // Verificar limites de cota
      if (
        chaveItem.contador_diario < this.limiteDiario &&
        chaveItem.contador_mensal < this.limiteMensal
      ) {
        this.indiceAtual = (idx + 1) % status.length;
        return {
          indice: chaveItem.indice,
          chave: chaveItem.chave,
          contadorDiario: chaveItem.contador_diario,
          contadorMensal: chaveItem.contador_mensal
        };
      }
    }

    return null;
  }

  registrarUso(indice) {
    chavesRepo.incrementarConsumo(indice);
  }

  registrarRateLimit(indice, minutos = 30) {
    chavesRepo.aplicarCooldown(indice, minutos);
  }

  obterRelatorio() {
    this.inicializar();
    chavesRepo.sincronizar(this.keys);
    const status = chavesRepo.listarStatus();
    const agora = Date.now();

    let totalHoje = 0;
    let totalMes = 0;
    const chavesFormatadas = status.map((item, idx) => {
      totalHoje += item.contador_diario;
      totalMes += item.contador_mensal;

      let estado = '🟢 Ativa';
      let cooldownMin = 0;

      if (item.cooldown_ate && item.cooldown_ate > agora) {
        cooldownMin = Math.ceil((item.cooldown_ate - agora) / (1000 * 60));
        estado = `⏳ Cooldown (${cooldownMin}m restantes)`;
      } else if (item.contador_diario >= this.limiteDiario) {
        estado = '🔴 Cota diária esgotada';
      } else if (item.contador_mensal >= this.limiteMensal) {
        estado = '🔴 Cota mensal esgotada';
      }

      return {
        indice: idx + 1,
        chaveMascarada: `${item.chave.slice(0, 6)}...${item.chave.slice(-4)}`,
        contadorDiario: item.contador_diario,
        limiteDiario: this.limiteDiario,
        contadorMensal: item.contador_mensal,
        limiteMensal: this.limiteMensal,
        estado,
        cooldownMin
      };
    });

    const limiteDiarioTotal = this.keys.length * this.limiteDiario;
    const limiteMensalTotal = this.keys.length * this.limiteMensal;

    return {
      totalChaves: this.keys.length,
      buscasHoje: totalHoje,
      limiteDiarioTotal,
      buscasMes: totalMes,
      limiteMensalTotal,
      cotaMensalRestante: limiteMensalTotal - totalMes,
      chaves: chavesFormatadas
    };
  }
}

export const serpApiPool = new SerpApiPool();
