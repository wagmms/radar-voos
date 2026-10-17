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
const blocoModoFlexivel = document.getElementById('bloco-modo-flexivel');
const grupoFlexEstadia = document.getElementById('grupo-flex-estadia');
const grupoFlexSoIda = document.getElementById('grupo-flex-so-ida');
const campoDiasEstadia = document.getElementById('campo-dias-estadia');
const textoDiasEstadiaPreview = document.getElementById('texto-dias-estadia-preview');
const pillsAtalhosDias = document.getElementById('pills-atalhos-dias');

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
 * Sincroniza dinamicamente a visibilidade e obrigatoriedade dos campos
 * de acordo com o Modo Flexível (Sem Data) e o Tipo de Viagem (Só Ida vs Ida e Volta)
 */
export function sincronizarCamposFormulario() {
  const ehSemData = Boolean(campoSemData && campoSemData.checked);
  const ehSoIda = Boolean(tipoSoIda && tipoSoIda.checked);

  if (ehSemData) {
    // 1. Modo Flexível Sem Data: Oculta campos de datas fixas e seletor de janela flexível
    if (datasContainer) datasContainer.style.display = 'none';
    if (grupoDiasFlexiveis) grupoDiasFlexiveis.style.display = 'none';
    if (campoDataIda) campoDataIda.removeAttribute('required');
    if (blocoModoFlexivel) blocoModoFlexivel.style.display = 'block';

    if (ehSoIda) {
      if (grupoFlexEstadia) grupoFlexEstadia.style.display = 'none';
      if (grupoFlexSoIda) grupoFlexSoIda.style.display = 'block';
    } else {
      if (grupoFlexEstadia) grupoFlexEstadia.style.display = 'block';
      if (grupoFlexSoIda) grupoFlexSoIda.style.display = 'none';

      const diasVal = campoDiasEstadia ? parseInt(campoDiasEstadia.value, 10) : 10;
      const dias = (Number.isFinite(diasVal) && diasVal > 0) ? diasVal : 10;
      if (textoDiasEstadiaPreview) textoDiasEstadiaPreview.textContent = `${dias} dias`;

      if (pillsAtalhosDias) {
        pillsAtalhosDias.querySelectorAll('.btn-pill-dias').forEach(btn => {
          const btnDias = parseInt(btn.dataset.dias, 10);
          btn.classList.toggle('active', btnDias === dias);
        });
      }
    }
  } else {
    // 2. Modo Data Fixa: Exibe datas de calendário e janela flexível
    if (blocoModoFlexivel) blocoModoFlexivel.style.display = 'none';
    if (datasContainer) datasContainer.style.display = 'grid';
    if (grupoDiasFlexiveis) grupoDiasFlexiveis.style.display = 'block';
    if (campoDataIda) campoDataIda.setAttribute('required', 'true');

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
}

/**
 * Atualiza o estado visual e os campos dependentes do Tipo de Viagem (Só Ida vs Ida e Volta)
 */
export function atualizarSelecaoTipoViagem(tipo = 'round_trip') {
  const ehSoIda = tipo === 'one_way';
  if (tipoSoIda) tipoSoIda.checked = ehSoIda;
  if (tipoIdaVolta) tipoIdaVolta.checked = !ehSoIda;

  if (labelTipoSoIda) labelTipoSoIda.classList.toggle('active', ehSoIda);
  if (labelTipoIdaVolta) labelTipoIdaVolta.classList.toggle('active', !ehSoIda);

  sincronizarCamposFormulario();
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
    const res = await fetch(`/api/rotas?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
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
    const ehSemData = Boolean(rota.sem_data);
    campoSemData.checked = ehSemData;

    // Preserva a quantidade de dias de estadia configurada pelo usuário (ex: 14 dias)
    const diasEstadiaSalvo = (rota.dias_estadia && Number(rota.dias_estadia) > 0)
      ? Number(rota.dias_estadia)
      : 10;
    if (campoDiasEstadia) campoDiasEstadia.value = String(diasEstadiaSalvo);

    if (ehSemData) {
      // No modo flexível sem data, NUNCA expõe datas pontuais do scanner no formulário
      campoDataIda.value = '';
      campoDataVolta.value = '';
    } else {
      campoDataIda.value = rota.data_ida || '';
      campoDataVolta.value = rota.data_volta || '';
    }

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
    if (campoDiasEstadia) campoDiasEstadia.value = '10';
    campoDataIda.value = '';
    campoDataVolta.value = '';
    campoMaxStops.value = '';
    campoCarryOnBags.checked = false;
    if (campoDiasFlexiveis) {
      campoDiasFlexiveis.value = '0';
    }
    atualizarSelecaoTipoViagem('round_trip');
  }

  sincronizarCamposFormulario();
  modalRota.classList.remove('hidden');
}

export function fecharModal() {
  modalRota.classList.add('hidden');
  formRota.reset();
}

function alternarCamposData(semData) {
  sincronizarCamposFormulario();
}

/**
 * Submete criação ou edição de rota com tratamento de loading, error e success
 */
export async function salvarRota(event) {
  event.preventDefault();

  const id = campoId.value ? parseInt(campoId.value, 10) : null;
  const origem = campoOrigem.value.trim();
  const destino = campoDestino.value.trim();
  const semData = campoSemData ? campoSemData.checked : false;

  const ehSoIda = tipoSoIda ? tipoSoIda.checked : false;
  const tipoViagem = ehSoIda ? 'one_way' : 'round_trip';

  let dataIda = null;
  let dataVolta = null;
  let diasEstadia = null;

  if (semData) {
    // No Modo Flexível: Não há datas fixas. A duração da viagem é obtida do campo dedicado.
    dataIda = null;
    dataVolta = null;
    if (!ehSoIda) {
      const diasNum = campoDiasEstadia ? parseInt(campoDiasEstadia.value, 10) : 10;
      diasEstadia = (Number.isFinite(diasNum) && diasNum > 0) ? diasNum : 10;
    }
  } else {
    dataIda = campoDataIda.value.trim() || null;
    if (!ehSoIda) {
      const voltaStr = campoDataVolta.value.trim();
      dataVolta = voltaStr || null;
      const matchDias = voltaStr.match(/^(\d+)(?:\s*(?:dias?|d|\(dias?\)|noites?|n))?$/i);
      if (matchDias) {
        diasEstadia = parseInt(matchDias[1], 10);
      } else if (campoDiasEstadia && campoDiasEstadia.value) {
        diasEstadia = parseInt(campoDiasEstadia.value, 10) || 10;
      }
    }
  }

  // Armadilha de falsy evitada: parse seguro de valores numéricos
  const precoAlvoVal = campoPrecoAlvo.value.trim();
  const precoAlvo = precoAlvoVal !== '' && !isNaN(Number(precoAlvoVal)) ? Number(precoAlvoVal) : null;

  const maxStopsVal = campoMaxStops.value.trim();
  const maxStops = maxStopsVal !== '' && !isNaN(Number(maxStopsVal)) ? Number(maxStopsVal) : null;

  const carryOnBags = campoCarryOnBags.checked ? 1 : 0;

  const diasFlexVal = (campoDiasFlexiveis && !semData) ? campoDiasFlexiveis.value.trim() : '0';
  const diasFlexiveis = diasFlexVal !== '' && !isNaN(Number(diasFlexVal))
    ? Math.min(3, Math.max(0, parseInt(diasFlexVal, 10)))
    : 0;

  const payload = {
    origem,
    destino,
    tipo_viagem: tipoViagem,
    tipo: tipoViagem,
    sem_data: semData ? 1 : 0,
    data_ida: dataIda,
    data_volta: dataVolta,
    dias_estadia: diasEstadia,
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
  if (campoDiasEstadia) {
    campoDiasEstadia.addEventListener('input', () => {
      const val = parseInt(campoDiasEstadia.value, 10);
      const dias = (Number.isFinite(val) && val > 0) ? val : 10;
      if (textoDiasEstadiaPreview) textoDiasEstadiaPreview.textContent = `${dias} dias`;
      if (pillsAtalhosDias) {
        pillsAtalhosDias.querySelectorAll('.btn-pill-dias').forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.dias, 10) === dias);
        });
      }
    });
  }
  if (pillsAtalhosDias) {
    pillsAtalhosDias.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-pill-dias');
      if (!btn) return;
      const dias = parseInt(btn.dataset.dias, 10);
      if (Number.isFinite(dias) && dias > 0 && campoDiasEstadia) {
        campoDiasEstadia.value = String(dias);
        if (textoDiasEstadiaPreview) textoDiasEstadiaPreview.textContent = `${dias} dias`;
        pillsAtalhosDias.querySelectorAll('.btn-pill-dias').forEach(b => b.classList.toggle('active', b === btn));
      }
    });
  }
  if (formRota) formRota.addEventListener('submit', salvarRota);
  if (rotasContainer) rotasContainer.addEventListener('click', manipularAcaoCard);

  // Registro defensivo do Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa em ambientes sem HTTPS ou em testes
    });
  }
});
