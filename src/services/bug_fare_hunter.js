import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScraplingProvider } from './providers/scrapling_client.js';
import { detectarBugFareEstatistico } from '../domain/bug_fares.js';
import { montarCardBugFare } from '../domain/aeroportos.js';
import { bugFaresRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';
import { telemetryEvents } from './telemetry_events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ARQUIVO_WORKING_BUFFER_PADRAO = path.resolve(__dirname, '../../data/working_buffer.json');

/**
 * Matriz de Corredores Globais de Alta Sensibilidade a Bug Fares
 * Focada nas principais rotas emissoras do Brasil e destinos mundiais com maior histórico de falha tarifária GDS.
 * Utiliza códigos IATA reais (incluindo listas multi-aeroporto para varreduras continentais) compatíveis com o Protobuf tfs.
 */
export const CORREDORES_GLOBAIS_SWEET_SPOT = [
  // --- 8 SUPER-CLUSTERS MACRO (Varredura Continental de Alta Densidade - Origem SAO) ---
  // 1. Europa Principal (SAO -> LIS, MAD, CDG, FCO, AMS, FRA)
  { origem: 'SAO', destino: 'LIS,MAD,CDG,FCO,AMS,FRA', labelDestino: 'Europa (Super-Cluster)', regiao: 'EUROPA', diasEstadia: 11 },
  // 2. Estados Unidos Principal (SAO -> MIA, MCO, JFK, LAX, ORD)
  { origem: 'SAO', destino: 'MIA,MCO,JFK,LAX,ORD', labelDestino: 'EUA (Super-Cluster)', regiao: 'AMERICA_NORTE', diasEstadia: 9 },
  // 3. América do Sul (SAO -> BUE, SCL, LIM, MVD, BOG)
  { origem: 'SAO', destino: 'BUE,SCL,LIM,MVD,BOG', labelDestino: 'América do Sul (Super-Cluster)', regiao: 'AMERICA_SUL', diasEstadia: 6 },
  // 4. Caribe & América Central (SAO -> CUN, PUJ, PTY, SJO)
  { origem: 'SAO', destino: 'CUN,PUJ,PTY,SJO', labelDestino: 'Caribe & Central (Super-Cluster)', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },
  // 5. Europa Ocidental & Reino Unido (SAO -> LHR, BCN, MXP, OPO, ZRH)
  { origem: 'SAO', destino: 'LHR,BCN,MXP,OPO,ZRH', labelDestino: 'Europa II (Super-Cluster)', regiao: 'EUROPA', diasEstadia: 11 },
  // 6. América do Norte & Costa Oeste/Canadá (SAO -> SFO, LAS, BOS, IAD, YYZ)
  { origem: 'SAO', destino: 'SFO,LAS,BOS,IAD,YYZ', labelDestino: 'EUA & Canadá (Super-Cluster)', regiao: 'AMERICA_NORTE', diasEstadia: 10 },
  // 7. Oriente Médio & Hubs Globais (SAO -> DXB, DOH, IST, CAI)
  { origem: 'SAO', destino: 'DXB,DOH,IST,CAI', labelDestino: 'Oriente Médio (Super-Cluster)', regiao: 'ORIENTE_MEDIO', diasEstadia: 10 },
  // 8. Ásia & Oceania (SAO -> TYO, BKK, SIN, ICN)
  { origem: 'SAO', destino: 'TYO,BKK,SIN,ICN', labelDestino: 'Ásia (Super-Cluster)', regiao: 'ASIA_OCEANIA', diasEstadia: 15 },

  // --- CORREDORES CIRÚRGICOS ESPECÍFICOS & SWEET SPOTS HISTÓRICOS ---
  { origem: 'SAO', destino: 'LIS', labelDestino: 'Lisboa', regiao: 'EUROPA', diasEstadia: 10 },
  { origem: 'SAO', destino: 'MAD', labelDestino: 'Madrid', regiao: 'EUROPA', diasEstadia: 10 },
  { origem: 'SAO', destino: 'PAR', labelDestino: 'Paris', regiao: 'EUROPA', diasEstadia: 12 },
  { origem: 'SAO', destino: 'ROM', labelDestino: 'Roma', regiao: 'EUROPA', diasEstadia: 11 },
  { origem: 'RIO', destino: 'LIS', labelDestino: 'Lisboa', regiao: 'EUROPA', diasEstadia: 10 },
  { origem: 'RIO', destino: 'PAR', labelDestino: 'Paris', regiao: 'EUROPA', diasEstadia: 12 },
  { origem: 'SAO', destino: 'MIA', labelDestino: 'Miami', regiao: 'AMERICA_NORTE', diasEstadia: 9 },
  { origem: 'SAO', destino: 'MCO', labelDestino: 'Orlando', regiao: 'AMERICA_NORTE', diasEstadia: 10 },
  { origem: 'SAO', destino: 'NYC', labelDestino: 'Nova York', regiao: 'AMERICA_NORTE', diasEstadia: 8 },
  { origem: 'RIO', destino: 'MIA', labelDestino: 'Miami', regiao: 'AMERICA_NORTE', diasEstadia: 9 },
  { origem: 'SAO', destino: 'CUN', labelDestino: 'Cancún', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },
  { origem: 'SAO', destino: 'PUJ', labelDestino: 'Punta Cana', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },
  { origem: 'BSB', destino: 'CUN', labelDestino: 'Cancún', regiao: 'CARIBE_AMERICA_CENTRAL', diasEstadia: 7 },
  { origem: 'SAO', destino: 'BUE', labelDestino: 'Buenos Aires', regiao: 'AMERICA_SUL', diasEstadia: 5 },
  { origem: 'SAO', destino: 'SCL', labelDestino: 'Santiago', regiao: 'AMERICA_SUL', diasEstadia: 6 },
  { origem: 'SAO', destino: 'MVD', labelDestino: 'Montevidéu', regiao: 'AMERICA_SUL', diasEstadia: 4 },
  { origem: 'RIO', destino: 'BUE', labelDestino: 'Buenos Aires', regiao: 'AMERICA_SUL', diasEstadia: 5 },
  { origem: 'SAO', destino: 'DXB', labelDestino: 'Dubai', regiao: 'ORIENTE_MEDIO', diasEstadia: 10 },
  { origem: 'SAO', destino: 'DOH', labelDestino: 'Doha', regiao: 'ORIENTE_MEDIO', diasEstadia: 10 },
  { origem: 'SAO', destino: 'TYO', labelDestino: 'Tóquio', regiao: 'ASIA_OCEANIA', diasEstadia: 15 },
  { origem: 'SAO', destino: 'SSA', labelDestino: 'Salvador', regiao: 'DOMESTICO', diasEstadia: 5 },
  { origem: 'SAO', destino: 'REC', labelDestino: 'Recife', regiao: 'DOMESTICO', diasEstadia: 6 },
  { origem: 'SAO', destino: 'FOR', labelDestino: 'Fortaleza', regiao: 'DOMESTICO', diasEstadia: 6 },
  { origem: 'SAO', destino: 'FLN', labelDestino: 'Florianópolis', regiao: 'DOMESTICO', diasEstadia: 4 }
];

/**
 * Janela de deduplicação do Working Buffer (24 horas em ms)
 */
const JANELA_DEDUPLICACAO_MS = 24 * 60 * 60 * 1000;

/**
 * Tamanho máximo do buffer por corredor (últimas N leituras)
 */
const BUFFER_MAX_LEITURAS = 5;

/**
 * Limiar de Z-Score para classificar como OPORTUNIDADE (queda estatística significativa)
 */
const ZSCORE_LIMIAR_OPORTUNIDADE = -1.5;

/**
 * Limiar de Z-Score para classificar como BUG_FARE (anomalia estatística severa)
 */
const ZSCORE_LIMIAR_BUG_FARE = -2.5;

/**
 * Queda percentual mínima para classificar como OPORTUNIDADE (sem Z-Score disponível)
 */
const QUEDA_PCT_OPORTUNIDADE = 0.30;

export class BugFareHunter {
  constructor(opcoes = {}) {
    const config = typeof opcoes === 'string' ? { arquivoBuffer: opcoes } : (opcoes || {});
    this.provedorDirect = config.provedorDirect || new ScraplingProvider();
    this.indiceRotacao = 0;
    this.arquivoBuffer = config.arquivoBuffer !== undefined ? config.arquivoBuffer : ARQUIVO_WORKING_BUFFER_PADRAO;

    /**
     * Working Buffer em memória: estado leve de leituras recentes por chave de corredor.
     * Estrutura: Map<chaveCorreder, { leituras: number[], ultimoAlerta: { preco, ts, tipo } | null }>
     */
    this._workingBuffer = new Map();

    const carregarAuto = config.carregarNoBoot !== undefined
      ? Boolean(config.carregarNoBoot)
      : (process.env.NODE_ENV !== 'test' || config.arquivoBuffer !== undefined);

    if (this.arquivoBuffer && carregarAuto) {
      this.carregarWorkingBufferDisco();
    }
  }

  /**
   * Limpa todo o Working Buffer em memória (útil para testes e resets)
   */
  limparWorkingBuffer() {
    this._workingBuffer.clear();
  }

  /**
   * Persiste o estado atual do Working Buffer em disco de forma atômica.
   * Utiliza arquivo temporário no mesmo diretório antes do renameSync para evitar corrupção em falhas.
   * 
   * @param {string} [caminhoDestino] - Caminho do arquivo JSON de destino
   * @param {Object} [opcoes]
   * @param {boolean} [opcoes.forcar=false] - Se true, grava mesmo em ambiente de teste com caminho canônico
   * @returns {boolean} true se persistido com sucesso, false caso contrário
   */
  salvarWorkingBufferDisco(caminhoDestino = this.arquivoBuffer, { forcar = false } = {}) {
    const caminho = caminhoDestino || this.arquivoBuffer;
    if (!caminho) return false;

    // Em ambiente de teste com o arquivo canônico padrão, simula sucesso para não poluir o repo
    if (process.env.NODE_ENV === 'test' && caminho === ARQUIVO_WORKING_BUFFER_PADRAO && !forcar) {
      return true;
    }

    let tempFile = null;
    try {
      const payload = {
        versao: 1,
        atualizadoEm: new Date().toISOString(),
        totalCorredores: this._workingBuffer.size,
        corredores: {}
      };

      for (const [chave, dados] of this._workingBuffer.entries()) {
        payload.corredores[chave] = {
          leituras: Array.isArray(dados.leituras) ? dados.leituras.slice(-BUFFER_MAX_LEITURAS) : [],
          ultimoAlerta: dados.ultimoAlerta ? { ...dados.ultimoAlerta } : null
        };
      }

      const dir = path.dirname(caminho);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      tempFile = path.join(dir, `.tmp_wb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`);
      fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tempFile, caminho);
      return true;
    } catch (err) {
      console.warn(`⚠️ [BugFareHunter] Falha ao persistir Working Buffer em ${caminho}: ${err.message}`);
      if (tempFile && fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }
      return false;
    }
  }

  /**
   * Recarrega o Working Buffer a partir do disco.
   * Suporta tanto formato com envelope ({ versao, corredores }) quanto plano ({ [chave]: dados }).
   * Sanitiza entradas e limita o tamanho máximo de leituras por corredor.
   * 
   * @param {string} [caminhoOrigem] - Caminho do arquivo JSON de origem
   * @returns {boolean} true se carregado com sucesso, false caso contrário
   */
  carregarWorkingBufferDisco(caminhoOrigem = this.arquivoBuffer) {
    const caminho = caminhoOrigem || this.arquivoBuffer;
    if (!caminho) return false;

    try {
      if (!fs.existsSync(caminho)) {
        return false;
      }

      const conteudo = fs.readFileSync(caminho, 'utf-8');
      if (!conteudo || !conteudo.trim()) {
        return false;
      }

      const parsed = JSON.parse(conteudo);
      if (!parsed || typeof parsed !== 'object') {
        return false;
      }

      const mapaCorredores = parsed.corredores && typeof parsed.corredores === 'object'
        ? parsed.corredores
        : parsed;

      let carregados = 0;
      for (const [chave, dados] of Object.entries(mapaCorredores)) {
        if (!dados || typeof dados !== 'object') continue;

        const leituras = Array.isArray(dados.leituras)
          ? dados.leituras
              .filter(p => typeof p === 'number' && !isNaN(p) && p > 0)
              .slice(-BUFFER_MAX_LEITURAS)
          : [];

        let ultimoAlerta = null;
        if (dados.ultimoAlerta && typeof dados.ultimoAlerta === 'object') {
          const { tipo, preco, ts } = dados.ultimoAlerta;
          if (typeof tipo === 'string' && typeof ts === 'number') {
            ultimoAlerta = {
              tipo,
              preco: typeof preco === 'number' ? preco : null,
              ts
            };
          }
        }

        this._workingBuffer.set(chave, { leituras, ultimoAlerta });
        carregados++;
      }

      return true;
    } catch (err) {
      console.warn(`⚠️ [BugFareHunter] Falha ao carregar Working Buffer de ${caminho}: ${err.message}`);
      return false;
    }
  }

  /**
   * Calcula datas estratégicas futuras (terça ou quarta-feira, entre 45 e 120 dias)
   */
  gerarDatasEstrategicas(diasNoFuturo = 60, diasEstadia = 10) {
    const dataPartida = new Date();
    dataPartida.setDate(dataPartida.getDate() + diasNoFuturo);

    // Ajusta para a próxima terça-feira (dia com histórico menor de tarifas corporativas infladas)
    const diaSemana = dataPartida.getDay();
    const diffTerca = (2 - diaSemana + 7) % 7;
    dataPartida.setDate(dataPartida.getDate() + diffTerca);

    const dataRetorno = new Date(dataPartida);
    dataRetorno.setDate(dataRetorno.getDate() + diasEstadia);

    const fmt = (d) => d.toISOString().split('T')[0];
    return { dataIda: fmt(dataPartida), dataVolta: fmt(dataRetorno) };
  }

  /**
   * Retorna o estado interno do Working Buffer para um corredor.
   * Inicializa automaticamente se ainda não existir.
   * @param {string} chave - Chave única do corredor (origem+destino)
   * @returns {{ leituras: number[], ultimoAlerta: object|null }}
   */
  _obterBufferCorreder(chave) {
    if (!this._workingBuffer.has(chave)) {
      this._workingBuffer.set(chave, { leituras: [], ultimoAlerta: null });
    }
    return this._workingBuffer.get(chave);
  }

  /**
   * Registra nova leitura de preço no Working Buffer do corredor.
   * Mantém apenas as últimas BUFFER_MAX_LEITURAS leituras (janela deslizante).
   * @param {string} chave - Chave única do corredor
   * @param {number} preco - Preço observado nesta leitura
   */
  _registrarLeitura(chave, preco) {
    const buffer = this._obterBufferCorreder(chave);
    buffer.leituras.push(preco);
    if (buffer.leituras.length > BUFFER_MAX_LEITURAS) {
      buffer.leituras.shift();
    }
  }

  /**
   * Calcula média e desvio padrão amostral das leituras no buffer.
   * Requer mínimo de 3 leituras para produzir desvio padrão confiável.
   * @param {number[]} leituras
   * @returns {{ media: number|null, desvioPadrao: number|null }}
   */
  _calcularEstatisticasBuffer(leituras) {
    if (!leituras || leituras.length < 2) return { media: null, desvioPadrao: null };

    const n = leituras.length;
    const media = leituras.reduce((acc, v) => acc + v, 0) / n;

    if (n < 3) return { media, desvioPadrao: null };

    const variancia = leituras.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / (n - 1);
    const desvioPadrao = Math.sqrt(variancia);

    return { media, desvioPadrao };
  }

  /**
   * Classifica um preço em relação ao Working Buffer do corredor.
   * Aplica Z-Score quando há desvio padrão disponível; caso contrário, usa queda percentual.
   *
   * Categorias de classificação (padrão proactive-agent):
   *   - INFO       → Oscilação normal de mercado (sem alerta)
   *   - OPORTUNIDADE → Queda > 30% ou Z-Score < -1.5 (alerta moderado)
   *   - BUG_FARE   → Z-Score < -2.5 ou validação por piso estrutural (alerta crítico)
   *
   * @param {string} chave - Chave única do corredor
   * @param {number} preco - Preço atual a classificar
   * @returns {{ categoria: 'INFO'|'OPORTUNIDADE'|'BUG_FARE', zScore: number|null, quedaPct: number|null, media: number|null }}
   */
  _classificarPrecoBuffer(chave, preco) {
    const buffer = this._obterBufferCorreder(chave);
    const { media, desvioPadrao } = this._calcularEstatisticasBuffer(buffer.leituras);

    let zScore = null;
    let quedaPct = null;

    if (media !== null && media > 0) {
      quedaPct = (media - preco) / media;

      if (desvioPadrao !== null && desvioPadrao >= 30) {
        zScore = (preco - media) / desvioPadrao;

        if (zScore <= ZSCORE_LIMIAR_BUG_FARE) {
          return { categoria: 'BUG_FARE', zScore, quedaPct, media };
        }
        if (zScore <= ZSCORE_LIMIAR_OPORTUNIDADE) {
          return { categoria: 'OPORTUNIDADE', zScore, quedaPct, media };
        }
      } else if (quedaPct >= QUEDA_PCT_OPORTUNIDADE) {
        // Fallback sem desvio padrão robusto: queda percentual simples
        return { categoria: 'OPORTUNIDADE', zScore: null, quedaPct, media };
      }
    }

    return { categoria: 'INFO', zScore, quedaPct, media };
  }

  /**
   * Verifica se um alerta idêntico já foi disparado para este corredor na janela de 24h.
   * Deduplicação defensiva: suprime alertas repetidos do mesmo tipo dentro da janela.
   * @param {string} chave
   * @param {string} tipo - Categoria do alerta ('OPORTUNIDADE' | 'BUG_FARE')
   * @param {number|null} preco - Preço atual para verificar se houve melhoria significativa
   * @returns {boolean} true se deve suprimir (alerta recente ainda válido)
   */
  _ehAlertaDuplicado(chave, tipo, preco = null) {
    const buffer = this._obterBufferCorreder(chave);
    const ultimo = buffer.ultimoAlerta;
    if (!ultimo) return false;

    const agora = Date.now();
    const dentroJanela = (agora - ultimo.ts) < JANELA_DEDUPLICACAO_MS;
    const mesmoTipo = ultimo.tipo === tipo;

    if (!dentroJanela || !mesmoTipo) return false;

    // Se o preço atual for informado e representar uma nova queda relevante (queda >= 5%)
    // NÃO é duplicata: permite notificar uma nova queda no mesmo dia!
    if (preco && ultimo.preco && preco < ultimo.preco) {
      const melhoriaPct = ((ultimo.preco - preco) / ultimo.preco) * 100;
      if (melhoriaPct >= 5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Registra um alerta disparado no Working Buffer para deduplicação futura.
   * @param {string} chave
   * @param {string} tipo
   * @param {number} preco
   */
  _registrarAlertaDisparado(chave, tipo, preco) {
    const buffer = this._obterBufferCorreder(chave);
    buffer.ultimoAlerta = { tipo, preco, ts: Date.now() };
  }

  /**
   * Escaneia um único corredor específico, resolvendo o aeroporto/cidade real vencedora
   * (especialmente em buscas multi-aeroporto), atualizando o Working Buffer e avaliando Bug Fares.
   *
   * @param {Object} corredor - Objeto do corredor a ser escaneado
   * @param {Object} opcoes
   * @param {number} [opcoes.diasNoFuturo=60]
   * @param {boolean} [opcoes.notificar=true]
   * @returns {Promise<{ avaliado: boolean, categoria: string|null, bugCard: Object|null, oportunidade: Object|null }>}
   */
  async escanearCorredor(corredor, { diasNoFuturo = 60, notificar = true } = {}) {
    const chaveCorreder = `${corredor.origem}:${corredor.destino}`;
    const { dataIda, dataVolta } = this.gerarDatasEstrategicas(
      diasNoFuturo,
      corredor.diasEstadia || 10
    );

    console.log(`🔍 Investigando corredor: ${corredor.origem} ➔ ${corredor.labelDestino} (${dataIda} a ${dataVolta})`);
    const res = await this.provedorDirect.buscarOfertas({
      origemCod: corredor.origem,
      destinoCod: corredor.destino,
      dataIda,
      dataVolta,
      cabine: 'economy',
      adultos: 1
    });

    if (!res.ok || !res.encontrouVoos || !(res.oferta?.preco > 0)) {
      console.log(`⚪ Sem resultado válido para ${corredor.origem} ➔ ${corredor.labelDestino}`);
      return { avaliado: false, categoria: null, bugCard: null, oportunidade: null };
    }

    const preco = res.oferta.preco;
    const codigoDestinoReal = res.oferta.codigoDestinoReal || (corredor.destino.includes(',') ? corredor.destino.split(',')[0].trim() : corredor.destino);
    const destinoReal = res.oferta.destinoReal || corredor.labelDestino;
    const ciaAerea = res.oferta.cia || 'Cia Aérea';
    const ehMultiAeroporto = corredor.destino.includes(',');
    const labelExibicaoDestino = ehMultiAeroporto && res.oferta.destinoReal
      ? res.oferta.destinoReal
      : corredor.labelDestino;

    // --- Working Buffer: registrar leitura atual ---
    this._registrarLeitura(chaveCorreder, preco);
    const { categoria, zScore, quedaPct, media } = this._classificarPrecoBuffer(chaveCorreder, preco);

    // --- Validação por Piso Estrutural (detectarBugFareEstatistico) ---
    const buffer = this._obterBufferCorreder(chaveCorreder);
    const { media: mediaBuffer, desvioPadrao: dpBuffer } = this._calcularEstatisticasBuffer(buffer.leituras);
    const analiseEstatistica = detectarBugFareEstatistico({
      origemCod: corredor.origem,
      destinoCod: codigoDestinoReal || corredor.destino,
      preco,
      precoMedioHistorico: mediaBuffer,
      desvioPadrao: dpBuffer,
      cabine: 'economy',
      dataVolta
    });

    // --- Determinar categoria final (piso estrutural sobrepõe classificação do buffer) ---
    const categoriaFinal = analiseEstatistica.ehBugFare ? 'BUG_FARE' : categoria;
    const motivoFinal = analiseEstatistica.ehBugFare
      ? analiseEstatistica.motivo
      : (zScore !== null
        ? `Z-Score: ${zScore.toFixed(2)} | Queda: ${quedaPct !== null ? (quedaPct * 100).toFixed(1) : '?'}% vs média R$ ${media?.toFixed(0) ?? '?'}`
        : (quedaPct !== null ? `Queda de ${(quedaPct * 100).toFixed(1)}% vs média R$ ${media?.toFixed(0) ?? '?'}` : 'Detecção por piso estrutural'));
    const tipoFinal = analiseEstatistica.ehBugFare
      ? analiseEstatistica.tipo
      : (categoriaFinal === 'BUG_FARE' ? '🚨 BUG FARE POR ANOMALIA ESTATÍSTICA (Z-SCORE)' : '⚡ OPORTUNIDADE DE TARIFA');

    // === CLASSIFICAÇÃO INFO: silêncio absoluto (padrão proactive-agent) ===
    if (categoriaFinal === 'INFO') {
      console.log(`ℹ️  [INFO] ${corredor.origem} ➔ ${labelExibicaoDestino} (${codigoDestinoReal}): R$ ${preco.toFixed(0)} via ${ciaAerea} (mercado normal)`);
      return { avaliado: true, categoria: 'INFO', bugCard: null, oportunidade: null };
    }

    // === CLASSIFICAÇÃO OPORTUNIDADE ===
    if (categoriaFinal === 'OPORTUNIDADE') {
      console.log(`⚡ [OPORTUNIDADE] ${corredor.origem} ➔ ${labelExibicaoDestino} (${codigoDestinoReal}): R$ ${preco.toFixed(0)} via ${ciaAerea} | ${motivoFinal}`);
      const oportunidade = {
        corredor: chaveCorreder,
        label: labelExibicaoDestino,
        destinoReal,
        codigoDestinoReal,
        cia: ciaAerea,
        preco,
        zScore,
        quedaPct,
        media
      };
      return { avaliado: true, categoria: 'OPORTUNIDADE', bugCard: null, oportunidade };
    }

    // === CLASSIFICAÇÃO BUG_FARE ===
    // Deduplicação defensiva: suprimir se mesmo tipo já foi alertado nas últimas 24h sem melhora
    if (this._ehAlertaDuplicado(chaveCorreder, 'BUG_FARE', preco)) {
      console.log(`🔇 [SUPRIMIDO] Alerta BUG_FARE duplicado sem queda relevante dentro de 24h para ${corredor.origem} ➔ ${labelExibicaoDestino}`);
      return { avaliado: true, categoria: 'BUG_FARE_SUPRIMIDO', bugCard: null, oportunidade: null };
    }

    const bugCard = montarCardBugFare({
      origem: corredor.origem,
      codigoOrigem: corredor.origem,
      destino: labelExibicaoDestino,
      codigoDestino: codigoDestinoReal,
      dataIda,
      dataVolta,
      preco,
      cia: ciaAerea,
      motivo: motivoFinal,
      tipo: tipoFinal,
      destinoReal,
      codigoDestinoReal,
      linkOriginal: res.oferta.link
    });

    // Garante que a cia aérea esteja presente no objeto final do card
    if (!bugCard.cia) {
      bugCard.cia = ciaAerea;
    }

    // Persistência defensiva com deduplicação por link no banco de dados
    const jaCadastradoBD = bugFaresRepo.linkJaExiste(bugCard.link);
    if (!jaCadastradoBD) {
      bugFaresRepo.inserir(bugCard);

      telemetryEvents.emitirAtualizacao('bug_fare_detectado', {
        ...bugCard,
        severidade: analiseEstatistica.severidade || 'CRITICA',
        zScore,
        quedaPct
      });

      if (notificar) {
        await notifierTelegram.enviarAlertaBugFare(bugCard);
      }

      // Registrar no Working Buffer para deduplicação futura de 24h
      this._registrarAlertaDisparado(chaveCorreder, 'BUG_FARE', preco);

      console.log(`💥 [BUG FARE ENCONTRADO!] ${bugCard.titulo} | Cia: ${bugCard.cia} | Z-Score: ${zScore?.toFixed(2) ?? 'N/A'}`);
      return { avaliado: true, categoria: 'BUG_FARE', bugCard, oportunidade: null };
    } else {
      console.log(`🔇 [SUPRIMIDO] Bug Fare já registrado no banco: ${bugCard.link}`);
      return { avaliado: true, categoria: 'BUG_FARE_DUPLICADO_BD', bugCard: null, oportunidade: null };
    }
  }

  /**
   * Executa varredura proativa com Working Buffer + Z-Score + deduplicação de 24h.
   * Método principal: implementa o padrão proactive-agent com zero ruído.
   *
   * Fluxo:
   *   1. Seleciona corredores via round-robin
   *   2. Consulta ScraplingProvider por preço atual, cia e destino real vencedor
   *   3. Registra leitura no Working Buffer
   *   4. Classifica: INFO → silêncio / OPORTUNIDADE → log / BUG_FARE → alerta
   *   5. Valida piso estrutural via detectarBugFareEstatistico
   *   6. Deduplica por janela de 24h antes de notificar
   *   7. Persiste no banco e emite evento de telemetria
   *
   * @param {Object} params
   * @param {number} params.limiteRotas - Quantidade de corredores a escanear nesta rodada
   * @param {boolean} params.notificar - Se deve enviar notificações no Telegram
   */
  async escanearCorredoresProativos({ limiteRotas = 5, notificar = true } = {}) {
    console.log(`🧭 [BugFareHunter] Iniciando varredura proativa com Working Buffer (${limiteRotas} corredores)...`);

    const bugsEncontrados = [];
    const oportunidadesDetectadas = [];
    const corredoresAmostra = [];

    // Seleção em anel round-robin para cobrir todos os continentes ao longo do tempo
    const totalCorredores = CORREDORES_GLOBAIS_SWEET_SPOT.length;
    for (let i = 0; i < limiteRotas; i++) {
      const idx = (this.indiceRotacao + i) % totalCorredores;
      corredoresAmostra.push(CORREDORES_GLOBAIS_SWEET_SPOT[idx]);
    }
    this.indiceRotacao = (this.indiceRotacao + limiteRotas) % totalCorredores;

    let totalChecados = 0;
    for (const corredor of corredoresAmostra) {
      totalChecados++;
      const diasNoFuturo = 50 + (totalChecados * 12);

      try {
        const resultadoCorredor = await this.escanearCorredor(corredor, {
          diasNoFuturo,
          notificar
        });

        if (resultadoCorredor.oportunidade) {
          oportunidadesDetectadas.push(resultadoCorredor.oportunidade);
        }
        if (resultadoCorredor.bugCard) {
          bugsEncontrados.push(resultadoCorredor.bugCard);
        }
      } catch (err) {
        console.warn(`⚠️ Falha ao checar corredor ${corredor.origem} ➔ ${corredor.labelDestino}: ${err.message}`);
      }

      // Pausa defensiva com jitter para não levantar suspeitas no Google Flights
      if (totalChecados < corredoresAmostra.length) {
        const jitter = 1500 + Math.floor(Math.random() * 1500);
        await new Promise(r => setTimeout(r, jitter));
      }
    }

    const resumo = {
      sucesso: true,
      corredoresVarridos: totalChecados,
      totalBugsEncontrados: bugsEncontrados.length,
      totalOportunidades: oportunidadesDetectadas.length,
      bugs: bugsEncontrados,
      oportunidades: oportunidadesDetectadas
    };

    // Persistir Working Buffer no disco de forma atômica após cada ciclo de varredura
    this.salvarWorkingBufferDisco();

    console.log(`✅ [BugFareHunter] Varredura concluída: ${totalChecados} corredores | ${bugsEncontrados.length} Bug Fares | ${oportunidadesDetectadas.length} Oportunidades`);
    return resumo;
  }

  /**
   * Alias retrocompatível com o método anterior (executarVarreduraProativa).
   * Delega para escanearCorredoresProativos sem quebrar chamadas existentes.
   * @param {Object} params
   */
  async executarVarreduraProativa(params = {}) {
    return this.escanearCorredoresProativos(params);
  }

  /**
   * Retorna snapshot do Working Buffer atual para fins de diagnóstico.
   * @returns {Object} Estado interno do buffer por corredor
   */
  obterEstadoBuffer() {
    const estado = {};
    for (const [chave, dados] of this._workingBuffer.entries()) {
      const { media, desvioPadrao } = this._calcularEstatisticasBuffer(dados.leituras);
      estado[chave] = {
        leituras: dados.leituras.length,
        media: media ? Math.round(media) : null,
        desvioPadrao: desvioPadrao ? Math.round(desvioPadrao) : null,
        ultimoAlerta: dados.ultimoAlerta
          ? { tipo: dados.ultimoAlerta.tipo, preco: dados.ultimoAlerta.preco, horasAtras: Math.round((Date.now() - dados.ultimoAlerta.ts) / 3600000 * 10) / 10 }
          : null
      };
    }
    return estado;
  }
}

export const bugFareHunter = new BugFareHunter();
