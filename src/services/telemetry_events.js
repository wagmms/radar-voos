import { EventEmitter } from 'node:events';

class TelemetryEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Suporte a múltiplos clientes SSE conectados
  }

  emitirAtualizacao(tipo, payload) {
    this.emit('telemetria', {
      tipo,
      timestamp: new Date().toISOString(),
      ...payload
    });
  }
}

export const telemetryEvents = new TelemetryEvents();
