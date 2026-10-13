import { rotasRepo } from '../../db.js';
import { resolverDestino, validarPeriodo, calcularDataVolta, extrairDiasEstadia, ehSoIda, rotaEhSoIda } from '../../domain/rotas.js';
import { FlightScanner } from '../../services/flight_scanner.js';
import { weatherService } from '../../services/weather_service.js';
import { telemetryEvents } from '../../services/telemetry_events.js';
import { rotasSync } from '../../services/rotas_sync.js';

export async function rotasRoutes(fastify) {
  // Listar todas as rotas com histórico recente para sparklines
  fastify.get('/api/rotas', async (request, reply) => {
    if (request.query && request.query.sync === 'true') {
      try {
        await rotasSync.puxarDoGitHub();
      } catch (_) {}
    }
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

    const diasEstadiaEfetivo = extrairDiasEstadia(dias_estadia || data_volta, 10);
    const soIda = rotaEhSoIda({
      tipo: body.tipo,
      tipo_viagem: body.tipo_viagem,
      data_volta,
      sem_data: ehSemData,
      dias_estadia: dias_estadia !== undefined ? dias_estadia : (data_volta && /\d/.test(data_volta) ? diasEstadiaEfetivo : null)
    });

    let voltaCalculada = null;
    if (data_ida && !ehSemData) {
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
      data_volta: ehSemData ? (soIda ? 'Só Ida' : `${diasEstadiaEfetivo}`) : (voltaCalculada || data_volta),
      duracao_max_horas: parseFloat(duracao_max_horas) || 999,
      preco_alvo: parseFloat(preco_alvo) || null,
      cabine: cabine || 'economy',
      flexibilidade_dias: parseInt(flexibilidade_dias, 10) || 0,
      sem_data: ehSemData ? 1 : 0,
      dias_estadia: soIda ? null : diasEstadiaEfetivo,
      tipo: soIda ? 'one_way' : 'round_trip',
      tipo_viagem: soIda ? 'one_way' : 'round_trip',
      moeda: body.moeda || body.curr || 'BRL',
      clima_destino_resumo: climaPreliminar?.ok ? climaPreliminar.resumo : null,
      clima_temp_media: climaPreliminar?.ok ? climaPreliminar.tempMedia : null
    });

    try {
      await Promise.race([
        rotasSync.notificarAlteracaoRotasAsync('criacao'),
        new Promise(res => setTimeout(res, 3500))
      ]);
    } catch (_) {}

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

    if (!ehSemData && body.data_ida && body.data_volta) {
      const voltaCalculada = calcularDataVolta(body.data_ida, body.data_volta);
      const validacao = validarPeriodo(body.data_ida, voltaCalculada, voltaCalculada ? 'round_trip' : 'one_way', ehSemData);
      if (!validacao.ok) {
        return reply.code(400).send({ ok: false, erro: validacao.erro });
      }
    }

    const soIda = rotaEhSoIda({
      ...rota,
      ...body,
      sem_data: ehSemData,
      data_volta: body.data_volta,
      dias_estadia: body.dias_estadia !== undefined ? body.dias_estadia : (body.tipo === 'one_way' || ehSoIda(body.data_volta) ? null : rota.dias_estadia)
    });

    const rotaAtualizada = rotasRepo.atualizar(id, {
      ...body,
      tipo: soIda ? 'one_way' : 'round_trip',
      tipo_viagem: soIda ? 'one_way' : 'round_trip',
      data_volta: soIda ? null : body.data_volta,
      dias_estadia: soIda ? null : (body.dias_estadia !== undefined ? extrairDiasEstadia(body.dias_estadia, 10) : rota.dias_estadia),
      sem_data: body.sem_data !== undefined ? (ehSemData ? 1 : 0) : undefined
    });

    try {
      await Promise.race([
        rotasSync.notificarAlteracaoRotasAsync('atualizacao'),
        new Promise(res => setTimeout(res, 3500))
      ]);
    } catch (_) {}

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

    try {
      await Promise.race([
        rotasSync.notificarAlteracaoRotasAsync('remocao'),
        new Promise(res => setTimeout(res, 3500))
      ]);
    } catch (_) {}
    telemetryEvents.emitirAtualizacao('rota_removida', { id });
    return { ok: true, mensagem: 'Rota removida com sucesso' };
  });

  // Exportar todas as rotas salvas em formato JSON canônico (backup / mão dupla)
  fastify.get('/api/rotas/exportar', async (request, reply) => {
    const rotas = rotasSync.salvarArquivoRotas();
    reply.header('Content-Disposition', 'attachment; filename="rotas_radar.json"');
    return { ok: true, total: rotas.length, rotas };
  });

  // Importar / Restaurar lote de rotas no banco e arquivo JSON (mão dupla)
  fastify.post('/api/rotas/importar', async (request, reply) => {
    const body = request.body || {};
    const lista = Array.isArray(body.rotas) ? body.rotas : (Array.isArray(body) ? body : []);

    if (lista.length === 0) {
      return reply.code(400).send({ ok: false, erro: 'Nenhuma rota informada no corpo da requisição.' });
    }

    const { substituir = false } = body;
    if (substituir) {
      const db = rotasRepo.listarTodas(false);
      for (const r of db) {
        rotasRepo.excluir(r.id);
      }
    }

    const criadas = [];
    for (const r of lista) {
      try {
        const nova = rotasRepo.criar(r);
        criadas.push(nova);
      } catch (_) {}
    }

    rotasSync.notificarAlteracaoRotas('importacao');
    return { ok: true, importadas: criadas.length, total: rotasRepo.listarTodas(false).length };
  });

  // Puxar rotas da nuvem (GitHub) e sincronizar imediatamente com o SQLite local
  fastify.post('/api/rotas/sync-pull', async (request, reply) => {
    try {
      const resSync = await rotasSync.puxarDoGitHub();
      const rotas = rotasRepo.listarTodas(false);
      return reply.send({ ok: true, sincronizado: resSync.ok, total: rotas.length, stats: resSync.stats || null, rotas });
    } catch (err) {
      return reply.code(500).send({ ok: false, erro: err.message });
    }
  });

  // Forçar sincronização imediata com o GitHub (Two-Way Sync - Push)
  fastify.post('/api/rotas/sincronizar-github', async (request, reply) => {
    rotasSync.salvarArquivoRotas();
    const resSync = await rotasSync.sincronizarComGitHub('chore(sync): sincronização manual de rotas via Cockpit');
    const rotas = rotasRepo.listarTodas(false);
    return { ...resSync, rotas, totalRotas: rotas.length };
  });

  // Forçar verificação imediata de uma rota específica
  fastify.post('/api/rotas/:id/verificar', async (request, reply) => {
    const { id } = request.params;
    const { moeda, curr } = { ...(request.query || {}), ...(request.body || {}) };
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) {
      return reply.code(404).send({ ok: false, erro: 'Rota não encontrada' });
    }

    const res = await FlightScanner.escanearRota(rota, { moeda: moeda || curr });
    telemetryEvents.emitirAtualizacao('rota_verificada', { rotaId: id, resultado: res });
    return { ok: true, resultado: res };
  });
}
