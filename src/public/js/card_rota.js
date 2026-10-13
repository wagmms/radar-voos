/**
 * RADAR DE VOOS - COCKPIT PWA: CARD DE ROTA & AÇÕES
 * Renderização modular de cards de voos com botão de cópia rápida do Google Flights,
 * sparklines em SVG puro, arcos geodésicos ortodrômicos e badges contextuais.
 */

import { renderizarSparkline } from './sparkline.js';
import { renderizarArcoVooSvg } from './geo_routes.js';
import {
  extrairInfoTarifaEspecial,
  renderizarTagTarifaEspecial,
  renderizarBannerTarifaEspecial
} from './tarifa_tags.js';
import {
  renderizarWeatherBadge
} from './clima_filtro.js';
import {
  extrairInfoConexao,
  renderizarBadgeConexao,
  renderizarBannerStopover
} from './conexao_badges.js';

/**
 * Escapa strings para inserção segura no DOM / atributos HTML.
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formata data no padrão brasileiro DD/MM/AAAA.
 */
export function formatarDataBr(isoStr) {
  if (!isoStr) return '-';
  const partes = String(isoStr).split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return String(isoStr);
}

/**
 * Normaliza código IATA ou KGMID para badge de destino.
 */
export function formatarCodigoBadge(cod) {
  if (!cod) return 'DEST';
  if (cod === '/m/06_1') return 'AMSUL';
  if (cod === '/m/02j9z') return 'EUROPA';
  if (cod === '/m/02j1x') return 'ÁSIA';
  if (cod === '/m/02_286') return 'AMNORTE';
  if (cod === '/m/056_y') return 'AMCENTRAL';
  if (cod === '/m/0164v') return 'ÁFRICA';
  if (cod === '/m/05h_p') return 'OCEANIA';
  return String(cod).toUpperCase();
}

/**
 * Copia o link do Google Flights para a área de transferência com feedback visual toast.
 * Suporta navigator.clipboard.writeText com fallback gracioso e opções injetáveis para testes.
 *
 * @param {Event|null} event Evento de clique
 * @param {string} link URL a ser copiada
 * @param {object} options Opções com callbacks para teste ou desacoplamento
 * @returns {Promise<boolean>}
 */
export async function copiarLinkGoogleFlights(event, link, options = {}) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }

  if (typeof options.vibrar === 'function') {
    options.vibrar();
  } else if (typeof window !== 'undefined' && typeof window.vibrarAoTocar === 'function') {
    window.vibrarAoTocar();
  }

  const fnToast = options.mostrarToast ||
    (typeof window !== 'undefined' && typeof window.mostrarToast === 'function' ? window.mostrarToast : null);

  if (!link || link === '#' || typeof link !== 'string' || link.trim() === '') {
    if (fnToast) fnToast('Link não disponível para cópia', true);
    return false;
  }

  try {
    let copiado = false;
    const clipApi = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);

    if (clipApi && typeof clipApi.writeText === 'function') {
      await clipApi.writeText(link);
      copiado = true;
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      copiado = document.execCommand ? document.execCommand('copy') : false;
      document.body.removeChild(textarea);
    }

    if (copiado) {
      if (fnToast) fnToast('Link copiado! ✓', false, 2000);
      return true;
    } else {
      if (fnToast) fnToast('Erro ao copiar link', true);
      return false;
    }
  } catch (err) {
    if (fnToast) fnToast('Erro ao copiar link', true);
    return false;
  }
}

/** Cotações de referência R$/milheiro por programa de fidelidade */
export const COTACOES_MILHA_MILHEIRO = {
  smiles:   17.50,
  latam:    24.00,
  latampass: 24.00,
  livelo:   35.00,
  azul:     20.00,
  tudoazul: 20.00,
  iberia:   65.00,
  tap:      32.00
};

/**
 * Calcula a estimativa de milhas necessárias para emitir o voo pelo preço atual.
 *
 * @param {number|null} precoAtual Preço atual em BRL
 * @param {number|null} paridadeMilheiro Cotação R$ por milheiro (ex: 17.50 → 1.000 milhas = R$ 17,50)
 * @param {string} [programa='smiles'] Chave do programa de fidelidade (para label)
 * @returns {{ milhas: number, programa: string, cotacaoMilheiro: number } | null}
 *   Retorna null quando preço ou paridade são inválidos.
 */
export function calcularMilhasEstimadas(precoAtual, paridadeMilheiro, programa = 'smiles') {
  const preco = typeof precoAtual === 'number' ? precoAtual : parseFloat(precoAtual);
  if (!Number.isFinite(preco) || preco <= 0) return null;

  const progKey = String(programa || 'smiles').toLowerCase().trim();
  const cotacaoPadrao = COTACOES_MILHA_MILHEIRO[progKey] || COTACOES_MILHA_MILHEIRO.smiles;
  const cotacao = typeof paridadeMilheiro === 'number' && Number.isFinite(paridadeMilheiro) && paridadeMilheiro > 0
    ? paridadeMilheiro
    : cotacaoPadrao;

  // milhas = (preço / R$-por-milheiro) * 1.000
  const milhas = Math.ceil((preco / cotacao) * 1000);
  return { milhas, programa: progKey, cotacaoMilheiro: cotacao };
}

/**
 * Renderiza a badge visual de milhas estimadas para o card de rota,
 * com widget de edição inline de paridade_milhas e programa_milhas.
 * O formulário inline é exibido ao clicar no botão ✏️ e permite
 * persistência imediata via PATCH /api/rotas/:id/milhas.
 *
 * @param {object} rota Dados da rota
 * @returns {string} HTML da badge com editor inline ou ''
 */
export function renderizarBadgeMilhas(rota) {
  if (!rota || !rota.id) return '';

  const paridade = rota.paridade_milhas ?? null;
  const programa = String(rota.programa_milhas || 'smiles').toLowerCase().trim();

  // Opções de programa disponíveis
  const programasDisponiveis = Object.keys(COTACOES_MILHA_MILHEIRO);

  // Monta opções do <select>
  const opcoesSelect = programasDisponiveis.map(prog => {
    const label = prog.charAt(0).toUpperCase() + prog.slice(1);
    const selected = prog === programa ? ' selected' : '';
    return `<option value="${escapeHtml(prog)}"${selected}>${escapeHtml(label)}</option>`;
  }).join('');

  // Calcula badge de estimativa quando há preço
  let badgeEstimativaHtml = '';
  if (rota.preco_atual && rota.preco_atual > 0) {
    const resultado = calcularMilhasEstimadas(rota.preco_atual, paridade, programa);
    if (resultado) {
      const milhasFormatadas = resultado.milhas.toLocaleString('pt-BR');
      const nomePrograma = resultado.programa.charAt(0).toUpperCase() + resultado.programa.slice(1);
      const cotacaoFormatada = resultado.cotacaoMilheiro.toFixed(2).replace('.', ',');
      badgeEstimativaHtml = `
        <div class="milhas-estimativa-row" title="Estimativa p/ emissão em milhas (R$ ${cotacaoFormatada}/milheiro ${nomePrograma})">
          <span class="milhas-icon">✈️🏆</span>
          <span class="milhas-valor">~${milhasFormatadas} milhas</span>
          <span class="milhas-programa">${nomePrograma}</span>
        </div>`;
    }
  }

  const paridadeFormatada = paridade ? paridade.toFixed(2).replace('.', ',') : '';
  const paridadePlaceholder = COTACOES_MILHA_MILHEIRO[programa]
    ? COTACOES_MILHA_MILHEIRO[programa].toFixed(2).replace('.', ',')
    : '17,50';

  return `<div class="badge-milhas-estimadas" id="badge-milhas-${escapeHtml(String(rota.id))}">
    ${badgeEstimativaHtml}
    <div class="milhas-editor-toggle">
      <button
        class="btn-milhas-editar"
        onclick="toggleMilhasEditor(${rota.id})"
        title="${paridade ? 'Editar cotação de milhas (R$/' + paridadeFormatada + '/milheiro)' : 'Configurar cotação de milhas'}"
        aria-label="Editar cotação de milhas"
        type="button"
      >${paridade ? `✏️ R$&nbsp;${paridadeFormatada}` : '✏️ Configurar milhas'}</button>
    </div>
    <div class="milhas-editor-form" id="milhas-form-${escapeHtml(String(rota.id))}" style="display:none;" role="form" aria-label="Editor de cotação de milhas">
      <label class="milhas-form-label" for="milhas-prog-${escapeHtml(String(rota.id))}">Programa</label>
      <select
        id="milhas-prog-${escapeHtml(String(rota.id))}"
        class="milhas-select"
        onchange="atualizarPlaceholderMilhas(${rota.id})"
        aria-label="Programa de milhas"
      >${opcoesSelect}</select>
      <label class="milhas-form-label" for="milhas-cot-${escapeHtml(String(rota.id))}">R$/milheiro</label>
      <input
        type="number"
        id="milhas-cot-${escapeHtml(String(rota.id))}"
        class="milhas-input-cot"
        value="${escapeHtml(paridadeFormatada.replace(',', '.'))}"
        placeholder="${escapeHtml(paridadePlaceholder.replace(',', '.'))}"
        min="1"
        max="999"
        step="0.01"
        aria-label="Cotação em reais por milheiro"
      />
      <div class="milhas-form-actions">
        <button
          class="btn-milhas-salvar"
          onclick="salvarMilhasInline(${rota.id})"
          type="button"
          aria-label="Salvar cotação de milhas"
        >✓ Salvar</button>
        <button
          class="btn-milhas-cancelar"
          onclick="toggleMilhasEditor(${rota.id})"
          type="button"
          aria-label="Cancelar edição de milhas"
        >✕</button>
      </div>
    </div>
  </div>`;
}

/**
 * Salva paridade_milhas e programa_milhas via PATCH /api/rotas/:id/milhas.
 * Deve ser exposta em window.salvarMilhasInline pelo app.js.
 *
 * @param {number} rotaId ID da rota
 * @param {object} options Opções injetáveis para testes (fetch, mostrarToast, document)
 * @returns {Promise<boolean>}
 */
export async function salvarMilhasInline(rotaId, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const fnFetch = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  const fnToast = options.mostrarToast ||
    (typeof window !== 'undefined' && typeof window.mostrarToast === 'function' ? window.mostrarToast : null);
  const fnRecarregar = options.recarregarDados ||
    (typeof window !== 'undefined' && typeof window.carregarDadosCompletos === 'function' ? window.carregarDadosCompletos : null);

  if (!doc || !fnFetch) return false;

  const selectEl = doc.getElementById(`milhas-prog-${rotaId}`);
  const inputEl = doc.getElementById(`milhas-cot-${rotaId}`);

  if (!selectEl || !inputEl) {
    if (fnToast) fnToast('Erro: formulário de milhas não encontrado', true);
    return false;
  }

  const programa = selectEl.value.trim().toLowerCase();
  const paridadeRaw = parseFloat(String(inputEl.value).replace(',', '.'));

  // Validação visual defensiva
  if (!Number.isFinite(paridadeRaw) || paridadeRaw <= 0) {
    inputEl.classList.add('milhas-input-erro');
    if (fnToast) fnToast('Cotação inválida. Informe um valor positivo (ex: 17.50)', true);
    return false;
  }
  inputEl.classList.remove('milhas-input-erro');

  try {
    const res = await fnFetch(`/api/rotas/${rotaId}/milhas`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paridade_milhas: paridadeRaw, programa_milhas: programa })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (fnToast) fnToast(`Erro ao salvar: ${data.erro || 'Falha no servidor'}`, true);
      return false;
    }

    if (fnToast) fnToast('Cotação de milhas salva! ✓', false, 2000);
    // Fecha o editor inline e recarrega cards
    const formEl = doc.getElementById(`milhas-form-${rotaId}`);
    if (formEl) formEl.style.display = 'none';
    if (fnRecarregar) fnRecarregar(true);
    return true;
  } catch (_) {
    if (fnToast) fnToast('Falha na comunicação com o servidor', true);
    return false;
  }
}

/**
 * Cria a marcação HTML completa de um card de rota para o Cockpit PWA.
 *
 * @param {object} rota Dados da rota monitorada
 * @returns {string} Fragmento HTML do card
 */
export function criarCardRota(rota) {
  if (!rota) return '';

  const precoFormatado = rota.preco_atual && rota.preco_atual > 0
    ? `R$ ${rota.preco_atual.toFixed(2).replace('.', ',')}`
    : 'Aguardando';

  const menorHistorico = rota.menor_preco_historico ? `R$ ${rota.menor_preco_historico.toFixed(2).replace('.', ',')}` : '-';

  const classes = [];
  let termoClass = '';
  if (rota.sem_data === 1) {
    classes.push('status-flexivel');
  }
  if (rota.preco_atual && rota.preco_alvo && rota.preco_atual <= rota.preco_alvo) {
    classes.push('status-meta');
    termoClass = 'low';
  } else if (rota.termometro && rota.termometro.includes('Caro')) {
    classes.push('status-alta');
    termoClass = 'high';
  } else if (rota.termometro && (rota.termometro.includes('Super Barato') || rota.termometro.includes('Excelente'))) {
    classes.push('status-promo');
    termoClass = 'low';
  }
  const cardClass = classes.join(' ');

  const ehSoIda =
    rota.tipo_viagem === 'one_way' ||
    rota.tipo === 'one_way' ||
    (typeof rota.data_volta === 'string' && (rota.data_volta.toLowerCase().includes('só ida') || rota.data_volta.toLowerCase().includes('so ida'))) ||
    (!rota.data_volta && (!rota.dias_estadia || rota.sem_data !== 1));

  const tipoViagem = rota.sem_data === 1
    ? (ehSoIda ? '🗓️ FLEXÍVEL • SÓ IDA' : `🗓️ FLEXÍVEL • IDA E VOLTA (${rota.dias_estadia || 10}d)`)
    : (ehSoIda ? 'SÓ IDA' : 'IDA E VOLTA');
  const flexTag = rota.flexibilidade_dias && rota.flexibilidade_dias > 0 && rota.sem_data !== 1 ? ` • ±${rota.flexibilidade_dias}d FLEX` : '';
  const cabineTag = rota.cabine && rota.cabine !== 'economy' ? ` • ${rota.cabine.toUpperCase()}` : '';
  const arcoSvg = renderizarArcoVooSvg(rota.codigo_origem, rota.codigo_destino, 150, 36);
  const sparklineSvg = renderizarSparkline(rota.historico_recente || [], { width: 110, height: 32 });

  const infoTarifa = extrairInfoTarifaEspecial(rota);
  const tagTarifaHtml = renderizarTagTarifaEspecial(infoTarifa);
  const bannerTarifaHtml = renderizarBannerTarifaEspecial(infoTarifa);

  const infoConexao = extrairInfoConexao(rota);
  const badgeConexaoHtml = renderizarBadgeConexao(infoConexao);
  const bannerStopoverHtml = renderizarBannerStopover(infoConexao, rota.dica_stopover);

  let melhorOpcaoFlexivel = null;
  if (rota.melhor_opcao_flexivel) {
    try {
      melhorOpcaoFlexivel = typeof rota.melhor_opcao_flexivel === 'string'
        ? JSON.parse(rota.melhor_opcao_flexivel)
        : rota.melhor_opcao_flexivel;
    } catch (_) {}
  }

  const linkVoo = rota.link_google_flights || '#';

  return `
      <div class="flight-card ${cardClass}" id="card-rota-${rota.id}">
        <div class="card-route-header">
          <div class="route-airports">
            <span class="airport-badge">${escapeHtml(rota.codigo_origem || 'SAO')}</span>
            <span class="route-arrow">➔</span>
            <span class="airport-badge">${escapeHtml(formatarCodigoBadge(rota.codigo_destino))}</span>
            <div class="city-names">
              ${escapeHtml(rota.origem)} ➔ ${escapeHtml(rota.destino)}
              ${rota.destino_real && rota.destino_real !== rota.destino && rota.destino_real !== rota.codigo_destino ? `<span style="display:block; font-size:0.75rem; color:#10b981; font-weight:600; margin-top:2px;">📍 ${escapeHtml(rota.destino_real)}</span>` : ''}
            </div>
          </div>
          <div class="card-header-tags">
            <span class="trip-type-tag ${rota.sem_data === 1 ? 'tag-flexivel' : ''}">${tipoViagem}${flexTag}${cabineTag}</span>
            ${badgeConexaoHtml}
            ${tagTarifaHtml}
          </div>
        </div>

        <!-- Arco Geodésico Great Circle (remotion-maps) -->
        ${arcoSvg}

        <div class="card-dates-box">
          ${rota.sem_data === 1 ? `
            <div>🗓️ Período: <strong>${rota.preco_atual ? 'Melhor: ' + formatarDataBr(rota.data_ida) + (rota.data_volta && !ehSoIda ? ' a ' + formatarDataBr(rota.data_volta) : '') : 'Qualquer data (Flexível)'}</strong></div>
            <div>⏱️ Modalidade: <strong>${ehSoIda ? '➡️ Apenas Ida' : '🔄 Ida e Volta (' + (rota.dias_estadia || 10) + 'd estadia)'}</strong></div>
          ` : `
            <div>📅 Ida: <strong>${formatarDataBr(rota.data_ida)}</strong></div>
            <div>${!ehSoIda && rota.data_volta ? `Volta: <strong>${formatarDataBr(rota.data_volta)}</strong>` : '➡️ Apenas Ida'}</div>
          `}
        </div>

        ${melhorOpcaoFlexivel && melhorOpcaoFlexivel.preco ? `
          <div class="flex-saving-badge">
            <div>
              ✨ <strong>${melhorOpcaoFlexivel.modo === 'sem_data' ? 'Menor Tarifa do Período' : 'Janela Flexível'} (${ehSoIda ? 'Apenas Ida' : 'Ida e Volta'}):</strong> ${formatarDataBr(melhorOpcaoFlexivel.data_ida)}${melhorOpcaoFlexivel.data_volta && !ehSoIda ? ' a ' + formatarDataBr(melhorOpcaoFlexivel.data_volta) : ''}
              (R$ ${melhorOpcaoFlexivel.preco.toFixed(2).replace('.', ',')})
            </div>
            ${melhorOpcaoFlexivel.economia && melhorOpcaoFlexivel.economia > 0 ? `
              <span class="badge-saving">Economia de R$ ${melhorOpcaoFlexivel.economia.toFixed(2).replace('.', ',')}</span>
            ` : ''}
          </div>
        ` : ''}

        ${renderizarWeatherBadge(rota)}

        <div class="flight-specs">
          ${rota.detalhes_voo && rota.detalhes_voo !== '-' ? `✈️ ${escapeHtml(rota.detalhes_voo)}` : '⏱️ Duração máx: ' + (rota.duracao_max_horas || 16) + 'h'}
        </div>

        ${bannerTarifaHtml}

        <div class="card-pricing-block">
          <div class="price-main">
            <span class="price-label">Preço Atual</span>
            <span class="price-amount">${precoFormatado}</span>
          </div>
          <!-- Badge de Milhas Estimadas (paridade configurada da rota) -->
          ${renderizarBadgeMilhas(rota)}
          <!-- Sparkline de Tendência (smart-charts) -->
          <div class="sparkline-wrap">
            ${sparklineSvg}
            <span style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">Recorde: ${menorHistorico}</span>
          </div>
        </div>

        <!-- Teto / Preço Alvo Monitorado com Escopo Claro -->
        <div class="card-teto-row">
          <span class="card-teto-label">🎯 Teto Monitorado:</span>
          <span class="card-teto-val">
            ${rota.preco_alvo ? `<strong>R$ ${Number(rota.preco_alvo).toFixed(2).replace('.', ',')}</strong> <span class="teto-scope-pill ${ehSoIda ? 'pill-oneway' : 'pill-roundtrip'}">${ehSoIda ? 'Apenas Ida' : 'Ida e Volta'}</span>` : '<span class="teto-sem-meta">Sem teto definido</span>'}
          </span>
        </div>

        ${rota.termometro ? `
          <div class="thermometer-tag ${termoClass}">
            ${escapeHtml(rota.termometro)}
            ${rota.variacao_texto && rota.variacao_texto !== '-' ? `• ${escapeHtml(rota.variacao_texto)}` : ''}
          </div>
        ` : ''}

        ${rota.custo_destino_texto && rota.custo_destino_texto !== '-' ? `
          <div class="trip-total-cost-box">
            <span>🏨 Custo Destino</span>
            <strong>${escapeHtml(rota.custo_destino_texto)}</strong>
          </div>
        ` : ''}

        ${bannerStopoverHtml}

        <div class="card-actions">
          <a href="${escapeHtml(linkVoo)}" target="_blank" rel="noopener noreferrer" class="btn-flights-external">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3m-2 16H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"/></svg>
            Google Flights
          </a>
          <button class="btn-icon-action btn-copy-link" onclick="copiarLinkGoogleFlights(event, '${escapeHtml(rota.link_google_flights || '')}')" title="Copiar link do Google Flights" aria-label="Copiar link do Google Flights">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="btn-icon-action ${rota.esta_silenciada ? 'active-muted' : ''}" onclick="alternarSilenciamentoRota(${rota.id})" title="${rota.esta_silenciada ? 'Silenciada por 24h (clique para reativar)' : 'Silenciar alertas por 24h'}">
            ${rota.esta_silenciada ? '🔕' : '🔔'}
          </button>
          <button class="btn-icon-action" onclick="abrirEdicaoRota(${rota.id})" title="Alterar opções desta rota">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="btn-icon-action" onclick="verificarRotaIndividual(${rota.id})" title="Verificar preço agora">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
          <button class="btn-icon-action" onclick="abrirHistorico(${rota.id})" title="Ver histórico de preços">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </button>
          <button class="btn-icon-action danger" onclick="excluirRota(${rota.id})" title="Excluir rota">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
}
