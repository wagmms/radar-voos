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
    const { todas = false } = request.body || {};
    if (scheduler.executando) {
      return reply.code(409).send({ ok: false, erro: 'Varredura já está em execução no momento.' });
    }

    const resultado = await scheduler.executarCiclo(Boolean(todas));
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

  // Diagnóstico Google Flights Direct & SerpAPI
  fastify.get('/api/debug/google-flights', async (request, reply) => {
    const { gerarLinkGoogleFlightsCheapest } = await import('../../domain/rotas.js');
    const { SerpApiProvider } = await import('../../services/providers/serpapi_provider.js');
    const url = gerarLinkGoogleFlightsCheapest('RIO', 'RAO', '2027-01-17', null, 6);

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'SOCS=CAISHAgBEhJnd3NfMjAyNDA5MTAtMF9SQzIaAnB0IAEaBgiA_L22Bg; 1P_JAR=2026-10-12-15; NID=511=Qn'
      }
    });

    const html = await resp.text();
    const tem587 = html.includes('587');
    const matches587 = [];
    if (tem587) {
      let pos = 0;
      while ((pos = html.indexOf('587', pos)) !== -1) {
        matches587.push(html.slice(Math.max(0, pos - 80), Math.min(html.length, pos + 80)));
        pos += 3;
        if (matches587.length >= 5) break;
      }
    }

    // Testa SerpAPI com booking_token
    const serpProvider = new SerpApiProvider();
    const serpRes = await serpProvider.buscarOfertas({
      origemCod: 'RIO',
      destinoCod: 'RAO',
      dataIda: '2027-01-17',
      duracaoMaxHoras: 6
    });

    return {
      ok: true,
      url,
      htmlLength: html.length,
      tem587,
      matches587,
      serpApi: serpRes
    };
  });
}
