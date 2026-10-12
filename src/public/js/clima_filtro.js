/**
 * RADAR DE VOOS - TRAVEL HACKING COCKPIT
 * Módulo de Filtro e Metadados Climáticos para o Cockpit PWA:
 * - Extração e normalização de temperatura média (clima_temp_media)
 * - Classificação em faixas: Quente (>25°C), Ameno (15-25°C) e Frio (<15°C)
 * - Filtragem cirúrgica de rotas por clima
 * - Renderização de badges meteorológicos enriquecidos com micro-tags
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extrai a temperatura média em graus Celsius de uma rota,
 * priorizando a coluna clima_temp_media e aplicando fallback
 * defensivo sobre clima_destino_resumo quando necessário.
 *
 * @param {Object|number|null} rota - Objeto da rota ou valor numérico
 * @returns {number|null} Temperatura numérica ou null se indisponível
 */
export function extrairTemperaturaMedia(rota) {
  if (rota === null || rota === undefined) return null;

  if (typeof rota === 'number' && Number.isFinite(rota)) {
    return rota;
  }

  if (typeof rota === 'object') {
    // 1. Prioridade: coluna numérica clima_temp_media do SQLite
    if (rota.clima_temp_media !== null && rota.clima_temp_media !== undefined) {
      const val = Number(rota.clima_temp_media);
      if (!Number.isNaN(val) && Number.isFinite(val)) {
        return val;
      }
    }

    // 2. Fallback: extração regex defensiva do resumo textual
    if (typeof rota.clima_destino_resumo === 'string') {
      const match = rota.clima_destino_resumo.match(/(-?\d+(?:[.,]\d+)?)\s*°?\s*C/i);
      if (match) {
        const parsed = parseFloat(match[1].replace(',', '.'));
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  return null;
}

/**
 * Classifica a temperatura média em uma das faixas canônicas do Cockpit:
 * - 'quente': > 25°C
 * - 'ameno': entre 15°C e 25°C (inclusive)
 * - 'frio': < 15°C
 * - 'sem_dados': quando a temperatura não está disponível
 *
 * @param {number|null} tempMedia
 * @returns {'quente'|'ameno'|'frio'|'sem_dados'}
 */
export function classificarFaixaClima(tempMedia) {
  if (tempMedia === null || tempMedia === undefined || typeof tempMedia !== 'number' || !Number.isFinite(tempMedia)) {
    return 'sem_dados';
  }

  if (tempMedia > 25) {
    return 'quente';
  }
  if (tempMedia >= 15 && tempMedia <= 25) {
    return 'ameno';
  }
  return 'frio';
}

/**
 * Retorna os metadados visuais completos de uma faixa climática ou rota.
 *
 * @param {string|Object|number} faixaOuRota
 * @returns {Object} Metadados com id, rotulo, rotuloCurto, emoji, badgeClass e cor
 */
export function obterMetaFaixaClima(faixaOuRota) {
  let faixa = 'sem_dados';

  if (typeof faixaOuRota === 'string' && ['quente', 'ameno', 'frio', 'sem_dados'].includes(faixaOuRota)) {
    faixa = faixaOuRota;
  } else {
    const temp = extrairTemperaturaMedia(faixaOuRota);
    faixa = classificarFaixaClima(temp);
  }

  switch (faixa) {
    case 'quente':
      return {
        id: 'quente',
        rotulo: 'Quente (>25°C)',
        rotuloCurto: 'Quente',
        emoji: '☀️',
        badgeClass: 'weather-badge-quente',
        chipClass: 'chip-clima-quente',
        cor: '#fbbf24'
      };
    case 'ameno':
      return {
        id: 'ameno',
        rotulo: 'Ameno (15-25°C)',
        rotuloCurto: 'Ameno',
        emoji: '⛅',
        badgeClass: 'weather-badge-ameno',
        chipClass: 'chip-clima-ameno',
        cor: '#34d399'
      };
    case 'frio':
      return {
        id: 'frio',
        rotulo: 'Frio (<15°C)',
        rotuloCurto: 'Frio',
        emoji: '❄️',
        badgeClass: 'weather-badge-frio',
        chipClass: 'chip-clima-frio',
        cor: '#38bdf8'
      };
    default:
      return {
        id: 'sem_dados',
        rotulo: 'Sem dados climáticos',
        rotuloCurto: 'Indefinido',
        emoji: '🌡️',
        badgeClass: 'weather-badge-indefinido',
        chipClass: '',
        cor: 'var(--text-dim)'
      };
  }
}

/**
 * Avalia se uma rota atende ao critério de filtro climático selecionado.
 *
 * @param {Object} rota - Rota a testar
 * @param {string} filtro - 'todos', 'quente', 'ameno', 'frio' (ou com prefixo 'clima-')
 * @returns {boolean} True se a rota deve ser exibida, false caso contrário
 */
export function filtrarPorFaixaClima(rota, filtro) {
  if (!filtro || filtro === 'todos' || filtro === 'todas') {
    return true;
  }

  // Normaliza possíveis prefixos de categoria (ex: 'clima-quente' -> 'quente')
  const filtroNormalizado = String(filtro).toLowerCase().replace(/^clima-/, '');

  if (!['quente', 'ameno', 'frio'].includes(filtroNormalizado)) {
    return true;
  }

  const temp = extrairTemperaturaMedia(rota);
  if (temp === null) {
    return false;
  }

  const faixa = classificarFaixaClima(temp);
  return faixa === filtroNormalizado;
}

/**
 * Renderiza o bloco HTML do badge meteorológico do card com destaque
 * visual correspondente à faixa de temperatura.
 *
 * @param {Object} rota - Dados da rota monitorada
 * @returns {string} Fragmento HTML do weather-badge
 */
export function renderizarWeatherBadge(rota) {
  if (!rota || typeof rota !== 'object') return '';

  const resumo = rota.clima_destino_resumo;
  const temp = extrairTemperaturaMedia(rota);

  if (!resumo && temp === null) {
    return '';
  }

  const meta = obterMetaFaixaClima(rota);
  const textoExibicao = resumo || `${temp}°C`;

  return `
    <div class="weather-badge ${meta.badgeClass}" title="Condição climática: ${meta.rotulo}">
      <span class="weather-badge-text">${escapeHtml(textoExibicao)}</span>
      ${meta.id !== 'sem_dados' ? `<span class="weather-faixa-pill">${meta.emoji} ${meta.rotuloCurto}</span>` : ''}
    </div>
  `.trim();
}
