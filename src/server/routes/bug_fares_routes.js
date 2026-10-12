import { bugFaresRepo } from '../../db.js';
import { RssScanner } from '../../services/rss_scanner.js';

export async function bugFaresRoutes(fastify) {
  // Listar Bug Fares e Megapromoções
  fastify.get('/api/bug-fares', async (request, reply) => {
    const { limite = 50 } = request.query || {};
    const items = bugFaresRepo.listarRecentes(parseInt(limite, 10));
    return { ok: true, total: items.length, items };
  });

  // Forçar varredura no feed RSS
  fastify.post('/api/bug-fares/escanear', async (request, reply) => {
    const resultado = await RssScanner.verificarFeed();
    return { ok: true, resultado };
  });
}
