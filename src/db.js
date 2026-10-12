import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { resolverDestino, calcularDataVolta, gerarLinkGoogleFlights } from './domain/rotas.js';

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
    CREATE INDEX IF NOT EXISTS idx_historico_rota ON historico_precos(rota_id, data_checagem);
  `);
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

    const dataVolta = calcularDataVolta(dados.data_ida, dados.data_volta);
    const link = dados.link_google_flights || gerarLinkGoogleFlights(codigoOrigem, codigoDestino, dados.data_ida, dataVolta);

    const stmt = db.prepare(`
      INSERT INTO rotas (
        origem, destino, codigo_origem, codigo_destino,
        data_ida, data_volta, duracao_max_horas, preco_alvo,
        link_google_flights, ativa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const res = stmt.run(
      dados.origem,
      dados.destino,
      codigoOrigem,
      codigoDestino,
      dados.data_ida,
      dataVolta,
      dados.duracao_max_horas || 999,
      dados.preco_alvo || null,
      link
    );

    return rotasRepo.buscarPorId(res.lastInsertRowid);
  },

  atualizarResultadoChecagem: (id, resultado) => {
    const db = getDb();
    const rota = rotasRepo.buscarPorId(id);
    if (!rota) return null;

    const agora = new Date().toISOString();
    const menorHistorico = rota.menor_preco_historico
      ? Math.min(rota.menor_preco_historico, resultado.preco)
      : resultado.preco;

    const stmt = db.prepare(`
      UPDATE rotas SET
        preco_atual = ?,
        menor_preco_historico = ?,
        variacao_texto = ?,
        termometro = ?,
        custo_destino_texto = ?,
        detalhes_voo = ?,
        dica_stopover = ?,
        link_google_flights = ?,
        ultima_checagem = ?
      WHERE id = ?
    `);

    stmt.run(
      resultado.preco,
      menorHistorico,
      resultado.variacao_texto,
      resultado.termometro,
      resultado.custo_destino_texto,
      resultado.detalhes_voo,
      resultado.dica_stopover,
      resultado.link_google_flights,
      agora,
      id
    );

    // Salvar no histórico para séries temporais e gráficos
    if (resultado.preco && resultado.preco > 0) {
      db.prepare(`
        INSERT INTO historico_precos (rota_id, preco, termometro, data_checagem)
        VALUES (?, ?, ?, ?)
      `).run(id, resultado.preco, resultado.termometro, agora);
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
  }
};

/**
 * Operações de Bug Fares
 */
export const bugFaresRepo = {
  inserir: (titulo, link, tipo) => {
    const db = getDb();
    try {
      const stmt = db.prepare(`
        INSERT INTO bug_fares (titulo, link, tipo)
        VALUES (?, ?, ?)
      `);
      return stmt.run(titulo, link, tipo);
    } catch (e) {
      // Ignora erro de link duplicado
      return null;
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
  deveDisparar: (chaveAlerta, precoAtual, precoAnterior, precoAlvo, ehRecordeMinimo, nivelPreco, pctVariacao) => {
    const db = getDb();
    const ultimo = db.prepare(`
      SELECT * FROM alertas_disparados
      WHERE chave_alerta = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(chaveAlerta);

    if (ultimo && Math.abs(ultimo.preco - precoAtual) < 0.01) {
      return { deve: false };
    }

    const agora = new Date();
    const horasDesdeUltimo = ultimo
      ? (agora.getTime() - new Date(ultimo.disparado_em).getTime()) / (1000 * 60 * 60)
      : Infinity;

    const ehQuedaRelampago = pctVariacao <= -config.radar.gatilhoQuedaRelampagoPct;
    const ehNovoRecordeReal = ehRecordeMinimo && (!ultimo || precoAtual < ultimo.preco);
    const cruzouMetaAbaixo = precoAnterior > 0 && precoAnterior > precoAlvo && precoAtual <= precoAlvo;
    const primeiraChecagemAtende = (!precoAnterior || precoAnterior === 0) && (precoAtual <= precoAlvo || nivelPreco === 'LOW');

    let deveAlertar = false;
    let tipoAlerta = null;

    if (ehQuedaRelampago && horasDesdeUltimo >= 48) {
      deveAlertar = true;
      tipoAlerta = 'QUEDA_RELAMPAGO';
    } else if (cruzouMetaAbaixo && horasDesdeUltimo >= 168) { // 7 dias
      deveAlertar = true;
      tipoAlerta = 'ATINGIU_META';
    } else if (ehNovoRecordeReal && horasDesdeUltimo >= 48) {
      deveAlertar = true;
      tipoAlerta = 'NOVO_RECORDE';
    } else if (primeiraChecagemAtende) {
      deveAlertar = true;
      tipoAlerta = 'PRIMEIRA_CHECAGEM';
    }

    if (!deveAlertar) return { deve: false };

    db.prepare(`
      INSERT INTO alertas_disparados (chave_alerta, preco, tipo, disparado_em)
      VALUES (?, ?, ?, ?)
    `).run(chaveAlerta, precoAtual, tipoAlerta, agora.toISOString());

    return { deve: true, tipo: tipoAlerta };
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
 * Inicialização com Rotas Canônicas e Feriados de 2026/2027 se o banco estiver vazio
 */
export function popularDadosIniciaisSeVazio() {
  const db = getDb();
  const contagem = db.prepare('SELECT COUNT(*) as total FROM rotas').get().total;
  if (contagem >= 7) return;

  const rotasIniciais = [
    { origem: 'São Paulo', destino: 'Europa', data_ida: '2026-11-10', data_volta: '14', duracao_max_horas: 16, preco_alvo: 4200 },
    { origem: 'São Paulo', destino: 'Buenos Aires', data_ida: '2026-10-15', data_volta: '7', duracao_max_horas: 8, preco_alvo: 1900 },
    { origem: 'Rio de Janeiro', destino: 'Belém', data_ida: '2027-01-17', data_volta: 'Só Ida', duracao_max_horas: 8, preco_alvo: 700 },
    { origem: 'Rio de Janeiro', destino: 'Ribeirão Preto', data_ida: '2027-01-17', data_volta: 'Só Ida', duracao_max_horas: 6, preco_alvo: 800 },
    // Feriados prolongados 2026/2027
    { origem: 'São Paulo', destino: 'América do Sul', data_ida: '2026-10-09', data_volta: '2026-10-12', duracao_max_horas: 8, preco_alvo: 2000 },
    { origem: 'São Paulo', destino: 'Estados Unidos', data_ida: '2026-12-23', data_volta: '2027-01-02', duracao_max_horas: 15, preco_alvo: 4800 },
    { origem: 'São Paulo', destino: 'Nordeste', data_ida: '2027-03-25', data_volta: '2027-03-28', duracao_max_horas: 6, preco_alvo: 1200 }
  ];

  for (const r of rotasIniciais) {
    const jaExiste = db.prepare('SELECT id FROM rotas WHERE origem = ? AND destino = ? AND data_ida = ?').get(r.origem, r.destino, r.data_ida);
    if (!jaExiste) {
      rotasRepo.criar(r);
    }
  }
}
