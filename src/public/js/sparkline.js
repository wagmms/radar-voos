/**
 * Gerador de Sparklines em SVG Puro (Zero Dependências)
 * Inspirado na skill `smart-charts`
 * Inclui cálculo de economia vs teto e ordenação rápida de rotas.
 */

/**
 * Renderiza sparkline em SVG puro leve a partir de 5 a 10 pontos do histórico de preços.
 * Destaca o ponto de menor preço histórico com anel indicador e tooltip explicativo.
 *
 * @param {Array<number|Object>} historico Lista de leituras recentes (números ou objetos com campo preco)
 * @param {Object} [options] Opções visuais (width, height, strokeColor, fillColor, maxPontos)
 * @returns {string} String com SVG ou placeholder gracioso
 */
export function renderizarSparkline(historico, options = {}) {
  const width = options.width || 120;
  const height = options.height || 32;
  const strokeColor = options.strokeColor || '#10b981'; // Emerald
  const fillColor = options.fillColor || 'rgba(16, 185, 129, 0.12)';
  const maxPontos = options.maxPontos || 10;

  if (!Array.isArray(historico) || historico.length === 0) {
    return `<span class="sparkline-placeholder">Sem histórico</span>`;
  }

  // Extrai lista numérica de preços positivos
  let precos = historico
    .map(h => (typeof h === 'number' ? h : h?.preco))
    .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

  if (precos.length === 0) {
    return `<span class="sparkline-placeholder">Sem leituras</span>`;
  }

  // Janela calibrada: limita aos últimos 5–10 pontos para manter o gráfico ultraleve
  if (precos.length > maxPontos) {
    precos = precos.slice(-maxPontos);
  }

  if (precos.length === 1) {
    return `
      <svg class="sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-pontos="1" data-min="${precos[0]}" data-atual="${precos[0]}">
        <title>Leitura única: R$ ${precos[0].toFixed(2).replace('.', ',')}</title>
        <line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="${strokeColor}" stroke-dasharray="3,3" stroke-width="2"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="3" fill="${strokeColor}"/>
      </svg>
    `;
  }

  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const range = (max - min) === 0 ? 1 : (max - min);
  const paddingY = 4;
  const usableHeight = height - (paddingY * 2);

  const points = precos.map((preco, idx) => {
    const x = (idx / (precos.length - 1)) * width;
    const y = height - paddingY - ((preco - min) / range) * usableHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), preco };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Área preenchida sob a curva
  const areaPoints = `${polylinePoints} ${width},${height} 0,${height}`;

  // Ponto do último preço (leitura mais recente)
  const lastPoint = points[points.length - 1];
  // Ponto do menor preço na série
  const minPoint = points.reduce((prev, curr) => (curr.preco < prev.preco ? curr : prev), points[0]);
  const ehNovoMinimo = minPoint.preco === lastPoint.preco;

  return `
    <svg class="sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-pontos="${precos.length}" data-min="${minPoint.preco}" data-atual="${lastPoint.preco}">
      <title>Histórico de preços (${precos.length} pontos) | Mínimo: R$ ${minPoint.preco.toFixed(2).replace('.', ',')} | Atual: R$ ${lastPoint.preco.toFixed(2).replace('.', ',')}</title>
      <polygon fill="${fillColor}" points="${areaPoints}" />
      <polyline fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />
      <!-- Marcação do Menor Preço Histórico (com anel indicador e preenchimento esmeralda) -->
      <circle cx="${minPoint.x}" cy="${minPoint.y}" r="5.5" fill="none" stroke="#34d399" stroke-width="1.2" opacity="0.85" />
      <circle cx="${minPoint.x}" cy="${minPoint.y}" r="3" fill="#34d399" />
      <!-- Ponto da Última Leitura (quando diferente do mínimo) -->
      ${!ehNovoMinimo ? `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="3.5" fill="#38bdf8" />` : ''}
    </svg>
  `;
}

/**
 * Calcula a economia percentual em relação ao teto/preço alvo monitorado.
 * Fórmula: ((preco_alvo - preco_atual) / preco_alvo) * 100
 * Retorna null se a rota não possuir teto ou preço atual válido.
 *
 * @param {Object} rota Objeto da rota contendo preco_alvo e preco_atual
 * @returns {number|null} Percentual de economia arredondado para 1 casa decimal ou null
 */
export function calcularEconomiaPercentualTeto(rota) {
  if (!rota) return null;
  const teto = typeof rota.preco_alvo === 'number' ? rota.preco_alvo : parseFloat(rota.preco_alvo);
  const atual = typeof rota.preco_atual === 'number' ? rota.preco_atual : parseFloat(rota.preco_atual);

  if (!teto || isNaN(teto) || teto <= 0) return null;
  if (!atual || isNaN(atual) || atual <= 0) return null;

  const economiaPct = ((teto - atual) / teto) * 100;
  return Number(economiaPct.toFixed(1));
}

/**
 * Ordena a lista de rotas com base no critério selecionado.
 * Suporta ordenação rápida por maior economia percentual em relação ao preço alvo/teto.
 *
 * @param {Array<Object>} rotas Lista de rotas monitoradas
 * @param {'padrao'|'economia'|'preco'} criterio Critério de ordenação
 * @returns {Array<Object>} Nova lista ordenada de rotas
 */
export function ordenarRotasPorEconomia(rotas, criterio = 'padrao') {
  if (!Array.isArray(rotas)) return [];
  const lista = [...rotas];

  if (criterio === 'economia') {
    return lista.sort((a, b) => {
      const econA = calcularEconomiaPercentualTeto(a);
      const econB = calcularEconomiaPercentualTeto(b);

      // 1. Ambas possuem meta calculada: maior economia % primeiro
      if (econA !== null && econB !== null) {
        if (econB !== econA) return econB - econA;
        return (a.preco_atual || 0) - (b.preco_atual || 0);
      }

      // 2. Apenas uma possui meta: priorizar quem tem meta
      if (econA !== null) return -1;
      if (econB !== null) return 1;

      // 3. Nenhuma possui meta: ordenar por menor preço absoluto
      const precoA = a.preco_atual && a.preco_atual > 0 ? a.preco_atual : 999999;
      const precoB = b.preco_atual && b.preco_atual > 0 ? b.preco_atual : 999999;
      return precoA - precoB;
    });
  }

  if (criterio === 'preco') {
    return lista.sort((a, b) => {
      const precoA = a.preco_atual && a.preco_atual > 0 ? a.preco_atual : 999999;
      const precoB = b.preco_atual && b.preco_atual > 0 ? b.preco_atual : 999999;
      return precoA - precoB;
    });
  }

  // 'padrao': preserva a ordem original
  return lista;
}

/**
 * Extrai os 5 a 10 pontos de preços para renderização de sparklines.
 * Utiliza historico_recente ou gera fallback a partir de menor_preco_historico e preco_atual.
 *
 * @param {Object} rota Objeto da rota
 * @param {number} [maxPontos=10] Limite máximo de pontos
 * @returns {Array<number>} Lista numérica de preços
 */
export function extrairPontosSparkline(rota, maxPontos = 10) {
  if (!rota) return [];

  if (Array.isArray(rota.historico_recente) && rota.historico_recente.length > 0) {
    const precos = rota.historico_recente
      .map(h => (typeof h === 'number' ? h : h?.preco))
      .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);
    if (precos.length > 0) {
      return precos.slice(-maxPontos);
    }
  }

  // Fallback quando não há série temporal detalhada
  const fallback = [];
  if (rota.menor_preco_historico && rota.menor_preco_historico > 0) {
    fallback.push(Number(rota.menor_preco_historico));
  }
  if (rota.preco_atual && rota.preco_atual > 0) {
    if (fallback.length === 0 || fallback[0] !== Number(rota.preco_atual)) {
      fallback.push(Number(rota.preco_atual));
    }
  }

  return fallback;
}

