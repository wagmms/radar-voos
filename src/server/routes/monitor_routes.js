import { serpApiPool } from '../../services/serpapi_pool.js';
import { scheduler } from '../../services/scheduler.js';
import { chavesRepo } from '../../db.js';
import { notifierTelegram } from '../../services/notifier_telegram.js';

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

  // Forçar varredura sob demanda
  fastify.post('/api/varredura', async (request, reply) => {
    const { todas = false } = request.body || {};
    if (scheduler.executando) {
      return reply.code(409).send({ ok: false, erro: 'Varredura já está em execução no momento.' });
    }

    // Dispara em background ou aguarda
    const resultado = await scheduler.executarCiclo(Boolean(todas));
    return { ok: true, resultado };
  });

  // Resetar contadores de hoje das chaves
  fastify.post('/api/reset-hoje', async (request, reply) => {
    chavesRepo.resetarHoje();
    return { ok: true, mensagem: 'Contadores diários e cooldowns de hoje foram resetados com sucesso.' };
  });

  // Testar notificação do Telegram
  fastify.post('/api/notificacao/teste', async (request, reply) => {
    const enviado = await notifierTelegram.enviarMensagem(
      '✈️ <b>RADAR DE VOOS ATIVO!</b>\n\nO servidor autônomo em Node.js está operacional e monitorando passagens em tempo real.',
      'https://www.google.com/travel/flights',
      '🌍 Abrir Google Flights'
    );
    return { ok: enviado, mensagem: enviado ? 'Alerta de teste enviado com sucesso!' : 'Falha ao enviar mensagem.' };
  });
}
