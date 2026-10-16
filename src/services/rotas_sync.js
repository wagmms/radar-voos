import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { rotasRepo, getDb } from '../db.js';
import { rotaEhSoIda, ehSoIda } from '../domain/rotas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARQUIVO_ROTAS = path.resolve(__dirname, '../../data/rotas.json');

/**
 * Hard Guard Arquitetural (Auditoria Gemini 4 Argon):
 * Impede estritamente qualquer escrita em disco (data/rotas.json) ou commit remoto no GitHub
 * se o processo estiver sob runner de teste ou se o banco ativo não for o oficial de produção.
 */
export function isExecucaoOficialAutorizada() {
  // 1. Bloqueio absoluto se estiver em ambiente de teste ou runner de testes
  const isTestEnv =
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined ||
    process.env.VITEST !== undefined ||
    process.env.TEST === '1' ||
    process.argv.some(arg => arg.includes('test') || arg.includes('validate'));

  if (isTestEnv) {
    return false;
  }

  // 2. Bloqueio se o banco ativo for temporário, em memória ou diferente de data/radar_voos.sqlite
  const dbPathAtual = config.dbPath;
  if (!dbPathAtual || dbPathAtual === ':memory:' || process.env.DB_PATH === ':memory:') {
    return false;
  }

  const dbOficial = path.resolve(process.cwd(), 'data/radar_voos.sqlite');
  const dbAtivo = path.resolve(process.cwd(), dbPathAtual);

  if (dbAtivo !== dbOficial) {
    return false;
  }

  return true;
}

export class RotasSyncService {
  constructor() {
    this.arquivoRotas = ARQUIVO_ROTAS;
    this.sincronizandoGithub = false;
  }

  /**
   * Obtém as rotas salvas no arquivo canônico data/rotas.json
   */
  lerArquivoRotas() {
    try {
      if (fs.existsSync(this.arquivoRotas)) {
        const conteudo = fs.readFileSync(this.arquivoRotas, 'utf-8');
        const json = JSON.parse(conteudo);
        if (Array.isArray(json) && json.length > 0) {
          return json;
        }
      }
    } catch (err) {
      console.warn('⚠️ Falha ao ler data/rotas.json:', err.message);
    }
    return [];
  }

  /**
   * Salva a lista atual de rotas no arquivo local data/rotas.json
   */
  salvarArquivoRotas(rotas = null) {
    try {
      const lista = rotas || rotasRepo.listarTodas(false);
      const sanitizadas = lista.map(r => {
        const soIda = rotaEhSoIda(r);
        return {
          origem: r.origem,
          destino: r.destino,
          codigo_origem: r.codigo_origem,
          codigo_destino: r.codigo_destino,
          data_ida: r.data_ida,
          data_volta: soIda ? null : r.data_volta,
          duracao_max_horas: r.duracao_max_horas || 999,
          preco_alvo: r.preco_alvo || null,
          cabine: r.cabine || 'economy',
          flexibilidade_dias: r.flexibilidade_dias || 0,
          sem_data: r.sem_data ? 1 : 0,
          dias_estadia: soIda ? null : (r.dias_estadia || 10),
          tipo_viagem: soIda ? 'one_way' : 'round_trip',
          ativa: r.ativa !== undefined ? r.ativa : 1
        };
      });

      // Em ambiente de teste ou banco não-oficial, não grava no disco para proteger arquivo canônico
      if (!isExecucaoOficialAutorizada()) {
        return sanitizadas;
      }

      // Validação anti-corrupção: impede salvar payload com mocks conhecidos
      const contemMock = sanitizadas.some(r =>
        ['AAA', 'BBB', 'TEST', 'MOCK', 'XXX'].includes(r.origem) ||
        ['AAA', 'BBB', 'TEST', 'MOCK', 'XXX'].includes(r.destino) ||
        String(r.origem).toLowerCase().includes('teste') ||
        String(r.destino).toLowerCase().includes('teste')
      );
      if (contemMock) {
        console.warn('⚠️ [RotasSync] Tentativa bloqueada de salvar rota de teste em data/rotas.json');
        return sanitizadas;
      }

      const dir = path.dirname(this.arquivoRotas);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.arquivoRotas, JSON.stringify(sanitizadas, null, 2), 'utf-8');
      return sanitizadas;
    } catch (err) {
      console.error('❌ Erro ao salvar data/rotas.json:', err.message);
      return [];
    }
  }

  /**
   * Sincroniza uma lista canônica de rotas com o banco SQLite local,
   * inserindo novas, atualizando modificadas e excluindo as removidas remotamente.
   */
  sincronizarRotasComBanco(rotasCanonica, { excluirAusentes = true } = {}) {
    if (!Array.isArray(rotasCanonica) || rotasCanonica.length === 0) {
      return { inseridas: 0, atualizadas: 0, removidas: 0 };
    }

    const locais = rotasRepo.listarTodas(false);
    const processadosIds = new Set();
    let inseridas = 0;
    let atualizadas = 0;
    let removidas = 0;

    for (const r of rotasCanonica) {
      const match = locais.find(l => {
        if (r.sem_data && l.sem_data) {
          return l.origem === r.origem && l.destino === r.destino;
        }
        return l.origem === r.origem && l.destino === r.destino && l.data_ida === r.data_ida;
      });

      if (match) {
        const soIdaRemota = rotaEhSoIda(r);
        rotasRepo.atualizar(match.id, {
          ...r,
          tipo: soIdaRemota ? 'one_way' : 'round_trip',
          tipo_viagem: soIdaRemota ? 'one_way' : 'round_trip',
          data_volta: soIdaRemota ? null : r.data_volta,
          dias_estadia: soIdaRemota ? null : r.dias_estadia
        });
        processadosIds.add(match.id);
        atualizadas++;
      } else {
        const soIdaNova = rotaEhSoIda(r);
        const nova = rotasRepo.criar({
          ...r,
          tipo: soIdaNova ? 'one_way' : 'round_trip',
          tipo_viagem: soIdaNova ? 'one_way' : 'round_trip',
          data_volta: soIdaNova ? null : r.data_volta,
          dias_estadia: soIdaNova ? null : r.dias_estadia
        });
        if (nova && nova.id) {
          processadosIds.add(nova.id);
          inseridas++;
        }
      }
    }

    if (excluirAusentes) {
      for (const l of locais) {
        if (!processadosIds.has(l.id)) {
          rotasRepo.excluir(l.id);
          removidas++;
        }
      }
    }

    return { inseridas, atualizadas, removidas };
  }

  /**
   * Puxa a versão canônica mais recente de rotas direto do GitHub
   * e atualiza tanto o SQLite local quanto o arquivo data/rotas.json.
   */
  async puxarDoGitHub() {
    if (process.env.NODE_ENV === 'test') {
      const locais = this.lerArquivoRotas();
      this.sincronizarRotasComBanco(locais);
      return { ok: true, totalRotas: locais.length };
    }

    const token = config.github?.token;
    const repo = config.github?.repo || 'wagmms/radar-voos';
    const branch = config.github?.branch || 'main';

    let jsonStr = null;

    // 1. Tentar via GitHub Contents API (autenticado)
    if (token) {
      try {
        const urlContents = `https://api.github.com/repos/${repo}/contents/data/rotas.json?ref=${branch}`;
        const res = await fetch(urlContents, {
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'RadarVoos-Sync',
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (res.ok) {
          const dados = await res.json();
          if (dados.content) {
            jsonStr = Buffer.from(dados.content, 'base64').toString('utf-8');
          }
        }
      } catch (err) {
        console.warn('⚠️ [Two-Way Sync] Falha ao consultar GitHub Contents API:', err.message);
      }
    }

    // 2. Fallback via raw.githubusercontent.com
    if (!jsonStr) {
      try {
        const urlRaw = `https://raw.githubusercontent.com/${repo}/${branch}/data/rotas.json`;
        const resRaw = await fetch(urlRaw, {
          headers: { 'User-Agent': 'RadarVoos-Sync' }
        });
        if (resRaw.ok) {
          jsonStr = await resRaw.text();
        }
      } catch (err) {
        console.warn('⚠️ [Two-Way Sync] Falha ao consultar raw GitHub:', err.message);
      }
    }

    // 3. Processar conteúdo recebido do GitHub
    if (jsonStr) {
      try {
        const rotasRemotas = JSON.parse(jsonStr);
        if (Array.isArray(rotasRemotas) && rotasRemotas.length > 0) {
          const stats = this.sincronizarRotasComBanco(rotasRemotas);
          this.salvarArquivoRotas(rotasRemotas);
          console.log(`✅ [Two-Way Sync] Rotas puxadas do GitHub com sucesso! Total: ${rotasRemotas.length} (inseridas: ${stats.inseridas}, atualizadas: ${stats.atualizadas}, removidas: ${stats.removidas})`);
          return { ok: true, totalRotas: rotasRemotas.length, stats };
        }
      } catch (e) {
        console.warn('⚠️ [Two-Way Sync] JSON de rotas retornado pelo GitHub inválido:', e.message);
      }
    }

    // 4. Fallback: usar arquivo local data/rotas.json
    const rotasLocais = this.lerArquivoRotas();
    if (rotasLocais.length > 0) {
      const stats = this.sincronizarRotasComBanco(rotasLocais);
      console.log(`📁 [Two-Way Sync] Sincronizado a partir do arquivo local data/rotas.json (${rotasLocais.length} rotas)`);
      return { ok: true, fallback: true, totalRotas: rotasLocais.length, stats };
    }

    return { ok: false, mensagem: 'Não foi possível puxar rotas do GitHub nem do arquivo local' };
  }

  /**
   * Sincronização executada na inicialização do servidor (startup).
   * Garante que o ambiente local e produção sempre comecem com as rotas canônicas.
   */
  async sincronizarNoStartup() {
    const db = getDb();
    const contagem = db.prepare('SELECT COUNT(*) as total FROM rotas').get().total;

    // Se o banco já possui rotas cadastradas, preserva a integridade e NUNCA sobrescreve ou deleta no startup
    if (contagem > 0) {
      console.log(`🔒 [Startup] Banco SQLite já possui ${contagem} rotas ativas. Preservando rotas do usuário sem modificação.`);
      return;
    }

    // Apenas se o banco estiver 100% vazio (ex: novo volume limpo), inicializa a partir do arquivo canônico data/rotas.json
    console.log('📦 [Startup] Banco SQLite vazio detectado. Restaurando rotas canônicas do usuário...');
    this.inicializarRotasNoBancoSeVazio();
  }

  /**
   * Inicializa o banco de dados a partir de data/rotas.json se o SQLite estiver vazio
   */
  inicializarRotasNoBancoSeVazio() {
    const db = getDb();
    const contagem = db.prepare('SELECT COUNT(*) as total FROM rotas').get().total;
    if (contagem > 0) {
      return;
    }

    const rotasSalvas = this.lerArquivoRotas();
    if (rotasSalvas.length > 0) {
      console.log(`📦 [Two-Way Sync] Restaurando ${rotasSalvas.length} rotas do arquivo canônico data/rotas.json...`);
      for (const r of rotasSalvas) {
        try {
          rotasRepo.criar(r);
        } catch (e) {
          console.warn(`⚠️ Não foi possível restaurar rota ${r.origem} -> ${r.destino}:`, e.message);
        }
      }
    }
  }

  /**
   * Sincroniza atômica e bidirecionalmente com o repositório GitHub via Contents API
   */
  async sincronizarComGitHub(mensagemCommit = 'chore(sync): sincroniza rotas do cockpit via web [skip ci]') {
    if (!isExecucaoOficialAutorizada()) {
      return { ok: true, commitSha: 'test-commit-mock', totalRotas: 0, skipped: true };
    }

    const token = config.github?.token;
    const repo = config.github?.repo || 'wagmms/radar-voos';
    const branch = config.github?.branch || 'main';

    if (!token) {
      return { ok: false, mensagem: 'GITHUB_TOKEN não configurado para auto-sync remoto' };
    }

    if (this.sincronizandoGithub) {
      return { ok: false, mensagem: 'Sincronização já em andamento' };
    }

    this.sincronizandoGithub = true;

    try {
      const rotas = this.salvarArquivoRotas();
      const conteudoJson = JSON.stringify(rotas, null, 2);
      const urlContents = `https://api.github.com/repos/${repo}/contents/data/rotas.json`;

      // 1. Obter SHA atual do arquivo no GitHub (se existir)
      let shaAtual = null;
      try {
        const resSha = await fetch(urlContents, {
          headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'RadarVoos-Sync',
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (resSha.ok) {
          const dados = await resSha.json();
          shaAtual = dados.sha;
        }
      } catch (_) {}

      // 2. Fazer PUT com novo conteúdo
      const payload = {
        message: mensagemCommit,
        content: Buffer.from(conteudoJson).toString('base64'),
        branch
      };
      if (shaAtual) {
        payload.sha = shaAtual;
      }

      const resCommit = await fetch(urlContents, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'RadarVoos-Sync',
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const dataResult = await resCommit.json();
      if (resCommit.ok) {
        console.log(`✅ [Two-Way Sync] data/rotas.json sincronizado com GitHub (${repo})! Commit: ${dataResult.commit?.sha?.slice(0, 7) || 'ok'}`);
        return { ok: true, commitSha: dataResult.commit?.sha, totalRotas: rotas.length };
      } else {
        console.warn(`⚠️ [Two-Way Sync] Falha ao sincronizar com GitHub: ${dataResult.message}`);
        return { ok: false, erro: dataResult.message };
      }
    } catch (err) {
      console.warn('⚠️ [Two-Way Sync] Erro de rede ao sincronizar com GitHub:', err.message);
      return { ok: false, erro: err.message };
    } finally {
      this.sincronizandoGithub = false;
    }
  }

  /**
   * Notifica que uma rota foi alterada (criação, edição ou exclusão) de forma assíncrona
   * Salva no arquivo local e dispara sincronização remota retornando a Promise
   */
  async notificarAlteracaoRotasAsync(motivo = 'alteracao') {
    if (!isExecucaoOficialAutorizada()) {
      return { ok: true, skipped: true };
    }
    this.salvarArquivoRotas();
    return this.sincronizarComGitHub(`chore(sync): ${motivo} de rotas via Cockpit Web [skip ci]`);
  }

  /**
   * Notifica que uma rota foi alterada (criação, edição ou exclusão)
   * Salva no arquivo local e dispara sincronização remota sem travar a requisição
   */
  notificarAlteracaoRotas(motivo = 'alteracao') {
    if (!isExecucaoOficialAutorizada()) {
      return;
    }
    this.salvarArquivoRotas();
    this.sincronizarComGitHub(`chore(sync): ${motivo} de rotas via Cockpit Web [skip ci]`).catch(() => {});
  }
}

export const rotasSync = new RotasSyncService();
