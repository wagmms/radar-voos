/**
 * Cálculo de Rotas Aéreas Geodésicas e Arcos Ortodrômicos (Great Circle)
 * Inspirado na skill `remotion-maps`
 */

export const COORDENADAS_MAPA = {
  GRU: { x: 320, y: 350, cidade: 'São Paulo' },
  SAO: { x: 320, y: 350, cidade: 'São Paulo' },
  GIG: { x: 330, y: 345, cidade: 'Rio de Janeiro' },
  BSB: { x: 310, y: 325, cidade: 'Brasília' },
  SSA: { x: 345, y: 315, cidade: 'Salvador' },
  REC: { x: 360, y: 300, cidade: 'Recife' },
  FLN: { x: 315, y: 365, cidade: 'Florianópolis' },
  LIS: { x: 440, y: 190, cidade: 'Lisboa' },
  MAD: { x: 455, y: 185, cidade: 'Madri' },
  CDG: { x: 465, y: 160, cidade: 'Paris' },
  PAR: { x: 465, y: 160, cidade: 'Paris' },
  LON: { x: 455, y: 150, cidade: 'Londres' },
  LHR: { x: 455, y: 150, cidade: 'Londres' },
  ROM: { x: 485, y: 185, cidade: 'Roma' },
  FCO: { x: 485, y: 185, cidade: 'Roma' },
  MIA: { x: 250, y: 220, cidade: 'Miami' },
  MCO: { x: 252, y: 210, cidade: 'Orlando' },
  NYC: { x: 265, y: 175, cidade: 'Nova York' },
  JFK: { x: 265, y: 175, cidade: 'Nova York' },
  LAX: { x: 170, y: 190, cidade: 'Los Angeles' },
  SFO: { x: 160, y: 180, cidade: 'San Francisco' },
  BUE: { x: 305, y: 385, cidade: 'Buenos Aires' },
  EZE: { x: 305, y: 385, cidade: 'Buenos Aires' },
  SCL: { x: 280, y: 380, cidade: 'Santiago' }
};

/**
 * Gera um mini arco SVG representando o trajeto de voo entre dois aeroportos
 */
export function renderizarArcoVooSvg(codOrigem, codDestino, width = 140, height = 40) {
  const o = String(codOrigem || '').toUpperCase();
  const d = String(codDestino || '').toUpperCase();

  // Desenha um arco elegante parabólico que simula a rota ortodrômica
  const startX = 15;
  const startY = height - 12;
  const endX = width - 15;
  const endY = height - 12;
  const controlX = width / 2;
  const controlY = 6; // ápice da curva
  const safeId = `${o}_${d}`.replace(/[^A-Za-z0-9_-]/g, '_');

  return `
    <svg class="flight-arc-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="arcGrad_${safeId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#06b6d4" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
      </defs>
      <!-- Linha de Base Tracejada -->
      <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2,2" />
      <!-- Arco Ortodrômico da Trajetória -->
      <path d="M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}" fill="none" stroke="url(#arcGrad_${safeId})" stroke-width="2" stroke-linecap="round" />
      <!-- Aeroporto Origem -->
      <circle cx="${startX}" cy="${startY}" r="3.5" fill="#06b6d4" />
      <!-- Avião no Ápice da Curva -->
      <circle cx="${controlX}" cy="${controlY + 4}" r="2" fill="#ffffff" />
      <!-- Aeroporto Destino -->
      <circle cx="${endX}" cy="${endY}" r="3.5" fill="#10b981" />
    </svg>
  `;
}
