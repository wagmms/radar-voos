/**
 * RADAR DE VOOS - TRAVEL HACKING COCKPIT
 * Módulo de Detecção e Renderização de Tags Visuais para Tarifas Especiais:
 * - Aba "Mais Baratos" (Cheapest Tab via Protobuf tfs/tfu do Google Flights)
 * - Tarifas de Agências Parceiras / OTAs (Decolar, MyTrip, Gotogate, etc.)
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
 * Extrai informações estruturadas da fonte da tarifa quando obtida
 * pela aba "Cheapest" ou parceiros/OTAs.
 *
 * @param {Object} rota - Dados da rota monitorada
 * @returns {Object|null} Metadados da tarifa especial ou null se for regular
 */
export function extrairInfoTarifaEspecial(rota) {
  if (!rota || typeof rota !== 'object' || Array.isArray(rota)) return null;

  const detalhes = typeof rota.detalhes_voo === 'string' ? rota.detalhes_voo : String(rota.detalhes_voo || '');
  const termometro = typeof rota.termometro === 'string' ? rota.termometro : String(rota.termometro || '');
  const link = typeof rota.link_google_flights === 'string' ? rota.link_google_flights : String(rota.link_google_flights || '');

  // 1. Detecção explícita de "Menor Tarifa (...)" nos detalhes do voo
  // Padrão gerado por SerpApiProvider e GoogleFlightsDirectProvider
  const regexMenorTarifa = /Menor Tarifa \(([^:)]+)(?::\s*R\$\s*([\d.]+))?\)/i;
  const matchMenorTarifa = detalhes.match(regexMenorTarifa);

  if (matchMenorTarifa) {
    const fonteBruta = matchMenorTarifa[1].trim();
    const precoMencionado = matchMenorTarifa[2]
      ? parseFloat(matchMenorTarifa[2].replace(/\./g, ''))
      : null;

    if (fonteBruta.toLowerCase().includes('cheapest')) {
      return {
        tipo: 'cheapest',
        fonte: 'Aba Cheapest (Google Flights)',
        nomeExibicao: 'Aba Mais Baratos (Cheapest)',
        icone: '⚡',
        badgeClasse: 'tag-tarifa-cheapest',
        titulo: 'Aba "Mais Baratos" do Google Flights',
        descricao: 'Tarifa de menor custo capturada via aba Cheapest frente à tarifa padrão da cia aérea.',
        preco: precoMencionado
      };
    }

    // Se for OTA / Agência Parceira
    const nomeAmigavel = fonteBruta.toUpperCase() === 'OTA' ? 'OTA Parceira' : fonteBruta;
    return {
      tipo: 'parceiro',
      fonte: nomeAmigavel,
      nomeExibicao: `Parceiro: ${nomeAmigavel}`,
      icone: '🏷️',
      badgeClasse: 'tag-tarifa-parceiro',
      titulo: `Tarifa Parceiro • ${nomeAmigavel}`,
      descricao: `Tarifa mais econômica apurada através de agência parceira integrada (${nomeAmigavel}).`,
      preco: precoMencionado
    };
  }

  // 2. Detecção de Aba Cheapest via palavras-chave no detalhes_voo ou termômetro
  if (
    detalhes.toLowerCase().includes('aba cheapest') ||
    detalhes.toLowerCase().includes('google flights cheapest') ||
    termometro.toLowerCase().includes('cheapest')
  ) {
    return {
      tipo: 'cheapest',
      fonte: 'Aba Cheapest (Google Flights)',
      nomeExibicao: 'Aba Mais Baratos (Cheapest)',
      icone: '⚡',
      badgeClasse: 'tag-tarifa-cheapest',
      titulo: 'Aba "Mais Baratos" do Google Flights',
      descricao: 'Tarifa de menor custo capturada via aba Cheapest frente à tarifa padrão da cia aérea.',
      preco: null
    };
  }

  // 3. Detecção via link estruturado com o token da aba Cheapest (tfu=EgoIABAAGAAgAigD)
  if (link.includes('tfu=EgoIABAAGAAgAigD') || link.includes('EgoIABAAGAAgAigD')) {
    return {
      tipo: 'cheapest',
      fonte: 'Aba Cheapest (Google Flights)',
      nomeExibicao: 'Aba Mais Baratos (Cheapest)',
      icone: '⚡',
      badgeClasse: 'tag-tarifa-cheapest',
      titulo: 'Aba "Mais Baratos" do Google Flights',
      descricao: 'Link canônico configurado com a aba "Mais baratos" do Google Flights.',
      preco: null
    };
  }

  // 4. Detecção na melhor opção flexível se existir
  let flexObj = null;
  if (rota.melhor_opcao_flexivel) {
    try {
      flexObj = typeof rota.melhor_opcao_flexivel === 'string'
        ? JSON.parse(rota.melhor_opcao_flexivel)
        : rota.melhor_opcao_flexivel;
    } catch (_) {}
  }

  const flexLink = (flexObj && typeof flexObj === 'object' && typeof flexObj.link === 'string')
    ? flexObj.link
    : '';

  if (flexLink && (flexLink.includes('tfu=EgoIABAAGAAgAigD') || flexLink.includes('EgoIABAAGAAgAigD'))) {
    let flexPreco = null;
    if (typeof flexObj.preco === 'number' && Number.isFinite(flexObj.preco) && flexObj.preco > 0) {
      flexPreco = flexObj.preco;
    } else if (flexObj.preco !== undefined && flexObj.preco !== null) {
      const sPreco = String(flexObj.preco).replace(/[R$\s]/gi, '').trim();
      const numStr = sPreco.includes(',') && sPreco.includes('.')
        ? sPreco.replace(/\./g, '').replace(',', '.')
        : (sPreco.includes('.') && /^\d{1,3}\.\d{3}/.test(sPreco) ? sPreco.replace(/\./g, '') : sPreco.replace(',', '.'));
      const parsed = parseFloat(numStr);
      flexPreco = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    return {
      tipo: 'cheapest',
      fonte: 'Aba Cheapest (Google Flights)',
      nomeExibicao: 'Aba Mais Baratos (Cheapest)',
      icone: '⚡',
      badgeClasse: 'tag-tarifa-cheapest',
      titulo: 'Aba "Mais Baratos" do Google Flights',
      descricao: 'Menor tarifa do período encontrada através da aba Cheapest.',
      preco: flexPreco
    };
  }

  return null;
}

/**
 * Renderiza a tag pill compacta para o cabeçalho do card da rota
 *
 * @param {Object|null} infoTarifa
 * @returns {string} HTML da tag ou string vazia
 */
export function renderizarTagTarifaEspecial(infoTarifa) {
  if (!infoTarifa) return '';

  return `<span class="tarifa-deal-pill ${infoTarifa.badgeClasse}" title="${escapeHtml(infoTarifa.descricao)}">` +
    `<span class="tarifa-deal-icon">${infoTarifa.icone}</span>` +
    `<span class="tarifa-deal-label">${escapeHtml(infoTarifa.nomeExibicao)}</span>` +
  `</span>`;
}

/**
 * Renderiza o banner informativo visual estilizado para o corpo do card
 *
 * @param {Object|null} infoTarifa
 * @returns {string} HTML do banner ou string vazia
 */
export function renderizarBannerTarifaEspecial(infoTarifa) {
  if (!infoTarifa) return '';

  return `
    <div class="tarifa-deal-banner ${infoTarifa.badgeClasse}">
      <span class="deal-icon">${infoTarifa.icone}</span>
      <div class="deal-body">
        <strong>${escapeHtml(infoTarifa.titulo)}</strong>
        <span>${escapeHtml(infoTarifa.descricao)}</span>
      </div>
    </div>
  `;
}
