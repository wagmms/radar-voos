/**
 * RADAR DE VOOS - TRAVEL HACKING COCKPIT APP
 */

// Registrar Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Falha ao registrar Service Worker:', err);
    });
  });
}

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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  carregarDadosCompletos();

  // Polling automático de atualização a cada 30 segundos
  setInterval(carregarDadosCompletos, 30000);
});

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
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
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filtroCategoria = chip.getAttribute('data-filter');
      renderizarRotas();
    });
  });

  // Botões de Ação Topo
  document.getElementById('btn-forcar-varredura')?.addEventListener('click', executarVarreduraManual);
  document.getElementById('btn-testar-telegram')?.addEventListener('click', testarTelegram);
  document.getElementById('btn-abrir-modal-rota')?.addEventListener('click', () => abrirModal(modalRota));
  document.getElementById('btn-fechar-modal-rota')?.addEventListener('click', () => fecharModal(modalRota));
  document.getElementById('btn-cancelar-modal-rota')?.addEventListener('click', () => fecharModal(modalRota));

  document.getElementById('btn-fechar-modal-historico')?.addEventListener('click', () => fecharModal(modalHistorico));
  document.getElementById('btn-escanear-rss')?.addEventListener('click', escanearRss);
  document.getElementById('btn-reset-hoje')?.addEventListener('click', resetarCotasHoje);

  // Form Nova Rota
  document.getElementById('form-nova-rota')?.addEventListener('submit', criarNovaRota);
}

// Carregamento de Dados da API
async function carregarDadosCompletos() {
  try {
    const [resRotas, resStatus, resBugs] = await Promise.all([
      fetch('/api/rotas').then((r) => r.json()),
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/bug-fares').then((r) => r.json())
    ]);

    if (resRotas.ok) {
      state.rotas = resRotas.rotas;
      renderizarRotas();
      atualizarMetricasRotas();
    }

    if (resStatus.ok) {
      state.poolStatus = resStatus.pool;
      renderizarPoolStatus();
      atualizarMetricasPool();
    }

    if (resBugs.ok) {
      state.bugFares = resBugs.items;
      renderizarBugFares();
      atualizarMetricasBugs();
    }
  } catch (err) {
    console.error('Erro ao buscar dados da API:', err);
  }
}

// Renderização das Rotas
function renderizarRotas() {
  if (!rotasContainer) return;

  let filtradas = state.rotas.filter((rota) => {
    const busca = `${rota.origem} ${rota.destino} ${rota.codigo_origem} ${rota.codigo_destino}`.toLowerCase();
    const bateTexto = !state.filtroTexto || busca.includes(state.filtroTexto);

    if (!bateTexto) return false;

    if (state.filtroCategoria === 'meta') {
      return rota.preco_atual && rota.preco_alvo && rota.preco_atual <= rota.preco_alvo;
    }
    if (state.filtroCategoria === 'promo') {
      return rota.termometro && (rota.termometro.includes('Super Barato') || rota.termometro.includes('Promoção'));
    }
    return true;
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
    } else if (rota.termometro && rota.termometro.includes('Super Barato')) {
      cardClass = 'status-promo';
      termoClass = 'low';
    }

    const tipoViagem = rota.data_volta ? 'IDA E VOLTA' : 'SÓ IDA';

    return `
      <div class="flight-card ${cardClass}" id="card-rota-${rota.id}">
        <div class="card-route-header">
          <div class="route-airports">
            <span class="airport-badge">${escapeHtml(rota.codigo_origem || 'SAO')}</span>
            <span class="route-arrow">➔</span>
            <span class="airport-badge">${escapeHtml(rota.codigo_destino || 'DEST')}</span>
            <div class="city-names">${escapeHtml(rota.origem)} ➔ ${escapeHtml(rota.destino)}</div>
          </div>
          <span class="trip-type-tag">${tipoViagem}</span>
        </div>

        <div class="card-dates-box">
          <div>📅 Ida: <strong>${formatarDataBr(rota.data_ida)}</strong></div>
          <div>${rota.data_volta ? `Volta: <strong>${formatarDataBr(rota.data_volta)}</strong>` : 'Só Ida'}</div>
        </div>

        <div class="flight-specs">
          ${rota.detalhes_voo && rota.detalhes_voo !== '-' ? `✈️ ${escapeHtml(rota.detalhes_voo)}` : '⏱️ Duração máx: ' + (rota.duracao_max_horas || 16) + 'h'}
        </div>

        <div class="card-pricing-block">
          <div class="price-main">
            <span class="price-label">Preço Atual</span>
            <span class="price-amount">${precoFormatado}</span>
          </div>
          <div class="price-meta-block">
            <div>Meta: <span class="val-meta">${precoAlvoFormatado}</span></div>
            <div>Recorde: <span class="val-menor">${menorHistorico}</span></div>
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

// Ações do Usuário
async function criarNovaRota(e) {
  e.preventDefault();
  const origem = document.getElementById('input-origem').value.trim();
  const destino = document.getElementById('input-destino').value.trim();
  const data_ida = document.getElementById('input-data-ida').value;
  const data_volta = document.getElementById('input-data-volta').value.trim();
  const preco_alvo = document.getElementById('input-preco-alvo').value;
  const duracao_max_horas = document.getElementById('input-duracao-max').value;

  try {
    const res = await fetch('/api/rotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem,
        destino,
        data_ida,
        data_volta,
        preco_alvo,
        duracao_max_horas
      })
    });

    const data = await res.json();
    if (!res.ok) {
      mostrarToast(`Erro: ${data.erro || 'Falha ao salvar rota'}`, true);
      return;
    }

    mostrarToast(`Rota ${origem} ➔ ${destino} adicionada ao radar!`);
    fecharModal(modalRota);
    document.getElementById('form-nova-rota').reset();
    carregarDadosCompletos();
  } catch (err) {
    mostrarToast('Erro ao comunicar com servidor', true);
  }
}

window.verificarRotaIndividual = async function(id) {
  mostrarToast('Iniciando checagem da rota no Google Flights...');
  try {
    const res = await fetch(`/api/rotas/${id}/verificar`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.resultado.sucesso) {
      mostrarToast('Cotação atualizada com sucesso!');
      carregarDadosCompletos();
    } else {
      mostrarToast(`Aviso: ${data.resultado?.erro || 'Sem voos no filtro'}`, true);
      carregarDadosCompletos();
    }
  } catch (err) {
    mostrarToast('Falha na requisição de checagem', true);
  }
};

window.excluirRota = async function(id) {
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
      carregarDadosCompletos();
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

async function escanearRss() {
  mostrarToast('Consultando feed RSS do Melhores Destinos...');
  try {
    const res = await fetch('/api/bug-fares/escanear', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      mostrarToast(`Feed analisado! ${data.resultado.novos || 0} novos bugs encontrados.`);
      carregarDadosCompletos();
    }
  } catch (err) {
    mostrarToast('Erro ao analisar feed', true);
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
