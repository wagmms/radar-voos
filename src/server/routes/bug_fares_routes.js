import { bugFaresRepo } from '../../db.js';
import { scheduler } from '../../services/scheduler.js';
import { bugFareHunter } from '../../services/bug_fare_hunter.js';
import { BugFareFeedWatcher } from '../../services/bug_fare_feed_watcher.js';

export async function bugFaresRoutes(fastify) {
  // Listar Bug Fares e Megapromoções
  fastify.get('/api/bug-fares', async (request, reply) => {
    const { limite = 50 } = request.query || {};
    const items = bugFaresRepo.listarRecentes(parseInt(limite, 10));
    return {
      ok: true,
      total: items.length,
      items,
      bugFares: items // Compatibilidade dupla para evitar falha no frontend
    };
  });

  // Forçar varredura proativa completa (Corredores Globais + Feeds de Comunidade + Rotas Monitored)
  fastify.post('/api/bug-fares/escanear', async (request, reply) => {
    const { limiteRotas = 5, incluirFeeds = true, incluirRotas = false } = request.body || {};

    const [resProativo, resFeeds, resRotas] = await Promise.allSettled([
      bugFareHunter.executarVarreduraProativa({ limiteRotas: parseInt(limiteRotas, 10) || 5, notificar: true }),
      incluirFeeds ? BugFareFeedWatcher.escanearFeeds({ notificar: true }) : Promise.resolve(null),
      incluirRotas ? scheduler.executarCiclo(false) : Promise.resolve({ ok: true, pulado: true })
    ]);

    const proativo = resProativo.status === 'fulfilled' ? resProativo.value : { erro: resProativo.reason?.message };
    const feeds = resFeeds.status === 'fulfilled' ? resFeeds.value : { erro: resFeeds.reason?.message };
    const rotas = resRotas.status === 'fulfilled' ? resRotas.value : { erro: resRotas.reason?.message };

    const totalNovosBugs = (proativo.totalBugsEncontrados || 0) + (feeds?.totalBugsEncontrados || 0);

    return {
      ok: true,
      mensagem: `Varredura proativa de Bug Fares concluída com sucesso (${totalNovosBugs} anomalias encontradas)`,
      resultado: {
        proativo,
        feeds,
        rotas
      }
    };
  });
}

