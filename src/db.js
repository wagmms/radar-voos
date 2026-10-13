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
  rotaEhSoIda
} from './domain/rotas.js';

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
  try { db.exec('ALTER TABLE rotas ADD COLUMN clima_destino_resumo TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN clima_temp_media REAL;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN silenciada_ate TEXT;'); } catch (_) {}
  try { db.exec("ALTER TABLE rotas ADD COLUMN cabine TEXT DEFAULT 'economy';"); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN flexibilidade_dias INTEGER DEFAULT 0;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN melhor_opcao_flexivel TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN sem_data INTEGER DEFAULT 0;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN dias_estadia INTEGER DEFAULT 10;'); } catch (_) {}
  try { db.exec('ALTER TABLE rotas ADD COLUMN destino_real TEXT;'); } catch (_) {}

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

    const semData = dados.sem_data ? 1 : 0;
    const diasEstadia = extrairDiasEstadia(dados.dias_estadia || dados.data_volta, 10);
    const soIda = rotaEhSoIda({
      ...dados,
      sem_data: semData,
      dias_estadia: diasEstadia
    });
    let dataIda = dados.data_ida;
    if (semData && !dataIda) {
      dataIda = gerarDataPadraoInicial(25);
    }

    const dataVolta = semData
      ? (soIda ? null : somarDiasData(dataIda, diasEstadia))
      : (soIda ? null : calcularDataVolta(dataIda, dados.data_volta));

    const link = dados.link_google_flights || gerarLinkGoogleFlights(codigoOrigem, codigoDestino, dataIda, dataVolta);

    const flexibilidadeDias = parseInt(dados.flexibilidade_dias, 10) || 0;

    const stmt = db.prepare(`
      INSERT INTO rotas (
        origem, destino, codigo_origem, codigo_destino,
        data_ida, data_volta, duracao_max_horas, preco_alvo,
        link_google_flights, cabine, flexibilidade_dias,
        sem_data, dias_estadia, ativa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
      link,
      dados.cabine || 'economy',
      flexibilidadeDias,
      semData,
      soIda ? null : diasEstadia
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
    const semData = dados.sem_data !== undefined ? (dados.sem_data ? 1 : 0) : (rota.sem_data || 0);
    const diasEstadia = dados.dias_estadia !== undefined
      ? extrairDiasEstadia(dados.dias_estadia, rota.dias_estadia || 10)
      : (dados.data_volta !== undefined && semData ? extrairDiasEstadia(dados.data_volta, rota.dias_estadia || 10) : (rota.dias_estadia || 10));
    const dataIda = dados.data_ida || rota.data_ida;

    let dataVolta;
    let diasEstadiaFinal = diasEstadia;
    if (dados.data_volta !== undefined) {
      const soIda = rotaEhSoIda({
        ...rota,
        ...dados,
        sem_data: semData,
        dias_estadia: dados.dias_estadia !== undefined ? dados.dias_estadia : (dados.tipo === 'one_way' || ehSoIda(dados.data_volta) ? null : diasEstadia)
      });
      if (semData) {
        dataVolta = soIda ? null : somarDiasData(dataIda, diasEstadia);
        if (soIda) diasEstadiaFinal = null;
      } else {
        dataVolta = soIda ? null : calcularDataVolta(dataIda, dados.data_volta);
        if (soIda) diasEstadiaFinal = null;
      }
    } else if (dados.tipo === 'one_way' || dados.tipo_viagem === 'one_way') {
      dataVolta = null;
      diasEstadiaFinal = null;
    } else if (dados.dias_estadia !== undefined && semData && rota.data_volta) {
      dataVolta = somarDiasData(dataIda, diasEstadia);
    } else {
      dataVolta = rota.data_volta;
      if (rotaEhSoIda(rota)) diasEstadiaFinal = null;
    }

    const precoAlvo = dados.preco_alvo !== undefined ? (parseFloat(dados.preco_alvo) || null) : rota.preco_alvo;
    const duracaoMaxHoras = dados.duracao_max_horas !== undefined ? (parseFloat(dados.duracao_max_horas) || 999) : rota.duracao_max_horas;
    const cabine = dados.cabine || rota.cabine || 'economy';
    const flexibilidadeDias = dados.flexibilidade_dias !== undefined ? (parseInt(dados.flexibilidade_dias, 10) || 0) : (rota.flexibilidade_dias || 0);
    const ativa = dados.ativa !== undefined ? (dados.ativa ? 1 : 0) : rota.ativa;
    const link = gerarLinkGoogleFlights(codigoOrigem, codigoDestino, dataIda, dataVolta);

    // Se a modalidade mudou de Ida e Volta para Só Ida (ou vice-versa), limpa cache de melhor_opcao_flexivel
    const modalidadeMudou = Boolean(rota.data_volta) !== Boolean(dataVolta);
    const melhorOpcaoFlexivel = modalidadeMudou ? null : rota.melhor_opcao_flexivel;

    const stmt = db.prepare(`
      UPDATE rotas SET
        origem = ?,
        destino = ?,
        codigo_origem = ?,
        codigo_destino = ?,
        data_ida = ?,
        data_volta = ?,
        preco_alvo = ?,
        duracao_max_horas = ?,
        cabine = ?,
        flexibilidade_dias = ?,
        sem_data = ?,
        dias_estadia = ?,
        link_google_flights = ?,
        ativa = ?,
        melhor_opcao_flexivel = ?
      WHERE id = ?
    `);

    stmt.run(origem, destino, codigoOrigem, codigoDestino, dataIda, dataVolta, precoAlvo, duracaoMaxHoras, cabine, flexibilidadeDias, semData, diasEstadiaFinal, link, ativa, melhorOpcaoFlexivel, id);
    return rotasRepo.buscarPorId(id);
  },

  atualizarResultadoChecagem: (id, resultado) => {
    const db = getDb();
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) return null;

    const agora = new Date().toISOString();
    const preco = resultado.preco !== undefined ? resultado.preco : (resultado.preco_atual !== undefined ? resultado.preco_atual : null);
    const menorHistorico = rota.menor_preco_historico && preco
      ? Math.min(rota.menor_preco_historico, preco)
      : preco;

    const updateFlexivel = resultado.melhor_opcao_flexivel !== undefined;
    const melhorFlexivelStr = updateFlexivel
      ? (resultado.melhor_opcao_flexivel !== null
          ? (typeof resultado.melhor_opcao_flexivel === 'object' ? JSON.stringify(resultado.melhor_opcao_flexivel) : String(resultado.melhor_opcao_flexivel))
          : null)
      : rota.melhor_opcao_flexivel;

    const dataIdaNova = resultado.data_ida || rota.data_ida;
    const dataVoltaNova = resultado.data_volta !== undefined ? resultado.data_volta : rota.data_volta;
    const linkNovo = resultado.link_google_flights || rota.link_google_flights;

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
        ultima_checagem = ?
      WHERE id = ?
    `);

    stmt.run(
      dataIdaNova,
      dataVoltaNova,
      preco ?? null,
      menorHistorico ?? null,
      resultado.variacao_texto ?? null,
      resultado.termometro ?? null,
      resultado.custo_destino_texto ?? null,
      resultado.detalhes_voo ?? null,
      resultado.dica_stopover ?? null,
      linkNovo,
      resultado.destino_real ?? resultado.destinoReal ?? null,
      resultado.clima_destino_resumo ?? null,
      resultado.clima_temp_media !== undefined ? resultado.clima_temp_media : null,
      melhorFlexivelStr,
      agora,
      id
    );

    // Salvar no histórico para séries temporais e gráficos
    if (preco && preco > 0) {
      db.prepare(`
        INSERT INTO historico_precos (rota_id, preco, termometro, data_checagem)
        VALUES (?, ?, ?, ?)
      `).run(id, preco, resultado.termometro ?? null, agora);
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

    // 2b. SUPRESSÃO DE RUÍDO & DETECÇÃO DE DELTA (proactive-agent):
    const cruzouMetaAbaixo = temPrecoAlvo && precoAnterior > precoAlvo && precoAtual <= precoAlvo;
    const ehOportunidadeDelta = options.classificacaoDelta === 'OPORTUNIDADE' ||
      (typeof options.zScore === 'number' && options.zScore <= -1.5) ||
      (typeof options.deltaMediaPct === 'number' && options.deltaMediaPct >= 30);

    // Se NÃO tem preço alvo definido pelo usuário:
    // Só pode alertar se for uma oportunidade comprovada:
    // - Oportunidade estatística (Z-Score <= -1.5 ou queda >= 30% da média móvel)
    // - OU nível LOW do Google Flights E queda expressiva
    if (!temPrecoAlvo) {
      if (options.classificacaoDelta === 'INFO' && !ehOportunidadeDelta) {
        return { deve: false, motivo: 'oscilacao_normal_mercado_info' };
      }

      if (!ehOportunidadeDelta && (nivelPreco !== 'LOW' || pctVariacao > -config.radar.gatilhoQuedaRelampagoPct)) {
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

    db.prepare(`
      INSERT INTO alertas_disparados (chave_alerta, preco, tipo, disparado_em)
      VALUES (?, ?, ?, ?)
    `).run(chaveAlerta, precoAtual, tipoAlerta, agora.toISOString());

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
export function popularDadosIniciaisSeVazio() {
  const db = getDb();
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
    rotasParaInserir = [
      { origem: 'São Paulo', destino: 'Europa', data_ida: '2026-11-10', data_volta: '14', duracao_max_horas: 16, preco_alvo: 4200 },
      { origem: 'São Paulo', destino: 'Buenos Aires', data_ida: '2026-10-15', data_volta: '7', duracao_max_horas: 8, preco_alvo: 1900 },
      { origem: 'Rio de Janeiro', destino: 'Belém', data_ida: '2027-01-17', data_volta: 'Só Ida', duracao_max_horas: 8, preco_alvo: 700 }
    ];
  }

  for (const r of rotasParaInserir) {
    try {
      rotasRepo.criar(r);
    } catch (_) {}
  }
}
