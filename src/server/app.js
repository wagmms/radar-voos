import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rotasRoutes } from './routes/rotas_routes.js';
import { monitorRoutes } from './routes/monitor_routes.js';
import { bugFaresRoutes } from './routes/bug_fares_routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  await app.register(cors, {
    origin: true
  });

  // Servir frontend estático se a pasta existir; caso contrário, expor endpoint raiz da API
  const publicPath = path.resolve(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    await app.register(fastifyStatic, {
      root: publicPath,
      prefix: '/'
    });
  } else {
    app.get('/', async () => ({
      status: 'ok',
      nome: 'Radar de Voos API',
      versao: '2.21.0',
      mensagem: 'Motor de APIs ativo. Frontend pronto para recriação.'
    }));
  }

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Registrar rotas da API
  await app.register(rotasRoutes);
  await app.register(monitorRoutes);
  await app.register(bugFaresRoutes);

  return app;
}
