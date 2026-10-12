/**
 * RADAR DE VOOS - TRAVEL HACKING COCKPIT APP (v2.1)
 * Integrado com Sparklines em SVG, Arcos Geodésicos Great Circle,
 * Telemetria SSE em tempo real, Previsão do Clima e Háptica iOS.
 */

import { renderizarSparkline } from './js/sparkline.js';
import { renderizarArcoVooSvg } from './js/geo_routes.js';

// Registrar Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Falha ao registrar Service Worker:', err);
    });
  });
}

function vibrarAoTocar() {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(12); } catch (_) {}
  }
}

// Sintetizador nativo de Chime de Cabine (Aviso Sonoro de Aeronave via Web Audio API)
let audioCtx = null;
export function tocarChimeCabine() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const agora = audioCtx.currentTime;

    // Primeiro tom (D5 - 587.33 Hz) com ataque rápido e decaimento exponencial
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, agora);
    gain1.gain.setValueAtTime(0, agora);
    gain1.gain.linearRampToValueAtTime(0.3, agora + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, agora + 0.55);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(agora);
    osc1.stop(agora + 0.55);

    // Segundo tom (A4 - 440.00 Hz) formando o ding-dong clássico de cabine
    const delay = 0.28;
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440.00, agora + delay);
    gain2.gain.setValueAtTime(0, agora + delay);
    gain2.gain.linearRampToValueAtTime(0.28, agora + delay + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, agora + delay + 0.7);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(agora + delay);
    osc2.stop(agora + delay + 0.7);
  } catch (e) {
    console.warn('Erro ao reproduzir chime de cabine:', e);
  }
}
window.tocarChimeCabine = tocarChimeCabine;

const state = {
  rotas: [],
  bugFares: [],
  poolStatus: null,
  filtroTexto: '',
  filtroCategoria: 'todas',
  abaAtiva: 'tab-rotas'
};

// Elementos DOM
const rotasContainer = document.getElementById('rotas-container');
const bugfaresContainer = document.getElementById('bugfares-container');
const poolKeysContainer = document.getElementById('pool-keys-container');
const badgeBugFares = document.getElementById('badge-bugfares');

const metricRotasTotal = document.getElementById('metric-rotas-total');
const metricOportunidades = document.getElementById('metric-oportunidades');
const metricCotasHoje = document.getElementById('metric-cotas-hoje');
const metricCotasMes = document.getElementById('metric-cotas-mes');
const metricBugFares = document.getElementById('metric-bugfares');

const modalRota = document.getElementById('modal-rota');
const modalHistorico = document.getElementById('modal-historico');
const toastContainer = document.getElementById('toast-container');
const sseBadge = document.getElementById('sse-badge');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  carregarDadosCompletos();
  iniciarSseTelemetria();

  // Polling de segurança a cada 45s (como contingência ao SSE)
  setInterval(() => carregarDadosCompletos(true), 45000);
});

function iniciarSseTelemetria() {
  try {
    const eventSource = new EventSource('/api/stream/telemetria');

    eventSource.addEventListener('conectado', () => {
      if (sseBadge) sseBadge.style.opacity = '1';
    });

    eventSource.addEventListener('telemetria', (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.log('⚡ [SSE Telemetria]:', payload.tipo);

        // Se detectar Bug Fare ou meta atingida, dispara o Chime sonoro de cabine
        if (payload.tipo === 'bug_fare_detectado' || payload.tipo === 'meta_atingida') {
          tocarChimeCabine();
          mostrarToast(`🚨 ${payload.dados?.titulo || 'Oportunidade crítica ou Bug Fare detectado!'}`);
        }

        carregarDadosCompletos(true);
      } catch (_) {}
    });

    eventSource.onerror = () => {
      if (sseBadge) sseBadge.style.opacity = '0.4';
    };
  } catch (err) {
    console.warn('SSE indisponível no cliente, operando em polling normal.');
  }
}

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      vibrarAoTocar();
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(targetTab)?.classList.add('active');
      state.abaAtiva = targetTab;
    });
  });

  // Filtro de Busca
  document.getElementById('filtro-rotas')?.addEventListener('input', (e) => {
    state.filtroTexto = e.target.value.toLowerCase().trim();
    renderizarRotas();
  });

  // Filtro Chips
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      vibrarAoTocar();
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filtroCategoria = chip.getAttribute('data-filter');
      renderizarRotas();
    });
  });

  // Botões de Ação Topo
  document.getElementById('btn-forcar-varredura')?.addEventListener('click', () => {
    vibrarAoTocar();
    executarVarreduraManual();
  });
  document.getElementById('btn-testar-telegram')?.addEventListener('click', () => {
    vibrarAoTocar();
    testarTelegram();
  });
  document.getElementById('btn-abrir-modal-rota')?.addEventListener('click', () => {
    vibrarAoTocar();
    abrirModalNovaRota();
  });
  document.getElementById('btn-fechar-modal-rota')?.addEventListener('click', () => fecharModal(modalRota));
  document.getElementById('btn-cancelar-modal-rota')?.addEventListener('click', () => fecharModal(modalRota));

  document.getElementById('btn-fechar-modal-historico')?.addEventListener('click', () => fecharModal(modalHistorico));
  document.getElementById('btn-testar-chime')?.addEventListener('click', () => {
    vibrarAoTocar();
    tocarChimeCabine();
    mostrarToast('🔊 Aviso sonoro de cabine emitido via Web Audio API!');
  });
  document.getElementById('btn-reset-hoje')?.addEventListener('click', () => {
    vibrarAoTocar();
    resetarCotasHoje();
  });

  // Form Nova Rota
  document.getElementById('form-nova-rota')?.addEventListener('submit', criarNovaRota);
}

// Carregamento de Dados da API
async function carregarDadosCompletos(suave = false) {
  try {
    const [resRotas, resStatus, resBugs] = await Promise.all([
      fetch('/api/rotas').then((r) => r.json()),
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/bug-fares').then((r) => r.json())
    ]);

    if (resRotas.ok) state.rotas = resRotas.rotas || [];
    if (resStatus.ok) state.poolStatus = resStatus.pool || null;
    if (resBugs.ok) state.bugFares = resBugs.bugFares || [];

    atualizarMetricasRotas();
    atualizarMetricasPool();
    atualizarMetricasBugs();

    renderizarRotas();
    renderizarBugFares();
    renderizarPoolStatus();
  } catch (err) {
    if (!suave) mostrarToast('Falha ao sincronizar dados com o servidor', true);
  }
}

// Renderização Rotas
function renderizarRotas() {
  if (!rotasContainer) return;

  const filtradas = state.rotas.filter((rota) => {
    // Filtro texto
    const busca = `${rota.origem} ${rota.destino} ${rota.codigo_origem} ${rota.codigo_destino}`.toLowerCase();
    const bateTexto = !state.filtroTexto || busca.includes(state.filtroTexto);

    // Filtro categoria
    let bateCat = true;
    if (state.filtroCategoria === 'meta') {
      bateCat = rota.preco_atual && rota.preco_alvo && rota.preco_atual <= rota.preco_alvo;
    } else if (state.filtroCategoria === 'promo') {
      bateCat = rota.termometro && (rota.termometro.includes('Super Barato') || rota.termometro.includes('Excelente'));
    }

    return bateTexto && bateCat;
  });

  if (filtradas.length === 0) {
    rotasContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-dim);">
        <p style="font-size: 1.1rem; margin-bottom: 8px;">Nenhuma rota encontrada com os filtros atuais.</p>
        <span style="font-size: 0.85rem;">Clique em "+ Nova Rota" para adicionar um novo destino ao radar.</span>
      </div>
    `;
    return;
  }

  rotasContainer.innerHTML = filtradas.map((rota) => {
    const precoFormatado = rota.preco_atual && rota.preco_atual > 0
      ? `R$ ${rota.preco_atual.toFixed(2).replace('.', ',')}`
      : 'Aguardando';

    const precoAlvoFormatado = rota.preco_alvo ? `R$ ${rota.preco_alvo.toFixed(2).replace('.', ',')}` : 'Não definida';
    const menorHistorico = rota.menor_preco_historico ? `R$ ${rota.menor_preco_historico.toFixed(2).replace('.', ',')}` : '-';

    let cardClass = '';
    let termoClass = '';
    if (rota.preco_atual && rota.preco_alvo && rota.preco_atual <= rota.preco_alvo) {
      cardClass = 'status-meta';
      termoClass = 'low';
    } else if (rota.termometro && rota.termometro.includes('Caro')) {
      cardClass = 'status-alta';
      termoClass = 'high';
    } else if (rota.termometro && (rota.termometro.includes('Super Barato') || rota.termometro.includes('Excelente'))) {
      cardClass = 'status-promo';
      termoClass = 'low';
    }

    const tipoViagem = rota.data_volta ? 'IDA E VOLTA' : 'SÓ IDA';
    const flexTag = rota.flexibilidade_dias && rota.flexibilidade_dias > 0 ? ` • ±${rota.flexibilidade_dias}d FLEX` : '';
    const cabineTag = rota.cabine && rota.cabine !== 'economy' ? ` • ${rota.cabine.toUpperCase()}` : '';
    const arcoSvg = renderizarArcoVooSvg(rota.codigo_origem, rota.codigo_destino, 150, 36);
    const sparklineSvg = renderizarSparkline(rota.historico_recente || [], { width: 110, height: 32 });

    let melhorOpcaoFlexivel = null;
    if (rota.melhor_opcao_flexivel) {
      try {
        melhorOpcaoFlexivel = typeof rota.melhor_opcao_flexivel === 'string'
          ? JSON.parse(rota.melhor_opcao_flexivel)
          : rota.melhor_opcao_flexivel;
      } catch (_) {}
    }

    return `
      <div class="flight-card ${cardClass}" id="card-rota-${rota.id}">
        <div class="card-route-header">
          <div class="route-airports">
            <span class="airport-badge">${escapeHtml(rota.codigo_origem || 'SAO')}</span>
            <span class="route-arrow">➔</span>
            <span class="airport-badge">${escapeHtml(rota.codigo_destino || 'DEST')}</span>
            <div class="city-names">${escapeHtml(rota.origem)} ➔ ${escapeHtml(rota.destino)}</div>
          </div>
          <span class="trip-type-tag">${tipoViagem}${flexTag}${cabineTag}</span>
        </div>

        <!-- Arco Geodésico Great Circle (remotion-maps) -->
        ${arcoSvg}

        <div class="card-dates-box">
          <div>📅 Ida: <strong>${formatarDataBr(rota.data_ida)}</strong></div>
          <div>${rota.data_volta ? `Volta: <strong>${formatarDataBr(rota.data_volta)}</strong>` : 'Só Ida'}</div>
        </div>

        ${melhorOpcaoFlexivel && melhorOpcaoFlexivel.preco ? `
          <div class="flex-saving-badge">
            <div>
              ✨ <strong>Janela Flexível:</strong> ${formatarDataBr(melhorOpcaoFlexivel.data_ida)}${melhorOpcaoFlexivel.data_volta ? ' a ' + formatarDataBr(melhorOpcaoFlexivel.data_volta) : ''}
              (R$ ${melhorOpcaoFlexivel.preco.toFixed(2).replace('.', ',')})
            </div>
            ${melhorOpcaoFlexivel.economia && melhorOpcaoFlexivel.economia > 0 ? `
              <span class="badge-saving">Economia de R$ ${melhorOpcaoFlexivel.economia.toFixed(2).replace('.', ',')}</span>
            ` : ''}
          </div>
        ` : ''}

        ${rota.clima_destino_resumo ? `
          <div class="weather-badge">
            ${escapeHtml(rota.clima_destino_resumo)}
          </div>
        ` : ''}

        <div class="flight-specs">
          ${rota.detalhes_voo && rota.detalhes_voo !== '-' ? `✈️ ${escapeHtml(rota.detalhes_voo)}` : '⏱️ Duração máx: ' + (rota.duracao_max_horas || 16) + 'h'}
        </div>

        <div class="card-pricing-block">
          <div class="price-main">
            <span class="price-label">Preço Atual</span>
            <span class="price-amount">${precoFormatado}</span>
          </div>
          <!-- Sparkline de Tendência (smart-charts) -->
          <div class="sparkline-wrap">
            ${sparklineSvg}
            <span style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">Recorde: ${menorHistorico}</span>
          </div>
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

        ${rota.dica_stopover && rota.dica_stopover !== '-' ? `
          <div class="stopover-callout">
            💡 ${escapeHtml(rota.dica_stopover)}
          </div>
        ` : ''}

        <div class="card-actions">
          <a href="${rota.link_google_flights}" target="_blank" rel="noopener noreferrer" class="btn-flights-external">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3m-2 16H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"/></svg>
            Google Flights
          </a>
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
  }).join('');
}

// Renderização Bug Fares
function renderizarBugFares() {
  if (!bugfaresContainer) return;

  if (state.bugFares.length === 0) {
    bugfaresContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-dim);">
        Nenhum Bug Fare recente registrado. O radar monitora o feed a cada ciclo.
      </div>
    `;
    return;
  }

  bugfaresContainer.innerHTML = state.bugFares.map((bug) => {
    return `
      <div class="bugfare-card">
        <div class="bugfare-info">
          <h4>${escapeHtml(bug.titulo)}</h4>
          <div class="bugfare-meta">
            ${escapeHtml(bug.tipo)} • Detectado em ${bug.detectado_em || 'Hoje'}
          </div>
        </div>
        <a href="${bug.link}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
          Acessar Oferta
        </a>
      </div>
    `;
  }).join('');
}

// Renderização Pool SerpAPI
function renderizarPoolStatus() {
  if (!poolKeysContainer || !state.poolStatus) return;

  poolKeysContainer.innerHTML = state.poolStatus.chaves.map((ch) => {
    const pctDiario = Math.min(100, (ch.contadorDiario / ch.limiteDiario) * 100);
    const pctMensal = Math.min(100, (ch.contadorMensal / ch.limiteMensal) * 100);

    return `
      <div class="pool-key-card">
        <div class="pool-key-header">
          <span class="key-index">Chave ${ch.indice} (${ch.chaveMascarada})</span>
          <span style="font-size: 0.75rem; font-weight: 700;">${ch.estado}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Uso Diário: <strong>${ch.contadorDiario} / ${ch.limiteDiario}</strong> buscas
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${pctDiario}%;"></div>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">
          Uso Mensal: <strong>${ch.contadorMensal} / ${ch.limiteMensal}</strong> buscas
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${pctMensal}%; background: var(--purple);"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Atualização de Métricas
function atualizarMetricasRotas() {
  if (metricRotasTotal) metricRotasTotal.textContent = state.rotas.length;

  const naMeta = state.rotas.filter((r) => r.preco_atual && r.preco_alvo && r.preco_atual <= rota.preco_alvo).length;
  if (metricOportunidades) metricOportunidades.textContent = naMeta;
}

function atualizarMetricasPool() {
  if (!state.poolStatus) return;
  if (metricCotasHoje) {
    metricCotasHoje.textContent = `${state.poolStatus.buscasHoje} / ${state.poolStatus.limiteDiarioTotal}`;
  }
  if (metricCotasMes) {
    metricCotasMes.textContent = `Restante mês: ${state.poolStatus.cotaMensalRestante} buscas`;
  }
}

function atualizarMetricasBugs() {
  if (metricBugFares) metricBugFares.textContent = state.bugFares.length;
  if (badgeBugFares) badgeBugFares.textContent = state.bugFares.length;
}

// Ações do Usuário
function abrirModalNovaRota() {
  document.getElementById('input-rota-id').value = '';
  document.getElementById('modal-rota-titulo').textContent = '✈️ Monitorar Nova Rota';
  document.getElementById('btn-salvar-rota-submit').textContent = 'Ativar Monitoramento';
  document.getElementById('form-nova-rota').reset();
  const selectFlex = document.getElementById('input-flexibilidade');
  if (selectFlex) selectFlex.value = '3';
  abrirModal(modalRota);
}

window.abrirEdicaoRota = function(id) {
  vibrarAoTocar();
  const rota = state.rotas.find((r) => r.id === id);
  if (!rota) return;

  document.getElementById('input-rota-id').value = rota.id;
  document.getElementById('modal-rota-titulo').textContent = `✏️ Alterar Opções: ${rota.origem} ➔ ${rota.destino}`;
  document.getElementById('btn-salvar-rota-submit').textContent = 'Salvar Alterações';

  document.getElementById('input-origem').value = rota.origem;
  document.getElementById('input-destino').value = rota.destino;
  document.getElementById('input-data-ida').value = rota.data_ida;
  document.getElementById('input-data-volta').value = rota.data_volta || 'Só Ida';
  document.getElementById('input-preco-alvo').value = rota.preco_alvo || '';
  document.getElementById('input-duracao-max').value = rota.duracao_max_horas || 16;
  const selectCabine = document.getElementById('input-cabine');
  if (selectCabine) selectCabine.value = rota.cabine || 'economy';
  const selectFlex = document.getElementById('input-flexibilidade');
  if (selectFlex) selectFlex.value = String(rota.flexibilidade_dias ?? 0);

  abrirModal(modalRota);
};

window.alternarSilenciamentoRota = async function(id) {
  vibrarAoTocar();
  const rota = state.rotas.find((r) => r.id === id);
  if (!rota) return;

  const novoSilencio = !rota.esta_silenciada;
  const horas = novoSilencio ? 24 : 0;

  try {
    const res = await fetch(`/api/rotas/${id}/silenciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horas })
    });
    if (res.ok) {
      mostrarToast(novoSilencio ? 'Rota silenciada por 24h.' : 'Alertas reativados para a rota.');
      carregarDadosCompletos(true);
    }
  } catch (_) {
    mostrarToast('Falha ao alterar silenciamento', true);
  }
};

async function criarNovaRota(e) {
  e.preventDefault();
  vibrarAoTocar();
  const rotaId = document.getElementById('input-rota-id').value;
  const origem = document.getElementById('input-origem').value.trim();
  const destino = document.getElementById('input-destino').value.trim();
  const data_ida = document.getElementById('input-data-ida').value;
  const data_volta = document.getElementById('input-data-volta').value.trim();
  const preco_alvo = document.getElementById('input-preco-alvo').value;
  const duracao_max_horas = document.getElementById('input-duracao-max').value;
  const cabine = document.getElementById('input-cabine')?.value || 'economy';
  const flexibilidade_dias = parseInt(document.getElementById('input-flexibilidade')?.value || '0', 10);

  const url = rotaId ? `/api/rotas/${rotaId}` : '/api/rotas';
  const method = rotaId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem,
        destino,
        data_ida,
        data_volta,
        preco_alvo,
        duracao_max_horas,
        cabine,
        flexibilidade_dias
      })
    });

    const data = await res.json();
    if (!res.ok) {
      mostrarToast(`Erro: ${data.erro || 'Falha ao salvar rota'}`, true);
      return;
    }

    const acaoTexto = rotaId ? 'atualizada' : 'adicionada ao radar';
    mostrarToast(`Rota ${origem} ➔ ${destino} ${acaoTexto}!`);
    fecharModal(modalRota);
    document.getElementById('form-nova-rota').reset();
    carregarDadosCompletos();
  } catch (err) {
    mostrarToast('Erro ao comunicar com servidor', true);
  }
}

window.verificarRotaIndividual = async function(id) {
  vibrarAoTocar();
  mostrarToast('Iniciando checagem da rota no Google Flights...');
  try {
    const res = await fetch(`/api/rotas/${id}/verificar`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.resultado.sucesso) {
      mostrarToast('Cotação atualizada com sucesso!');
      carregarDadosCompletos(true);
    } else {
      mostrarToast(`Aviso: ${data.resultado?.erro || 'Sem voos no filtro'}`, true);
      carregarDadosCompletos(true);
    }
  } catch (err) {
    mostrarToast('Falha na requisição de checagem', true);
  }
};

window.excluirRota = async function(id) {
  vibrarAoTocar();
  if (!confirm('Deseja realmente remover esta rota do monitoramento?')) return;

  try {
    const res = await fetch(`/api/rotas/${id}`, { method: 'DELETE' });
    if (res.ok) {
      mostrarToast('Rota removida com sucesso!');
      carregarDadosCompletos();
    }
  } catch (err) {
    mostrarToast('Erro ao excluir rota', true);
  }
};

window.abrirHistorico = async function(id) {
  vibrarAoTocar();
  const rota = state.rotas.find((r) => r.id === id);
  if (!rota) return;

  document.getElementById('historico-titulo').textContent = `📈 Histórico: ${rota.origem} ➔ ${rota.destino}`;
  const tbody = document.getElementById('historico-tbody');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Carregando histórico...</td></tr>';
  abrirModal(modalHistorico);

  try {
    const res = await fetch(`/api/rotas/${id}`).then((r) => r.json());
    if (res.ok && res.historico.length > 0) {
      tbody.innerHTML = res.historico.map((h) => {
        return `
          <tr>
            <td>${formatarDataHora(h.data_checagem)}</td>
            <td style="font-weight:700; color:var(--cyan-primary);">R$ ${h.preco.toFixed(2).replace('.', ',')}</td>
            <td>${escapeHtml(h.termometro || '-')}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum histórico registrado ainda.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Erro ao carregar dados.</td></tr>';
  }
};

async function executarVarreduraManual() {
  mostrarToast('Disparando varredura da próxima rota na fila justa...');
  try {
    const res = await fetch('/api/varredura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: false })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarToast('Varredura concluída!');
      carregarDadosCompletos(true);
    } else {
      mostrarToast(`Aviso: ${data.erro || 'Falha na varredura'}`, true);
    }
  } catch (err) {
    mostrarToast('Erro ao disparar varredura', true);
  }
}

async function testarTelegram() {
  mostrarToast('Enviando alerta de teste para o Telegram...');
  try {
    const res = await fetch('/api/notificacao/teste', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      mostrarToast('Mensagem enviada com sucesso no Telegram!');
    } else {
      mostrarToast('Falha ao enviar mensagem no Telegram', true);
    }
  } catch (err) {
    mostrarToast('Erro ao testar Telegram', true);
  }
}

async function resetarCotasHoje() {
  if (!confirm('Deseja resetar os contadores de buscas de hoje das chaves SerpAPI?')) return;

  try {
    const res = await fetch('/api/reset-hoje', { method: 'POST' });
    if (res.ok) {
      mostrarToast('Contadores de hoje resetados com sucesso!');
      carregarDadosCompletos();
    }
  } catch (err) {
    mostrarToast('Erro ao resetar contadores', true);
  }
}

// Helpers de Interface
function abrirModal(el) {
  el.classList.add('open');
}

function fecharModal(el) {
  el.classList.remove('open');
}

function mostrarToast(mensagem, erro = false) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (erro) toast.style.borderColor = 'var(--rose)';
  toast.textContent = mensagem;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function formatarDataBr(isoStr) {
  if (!isoStr) return '-';
  const partes = isoStr.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return isoStr;
}

function formatarDataHora(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR');
  } catch (_) {
    return isoStr;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
