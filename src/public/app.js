/**
 * Cockpit PWA • Radar de Voos
 * Controlador Vanilla JS mobile-first para o gerenciamento de rotas e caça de voos.
 */

import { renderizarCardRota } from './js/card_rota.js';

// Estado da aplicação
const state = {
  rotas: [],
  carregando: false,
  varrendo: false
};

// Elementos DOM
const rotasContainer = document.getElementById('rotas-container');
const btnVarrerTodas = document.getElementById('btn-varrer-todas') || document.getElementById('btn-sync');
const btnNovaRota = document.getElementById('btn-nova-rota');
const modalRota = document.getElementById('modal-rota');
const modalTitulo = document.getElementById('modal-titulo');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const btnCancelar = document.getElementById('btn-cancelar');
const formRota = document.getElementById('form-rota');
const btnSalvar = document.getElementById('btn-salvar');
const toastContainer = document.getElementById('toast-container');

// Campos do formulário
const campoId = document.getElementById('rota-id');
const campoOrigem = document.getElementById('campo-origem');
const campoDestino = document.getElementById('campo-destino');
const campoSemData = document.getElementById('campo-sem-data');
const datasContainer = document.getElementById('datas-container');
const campoDataIda = document.getElementById('campo-data-ida');
const campoDataVolta = document.getElementById('campo-data-volta');
const campoPrecoAlvo = document.getElementById('campo-preco-alvo');
const campoMaxStops = document.getElementById('campo-max-stops');
const campoCarryOnBags = document.getElementById('campo-carry-on-bags');
const campoDiasFlexiveis = document.getElementById('campo-dias-flexiveis');
const grupoDiasFlexiveis = document.getElementById('grupo-dias-flexiveis');
const tipoIdaVolta = document.getElementById('tipo-ida-volta');
const tipoSoIda = document.getElementById('tipo-so-ida');
const labelTipoIdaVolta = document.getElementById('label-tipo-ida-volta');
const labelTipoSoIda = document.getElementById('label-tipo-so-ida');
const grupoDataVolta = document.getElementById('grupo-data-volta');

/**
 * Atualiza o estado visual e os campos dependentes do Tipo de Viagem (Só Ida vs Ida e Volta)
 */
export function atualizarSelecaoTipoViagem(tipo = 'round_trip') {
  const ehSoIda = tipo === 'one_way';
  if (tipoSoIda) tipoSoIda.checked = ehSoIda;
  if (tipoIdaVolta) tipoIdaVolta.checked = !ehSoIda;

  if (labelTipoSoIda) labelTipoSoIda.classList.toggle('active', ehSoIda);
  if (labelTipoIdaVolta) labelTipoIdaVolta.classList.toggle('active', !ehSoIda);

  if (grupoDataVolta) {
    if (ehSoIda) {
      grupoDataVolta.style.opacity = '0.35';
      if (campoDataVolta) {
        campoDataVolta.disabled = true;
        campoDataVolta.placeholder = 'Não se aplica (Só Ida)';
      }
    } else {
      grupoDataVolta.style.opacity = '1';
      if (campoDataVolta) {
        campoDataVolta.disabled = false;
        campoDataVolta.placeholder = 'Ex: 2026-11-20 ou 10';
      }
    }
  }
}

/**
 * Exibe notificação toast na tela
 */
export function exibirToast(mensagem, tipo = 'info', duracao = 4000) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duracao);
}

/**
 * Carrega a lista de rotas monitoradas da API
 */
export async function carregarRotas() {
  state.carregando = true;
  try {
    const res = await fetch('/api/rotas');
    const json = await res.json();
    if (json.ok && Array.isArray(json.rotas)) {
      state.rotas = json.rotas;
      renderizarListaRotas();
    } else {
      rotasContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>⚠️ Falha ao carregar rotas</h3>
          <p>${json.erro || 'Erro inesperado no servidor.'}</p>
        </div>
      `;
    }
  } catch (err) {
    rotasContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>⚠️ Erro de conexão</h3>
        <p>Não foi possível conectar ao servidor do Radar de Voos.</p>
      </div>
    `;
  } finally {
    state.carregando = false;
  }
}

/**
 * Renderiza o container de rotas com base no state
 */
export function renderizarListaRotas() {
  if (!rotasContainer) return;

  if (state.rotas.length === 0) {
    rotasContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>Nenhuma rota monitorada</h3>
        <p>Clique em "+ Nova Rota" para cadastrar sua primeira rota de interesse.</p>
      </div>
    `;
    return;
  }

  rotasContainer.innerHTML = state.rotas.map(r => renderizarCardRota(r)).join('');
}

/**
 * Abre o modal de criação ou edição
 */
export function abrirModal(rota = null) {
  formRota.reset();
  if (rota) {
    modalTitulo.textContent = `Editar Rota #${rota.id}`;
    campoId.value = rota.id;
    campoOrigem.value = rota.origem || '';
    campoDestino.value = rota.destino || '';
    campoSemData.checked = Boolean(rota.sem_data);
    campoDataIda.value = rota.data_ida || '';
    campoDataVolta.value = rota.data_volta || '';
    campoPrecoAlvo.value = rota.preco_alvo !== null && rota.preco_alvo !== undefined ? rota.preco_alvo : '';

    // Armadilha de falsy evitada: max_stops === 0 deve selecionar '0' no select
    if (rota.max_stops !== null && rota.max_stops !== undefined) {
      campoMaxStops.value = String(rota.max_stops);
    } else {
      campoMaxStops.value = '';
    }

    campoCarryOnBags.checked = Boolean(rota.carry_on_bags && Number(rota.carry_on_bags) > 0);

    const diasFlexVal = (rota.dias_flexiveis !== undefined && rota.dias_flexiveis !== null)
      ? rota.dias_flexiveis
      : (rota.diasFlexiveis !== undefined && rota.diasFlexiveis !== null ? rota.diasFlexiveis : 0);
    if (campoDiasFlexiveis) {
      campoDiasFlexiveis.value = String(diasFlexVal);
    }

    const ehSoIda = rota.tipo_viagem === 'one_way' ||
      (!rota.data_volta && (!rota.dias_estadia || Number(rota.dias_estadia) === 0));
    atualizarSelecaoTipoViagem(ehSoIda ? 'one_way' : 'round_trip');
  } else {
    modalTitulo.textContent = 'Nova Rota Monitorada';
    campoId.value = '';
    campoSemData.checked = false;
    campoMaxStops.value = '';
    campoCarryOnBags.checked = false;
    if (campoDiasFlexiveis) {
      campoDiasFlexiveis.value = '0';
    }
    atualizarSelecaoTipoViagem('round_trip');
  }

  alternarCamposData(campoSemData.checked);
  modalRota.classList.remove('hidden');
}

export function fecharModal() {
  modalRota.classList.add('hidden');
  formRota.reset();
}

function alternarCamposData(semData) {
  if (semData) {
    campoDataIda.removeAttribute('required');
    datasContainer.style.opacity = '0.5';
    if (campoDiasFlexiveis) campoDiasFlexiveis.disabled = true;
    if (grupoDiasFlexiveis) grupoDiasFlexiveis.style.opacity = '0.5';
  } else {
    campoDataIda.setAttribute('required', 'true');
    datasContainer.style.opacity = '1';
    if (campoDiasFlexiveis) campoDiasFlexiveis.disabled = false;
    if (grupoDiasFlexiveis) grupoDiasFlexiveis.style.opacity = '1';
  }
}

/**
 * Submete criação ou edição de rota com tratamento de loading, error e success
 */
export async function salvarRota(event) {
  event.preventDefault();

  const id = campoId.value ? parseInt(campoId.value, 10) : null;
  const origem = campoOrigem.value.trim();
  const destino = campoDestino.value.trim();
  const semData = campoSemData.checked;
  const dataIda = campoDataIda.value.trim();
  const dataVolta = campoDataVolta.value.trim();

  const ehSoIda = tipoSoIda ? tipoSoIda.checked : false;
  const tipoViagem = ehSoIda ? 'one_way' : 'round_trip';
  const dataVoltaEfetiva = ehSoIda ? null : (dataVolta || null);

  // Armadilha de falsy evitada: parse seguro de valores numéricos
  const precoAlvoVal = campoPrecoAlvo.value.trim();
  const precoAlvo = precoAlvoVal !== '' && !isNaN(Number(precoAlvoVal)) ? Number(precoAlvoVal) : null;

  const maxStopsVal = campoMaxStops.value.trim();
  const maxStops = maxStopsVal !== '' && !isNaN(Number(maxStopsVal)) ? Number(maxStopsVal) : null;

  const carryOnBags = campoCarryOnBags.checked ? 1 : 0;

  const diasFlexVal = campoDiasFlexiveis ? campoDiasFlexiveis.value.trim() : '0';
  const diasFlexiveis = diasFlexVal !== '' && !isNaN(Number(diasFlexVal))
    ? Math.min(3, Math.max(0, parseInt(diasFlexVal, 10)))
    : 0;

  const payload = {
    origem,
    destino,
    tipo_viagem: tipoViagem,
    tipo: tipoViagem,
    sem_data: semData ? 1 : 0,
    data_ida: dataIda || null,
    data_volta: dataVoltaEfetiva,
    preco_alvo: precoAlvo,
    max_stops: maxStops,
    carry_on_bags: carryOnBags,
    dias_flexiveis: diasFlexiveis
  };

  // Estado explícito de Loading
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<span class="loading-spinner"></span> Salvando...';

  try {
    const url = id ? `/api/rotas/${id}` : '/api/rotas';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (json.ok) {
      exibirToast(id ? 'Rota atualizada com sucesso!' : 'Nova rota cadastrada com sucesso!', 'success');
      fecharModal();
      await carregarRotas();
    } else {
      exibirToast(json.erro || 'Erro ao salvar rota', 'error');
    }
  } catch (err) {
    exibirToast(`Falha de comunicação: ${err.message}`, 'error');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<span class="btn-text">Salvar Rota</span>';
  }
}

/**
 * Ações dos botões dos cards (checar agora, editar, excluir)
 */
async function manipularAcaoCard(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const acao = btn.dataset.action;
  const rotaId = parseInt(btn.dataset.id, 10);
  if (!rotaId) return;

  if (acao === 'verificar') {
    btn.disabled = true;
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> Checando...';
    try {
      const res = await fetch(`/api/rotas/${rotaId}/verificar`, { method: 'POST' });
      const json = await res.json();
      if (json.ok && json.resultado && json.resultado.sucesso) {
        exibirToast(`Varredura concluída! Menor preço: R$ ${json.resultado.oferta?.preco || 'encontrado'}`, 'success');
        await carregarRotas();
      } else {
        exibirToast(json.resultado?.erro || json.erro || 'Nenhum voo encontrado nos filtros.', 'info');
      }
    } catch (err) {
      exibirToast(`Erro ao checar rota: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = txtOriginal;
    }
  } else if (acao === 'editar') {
    const rota = state.rotas.find(r => r.id === rotaId);
    if (rota) abrirModal(rota);
  } else if (acao === 'excluir') {
    if (!confirm('Deseja realmente remover esta rota monitorada?')) return;
    try {
      const res = await fetch(`/api/rotas/${rotaId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        exibirToast('Rota removida com sucesso!', 'success');
        await carregarRotas();
      } else {
        exibirToast(json.erro || 'Erro ao remover rota.', 'error');
      }
    } catch (err) {
      exibirToast(`Erro ao excluir: ${err.message}`, 'error');
    }
  }
}

/**
 * Executa a varredura completa sob demanda de todas as rotas monitoradas no Google Flights
 */
export async function varrerTodasRotas() {
  const btn = document.getElementById('btn-varrer-todas') || document.getElementById('btn-sync');
  if (state.varrendo) return;

  if (!state.rotas || state.rotas.length === 0) {
    exibirToast('Nenhuma rota monitorada para varrer.', 'info');
    return;
  }

  state.varrendo = true;
  const txtOriginal = btn ? btn.innerHTML : '⚡ Varrer Todos os Voos';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Varrendo voos...';
  }

  exibirToast('🔍 Iniciando varredura de voos em todas as rotas monitoradas...', 'info', 4500);

  try {
    const res = await fetch('/api/varredura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true })
    });

    const json = await res.json();
    if (res.status === 409) {
      exibirToast(json.erro || 'Uma varredura já está em andamento no servidor.', 'info');
    } else if (json.ok) {
      const processadas = json.resultado?.processadas ?? state.rotas.length;
      exibirToast(`✅ Varredura concluída! ${processadas} ${processadas === 1 ? 'rota atualizada' : 'rotas atualizadas'}.`, 'success');
      await carregarRotas();
    } else {
      exibirToast(json.erro || 'Falha ao executar varredura de voos.', 'error');
    }
  } catch (err) {
    exibirToast(`Erro de conexão ao varrer voos: ${err.message}`, 'error');
  } finally {
    state.varrendo = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = txtOriginal;
    }
  }
}

/**
 * Conecta ao Server-Sent Events (SSE) para atualização em tempo real no Cockpit
 */
export function inicializarSseTelemetria() {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return;
  try {
    const es = new EventSource('/api/stream/telemetria');
    es.addEventListener('telemetria', (e) => {
      try {
        const evento = JSON.parse(e.data);
        if (['rota_verificada', 'ciclo_concluido', 'nova_rota', 'rota_atualizada', 'rota_removida'].includes(evento.tipo)) {
          carregarRotas();
        }
      } catch (_) {}
    });
    es.onerror = () => {
      // Reconexão automática em caso de instabilidade
    };
  } catch (_) {}
}

// Inicialização de listeners no DOM
document.addEventListener('DOMContentLoaded', () => {
  carregarRotas();
  inicializarSseTelemetria();

  const btnVarrer = document.getElementById('btn-varrer-todas') || document.getElementById('btn-sync');
  if (btnVarrer) btnVarrer.addEventListener('click', varrerTodasRotas);
  if (btnNovaRota) btnNovaRota.addEventListener('click', () => abrirModal());
  if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModal);
  if (btnCancelar) btnCancelar.addEventListener('click', fecharModal);
  if (tipoIdaVolta) tipoIdaVolta.addEventListener('change', () => atualizarSelecaoTipoViagem('round_trip'));
  if (tipoSoIda) tipoSoIda.addEventListener('change', () => atualizarSelecaoTipoViagem('one_way'));
  if (campoSemData) campoSemData.addEventListener('change', (e) => alternarCamposData(e.target.checked));
  if (formRota) formRota.addEventListener('submit', salvarRota);
  if (rotasContainer) rotasContainer.addEventListener('click', manipularAcaoCard);

  // Registro defensivo do Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa em ambientes sem HTTPS ou em testes
    });
  }
});
