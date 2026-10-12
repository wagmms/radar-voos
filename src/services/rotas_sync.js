import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { rotasRepo, getDb } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARQUIVO_ROTAS = path.resolve(__dirname, '../../data/rotas.json');

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
      const sanitizadas = lista.map(r => ({
        origem: r.origem,
        destino: r.destino,
        codigo_origem: r.codigo_origem,
        codigo_destino: r.codigo_destino,
        data_ida: r.data_ida,
        data_volta: r.data_volta,
        duracao_max_horas: r.duracao_max_horas || 999,
        preco_alvo: r.preco_alvo || null,
        cabine: r.cabine || 'economy',
        flexibilidade_dias: r.flexibilidade_dias || 0,
        sem_data: r.sem_data ? 1 : 0,
        dias_estadia: r.dias_estadia || 10,
        ativa: r.ativa !== undefined ? r.ativa : 1
      }));

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
   * Inicializa o banco de dados a partir de data/rotas.json se o SQLite estiver vazio
   */
  inicializarRotasNoBancoSeVazio() {
    const db = getDb();
    const contagem = db.prepare('SELECT COUNT(*) as total FROM rotas').get().total;
    if (contagem > 0) {
      // O banco já contém rotas do usuário; não sobrescreve
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
    if (process.env.NODE_ENV === 'test') {
      return { ok: true, commitSha: 'test-commit-mock', totalRotas: 0 };
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
   * Notifica que uma rota foi alterada (criação, edição ou exclusão)
   * Salva no arquivo local e dispara sincronização remota sem travar a requisição
   */
  notificarAlteracaoRotas(motivo = 'alteracao') {
    this.salvarArquivoRotas();
    this.sincronizarComGitHub(`chore(sync): ${motivo} de rotas via Cockpit Web [skip ci]`).catch(() => {});
  }
}

export const rotasSync = new RotasSyncService();
