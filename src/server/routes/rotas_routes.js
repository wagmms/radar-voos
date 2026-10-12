import { rotasRepo } from '../../db.js';
import { resolverDestino, validarPeriodo, calcularDataVolta } from '../../domain/rotas.js';
import { FlightScanner } from '../../services/flight_scanner.js';
import { weatherService } from '../../services/weather_service.js';
import { telemetryEvents } from '../../services/telemetry_events.js';

export async function rotasRoutes(fastify) {
  // Listar todas as rotas com histórico recente para sparklines
  fastify.get('/api/rotas', async (request, reply) => {
    const rotas = rotasRepo.listarTodas(false);
    const rotasCompletas = rotas.map(r => ({
      ...r,
      esta_silenciada: rotasRepo.estaSilenciada(r),
      historico_recente: rotasRepo.obterHistoricoRecente(r.id, 10)
    }));
    return { ok: true, total: rotasCompletas.length, rotas: rotasCompletas };
  });

  // Obter rota por ID e seu histórico detalhado
  fastify.get('/api/rotas/:id', async (request, reply) => {
    const { id } = request.params;
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }
    const historico = rotasRepo.obterHistorico(id, 30);
    return {
      ok: true,
      rota: {
        ...rota,
        esta_silenciada: rotasRepo.estaSilenciada(rota)
      },
      historico
    };
  });

  // Obter previsão meteorológica do destino da rota
  fastify.get('/api/rotas/:id/clima', async (request, reply) => {
    const { id } = request.params;
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }

    const clima = await weatherService.obterClimaDestino(rota.codigo_destino || rota.destino, rota.data_ida);
    if (clima.ok) {
      rotasRepo.atualizarClima(rota.id, clima.resumo, clima.tempMedia);
    }
    return { ok: true, clima };
  });

  // Silenciar notificações de uma rota temporariamente
  fastify.post('/api/rotas/:id/silenciar', async (request, reply) => {
    const { id } = request.params;
    const { horas = 24 } = request.body || {};
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }

    const rotaAtualizada = rotasRepo.silenciarRota(id, Number(horas));
    telemetryEvents.emitirAtualizacao('rota_silenciada', { rotaId: id, silenciadaAte: rotaAtualizada.silenciada_ate });
    return { ok: true, mensagem: `Rota silenciada por ${horas} horas`, rota: rotaAtualizada };
  });

  // Criar nova rota monitorada
  fastify.post('/api/rotas', async (request, reply) => {
    const body = request.body || {};
    const {
      origem,
      destino,
      data_ida,
      data_volta,
      duracao_max_horas,
      preco_alvo,
      cabine,
      flexibilidade_dias,
      sem_data,
      dias_estadia
    } = body;

    const ehSemData = Boolean(sem_data === true || sem_data === 1 || sem_data === 'true' || sem_data === '1');

    if (!origem || !destino) {
      return reply.code(400).send({
        ok: false,
        erro: 'Campos obrigatórios ausentes: origem e destino são necessários.'
      });
    }

    if (!ehSemData && !data_ida) {
      return reply.code(400).send({
        ok: false,
        erro: 'Campos obrigatórios ausentes: data_ida é necessária (ou ative a opção de voo flexível sem data).'
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

    let voltaCalculada = null;
    if (data_ida) {
      voltaCalculada = calcularDataVolta(data_ida, data_volta);
      const validacao = validarPeriodo(data_ida, voltaCalculada, voltaCalculada ? 'round_trip' : 'one_way', ehSemData);
      if (!validacao.ok) {
        return reply.code(400).send({ ok: false, erro: validacao.erro });
      }
    }

    // Consulta de clima preliminar
    const dataClima = data_ida || new Date().toISOString().split('T')[0];
    const climaPreliminar = await weatherService.obterClimaDestino(codDestino, dataClima).catch(() => null);

    const novaRota = rotasRepo.criar({
      origem,
      destino,
      data_ida: data_ida || null,
      data_volta: voltaCalculada || data_volta,
      duracao_max_horas: parseFloat(duracao_max_horas) || 999,
      preco_alvo: parseFloat(preco_alvo) || null,
      cabine: cabine || 'economy',
      flexibilidade_dias: parseInt(flexibilidade_dias, 10) || 0,
      sem_data: ehSemData ? 1 : 0,
      dias_estadia: parseInt(dias_estadia, 10) || (data_volta && !isNaN(data_volta) ? parseInt(data_volta, 10) : 10),
      clima_destino_resumo: climaPreliminar?.ok ? climaPreliminar.resumo : null,
      clima_temp_media: climaPreliminar?.ok ? climaPreliminar.tempMedia : null
    });

    telemetryEvents.emitirAtualizacao('nova_rota', { rota: novaRota });
    return reply.code(201).send({ ok: true, rota: novaRota });
  });

  // Atualizar/Alterar opções de uma rota existente
  fastify.put('/api/rotas/:id', async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }

    const ehSemData = body.sem_data !== undefined
      ? Boolean(body.sem_data === true || body.sem_data === 1 || body.sem_data === 'true' || body.sem_data === '1')
      : Boolean(rota.sem_data);

    if (body.data_ida && body.data_volta) {
      const voltaCalculada = calcularDataVolta(body.data_ida, body.data_volta);
      const validacao = validarPeriodo(body.data_ida, voltaCalculada, voltaCalculada ? 'round_trip' : 'one_way', ehSemData);
      if (!validacao.ok) {
        return reply.code(400).send({ ok: false, erro: validacao.erro });
      }
    }

    const rotaAtualizada = rotasRepo.atualizar(id, {
      ...body,
      sem_data: body.sem_data !== undefined ? (ehSemData ? 1 : 0) : undefined
    });
    telemetryEvents.emitirAtualizacao('rota_atualizada', { rota: rotaAtualizada });
    return { ok: true, rota: rotaAtualizada };
  });

  // Excluir rota
  fastify.delete('/api/rotas/:id', async (request, reply) => {
    const { id } = request.params;
    const res = rotasRepo.excluir(id);
    if (res.changes === 0) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }
    telemetryEvents.emitirAtualizacao('rota_removida', { id });
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
    telemetryEvents.emitirAtualizacao('rota_verificada', { rotaId: id, resultado: res });
    return { ok: true, resultado: res };
  });
}
