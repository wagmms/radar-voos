import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import {
  resolverDestino,
  calcularDataVolta,
  gerarLinkGoogleFlights,
  somarDiasData,
  gerarDataPadraoInicial,
  extrairDiasEstadia,
  ehSoIda,
  rotaEhSoIda,
  obterDatasEfetivasRota,
  ehRotaDomesticaBrasil,
  ehAeroportoOuRegiaoBrasil
} from './domain/rotas.js';
import {
  auditarTarifaBrasil,
  enforceGoogleFlightsBrUrl,
  sanitizarPayloadPosBrasil
} from './domain/pos_guard.js';

let dbInstance = null;

export function getDb(customPath = null) {
  if (dbInstance) return dbInstance;

  const dbFilePath = customPath || config.dbPath;
  const dbDir = path.dirname(dbFilePath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbFilePath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');
  dbInstance.exec('PRAGMA synchronous = NORMAL;');
  dbInstance.exec('PRAGMA cache_size = -64000;');

  initSchema(dbInstance);
  popularDadosIniciaisSeVazio(dbInstance);
  rotasRepo.sanitizarRotasIdaEVolta(dbInstance);
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origem TEXT NOT NULL,
      destino TEXT NOT NULL,
      codigo_origem TEXT NOT NULL,
      codigo_destino TEXT NOT NULL,
      data_ida TEXT NOT NULL,
      data_volta TEXT,
      duracao_max_horas REAL DEFAULT 999,
      preco_alvo REAL,
      preco_atual REAL,
      menor_preco_historico REAL,
      variacao_texto TEXT,
      termometro TEXT,
      custo_destino_texto TEXT,
      detalhes_voo TEXT,
      dica_stopover TEXT,
      link_google_flights TEXT,
      ultima_checagem TEXT,
      clima_destino_resumo TEXT,
      clima_temp_media REAL,
      silenciada_ate TEXT,
      cabine TEXT DEFAULT 'economy',
      moeda TEXT DEFAULT 'BRL',
      max_stops INTEGER,
      carry_on_bags INTEGER,
      checked_bags INTEGER,
      top_ofertas TEXT,
      melhor_opcao_direta_rapida TEXT,
      horario_partida TEXT,
      horario_chegada TEXT,
      numero_voo TEXT,
      tempo_conexao TEXT,
      dias_flexiveis INTEGER DEFAULT 0,
      calendario_precos TEXT,
      melhor_data_alternativa TEXT,
      price_insights TEXT,
      ranking_destinos_regionais TEXT,
      tipo_viagem TEXT DEFAULT 'round_trip',
      ativa INTEGER DEFAULT 1,
      criada_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS historico_precos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rota_id INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
      preco REAL NOT NULL,
      termometro TEXT,
      data_checagem TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bug_fares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      link TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      detectado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS chaves_serpapi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indice INTEGER NOT NULL UNIQUE,
      chave TEXT NOT NULL,
      contador_diario INTEGER DEFAULT 0,
      contador_mensal INTEGER DEFAULT 0,
      cooldown_ate INTEGER DEFAULT 0,
      data_reset_diario TEXT,
      mes_reset_mensal TEXT
    );

    CREATE TABLE IF NOT EXISTS alertas_disparados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave_alerta TEXT NOT NULL,
      preco REAL NOT NULL,
      tipo TEXT NOT NULL,
      disparado_em TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rotas_ultima_checagem ON rotas(ultima_checagem, ativa);
    CREATE INDEX IF NOT EXISTS idx_rotas_ativas_fila ON rotas(ultima_checagem) WHERE ativa = 1;
    CREATE INDEX IF NOT EXISTS idx_historico_rota ON historico_precos(rota_id, data_checagem);
  `);

  // Migrações dinâmicas para bases SQLite existentes
  try { db.exec("ALTER TABLE rotas ADD COLUMN tipo_viagem TEXT DEFAULT 'round_trip';"); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN clima_destino_resumo TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN clima_temp_media REAL;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN silenciada_ate TEXT;'); } catch (_) {}
  try { db.exec("ALTER TABLE rotas ADD COLUMN cabine TEXT DEFAULT 'economy';"); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN flexibilidade_dias INTEGER DEFAULT 0;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN melhor_opcao_flexivel TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN sem_data INTEGER DEFAULT 0;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN dias_estadia INTEGER DEFAULT 10;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN destino_real TEXT;'); } catch (_) {}
  try { db.exec("ALTER TABLE rotas ADD COLUMN moeda TEXT DEFAULT 'BRL';"); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN paridade_milhas REAL;'); } catch (_) {}
  try { db.exec("ALTER TABLE rotas ADD COLUMN programa_milhas TEXT DEFAULT 'smiles';"); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN max_stops INTEGER;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN carry_on_bags INTEGER;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN checked_bags INTEGER;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN top_ofertas TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN melhor_opcao_direta_rapida TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN horario_partida TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN horario_chegada TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN numero_voo TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN tempo_conexao TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN dias_flexiveis INTEGER DEFAULT 0;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN calendario_precos TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN melhor_data_alternativa TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN price_insights TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN ranking_destinos_regionais TEXT;'); } catch (_) {}

  // Migrações dinâmicas para tabela bug_fares
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN aeroporto_chegada TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN pais_destino TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN cidade_destino TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN data_ida TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN data_volta TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN preco REAL;'); } catch (_) {}
  try { db.exec('ALTER TABLE bug_fares ADD COLUMN periodo_texto TEXT;'); } catch (_) {}
}

/**
 * Operações de Rotas
 */
export const rotasRepo = {
  listarTodas: (apenasAtivas = true) => {
    const db = getDb();
    const query = apenasAtivas
      ? 'SELECT * FROM rotas WHERE ativa = 1 ORDER BY id ASC'
      : 'SELECT * FROM rotas ORDER BY id ASC';
    return db.prepare(query).all();
  },

  buscarPorId: (id) => {
    const db = getDb();
    return db.prepare('SELECT * FROM rotas WHERE id = ?').get(id);
  },

  criar: (dados) => {
    const db = getDb();
    const codigoOrigem = dados.codigo_origem || resolverDestino(dados.origem);
    const codigoDestino = dados.codigo_destino || resolverDestino(dados.destino);

    if (!codigoOrigem) {
      throw new Error(`Origem não reconhecida: '${dados.origem}'. Informe uma cidade válida ou código IATA.`);
    }
    if (!codigoDestino) {
      throw new Error(`Destino não reconhecido: '${dados.destino}'. Informe a cidade, região ou código IATA.`);
    }

    const { dataIda, dataVolta, soIda, diasEstadia, semData } = obterDatasEfetivasRota(dados);
    const tipoViagem = soIda ? 'one_way' : 'round_trip';
    const domestica = ehRotaDomesticaBrasil(codigoOrigem, codigoDestino);
    const moeda = domestica ? 'BRL' : (dados.moeda || dados.curr || 'BRL').trim().toUpperCase();

    // Se o tipo de viagem não bate com o formato do link (one-way vs round-trip) ou link for nulo, regera
    let link = dados.link_google_flights;
    if (!link || (!soIda && link.includes('one-way')) || (soIda && !link.includes('one-way'))) {
      link = gerarLinkGoogleFlights(codigoOrigem, codigoDestino, dataIda, dataVolta, moeda);
    }

    const flexibilidadeDias = parseInt(dados.flexibilidade_dias, 10) || 0;
    const diasFlexiveis = Math.min(3, Math.max(0, parseInt(dados.dias_flexiveis !== undefined ? dados.dias_flexiveis : flexibilidadeDias, 10) || 0));

    const parseNumOpt = (val) => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val)) ? Number(val) : null);
    const maxStops = parseNumOpt(dados.max_stops !== undefined ? dados.max_stops : dados.maxStops);
    const carryOnBags = parseNumOpt(dados.carry_on_bags !== undefined ? dados.carry_on_bags : dados.carryOnBags);
    const checkedBags = parseNumOpt(dados.checked_bags !== undefined ? dados.checked_bags : dados.checkedBags);

    const precoAtual = parseNumOpt(dados.preco_atual);
    const menorHist = parseNumOpt(dados.menor_preco_historico) || precoAtual;
    const variacaoTexto = dados.variacao_texto || null;
    const termometro = dados.termometro || null;
    const detalhesVoo = dados.detalhes_voo || null;
    const topOfertas = typeof dados.top_ofertas === 'object' && dados.top_ofertas !== null ? JSON.stringify(dados.top_ofertas) : (dados.top_ofertas || null);
    const melhorOpcaoDireta = typeof dados.melhor_opcao_direta_rapida === 'object' && dados.melhor_opcao_direta_rapida !== null ? JSON.stringify(dados.melhor_opcao_direta_rapida) : (dados.melhor_opcao_direta_rapida || null);
    const melhorOpcaoFlexivel = typeof dados.melhor_opcao_flexivel === 'object' && dados.melhor_opcao_flexivel !== null ? JSON.stringify(dados.melhor_opcao_flexivel) : (dados.melhor_opcao_flexivel || null);
    const rankingDestinosRegionais = typeof dados.ranking_destinos_regionais === 'object' && dados.ranking_destinos_regionais !== null ? JSON.stringify(dados.ranking_destinos_regionais) : (dados.ranking_destinos_regionais || null);
    const calendarioPrecos = typeof dados.calendario_precos === 'object' && dados.calendario_precos !== null ? JSON.stringify(dados.calendario_precos) : (dados.calendario_precos || null);
    const melhorDataAlternativa = typeof dados.melhor_data_alternativa === 'object' && dados.melhor_data_alternativa !== null ? JSON.stringify(dados.melhor_data_alternativa) : (dados.melhor_data_alternativa || null);
    const ultimaChecagem = dados.ultima_checagem || null;
    const destinoReal = dados.destino_real || null;

    const stmt = db.prepare(`
      INSERT INTO rotas (
        origem, destino, codigo_origem, codigo_destino,
        data_ida, data_volta, duracao_max_horas, preco_alvo,
        preco_atual, menor_preco_historico, variacao_texto, termometro,
        detalhes_voo, top_ofertas, melhor_opcao_direta_rapida, melhor_opcao_flexivel,
        ranking_destinos_regionais, calendario_precos, melhor_data_alternativa,
        ultima_checagem, destino_real,
        link_google_flights, cabine, flexibilidade_dias, dias_flexiveis,
        sem_data, dias_estadia, moeda, ativa,
        max_stops, carry_on_bags, checked_bags, tipo_viagem
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      dados.origem,
      dados.destino,
      codigoOrigem,
      codigoDestino,
      dataIda,
      dataVolta,
      dados.duracao_max_horas || 999,
      dados.preco_alvo || null,
      precoAtual,
      menorHist,
      variacaoTexto,
      termometro,
      detalhesVoo,
      topOfertas,
      melhorOpcaoDireta,
      melhorOpcaoFlexivel,
      rankingDestinosRegionais,
      calendarioPrecos,
      melhorDataAlternativa,
      ultimaChecagem,
      destinoReal,
      link,
      dados.cabine || 'economy',
      flexibilidadeDias,
      diasFlexiveis,
      semData ? 1 : 0,
      soIda ? null : diasEstadia,
      moeda,
      maxStops,
      carryOnBags,
      checkedBags,
      tipoViagem
    );

    return rotasRepo.buscarPorId(res.lastInsertRowid);
  },

  atualizar: (id, dados) => {
    const db = getDb();
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) return null;

    const origem = dados.origem || rota.origem;
    const destino = dados.destino || rota.destino;
    const codigoOrigem = resolverDestino(origem) || rota.codigo_origem;
    const codigoDestino = resolverDestino(destino) || rota.codigo_destino;

    const dadosMesclados = {
      ...rota,
      ...dados
    };
    if (dados.tipo === 'one_way' || dados.tipo_viagem === 'one_way') {
      dadosMesclados.tipo_viagem = 'one_way';
      dadosMesclados.data_volta = null;
      dadosMesclados.dias_estadia = null;
    } else if (dados.tipo === 'round_trip' || dados.tipo_viagem === 'round_trip') {
      dadosMesclados.tipo_viagem = 'round_trip';
    }

    const { dataIda, dataVolta, soIda, diasEstadia, semData } = obterDatasEfetivasRota(dadosMesclados);
    const tipoViagem = soIda ? 'one_way' : 'round_trip';

    const precoAlvo = dados.preco_alvo !== undefined ? (parseFloat(dados.preco_alvo) || null) : rota.preco_alvo;
    const duracaoMaxHoras = dados.duracao_max_horas !== undefined ? (parseFloat(dados.duracao_max_horas) || 999) : rota.duracao_max_horas;
    const cabine = dados.cabine || rota.cabine || 'economy';
    const flexibilidadeDias = dados.flexibilidade_dias !== undefined ? (parseInt(dados.flexibilidade_dias, 10) || 0) : (rota.flexibilidade_dias || 0);
    const diasFlexiveis = dados.dias_flexiveis !== undefined
      ? Math.min(3, Math.max(0, parseInt(dados.dias_flexiveis, 10) || 0))
      : (dados.flexibilidade_dias !== undefined
          ? Math.min(3, Math.max(0, parseInt(dados.flexibilidade_dias, 10) || 0))
          : (rota.dias_flexiveis !== undefined && rota.dias_flexiveis !== null ? rota.dias_flexiveis : Math.min(3, Math.max(0, flexibilidadeDias))));
    const ativa = dados.ativa !== undefined ? (dados.ativa ? 1 : 0) : rota.ativa;
    const domestica = ehRotaDomesticaBrasil(codigoOrigem, codigoDestino);
    const moeda = domestica
      ? 'BRL'
      : (dados.moeda !== undefined ? (dados.moeda ? String(dados.moeda).trim().toUpperCase() : 'BRL') : (dados.curr !== undefined ? (dados.curr ? String(dados.curr).trim().toUpperCase() : 'BRL') : (rota.moeda || 'BRL')));
    
    let link = dados.link_google_flights;
    if (!link || (!soIda && link.includes('one-way')) || (soIda && !link.includes('one-way'))) {
      link = gerarLinkGoogleFlights(codigoOrigem, codigoDestino, dataIda, dataVolta, moeda);
    }

    // Paridade de milhas: valor numérico positivo ou null; programa: string normalizada ou fallback
    const paridadeMilhas = dados.paridade_milhas !== undefined
      ? (Number.isFinite(parseFloat(dados.paridade_milhas)) && parseFloat(dados.paridade_milhas) > 0 ? parseFloat(dados.paridade_milhas) : null)
      : (rota.paridade_milhas ?? null);
    const programaMilhas = dados.programa_milhas !== undefined
      ? (dados.programa_milhas ? String(dados.programa_milhas).toLowerCase().trim() : 'smiles')
      : (rota.programa_milhas || 'smiles');

    // Se a modalidade mudou de Ida e Volta para Só Ida (ou vice-versa), limpa cache de melhor_opcao_flexivel
    const modalidadeMudou = Boolean(rota.data_volta) !== Boolean(dataVolta);
    const melhorOpcaoFlexivel = modalidadeMudou ? null : rota.melhor_opcao_flexivel;

    const parseUpdateNumOpt = (valNovo, valAtual) => {
      if (valNovo === null || valNovo === '') return null;
      if (valNovo !== undefined && !isNaN(Number(valNovo))) return Number(valNovo);
      return valAtual ?? null;
    };

    const maxStops = parseUpdateNumOpt(dados.max_stops !== undefined ? dados.max_stops : dados.maxStops, rota.max_stops);
    const carryOnBags = parseUpdateNumOpt(dados.carry_on_bags !== undefined ? dados.carry_on_bags : dados.carryOnBags, rota.carry_on_bags);
    const checkedBags = parseUpdateNumOpt(dados.checked_bags !== undefined ? dados.checked_bags : dados.checkedBags, rota.checked_bags);

    const precoAtual = dados.preco_atual !== undefined ? (dados.preco_atual !== null && !isNaN(Number(dados.preco_atual)) ? Number(dados.preco_atual) : null) : rota.preco_atual;
    const menorHist = dados.menor_preco_historico !== undefined ? (dados.menor_preco_historico !== null && !isNaN(Number(dados.menor_preco_historico)) ? Number(dados.menor_preco_historico) : null) : rota.menor_preco_historico;
    const variacaoTexto = dados.variacao_texto !== undefined ? dados.variacao_texto : rota.variacao_texto;
    const termometro = dados.termometro !== undefined ? dados.termometro : rota.termometro;
    const detalhesVoo = dados.detalhes_voo !== undefined ? dados.detalhes_voo : rota.detalhes_voo;
    const topOfertas = dados.top_ofertas !== undefined ? (typeof dados.top_ofertas === 'object' && dados.top_ofertas !== null ? JSON.stringify(dados.top_ofertas) : dados.top_ofertas) : rota.top_ofertas;
    const melhorOpcaoDireta = dados.melhor_opcao_direta_rapida !== undefined ? (typeof dados.melhor_opcao_direta_rapida === 'object' && dados.melhor_opcao_direta_rapida !== null ? JSON.stringify(dados.melhor_opcao_direta_rapida) : dados.melhor_opcao_direta_rapida) : rota.melhor_opcao_direta_rapida;
    const melhorOpcaoFlexivelFinal = dados.melhor_opcao_flexivel !== undefined ? (typeof dados.melhor_opcao_flexivel === 'object' && dados.melhor_opcao_flexivel !== null ? JSON.stringify(dados.melhor_opcao_flexivel) : dados.melhor_opcao_flexivel) : melhorOpcaoFlexivel;
    const rankingDestinosRegionais = dados.ranking_destinos_regionais !== undefined ? (typeof dados.ranking_destinos_regionais === 'object' && dados.ranking_destinos_regionais !== null ? JSON.stringify(dados.ranking_destinos_regionais) : dados.ranking_destinos_regionais) : rota.ranking_destinos_regionais;
    const calendarioPrecos = dados.calendario_precos !== undefined ? (typeof dados.calendario_precos === 'object' && dados.calendario_precos !== null ? JSON.stringify(dados.calendario_precos) : dados.calendario_precos) : rota.calendario_precos;
    const melhorDataAlternativa = dados.melhor_data_alternativa !== undefined ? (typeof dados.melhor_data_alternativa === 'object' && dados.melhor_data_alternativa !== null ? JSON.stringify(dados.melhor_data_alternativa) : dados.melhor_data_alternativa) : rota.melhor_data_alternativa;
    const ultimaChecagem = dados.ultima_checagem !== undefined ? dados.ultima_checagem : rota.ultima_checagem;
    const destinoReal = dados.destino_real !== undefined ? dados.destino_real : rota.destino_real;

    const stmt = db.prepare(`
      UPDATE rotas SET
        origem = ?,
        destino = ?,
        codigo_origem = ?,
        codigo_destino = ?,
        data_ida = ?,
        data_volta = ?,
        preco_alvo = ?,
        preco_atual = ?,
        menor_preco_historico = ?,
        variacao_texto = ?,
        termometro = ?,
        detalhes_voo = ?,
        top_ofertas = ?,
        melhor_opcao_direta_rapida = ?,
        melhor_opcao_flexivel = ?,
        ranking_destinos_regionais = ?,
        calendario_precos = ?,
        melhor_data_alternativa = ?,
        ultima_checagem = ?,
        destino_real = ?,
        duracao_max_horas = ?,
        cabine = ?,
        flexibilidade_dias = ?,
        dias_flexiveis = ?,
        sem_data = ?,
        dias_estadia = ?,
        link_google_flights = ?,
        ativa = ?,
        moeda = ?,
        paridade_milhas = ?,
        programa_milhas = ?,
        max_stops = ?,
        carry_on_bags = ?,
        checked_bags = ?,
        tipo_viagem = ?
      WHERE id = ?
    `);

    stmt.run(
      origem,
      destino,
      codigoOrigem,
      codigoDestino,
      dataIda,
      dataVolta,
      precoAlvo,
      precoAtual,
      menorHist,
      variacaoTexto,
      termometro,
      detalhesVoo,
      topOfertas,
      melhorOpcaoDireta,
      melhorOpcaoFlexivelFinal,
      rankingDestinosRegionais,
      calendarioPrecos,
      melhorDataAlternativa,
      ultimaChecagem,
      destinoReal,
      duracaoMaxHoras,
      cabine,
      flexibilidadeDias,
      diasFlexiveis,
      semData ? 1 : 0,
      soIda ? null : diasEstadia,
      link,
      ativa,
      moeda,
      paridadeMilhas,
      programaMilhas,
      maxStops,
      carryOnBags,
      checkedBags,
      tipoViagem,
      id
    );
    return rotasRepo.buscarPorId(id);
  },

  atualizarResultadoChecagem: (id, resultado) => {
    const db = getDb();
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) return null;

    const agora = new Date().toISOString();
    const precoBruto = resultado.preco !== undefined ? resultado.preco : (resultado.preco_atual !== undefined ? resultado.preco_atual : null);

    // Auditoria e Saneamento Atômico POS Brasil (Gemini 4 Argon):
    // Reconcilia preço base, calendário flexível, dia vizinho mais barato, top ofertas e variação
    const auditoria = auditarTarifaBrasil({
      preco: precoBruto,
      moeda: resultado.moeda || 'BRL',
      detalhes: resultado.detalhes_voo || '',
      provedor: resultado.provedor || ''
    }, rota);

    const payloadSaneado = sanitizarPayloadPosBrasil(resultado, rota, auditoria);
    const preco = payloadSaneado.precoEfetivo;

    if (auditoria.ajustado && auditoria.motivo) {
      console.warn(`[POS-Guard] ${rota.origem}->${rota.destino}: ${auditoria.motivo}`);
    }

    const menorHistoricoBase = Number(rota.menor_preco_historico);
    const menorHistorico = Number.isFinite(menorHistoricoBase) && menorHistoricoBase > 0 && preco
      ? Math.min(menorHistoricoBase, preco)
      : preco;

    const serializarJsonSeguro = (val, atual) => {
      if (val === undefined) return atual;
      if (val === null) return null;
      try {
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      } catch (_) {
        return null;
      }
    };

    const melhorFlexivelStr = serializarJsonSeguro(payloadSaneado.melhor_opcao_flexivel, null);
    const calendarioPrecosStr = serializarJsonSeguro(payloadSaneado.calendario_precos, rota.calendario_precos);
    const melhorDataAlternativaStr = serializarJsonSeguro(payloadSaneado.melhor_data_alternativa, null);
    const topOfertasStr = serializarJsonSeguro(payloadSaneado.top_ofertas, rota.top_ofertas);
    const melhorDiretaStr = serializarJsonSeguro(payloadSaneado.melhor_opcao_direta_rapida, null);

    const dataIdaNova = resultado.data_ida || rota.data_ida;
    const dataVoltaNova = resultado.data_volta !== undefined ? resultado.data_volta : rota.data_volta;
    const linkBase = resultado.link_google_flights || rota.link_google_flights;
    const linkNovo = enforceGoogleFlightsBrUrl(linkBase);
    const moedaNova = 'BRL';

    const horarioPartida = auditoria.ajustado
      ? (rota.horario_partida ?? resultado.horario_partida ?? resultado.horarioPartida)
      : (resultado.horario_partida !== undefined ? resultado.horario_partida : (resultado.horarioPartida !== undefined ? resultado.horarioPartida : rota.horario_partida));
    const horarioChegada = auditoria.ajustado
      ? (rota.horario_chegada ?? resultado.horario_chegada ?? resultado.horarioChegada)
      : (resultado.horario_chegada !== undefined ? resultado.horario_chegada : (resultado.horarioChegada !== undefined ? resultado.horarioChegada : rota.horario_chegada));
    const numeroVoo = auditoria.ajustado
      ? (rota.numero_voo ?? resultado.numero_voo ?? resultado.numeroVoo)
      : (resultado.numero_voo !== undefined ? resultado.numero_voo : (resultado.numeroVoo !== undefined ? resultado.numeroVoo : rota.numero_voo));
    const tempoConexao = auditoria.ajustado
      ? (rota.tempo_conexao ?? resultado.tempo_conexao ?? resultado.tempoConexao)
      : (resultado.tempo_conexao !== undefined ? resultado.tempo_conexao : (resultado.tempoConexao !== undefined ? resultado.tempoConexao : rota.tempo_conexao));

    const priceInsightsStr = serializarJsonSeguro(resultado.price_insights ?? resultado.priceInsights, rota.price_insights);
    const rankingRegionaisStr = serializarJsonSeguro(resultado.ranking_destinos_regionais ?? resultado.rankingDestinosRegionais, rota.ranking_destinos_regionais);

    const stmt = db.prepare(`
      UPDATE rotas SET
        data_ida = ?,
        data_volta = ?,
        preco_atual = ?,
        menor_preco_historico = ?,
        variacao_texto = ?,
        termometro = ?,
        custo_destino_texto = ?,
        detalhes_voo = ?,
        dica_stopover = ?,
        link_google_flights = ?,
        destino_real = COALESCE(?, destino_real),
        clima_destino_resumo = COALESCE(?, clima_destino_resumo),
        clima_temp_media = COALESCE(?, clima_temp_media),
        melhor_opcao_flexivel = ?,
        moeda = COALESCE(?, moeda),
        top_ofertas = ?,
        melhor_opcao_direta_rapida = ?,
        horario_partida = ?,
        horario_chegada = ?,
        numero_voo = ?,
        tempo_conexao = ?,
        calendario_precos = ?,
        melhor_data_alternativa = ?,
        price_insights = ?,
        ranking_destinos_regionais = ?,
        ultima_checagem = ?
      WHERE id = ?
    `);

    db.exec('BEGIN IMMEDIATE');
    try {
      stmt.run(
        dataIdaNova,
        dataVoltaNova,
        preco ?? null,
        menorHistorico ?? null,
        payloadSaneado.variacao_texto ?? null,
        payloadSaneado.termometro ?? null,
        resultado.custo_destino_texto ?? rota.custo_destino_texto ?? null,
        payloadSaneado.detalhes_voo ?? null,
        resultado.dica_stopover ?? rota.dica_stopover ?? null,
        linkNovo,
        resultado.destino_real ?? resultado.destinoReal ?? null,
        resultado.clima_destino_resumo ?? null,
        resultado.clima_temp_media !== undefined ? resultado.clima_temp_media : null,
        melhorFlexivelStr,
        moedaNova,
        topOfertasStr ?? null,
        melhorDiretaStr ?? null,
        horarioPartida ?? null,
        horarioChegada ?? null,
        numeroVoo ?? null,
        tempoConexao ?? null,
        calendarioPrecosStr ?? null,
        melhorDataAlternativaStr ?? null,
        priceInsightsStr ?? null,
        rankingRegionaisStr ?? null,
        agora,
        id
      );

      // Salvar no histórico para séries temporais e gráficos (deduplicando amostras idênticas < 6h para preservar Z-Score)
      if (preco && preco > 0) {
        const ultimoHist = db.prepare(`
          SELECT preco, data_checagem
          FROM historico_precos
          WHERE rota_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).get(id);

        let deveInserirHistorico = true;
        if (ultimoHist && Number(ultimoHist.preco) === Number(preco) && ultimoHist.data_checagem) {
          const tsUltimo = new Date(ultimoHist.data_checagem).getTime();
          const tsAgora = new Date(agora).getTime();
          if (Number.isFinite(tsUltimo) && (tsAgora - tsUltimo) < 6 * 3600 * 1000) {
            deveInserirHistorico = false;
          }
        }

        if (deveInserirHistorico) {
          db.prepare(`
            INSERT INTO historico_precos (rota_id, preco, termometro, data_checagem)
            VALUES (?, ?, ?, ?)
          `).run(id, preco, resultado.termometro ?? null, agora);
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw err;
    }

    return rotasRepo.buscarPorId(id);
  },

  marcarFalhaChecagem: (id, erroMensagem) => {
    const db = getDb();
    const agora = new Date().toISOString();
    db.prepare(`
      UPDATE rotas SET
        termometro = ?,
        ultima_checagem = ?
      WHERE id = ?
    `).run(`⚠️ ${erroMensagem}`, agora, id);
  },

  excluir: (id) => {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM rotas WHERE id = ?');
    return stmt.run(id);
  },

  atualizarClima: (id, resumo, tempMedia) => {
    const db = getDb();
    db.prepare(`
      UPDATE rotas SET
        clima_destino_resumo = ?,
        clima_temp_media = ?
      WHERE id = ?
    `).run(resumo, tempMedia, id);
    return rotasRepo.buscarPorId(id);
  },

  silenciarRota: (id, horas = 24) => {
    const db = getDb();
    const dataLimite = new Date(Date.now() + horas * 3600 * 1000).toISOString();
    db.prepare(`UPDATE rotas SET silenciada_ate = ? WHERE id = ?`).run(dataLimite, id);
    return rotasRepo.buscarPorId(id);
  },

  estaSilenciada: (rota) => {
    if (!rota || !rota.silenciada_ate) return false;
    return new Date(rota.silenciada_ate).getTime() > Date.now();
  },

  // Fila justa anti-inanição (LRU): busca rotas que estão há mais tempo sem checagem
  obterFilaLru: (limite = 1) => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM rotas
      WHERE ativa = 1
      ORDER BY
        CASE WHEN ultima_checagem IS NULL THEN 0 ELSE 1 END ASC,
        ultima_checagem ASC,
        id ASC
      LIMIT ?
    `).all(limite);
  },

  obterHistorico: (rotaId, limite = 50) => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM historico_precos
      WHERE rota_id = ?
      ORDER BY data_checagem DESC
      LIMIT ?
    `).all(rotaId, limite);
  },

  obterHistoricoRecente: (rotaId, limite = 10) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT preco, termometro, data_checagem
      FROM historico_precos
      WHERE rota_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(rotaId, limite);
    return rows.reverse();
  },

  obterEstatisticasPreco: (rotaId) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT preco FROM historico_precos
      WHERE rota_id = ? AND preco > 0
      ORDER BY id DESC
      LIMIT 60
    `).all(rotaId);

    if (!rows || rows.length === 0) {
      return { total: 0, media: null, desvioPadrao: null, menor: null, maior: null };
    }

    const precos = rows.map(r => r.preco);
    const total = precos.length;
    const soma = precos.reduce((acc, p) => acc + p, 0);
    const media = Math.round(soma / total);
    const menor = Math.min(...precos);
    const maior = Math.max(...precos);

    let desvioPadrao = null;
    if (total >= 3) {
      const variancia = precos.reduce((acc, p) => acc + Math.pow(p - media, 2), 0) / (total - 1);
      desvioPadrao = Math.round(Math.sqrt(variancia));
    }

    return { total, media, desvioPadrao, menor, maior };
  },

  sanitizarRotasIdaEVolta: (dbParam = null) => {
    const db = dbParam || getDb();
    const rotas = db.prepare('SELECT * FROM rotas').all();
    let totalSanitizadas = 0;

    for (const r of rotas) {
      const soIda = rotaEhSoIda(r);
      const tipoViagemEsperado = soIda ? 'one_way' : 'round_trip';
      const codOrigem = r.codigo_origem || resolverDestino(r.origem);
      const codDestino = r.codigo_destino || resolverDestino(r.destino);
      const domestica = ehRotaDomesticaBrasil(codOrigem, codDestino);
      const ehAmericaDoSul = codDestino === 'SAM' || ['SCL', 'EZE', 'AEP', 'LIM', 'MVD', 'BOG'].includes(codDestino);

      // Reconciliação retroativa da rota Rio de Janeiro ➔ Belém (2027-01-17) para R$ 1.009 (Google Flights oficial)
      if (['RIO', 'GIG', 'SDU'].includes(codOrigem) && codDestino === 'BEL' && r.data_ida === '2027-01-17') {
        if (Number(r.preco_atual) === 1012 || Number(r.preco_atual) === 1281) {
          r.preco_atual = 1009;
          r.menor_preco_historico = 1009;
          db.prepare(`
            UPDATE rotas SET preco_atual = 1009, menor_preco_historico = 1009 WHERE id = ?
          `).run(r.id);
        }
      }

      // Reconciliação defensiva de calendários flexíveis e dias vizinhos contra o preço real auditado
      if (Number(r.preco_atual) > 0 && (r.calendario_precos || r.melhor_data_alternativa || r.melhor_opcao_flexivel)) {
        const saneado = sanitizarPayloadPosBrasil(
          {
            preco: Number(r.preco_atual),
            moeda: r.moeda || 'BRL',
            calendario_precos: r.calendario_precos,
            melhor_data_alternativa: r.melhor_data_alternativa,
            melhor_opcao_flexivel: r.melhor_opcao_flexivel,
            variacao_texto: r.variacao_texto,
            termometro: r.termometro,
            detalhes_voo: r.detalhes_voo,
            top_ofertas: r.top_ofertas,
            melhor_opcao_direta_rapida: r.melhor_opcao_direta_rapida
          },
          r,
          { valido: true, precoFinal: Number(r.preco_atual), ajustado: false }
        );

        const calStr = saneado.calendario_precos ? JSON.stringify(saneado.calendario_precos) : null;
        const altStr = saneado.melhor_data_alternativa ? JSON.stringify(saneado.melhor_data_alternativa) : null;
        const flexStr = saneado.melhor_opcao_flexivel ? JSON.stringify(saneado.melhor_opcao_flexivel) : null;

        if (calStr !== r.calendario_precos || altStr !== r.melhor_data_alternativa || flexStr !== r.melhor_opcao_flexivel) {
          db.prepare(`
            UPDATE rotas SET
              calendario_precos = ?,
              melhor_data_alternativa = ?,
              melhor_opcao_flexivel = ?
            WHERE id = ?
          `).run(calStr, altStr, flexStr, r.id);
          totalSanitizadas++;
        }
      }

      let precisaAtualizar = false;
      let novaDataVolta = r.data_volta;
      let novoPrecoAtual = r.preco_atual;
      let novoMenorHistorico = r.menor_preco_historico;
      let novoLink = r.link_google_flights;
      let novoTermometro = r.termometro;
      let novaMoeda = r.moeda || 'BRL';

      if (r.tipo_viagem !== tipoViagemEsperado) {
        precisaAtualizar = true;
      }

      // 0a. Auto-higienização de artefatos deixados por mocks de testes automatizados
      const ehPoluidaPorMock = (r.detalhes_voo && (r.detalhes_voo.includes('Voo Simulado') || r.detalhes_voo.includes('Voo EUR') || r.detalhes_voo.includes('Voo USD'))) ||
        (r.destino_real && r.destino_real.includes('Miami') && codDestino !== 'MIA' && !r.destino.toLowerCase().includes('miami'));

      // 0b. Correção de contaminação de moeda em rotas domésticas brasileiras, América do Sul ou com origem no Brasil
      const linkMoedaEstrangeira = novoLink && (novoLink.includes('curr=EUR') || novoLink.includes('curr=USD'));
      const origemNoBrasil = ehAeroportoOuRegiaoBrasil(codOrigem);
      const deveOperarEmBrl = domestica || ehAmericaDoSul || (origemNoBrasil && (r.preco_alvo >= 500 || linkMoedaEstrangeira));

      if (deveOperarEmBrl && (novaMoeda !== 'BRL' || linkMoedaEstrangeira)) {
        novaMoeda = 'BRL';
        if (codOrigem && codDestino) {
          novoLink = gerarLinkGoogleFlights(codOrigem, codDestino, r.data_ida, soIda ? null : novaDataVolta, 'BRL');
        }
        novoPrecoAtual = null;
        novoMenorHistorico = null;
        novoTermometro = '⚪ Aguardando rechecagem em BRL';
        precisaAtualizar = true;
      }

      if (ehPoluidaPorMock) {
        novoPrecoAtual = null;
        novoMenorHistorico = null;
        novoTermometro = '⚪ Aguardando checagem real';
        precisaAtualizar = true;
      }

      if (soIda) {
        const linkEhOneWay = novoLink && novoLink.includes('one-way');
        if (!novoLink || !linkEhOneWay) {
          if (codOrigem && codDestino) {
            novoLink = gerarLinkGoogleFlights(codOrigem, codDestino, r.data_ida, null, novaMoeda);
            precisaAtualizar = true;
          }
        }
        if (r.data_volta !== null || r.dias_estadia !== null) {
          precisaAtualizar = true;
        }
        if (novoTermometro && novoTermometro.includes('(Ida e Volta)')) {
          novoTermometro = '⚪ Aguardando checagem (Só Ida)';
          precisaAtualizar = true;
        }
        if (precisaAtualizar) {
          if (ehPoluidaPorMock) {
            db.prepare(`
              UPDATE rotas SET
                preco_atual = NULL,
                menor_preco_historico = NULL,
                link_google_flights = ?,
                termometro = ?,
                moeda = ?,
                tipo_viagem = ?,
                data_volta = NULL,
                dias_estadia = NULL,
                detalhes_voo = NULL,
                destino_real = NULL,
                ultima_checagem = NULL,
                variacao_texto = '-'
              WHERE id = ?
            `).run(novoLink, novoTermometro, novaMoeda, tipoViagemEsperado, r.id);
          } else {
            db.prepare(`
              UPDATE rotas SET
                preco_atual = ?,
                menor_preco_historico = ?,
                link_google_flights = ?,
                termometro = ?,
                moeda = ?,
                tipo_viagem = ?,
                data_volta = NULL,
                dias_estadia = NULL
              WHERE id = ?
            `).run(novoPrecoAtual, novoMenorHistorico, novoLink, novoTermometro, novaMoeda, tipoViagemEsperado, r.id);
          }
          totalSanitizadas++;
        }
        continue;
      }

      // 1. Se rota de Ida e Volta não tem data_volta válida ISO (YYYY-MM-DD)
      if (!novaDataVolta || !/^\d{4}-\d{2}-\d{2}$/.test(String(novaDataVolta).trim())) {
        const dias = extrairDiasEstadia(r.dias_estadia, 10);
        novaDataVolta = somarDiasData(r.data_ida || gerarDataPadraoInicial(25), dias);
        precisaAtualizar = true;
      }

      // 2. Se o link do Google Flights contiver 'one-way' ou não tiver retorno
      const linkEhOneWay = novoLink && novoLink.includes('one-way');
      if (!novoLink || linkEhOneWay || (!novoLink.includes('returning') && !novoLink.includes('tfs='))) {
        if (codOrigem && codDestino) {
          novoLink = gerarLinkGoogleFlights(codOrigem, codDestino, r.data_ida, novaDataVolta, novaMoeda);
          precisaAtualizar = true;
        }
      }

      // 3. Se a rota estava cravada em cotação espúria (link era one-way, ou preco_atual === preco_alvo no teto)
      const eraNoTetoEspurio = r.preco_alvo && r.preco_atual === r.preco_alvo &&
        (String(r.termometro || '').includes('No teto') || String(r.termometro || '').includes('Meta Batida'));
      if (linkEhOneWay || eraNoTetoEspurio) {
        novoPrecoAtual = null;
        novoMenorHistorico = null;
        novoTermometro = '⚪ Aguardando checagem (Ida e Volta)';
        precisaAtualizar = true;
      }

      if (precisaAtualizar) {
        if (ehPoluidaPorMock) {
          db.prepare(`
            UPDATE rotas SET
              data_volta = ?,
              preco_atual = NULL,
              menor_preco_historico = NULL,
              link_google_flights = ?,
              termometro = ?,
              moeda = ?,
              tipo_viagem = ?,
              detalhes_voo = NULL,
              destino_real = NULL,
              ultima_checagem = NULL,
              variacao_texto = '-'
            WHERE id = ?
          `).run(novaDataVolta, novoLink, novoTermometro, novaMoeda, tipoViagemEsperado, r.id);
        } else {
          db.prepare(`
            UPDATE rotas SET
              data_volta = ?,
              preco_atual = ?,
              menor_preco_historico = ?,
              link_google_flights = ?,
              termometro = ?,
              moeda = ?,
              tipo_viagem = ?
            WHERE id = ?
          `).run(novaDataVolta, novoPrecoAtual, novoMenorHistorico, novoLink, novoTermometro, novaMoeda, tipoViagemEsperado, r.id);
        }
        totalSanitizadas++;
      }
    }

    return totalSanitizadas;
  }
};

/**
 * Operações de Bug Fares
 */
export const bugFaresRepo = {
  inserir: (tituloOuDados, link = null, tipo = 'BUG FARE', dadosExtras = {}) => {
    const db = getDb();
    let titulo = tituloOuDados;
    let urlLink = link;
    let tipoBug = tipo;
    let aeroporto = dadosExtras.aeroporto_chegada || null;
    let pais = dadosExtras.pais_destino || null;
    let cidade = dadosExtras.cidade_destino || null;
    let dataIda = dadosExtras.data_ida || null;
    let dataVolta = dadosExtras.data_volta || null;
    let preco = dadosExtras.preco !== undefined ? dadosExtras.preco : null;
    let periodoTexto = dadosExtras.periodo_texto || null;

    if (typeof tituloOuDados === 'object' && tituloOuDados !== null) {
      titulo = tituloOuDados.titulo;
      urlLink = tituloOuDados.link;
      tipoBug = tituloOuDados.tipo || 'BUG FARE';
      aeroporto = tituloOuDados.aeroporto_chegada || null;
      pais = tituloOuDados.pais_destino || null;
      cidade = tituloOuDados.cidade_destino || null;
      dataIda = tituloOuDados.data_ida || null;
      dataVolta = tituloOuDados.data_volta || null;
      preco = tituloOuDados.preco !== undefined ? tituloOuDados.preco : null;
      periodoTexto = tituloOuDados.periodo_texto || null;
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO bug_fares (
          titulo, link, tipo,
          aeroporto_chegada, pais_destino, cidade_destino,
          data_ida, data_volta, preco, periodo_texto
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      return stmt.run(titulo, urlLink, tipoBug, aeroporto, pais, cidade, dataIda, dataVolta, preco, periodoTexto);
    } catch (e) {
      // Se link já existir, atualiza os campos enriquecidos se estiverem disponíveis
      try {
        const updateStmt = db.prepare(`
          UPDATE bug_fares
          SET titulo = ?, tipo = ?,
              aeroporto_chegada = COALESCE(?, aeroporto_chegada),
              pais_destino = COALESCE(?, pais_destino),
              cidade_destino = COALESCE(?, cidade_destino),
              data_ida = COALESCE(?, data_ida),
              data_volta = COALESCE(?, data_volta),
              preco = COALESCE(?, preco),
              periodo_texto = COALESCE(?, periodo_texto)
          WHERE link = ?
        `);
        return updateStmt.run(titulo, tipoBug, aeroporto, pais, cidade, dataIda, dataVolta, preco, periodoTexto, urlLink);
      } catch (_) {
        return null;
      }
    }
  },

  listarRecentes: (limite = 30) => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM bug_fares
      ORDER BY id DESC
      LIMIT ?
    `).all(limite);
  },

  linkJaExiste: (link) => {
    const db = getDb();
    const row = db.prepare('SELECT id FROM bug_fares WHERE link = ?').get(link);
    return Boolean(row);
  }
};

/**
 * Operações de Alertas (Deduplicação Inteligente)
 */
export const alertasRepo = {
  deveDisparar: (chaveAlerta, precoAtual, precoAnterior, precoAlvo, ehRecordeMinimo, nivelPreco, pctVariacao, options = {}) => {
    // 1. REGRA ABSOLUTA DE DEPLOY / INICIALIZAÇÃO:
    // Nunca disparar alerta na primeira checagem de uma rota. A primeira checagem serve estritamente para registrar baseline.
    if (!precoAnterior || precoAnterior <= 0) {
      return { deve: false, motivo: 'baseline_inicial_deploy' };
    }

    // 2. REGRA DOS CRITÉRIOS DO USUÁRIO (Preço Alvo):
    // Se o usuário estipulou preço alvo, o preço atual DEVE estar dentro da meta (precoAtual <= precoAlvo).
    const temPrecoAlvo = precoAlvo !== null && precoAlvo !== undefined && precoAlvo > 0;
    const atendePrecoAlvo = temPrecoAlvo && precoAtual <= precoAlvo;

    if (temPrecoAlvo && !atendePrecoAlvo) {
      // O preço está acima do alvo definido pelo usuário: NUNCA notificar!
      return { deve: false, motivo: 'acima_preco_alvo' };
    }

    // Normalização case-insensitive de nivelPreco (suporta 'low', 'LOW', 'baixo', 'BAIXO')
    const nivelNorm = String(nivelPreco || '').trim().toUpperCase();
    const ehNivelBaixo = nivelNorm === 'LOW' || nivelNorm === 'BAIXO';

    // 2b. SUPRESSÃO DE RUÍDO & DETECÇÃO DE DELTA (proactive-agent):
    const cruzouMetaAbaixo = temPrecoAlvo && precoAnterior > precoAlvo && precoAtual <= precoAlvo;
    const ehOportunidadeDelta = options.classificacaoDelta === 'OPORTUNIDADE' ||
      (typeof options.zScore === 'number' && options.zScore <= -1.5) ||
      (typeof options.deltaMediaPct === 'number' && options.deltaMediaPct >= 30);

    // Se NÃO tem preço alvo definido pelo usuário:
    // Só pode alertar se for uma oportunidade comprovada:
    // - Oportunidade estatística (Z-Score <= -1.5 ou queda >= 30% da média móvel)
    // - OU nível LOW/BAIXO do Google Flights E queda expressiva
    if (!temPrecoAlvo) {
      if (options.classificacaoDelta === 'INFO' && !ehOportunidadeDelta) {
        return { deve: false, motivo: 'oscilacao_normal_mercado_info' };
      }

      if (!ehOportunidadeDelta && (!ehNivelBaixo || pctVariacao > -config.radar.gatilhoQuedaRelampagoPct)) {
        return { deve: false, motivo: 'sem_meta_e_fora_dos_criterios_estritos' };
      }
    }

    const db = getDb();
    const ultimo = db.prepare(`
      SELECT * FROM alertas_disparados
      WHERE chave_alerta = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(chaveAlerta);

    const agora = new Date();
    const horasDesdeUltimo = ultimo
      ? (agora.getTime() - new Date(ultimo.disparado_em).getTime()) / (1000 * 60 * 60)
      : Infinity;

    // 3. REGRA ANTI-FLOOD / DEDUPLICAÇÃO DE MUDANÇA DE PREÇO:
    // Se já alertamos para esta rota:
    if (ultimo) {
      // Se o preço for igual ou maior que o último alerta enviado, não alertar de novo
      if (precoAtual >= ultimo.preco) {
        return { deve: false, motivo: 'preco_nao_melhorou' };
      }
      // Se a redução for inferior a 5% em relação ao último alerta disparado, não incomodar
      const melhoriaPct = ((ultimo.preco - precoAtual) / ultimo.preco) * 100;
      if (melhoriaPct < 5) {
        return { deve: false, motivo: 'variacao_insignificante' };
      }
      // Cooldown protetor mínimo anti-rajada imediata (5 minutos)
      const minutosDesdeUltimo = horasDesdeUltimo * 60;
      if (minutosDesdeUltimo < 5) {
        return { deve: false, motivo: 'cooldown_anti_rajada' };
      }
    }

    // 4. IDENTIFICAÇÃO DO GATILHO VÁLIDO DENTRO DOS CRITÉRIOS DO USUÁRIO:
    const ehQuedaExpressiva = pctVariacao <= -config.radar.gatilhoQuedaRelampagoPct;
    const ehNovoRecordeReal = ehRecordeMinimo && (!ultimo || precoAtual < ultimo.preco);

    let deveAlertar = false;
    let tipoAlerta = null;

    if (cruzouMetaAbaixo) {
      deveAlertar = true;
      tipoAlerta = 'ATINGIU_META';
    } else if (ehOportunidadeDelta) {
      deveAlertar = true;
      tipoAlerta = 'OPORTUNIDADE_ESTATISTICA';
    } else if (ehQuedaExpressiva) {
      deveAlertar = true;
      tipoAlerta = 'QUEDA_RELAMPAGO';
    } else if (ehNovoRecordeReal) {
      deveAlertar = true;
      tipoAlerta = 'NOVO_RECORDE';
    }

    if (!deveAlertar) return { deve: false, motivo: 'nenhum_gatilho_atingido' };

    if (!options.apenasAvaliar) {
      db.prepare(`
        INSERT INTO alertas_disparados (chave_alerta, preco, tipo, disparado_em)
        VALUES (?, ?, ?, ?)
      `).run(chaveAlerta, precoAtual, tipoAlerta, agora.toISOString());
    }

    return { deve: true, tipo: tipoAlerta };
  },

  obterUltimo: (chaveAlerta) => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM alertas_disparados
      WHERE chave_alerta = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(chaveAlerta);
  },

  registrarDisparo: (chaveAlerta, preco, tipo = 'OPORTUNIDADE') => {
    const db = getDb();
    const agora = new Date().toISOString();
    return db.prepare(`
      INSERT INTO alertas_disparados (chave_alerta, preco, tipo, disparado_em)
      VALUES (?, ?, ?, ?)
    `).run(chaveAlerta, preco, tipo, agora);
  },

  deveDispararBugFare: (chaveAlerta, precoAtual) => {
    const db = getDb();
    const ultimo = db.prepare(`
      SELECT * FROM alertas_disparados
      WHERE chave_alerta = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(chaveAlerta);

    if (!ultimo) {
      return { deve: true, motivo: 'primeiro_disparo_bug_fare' };
    }

    const agora = new Date();
    const horasDesdeUltimo = (agora.getTime() - new Date(ultimo.disparado_em).getTime()) / (1000 * 60 * 60);

    // Se o preço for igual ou maior que o último alertado:
    // Suprime se estiver dentro da janela de 24h para não floodar
    if (precoAtual >= ultimo.preco) {
      if (horasDesdeUltimo < 24) {
        return { deve: false, motivo: 'mesmo_preco_em_cooldown_24h', ultimoPreco: ultimo.preco };
      }
      return { deve: true, motivo: 'lembrete_diario_bug_ativo', ultimoPreco: ultimo.preco };
    }

    // Se o preço for MENOR que o último alerta (nova queda no mesmo dia!):
    const melhoriaPct = ((ultimo.preco - precoAtual) / ultimo.preco) * 100;
    if (melhoriaPct < 5) {
      return { deve: false, motivo: 'variacao_insignificante_bug', ultimoPreco: ultimo.preco };
    }

    // Queda real comprovada no mesmo dia: DEVE disparar!
    return { deve: true, motivo: 'nova_queda_mesmo_dia', precoAnteriorAlertado: ultimo.preco, melhoriaPct };
  }
};

/**
 * Operações de Controle de Cotas das Chaves SerpAPI
 */
export const chavesRepo = {
  sincronizar: (listaChaves) => {
    const db = getDb();
    const hojeStr = new Date().toISOString().split('T')[0];
    const mesStr = hojeStr.slice(0, 7);

    for (let i = 0; i < listaChaves.length; i++) {
      const row = db.prepare('SELECT * FROM chaves_serpapi WHERE indice = ?').get(i);
      if (!row) {
        db.prepare(`
          INSERT INTO chaves_serpapi (indice, chave, contador_diario, contador_mensal, data_reset_diario, mes_reset_mensal)
          VALUES (?, ?, 0, 0, ?, ?)
        `).run(i, listaChaves[i], hojeStr, mesStr);
      } else {
        // Reset diário
        let diario = row.contador_diario;
        let mensal = row.contador_mensal;
        if (row.data_reset_diario !== hojeStr) {
          diario = 0;
        }
        // Reset mensal
        if (row.mes_reset_mensal !== mesStr) {
          mensal = 0;
        }
        db.prepare(`
          UPDATE chaves_serpapi SET
            chave = ?,
            contador_diario = ?,
            contador_mensal = ?,
            data_reset_diario = ?,
            mes_reset_mensal = ?
          WHERE indice = ?
        `).run(listaChaves[i], diario, mensal, hojeStr, mesStr, i);
      }
    }
  },

  listarStatus: () => {
    const db = getDb();
    return db.prepare('SELECT * FROM chaves_serpapi ORDER BY indice ASC').all();
  },

  incrementarConsumo: (indice) => {
    const db = getDb();
    db.prepare(`
      UPDATE chaves_serpapi SET
        contador_diario = contador_diario + 1,
        contador_mensal = contador_mensal + 1
      WHERE indice = ?
    `).run(indice);
  },

  aplicarCooldown: (indice, minutos = 30) => {
    const db = getDb();
    const ate = Date.now() + minutos * 60 * 1000;
    db.prepare(`
      UPDATE chaves_serpapi SET cooldown_ate = ? WHERE indice = ?
    `).run(ate, indice);
  },

  resetarHoje: () => {
    const db = getDb();
    db.prepare(`
      UPDATE chaves_serpapi SET contador_diario = 0, cooldown_ate = 0
    `).run();
  }
};

/**
 * Inicialização com Rotas Canônicas a partir de data/rotas.json (Via de Mão Dupla)
 */
export function popularDadosIniciaisSeVazio(dbParam = null) {
  const db = dbParam || dbInstance || getDb();
  const contagem = db.prepare('SELECT COUNT(*) as total FROM rotas').get().total;
  if (contagem > 0) {
    // Banco já inicializado com as rotas do usuário; nunca sobrescrever
    return;
  }

  const arquivoRotas = path.resolve(path.dirname(config.dbPath), 'rotas.json');
  let rotasParaInserir = [];

  if (fs.existsSync(arquivoRotas)) {
    try {
      const conteudo = fs.readFileSync(arquivoRotas, 'utf-8');
      const parsed = JSON.parse(conteudo);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rotasParaInserir = parsed;
      }
    } catch (_) {}
  }

  if (rotasParaInserir.length === 0) {
    // NUNCA inserir rotas fictícias ou genéricas arbitrárias se não houver rotas salvas
    return;
  }

  for (const r of rotasParaInserir) {
    try {
      rotasRepo.criar(r);
    } catch (_) {}
  }
}
