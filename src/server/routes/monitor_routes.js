import { serpApiPool } from '../../services/serpapi_pool.js';
import { scheduler } from '../../services/scheduler.js';
import { chavesRepo } from '../../db.js';
import { notifierTelegram } from '../../services/notifier_telegram.js';
import { telemetryEvents } from '../../services/telemetry_events.js';

export async function monitorRoutes(fastify) {
  // Status completo do sistema e cotas
  fastify.get('/api/status', async (request, reply) => {
    const relatorioPool = serpApiPool.obterRelatorio();
    return {
      ok: true,
      servidor: {
        uptime: process.uptime(),
        agendadorAtivo: Boolean(scheduler.timer),
        agendadorExecutando: scheduler.executando,
        ultimaExecucao: scheduler.ultimaExecucao,
        intervaloMinutos: scheduler.intervaloMinutos
      },
      pool: relatorioPool
    };
  });

  // Server-Sent Events (SSE) para transmissão de telemetria em tempo real ao Cockpit
  fastify.get('/api/stream/telemetria', (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Para proxies Nginx/Cloudflare
    reply.raw.flushHeaders?.();

    // Evento inicial de boas-vindas / heartbeat
    reply.raw.write(`event: conectado\ndata: ${JSON.stringify({ status: 'online', timestamp: new Date().toISOString() })}\n\n`);

    // Listener de telemetria
    const listener = (evento) => {
      try {
        reply.raw.write(`event: telemetria\ndata: ${JSON.stringify(evento)}\n\n`);
      } catch (_) {}
    };

    telemetryEvents.on('telemetria', listener);

    // Heartbeat a cada 25 segundos para manter conexões abertas
    const heartbeatTimer = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch (_) {}
    }, 25000);

    // Prevenção de vazamento de memória ao desconectar cliente (fastify-best-practices)
    request.raw.on('close', () => {
      clearInterval(heartbeatTimer);
      telemetryEvents.off('telemetria', listener);
    });
  });

  // Forçar varredura sob demanda
  fastify.post('/api/varredura', async (request, reply) => {
    const payload = { ...(request.query || {}), ...(request.body || {}) };
    const todas = payload.todas === true || payload.todas === 'true' || payload.todas === 1 || payload.todas === '1';
    const moeda = payload.moeda || payload.curr;

    if (scheduler.executando) {
      return reply.code(409).send({ ok: false, erro: 'Varredura já está em execução no momento.' });
    }

    const resultado = await scheduler.executarCiclo(todas, { moeda });
    telemetryEvents.emitirAtualizacao('ciclo_concluido', { resultado });
    return { ok: true, resultado };
  });

  // Resetar contadores de hoje das chaves
  fastify.post('/api/reset-hoje', async (request, reply) => {
    chavesRepo.resetarHoje();
    telemetryEvents.emitirAtualizacao('chaves_resetadas', {});
    return { ok: true, mensagem: 'Contadores diários e cooldowns de hoje foram resetados com sucesso.' };
  });

  // Testar notificação do Telegram
  fastify.post('/api/notificacao/teste', async (request, reply) => {
    const enviado = await notifierTelegram.enviarMensagem(
      '✈️ <b>RADAR DE VOOS v2.1 ATIVO!</b>\n\nO robô autônomo está operacional com suporte a previsões meteorológicas, rotas ortodrômicas e streaming SSE.',
      'https://www.google.com/travel/flights',
      '🌍 Abrir Google Flights'
    );
    return { ok: enviado, mensagem: enviado ? 'Alerta de teste enviado com sucesso!' : 'Falha ao enviar mensagem.' };
  });
}
