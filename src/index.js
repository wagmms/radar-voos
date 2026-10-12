import { config } from './config.js';
import { getDb, popularDadosIniciaisSeVazio, closeDb } from './db.js';
import { serpApiPool } from './services/serpapi_pool.js';
import { scheduler } from './services/scheduler.js';
import { notifierTelegram } from './services/notifier_telegram.js';
import { buildApp } from './server/app.js';

async function bootstrap() {
  console.log('🚀 Inicializando Radar de Voos - Travel Hacking Engine v2.0...');

  // 1. Inicializar Banco de Dados
  getDb();
  popularDadosIniciaisSeVazio();
  console.log('📦 Banco de Dados SQLite sincronizado com sucesso.');

  // 2. Inicializar Pool de Chaves SerpAPI
  serpApiPool.inicializar();
  console.log(`🔑 Pool com ${config.serpApi.keys.length} chaves SerpAPI balanceadas pronto.`);

  // 3. Iniciar Servidor Web Fastify
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`🌐 Cockpit PWA e API REST rodando em: http://${config.host}:${config.port}`);

  // 4. Iniciar Agendador de Varreduras Periódicas
  scheduler.iniciar();

  // 5. Iniciar Bot do Telegram (Comandos Interativos)
  notifierTelegram.iniciarPolling();

  // Tratamento de Encerramento Gracioso (Graceful Shutdown)
  const shutdown = async (signal) => {
    console.log(`\n🛑 Recebido sinal ${signal}. Encerrando graciosamente...`);
    scheduler.parar();
    notifierTelegram.pararPolling();
    await app.close();
    closeDb();
    console.log('👋 Radar de Voos encerrado com segurança.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Falha fatal ao inicializar aplicação:', err);
  process.exit(1);
});
