import { rotasRepo } from '../../db.js';
import { resolverDestino, validarPeriodo, calcularDataVolta } from '../../domain/rotas.js';
import { FlightScanner } from '../../services/flight_scanner.js';

export async function rotasRoutes(fastify) {
  // Listar todas as rotas
  fastify.get('/api/rotas', async (request, reply) => {
    const rotas = rotasRepo.listarTodas(false);
    return { ok: true, total: rotas.length, rotas };
  });

  // Obter rota por ID e seu histórico de preços
  fastify.get('/api/rotas/:id', async (request, reply) => {
    const { id } = request.params;
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }
    const historico = rotasRepo.obterHistorico(id, 30);
    return { ok: true, rota, historico };
  });

  // Criar nova rota monitorada
  fastify.post('/api/rotas', async (request, reply) => {
    const body = request.body || {};
    const { origem, destino, data_ida, data_volta, duracao_max_horas, preco_alvo } = body;

    if (!origem || !destino || !data_ida) {
      return reply.code(400).send({
        ok: false,
        erro: 'Campos obrigatórios ausentes: origem, destino e data_ida são necessários.'
      });
    }

    const codOrigem = resolverDestino(origem);
    const codDestino = resolverDestino(destino);

    if (!codOrigem) {
      return reply.code(400).send({
        ok: false,
        erro: `Origem '${origem}' não reconhecida. Use o nome da cidade ou código IATA (ex: SAO, GRU, BSB).`
      });
    }

    if (!codDestino) {
      return reply.code(400).send({
        ok: false,
        erro: `Destino '${destino}' não reconhecido. Use a cidade, país ou código IATA (ex: Buenos Aires, Europa, LIS, NYC).`
      });
    }

    const voltaCalculada = calcularDataVolta(data_ida, data_volta);
    const validacao = validarPeriodo(data_ida, voltaCalculada, voltaCalculada ? 'round_trip' : 'one_way');

    if (!validacao.ok) {
      return reply.code(400).send({ ok: false, erro: validacao.erro });
    }

    const novaRota = rotasRepo.criar({
      origem,
      destino,
      data_ida,
      data_volta: voltaCalculada,
      duracao_max_horas: parseFloat(duracao_max_horas) || 999,
      preco_alvo: parseFloat(preco_alvo) || null
    });

    return reply.code(201).send({ ok: true, rota: novaRota });
  });

  // Excluir rota
  fastify.delete('/api/rotas/:id', async (request, reply) => {
    const { id } = request.params;
    const res = rotasRepo.excluir(id);
    if (res.changes === 0) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }
    return { ok: true, mensagem: 'Rota removida com sucesso' };
  });

  // Forçar verificação imediata de uma rota específica
  fastify.post('/api/rotas/:id/verificar', async (request, reply) => {
    const { id } = request.params;
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }

    const res = await FlightScanner.escanearRota(rota);
    return { ok: true, resultado: res };
  });
}
