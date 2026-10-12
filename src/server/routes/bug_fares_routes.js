import { bugFaresRepo } from '../../db.js';
import { FlightScanner } from '../../services/flight_scanner.js';

export async function bugFaresRoutes(fastify) {
  // Listar Bug Fares e Megapromoções
  fastify.get('/api/bug-fares', async (request, reply) => {
    const { limite = 50 } = request.query || {};
    const items = bugFaresRepo.listarRecentes(parseInt(limite, 10));
    return { ok: true, total: items.length, items };
  });

  // Forçar varredura no GDS para detecção de tarifas
  fastify.post('/api/bug-fares/escanear', async (request, reply) => {
    const resultado = await FlightScanner.executarCiclo(false);
    return { ok: true, mensagem: 'Varredura GDS executada para detecção de anomalias', resultado };
  });
}
