/**
 * RADAR DE VOOS - TRAVEL HACKING COCKPIT APP (v2.1)
 * Integrado com Sparklines em SVG, Arcos Geodésicos Great Circle,
 * Telemetria SSE em tempo real, Previsão do Clima e Háptica iOS.
 */

import { renderizarSparkline } from './js/sparkline.js';
import { renderizarArcoVooSvg } from './js/geo_routes.js';
import {
  extrairInfoTarifaEspecial,
  renderizarTagTarifaEspecial,
  renderizarBannerTarifaEspecial
} from './js/tarifa_tags.js';
import {
  filtrarPorFaixaClima,
  renderizarWeatherBadge
} from './js/clima_filtro.js';

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
  filtroClima: 'todos',
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

  // Filtro Chips de Categorias
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      vibrarAoTocar();
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filtroCategoria = chip.getAttribute('data-filter');
      renderizarRotas();
    });
  });

  // Filtro Chips de Faixas Climáticas (Quente, Ameno, Frio)
  document.querySelectorAll('.filter-chip-clima').forEach((chip) => {
    chip.addEventListener('click', () => {
      vibrarAoTocar();
      document.querySelectorAll('.filter-chip-clima').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filtroClima = chip.getAttribute('data-filter-clima') || 'todos';
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
  document.getElementById('btn-escanear-bugs')?.addEventListener('click', () => {
    vibrarAoTocar();
    escanearBugFaresProativo();
  });
  document.getElementById('btn-reset-hoje')?.addEventListener('click', () => {
    vibrarAoTocar();
    resetarCotasHoje();
  });

  // Botões de Mão Dupla (Backup, Restaurar e Sync GitHub)
  document.getElementById('btn-backup-rotas')?.addEventListener('click', () => {
    vibrarAoTocar();
    exportarRotasJson();
  });
  document.getElementById('btn-restaurar-rotas')?.addEventListener('click', () => {
    vibrarAoTocar();
    document.getElementById('input-importar-rotas')?.click();
  });
  document.getElementById('input-importar-rotas')?.addEventListener('change', importarRotasJson);
  document.getElementById('btn-sync-github')?.addEventListener('click', () => {
    vibrarAoTocar();
    sincronizarComGitHubRemoto();
  });

  // Form Nova Rota, Tipo de Viagem e Toggle de Voo Flexível
  document.getElementById('input-sem-data')?.addEventListener('change', atualizarVisualModoFlexivel);
  document.getElementById('btn-tipo-roundtrip')?.addEventListener('click', () => {
    vibrarAoTocar();
    definirTipoViagemFormulario('round_trip');
  });
  document.getElementById('btn-tipo-oneway')?.addEventListener('click', () => {
    vibrarAoTocar();
    definirTipoViagemFormulario('one_way');
  });
  document.getElementById('input-data-volta')?.addEventListener('input', (e) => {
    const val = (e.target.value || '').toLowerCase();
    if (val.includes('só ida') || val.includes('so ida')) {
      sincronizarTipoViagemBotao('one_way');
    } else if (val.length > 0) {
      sincronizarTipoViagemBotao('round_trip');
    }
    atualizarContextoTeto();
  });
  document.getElementById('input-flexibilidade')?.addEventListener('change', atualizarContextoTeto);
  document.getElementById('form-nova-rota')?.addEventListener('submit', criarNovaRota);
}

// Carregamento de Dados da API com Auto-Backup e Auto-Restore em LocalStorage
async function carregarDadosCompletos(suave = false) {
  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const rotasUrl = isLocal && !window.__radarSincronizado ? '/api/rotas?sync=true' : '/api/rotas';
    window.__radarSincronizado = true;

    const [resRotas, resStatus, resBugs] = await Promise.all([
      fetch(rotasUrl).then((r) => r.json()),
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/bug-fares').then((r) => r.json())
    ]);

    if (resRotas.ok) {
      state.rotas = resRotas.rotas || [];

      // Auto-Backup no LocalStorage como cópia de segurança somente-leitura
      if (state.rotas.length > 0) {
        try {
          localStorage.setItem('radar_rotas_backup', JSON.stringify(state.rotas));
        } catch (_) {}
      }
    }

    if (resStatus.ok) state.poolStatus = resStatus.pool || null;
    if (resBugs.ok) state.bugFares = resBugs.items || resBugs.bugFares || [];

    atualizarMetricasRotas();
    atualizarMetricasPool();
    atualizarMetricasBugs();

    renderizarRotas();
    renderizarBugFares();
    renderizarPoolStatus();
  } catch (err) {
    console.error('Falha ao carregar dados:', err);
    if (!suave) mostrarToast('Falha ao sincronizar dados com o servidor', true);
  }
}

// Aliases defensivos globais para garantir compatibilidade irrestrita
const carregarDados = carregarDadosCompletos;
if (typeof window !== 'undefined') {
  window.carregarDados = carregarDadosCompletos;
  window.carregarDadosCompletos = carregarDadosCompletos;
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
    } else if (state.filtroCategoria === 'flexivel') {
      bateCat = Boolean(rota.sem_data === 1);
    } else if (state.filtroCategoria === 'cheapest') {
      bateCat = Boolean(extrairInfoTarifaEspecial(rota));
    } else if (state.filtroCategoria === 'clima-quente') {
      bateCat = filtrarPorFaixaClima(rota, 'quente');
    } else if (state.filtroCategoria === 'clima-ameno') {
      bateCat = filtrarPorFaixaClima(rota, 'ameno');
    } else if (state.filtroCategoria === 'clima-frio') {
      bateCat = filtrarPorFaixaClima(rota, 'frio');
    }

    // Filtro por faixa de temperatura climática (clima_temp_media)
    const bateClima = filtrarPorFaixaClima(rota, state.filtroClima);

    return bateTexto && bateCat && bateClima;
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
    if (rota.sem_data === 1) {
      cardClass = 'status-flexivel';
    }
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
            <div class="city-names">
              ${escapeHtml(rota.origem)} ➔ ${escapeHtml(rota.destino)}
              ${rota.destino_real && rota.destino_real !== rota.destino && rota.destino_real !== rota.codigo_destino ? `<span style="display:block; font-size:0.75rem; color:#10b981; font-weight:600; margin-top:2px;">📍 ${escapeHtml(rota.destino_real)}</span>` : ''}
            </div>
          </div>
          <div class="card-header-tags">
            <span class="trip-type-tag ${rota.sem_data === 1 ? 'tag-flexivel' : ''}">${tipoViagem}${flexTag}${cabineTag}</span>
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

function sanitizarLinkGoogleFlights(link, bug = {}) {
  if (!link) return 'https://www.google.com/travel/flights';
  let url = String(link);

  // 1. Corrige palavra inválida 'through' que faz o Google Flights cair na página inicial
  url = url.replace(/\bthrough\b/gi, 'returning');

  // 2. Corrige continentes ou KGMIDs que quebram o Google Flights
  if (url.includes('/m/06_1') || url.includes('South%20America') || url.includes('Am%C3%A9rica%20do%20Sul')) {
    url = url.replace(/\/m\/06_1|South%20America|Am%C3%A9rica%20do%20Sul/g, 'EZE');
  }
  if (url.includes('/m/02j9z') || url.includes('Europe') || url.includes('Europa')) {
    url = url.replace(/\/m\/02j9z|Europe|Europa/g, 'MAD');
  }
  if (url.includes('/m/09c7w0') || url.includes('United%20States') || url.includes('Estados%20Unidos')) {
    url = url.replace(/\/m\/09c7w0|United%20States|Estados%20Unidos/g, 'MIA');
  }

  // 3. Se o bug possui aeroporto concreto e datas, assegura query canônica direta
  if (bug.aeroporto_chegada && bug.data_ida && url.includes('?q=')) {
    const iataChegada = bug.aeroporto_chegada.split('-')[0].trim();
    if (iataChegada && iataChegada.length === 3) {
      const voltaParam = bug.data_volta ? `+returning+${bug.data_volta}` : '+one-way';
      url = `https://www.google.com/travel/flights?q=Flights+from+SAO+to+${iataChegada}+on+${bug.data_ida}${voltaParam}&hl=pt-BR&gl=BR&curr=BRL`;
    }
  }

  return url;
}

// Renderização Bug Fares
function renderizarBugFares() {
  if (!bugfaresContainer) return;

  if (!state.bugFares || state.bugFares.length === 0) {
    bugfaresContainer.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
        <div style="font-size: 2.2rem; margin-bottom: 12px;">🧭</div>
        <h3 style="font-size: 1.05rem; color: #ffffff; margin-bottom: 8px;">Nenhum Bug Fare Registrado no Momento</h3>
        <p style="font-size: 0.85rem; color: var(--text-dim); max-width: 480px; margin: 0 auto 20px auto; line-height: 1.5;">
          O robô pesquisa ativamente anomalias estatísticas, feeds e pisos estruturais no GDS. Você pode disparar uma caçada autônoma nos principais corredores mundiais agora mesmo a custo zero.
        </p>
        <button class="btn btn-primary" onclick="document.getElementById('btn-escanear-bugs')?.click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          <span>Iniciar Varredura Proativa Global</span>
        </button>
      </div>
    `;
    return;
  }

  bugfaresContainer.innerHTML = state.bugFares.map((bug) => {
    const ehCritico = bug.tipo?.includes('ESTRUTURAL') || bug.tipo?.includes('IRREAL');
    const ehZscore = bug.tipo?.includes('Z-SCORE') || bug.tipo?.includes('ESTATÍSTICA');
    const badgeCor = ehCritico ? 'border-color: rgba(244, 63, 94, 0.4);' : (ehZscore ? 'border-color: rgba(245, 158, 11, 0.4);' : '');
    const badgeIcon = ehCritico ? '🚨' : (ehZscore ? '⚡' : '✈️');

    // Parse defensivo de títulos antigos ou campos estruturados ricos
    let aeroporto = bug.aeroporto_chegada;
    let pais = bug.pais_destino;
    let datas = bug.periodo_texto;

    if (!aeroporto && bug.titulo) {
      if (bug.titulo.includes('América do Sul') || bug.titulo.includes('AMERICA_SUL')) {
        aeroporto = 'EZE - Aeroporto Internacional Ministro Pistarini (Ezeiza)';
        pais = 'Argentina';
      } else if (bug.titulo.includes('Europa') || bug.titulo.includes('EUROPA')) {
        aeroporto = 'MAD - Aeroporto Adolfo Suárez Madrid-Barajas';
        pais = 'Espanha';
      }
    }

    if (!datas && bug.data_ida) {
      datas = bug.data_volta ? `Ida: ${bug.data_ida} ➔ Volta: ${bug.data_volta}` : `Ida: ${bug.data_ida} (Só Ida)`;
    }

    const linkSeguro = sanitizarLinkGoogleFlights(bug.link, bug);

    // Título sem termos genéricos
    let tituloExibicao = bug.titulo || 'Bug Fare';
    if (tituloExibicao.includes('América do Sul')) {
      tituloExibicao = tituloExibicao.replace('América do Sul', 'Buenos Aires, Argentina (EZE)');
    } else if (tituloExibicao.includes('Europa (Geral)') || tituloExibicao.includes('➔ Europa')) {
      tituloExibicao = tituloExibicao.replace('Europa (Geral)', 'Madrid, Espanha (MAD)').replace('➔ Europa', '➔ Madrid, Espanha (MAD)');
    }

    return `
      <div class="bugfare-card" style="${badgeCor}">
        <div class="bugfare-info">
          <h4>${escapeHtml(tituloExibicao)}</h4>
          <div class="bugfare-badges">
            ${aeroporto ? `<span class="bugfare-chip chip-airport" title="Aeroporto de Chegada e País">🛬 <b>${escapeHtml(aeroporto)}</b> • 🌍 ${escapeHtml(pais || '')}</span>` : ''}
            ${datas ? `<span class="bugfare-chip chip-dates" title="Datas da Viagem">📅 <b>${escapeHtml(datas)}</b></span>` : ''}
          </div>
          <div class="bugfare-meta">
            <span style="font-weight: 600; color: ${ehCritico ? 'var(--rose)' : (ehZscore ? 'var(--amber)' : 'var(--cyan)')};">
              ${badgeIcon} ${escapeHtml(bug.tipo || 'Bug Fare')}
            </span> • Registrado em: ${bug.detectado_em || 'Hoje'}
          </div>
        </div>
        <a href="${escapeHtml(linkSeguro)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="white-space: nowrap;">
          <span>Ver no Google Flights ↗</span>
        </a>
      </div>
    `;
  }).join('');
}

async function escanearBugFaresProativo() {
  const btn = document.getElementById('btn-escanear-bugs');
  const label = document.getElementById('label-btn-escanear-bugs');
  if (!btn) return;

  const originalHtml = label ? label.textContent : '';
  btn.disabled = true;
  if (label) label.textContent = '⏳ Varrendo Corredores Mundiais...';
  mostrarToast('🧭 Caçada proativa de Bug Fares iniciada nos corredores globais...');

  try {
    const resp = await fetch('/api/bug-fares/escanear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limiteRotas: 6, incluirFeeds: true })
    });
    const data = await resp.json();

    if (data.ok) {
      mostrarToast(data.mensagem || 'Varredura proativa concluída!');
      await carregarDadosCompletos(true);
    } else {
      mostrarToast(data.mensagemErro || data.erro || 'Erro ao escanear bug fares', true);
    }
  } catch (err) {
    const erroTexto = (err && (err.message || String(err))) || 'Falha de comunicação';
    mostrarToast(`Falha na varredura: ${erroTexto}`, true);
  } finally {
    btn.disabled = false;
    if (label) label.textContent = originalHtml;
  }
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

  const naMeta = state.rotas.filter((r) => r.preco_atual && r.preco_alvo && r.preco_atual <= r.preco_alvo).length;
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

function obterTipoViagemFormulario() {
  const btnOne = document.getElementById('btn-tipo-oneway');
  return btnOne && btnOne.classList.contains('active') ? 'one_way' : 'round_trip';
}

function sincronizarTipoViagemBotao(tipo) {
  const btnRound = document.getElementById('btn-tipo-roundtrip');
  const btnOne = document.getElementById('btn-tipo-oneway');
  if (tipo === 'one_way') {
    btnRound?.classList.remove('active');
    btnOne?.classList.add('active');
  } else {
    btnOne?.classList.remove('active');
    btnRound?.classList.add('active');
  }
}

function definirTipoViagemFormulario(tipo) {
  sincronizarTipoViagemBotao(tipo);
  const inputVolta = document.getElementById('input-data-volta');
  const checkSemData = document.getElementById('input-sem-data');
  const ehSemData = Boolean(checkSemData?.checked);

  if (tipo === 'one_way') {
    if (inputVolta) {
      inputVolta.value = 'Só Ida';
      inputVolta.readOnly = true;
    }
  } else {
    if (inputVolta) {
      inputVolta.readOnly = false;
      const val = (inputVolta.value || '').toLowerCase();
      if (!val || val.includes('só ida') || val.includes('so ida')) {
        inputVolta.value = ehSemData ? '10 dias' : '';
      }
    }
  }

  atualizarVisualModoFlexivel();
  atualizarContextoTeto();
}

function atualizarContextoTeto() {
  const tipo = obterTipoViagemFormulario();
  const badgeTeto = document.getElementById('badge-teto-escopo');
  const hintTeto = document.getElementById('hint-teto-explicacao');
  const checkSemData = document.getElementById('input-sem-data');
  const selectFlex = document.getElementById('input-flexibilidade');
  const inputVolta = document.getElementById('input-data-volta');

  const ehSemData = Boolean(checkSemData?.checked);
  const flexDias = parseInt(selectFlex?.value || '0', 10);
  const voltaTexto = inputVolta?.value || '';
  const matchDias = voltaTexto.match(/^(\d+)/);
  const diasEstadia = matchDias ? matchDias[1] : '10';

  if (!badgeTeto || !hintTeto) return;

  if (tipo === 'one_way') {
    badgeTeto.textContent = '➡️ Apenas Ida';
    badgeTeto.className = 'teto-scope-badge badge-oneway';

    if (ehSemData) {
      hintTeto.innerHTML = `💡 <strong>Modo Flexível (Sem Data Fixa)</strong>: o radar varre continuamente os próximos meses buscando a menor tarifa de <strong>Apenas Ida</strong> abaixo deste teto.`;
    } else if (flexDias > 0) {
      hintTeto.innerHTML = `💡 <strong>Janela Flexível (±${flexDias}d)</strong>: o radar avaliará datas de <strong>Apenas Ida</strong> buscando tarifas abaixo deste teto.`;
    } else {
      hintTeto.innerHTML = `💡 O radar alertará quando o bilhete de <strong>Apenas Ida</strong> estiver abaixo deste teto.`;
    }
  } else {
    badgeTeto.textContent = '🔄 Ida e Volta';
    badgeTeto.className = 'teto-scope-badge badge-roundtrip';

    if (ehSemData) {
      hintTeto.innerHTML = `💡 <strong>Modo Flexível (Sem Data Fixa)</strong>: o radar varre continuamente os próximos meses buscando a menor tarifa total de <strong>Ida e Volta (${diasEstadia} dias de estadia)</strong> abaixo deste teto.`;
    } else if (flexDias > 0) {
      hintTeto.innerHTML = `💡 <strong>Janela Flexível (±${flexDias}d)</strong>: o radar testará combinações de <strong>Ida e Volta</strong> buscando valor total abaixo deste teto.`;
    } else {
      hintTeto.innerHTML = `💡 O radar alertará quando o valor <strong>total de Ida e Volta</strong> estiver abaixo deste teto.`;
    }
  }
}

function atualizarVisualModoFlexivel() {
  const checkSemData = document.getElementById('input-sem-data');
  const inputDataIda = document.getElementById('input-data-ida');
  const labelDataIda = document.getElementById('label-data-ida');
  const inputDataVolta = document.getElementById('input-data-volta');
  const labelDataVolta = document.getElementById('label-data-volta');
  const tipo = obterTipoViagemFormulario();

  if (!checkSemData || !inputDataIda || !labelDataIda) return;

  if (checkSemData.checked) {
    inputDataIda.removeAttribute('required');
    labelDataIda.textContent = 'Data de Ida Estimada (Opcional)';
    if (tipo === 'one_way') {
      if (labelDataVolta) labelDataVolta.textContent = 'Modalidade';
      if (inputDataVolta) {
        inputDataVolta.value = 'Só Ida';
        inputDataVolta.readOnly = true;
      }
    } else {
      if (labelDataVolta) labelDataVolta.textContent = 'Duração da Viagem (Dias de estadia)';
      if (inputDataVolta) {
        inputDataVolta.readOnly = false;
        if (!inputDataVolta.value || inputDataVolta.value.toLowerCase().includes('só ida') || inputDataVolta.value.toLowerCase().includes('so ida')) {
          inputDataVolta.value = '10 dias';
        }
        inputDataVolta.placeholder = 'Ex: 10 dias';
      }
    }
  } else {
    inputDataIda.setAttribute('required', 'required');
    labelDataIda.textContent = 'Data de Ida';
    if (tipo === 'one_way') {
      if (labelDataVolta) labelDataVolta.textContent = 'Modalidade';
      if (inputDataVolta) {
        inputDataVolta.value = 'Só Ida';
        inputDataVolta.readOnly = true;
      }
    } else {
      if (labelDataVolta) labelDataVolta.textContent = 'Volta (Data ou Dias de viagem)';
      if (inputDataVolta) {
        inputDataVolta.readOnly = false;
        if (inputDataVolta.value.toLowerCase().includes('só ida') || inputDataVolta.value.toLowerCase().includes('so ida')) {
          inputDataVolta.value = '';
        }
        inputDataVolta.placeholder = 'Ex: 14 dias ou 2026-11-24';
      }
    }
  }

  atualizarContextoTeto();
}

// Ações do Usuário
function abrirModalNovaRota() {
  document.getElementById('input-rota-id').value = '';
  document.getElementById('modal-rota-titulo').textContent = '✈️ Monitorar Nova Rota';
  document.getElementById('btn-salvar-rota-submit').textContent = 'Ativar Monitoramento';
  document.getElementById('form-nova-rota').reset();
  const selectFlex = document.getElementById('input-flexibilidade');
  if (selectFlex) selectFlex.value = '3';
  const checkSemData = document.getElementById('input-sem-data');
  if (checkSemData) checkSemData.checked = false;
  definirTipoViagemFormulario('round_trip');
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
  document.getElementById('input-data-ida').value = rota.data_ida || '';

  const checkSemData = document.getElementById('input-sem-data');
  if (checkSemData) {
    checkSemData.checked = Boolean(rota.sem_data === 1);
  }

  const ehSoIda = Boolean(
    rota.tipo_viagem === 'one_way' ||
    rota.tipo === 'one_way' ||
    (typeof rota.data_volta === 'string' && (rota.data_volta.toLowerCase().includes('só ida') || rota.data_volta.toLowerCase().includes('so ida'))) ||
    (!rota.data_volta && (!rota.dias_estadia || rota.sem_data !== 1))
  );

  definirTipoViagemFormulario(ehSoIda ? 'one_way' : 'round_trip');

  if (rota.sem_data === 1) {
    document.getElementById('input-data-volta').value = ehSoIda
      ? 'Só Ida'
      : `${rota.dias_estadia || 10} dias`;
  } else {
    document.getElementById('input-data-volta').value = ehSoIda ? 'Só Ida' : (rota.data_volta || '');
  }

  document.getElementById('input-preco-alvo').value = rota.preco_alvo || '';
  document.getElementById('input-duracao-max').value = rota.duracao_max_horas || 16;
  const selectCabine = document.getElementById('input-cabine');
  if (selectCabine) selectCabine.value = rota.cabine || 'economy';
  const selectFlex = document.getElementById('input-flexibilidade');
  if (selectFlex) selectFlex.value = String(rota.flexibilidade_dias ?? 0);

  atualizarContextoTeto();
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
  const sem_data = document.getElementById('input-sem-data')?.checked ? 1 : 0;
  const tipo = obterTipoViagemFormulario();

  const matchDias = data_volta.match(/^(\d+)/);
  const dias_estadia = matchDias ? parseInt(matchDias[1], 10) : 10;
  const ehSoIdaTexto = tipo === 'one_way' || data_volta.toLowerCase().includes('só ida') || data_volta.toLowerCase().includes('so ida');

  const url = rotaId ? `/api/rotas/${rotaId}` : '/api/rotas';
  const method = rotaId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem,
        destino,
        tipo: ehSoIdaTexto ? 'one_way' : 'round_trip',
        tipo_viagem: ehSoIdaTexto ? 'one_way' : 'round_trip',
        data_ida: data_ida || undefined,
        data_volta: ehSoIdaTexto ? 'Só Ida' : (sem_data ? `${dias_estadia} dias` : (data_volta || undefined)),
        preco_alvo,
        duracao_max_horas,
        cabine,
        flexibilidade_dias,
        sem_data,
        dias_estadia: ehSoIdaTexto ? null : dias_estadia
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

async function exportarRotasJson() {
  mostrarToast('Exportando backup das rotas em JSON...');
  try {
    const res = await fetch('/api/rotas/exportar');
    const data = await res.json();
    if (res.ok && data.rotas) {
      const blob = new Blob([JSON.stringify(data.rotas, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `radar_rotas_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mostrarToast(`📥 Backup de ${data.rotas.length} rotas baixado com sucesso!`);
    } else {
      mostrarToast('Falha ao exportar rotas', true);
    }
  } catch (err) {
    mostrarToast('Erro ao exportar backup', true);
  }
}

async function importarRotasJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const leitor = new FileReader();
  leitor.onload = async (evento) => {
    try {
      const rotas = JSON.parse(evento.target.result);
      if (!Array.isArray(rotas) || rotas.length === 0) {
        mostrarToast('Arquivo JSON inválido ou sem rotas', true);
        return;
      }

      const substituir = confirm(`Deseja substituir as rotas atuais por essas ${rotas.length} rotas do arquivo?\n(OK = Substituir todas | Cancelar = Apenas adicionar novas)`);

      mostrarToast(`Importando ${rotas.length} rotas...`);
      const res = await fetch('/api/rotas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotas, substituir })
      });

      const data = await res.json();
      if (res.ok) {
        mostrarToast(`✅ ${data.importadas} rotas importadas e sincronizadas com sucesso!`);
        carregarDadosCompletos(true);
      } else {
        mostrarToast(`Erro ao importar: ${data.erro}`, true);
      }
    } catch (err) {
      mostrarToast('Erro ao processar arquivo JSON', true);
    } finally {
      e.target.value = '';
    }
  };
  leitor.readAsText(file);
}

async function sincronizarComGitHubRemoto() {
  mostrarToast('🔄 Sincronizando rotas com o repositório GitHub...');
  try {
    const res = await fetch('/api/rotas/sincronizar-github', { method: 'POST' });
    const data = await res.json();
    if (res.ok && (data.ok || data.commitSha)) {
      mostrarToast(`✅ ${data.totalRotas || data.rotas?.length || ''} rotas sincronizadas com o GitHub com sucesso!`);
      await carregarDadosCompletos(true);
    } else {
      // Se falhar o push, tenta pull como fallback
      const resPull = await fetch('/api/rotas/sync-pull', { method: 'POST' });
      const dataPull = await resPull.json();
      if (resPull.ok && dataPull.ok) {
        mostrarToast(`✅ ${dataPull.total} rotas sincronizadas com a nuvem com sucesso!`);
        await carregarDadosCompletos(true);
      } else {
        mostrarToast(`Aviso: ${data.erro || data.mensagem || 'Falha ao sincronizar com GitHub'}`, true);
      }
    }
  } catch (err) {
    mostrarToast('Falha na comunicação de sincronização', true);
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
