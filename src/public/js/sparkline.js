/**
 * Gerador de Sparklines em SVG Puro (Zero Dependências)
 * Inspirado na skill `smart-charts`
 */

export function renderizarSparkline(historico, options = {}) {
  const width = options.width || 120;
  const height = options.height || 32;
  const strokeColor = options.strokeColor || '#10b981'; // Emerald
  const fillColor = options.fillColor || 'rgba(16, 185, 129, 0.12)';

  if (!Array.isArray(historico) || historico.length === 0) {
    return `<span class="sparkline-placeholder">Sem histórico</span>`;
  }

  // Extrai lista numérica de preços
  const precos = historico.map(h => (typeof h === 'number' ? h : h.preco)).filter(p => p && p > 0);

  if (precos.length === 0) {
    return `<span class="sparkline-placeholder">Sem leituras</span>`;
  }

  if (precos.length === 1) {
    return `
      <svg class="sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
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

  // Ponto do último preço
  const lastPoint = points[points.length - 1];
  // Ponto do menor preço
  const minPoint = points.reduce((prev, curr) => (curr.preco < prev.preco ? curr : prev), points[0]);

  return `
    <svg class="sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polygon fill="${fillColor}" points="${areaPoints}" />
      <polyline fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />
      <!-- Menor Preço Histórico (Dourado/Verde) -->
      <circle cx="${minPoint.x}" cy="${minPoint.y}" r="3" fill="#34d399" />
      <!-- Última Leitura (Pulsante) -->
      <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="3.5" fill="#38bdf8" />
    </svg>
  `;
}
