/**
 * RADAR DE VOOS - TRAVEL HACKING COCKPIT
 * Módulo de Detecção e Renderização de Badges de Conexões e Stopover:
 * - Voo Direto (sem escalas)
 * - Conexões Rápidas (<= 3h)
 * - Conexões Moderadas (3h a 8h)
 * - Escalas Prolongadas (> 8h) com oportunidade de Stopover 2-em-1
 * - Escalas Noturnas (Pernoite / Overnight) com destaque visual dedicado para cards móveis
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
 * Converte strings de tempo de conexão para minutos inteiros.
 * Exemplos: "9h 30m" -> 570, "1h 45min" -> 105, "45 min" -> 45, "8h" -> 480.
 *
 * @param {string} tempoStr
 * @returns {number|null} Minutos ou null se não for possível converter
 */
export function parsearTempoMinutos(tempoStr) {
  if (!tempoStr || typeof tempoStr !== 'string') return null;

  const limpo = tempoStr.trim().toLowerCase();
  let totalMinutos = 0;
  let encontrou = false;

  // 1. Horas decimais ou inteiras (ex: "9.5h", "9h", "9 h", "9 horas")
  const matchHoras = limpo.match(/(\d+(?:[.,]\d+)?)\s*(?:h(?:ora(?:s)?)?|hr(?:s)?)/);
  if (matchHoras) {
    const horasNum = parseFloat(matchHoras[1].replace(',', '.'));
    if (!Number.isNaN(horasNum)) {
      totalMinutos += Math.round(horasNum * 60);
      encontrou = true;
    }
  }

  // 2. Minutos adicionais ou avulsos (ex: "30m", "30min", "45 minutos")
  const matchMinutos = limpo.match(/(\d+)\s*(?:m(?:in(?:uto(?:s)?)?)?)\b/);
  if (matchMinutos) {
    const minNum = parseInt(matchMinutos[1], 10);
    if (!Number.isNaN(minNum)) {
      totalMinutos += minNum;
      encontrou = true;
    }
  }

  return encontrou ? totalMinutos : null;
}

/**
 * Extrai dados estruturados de conexão e escalas da rota monitorada.
 *
 * @param {Object} rota Dados da rota
 * @returns {Object|null} Metadados da conexão ou null se não houver dados
 */
export function extrairInfoConexao(rota) {
  if (!rota || typeof rota !== 'object') return null;

  const detalhesVoo = String(rota.detalhes_voo || '');
  const dicaStopover = String(rota.dica_stopover || '');

  // Lê também melhor opção flexível se existir
  let flexObj = null;
  if (rota.melhor_opcao_flexivel) {
    try {
      flexObj = typeof rota.melhor_opcao_flexivel === 'string'
        ? JSON.parse(rota.melhor_opcao_flexivel)
        : rota.melhor_opcao_flexivel;
    } catch (_) {}
  }

  const textoFlex = flexObj ? String(flexObj.detalhes || flexObj.dicaStopover || '') : '';
  const textoCompleto = `${detalhesVoo} | ${dicaStopover} | ${textoFlex}`.trim();

  // Se não há dados reais de voo
  if ((!detalhesVoo || detalhesVoo === '-') && (!dicaStopover || dicaStopover === '-') && !textoFlex) {
    return null;
  }

  // 1. Detecção explícita de voo direto / sem escalas
  const ehDireto = /\b(?:direto|sem\s+escalas|sem\s+paradas|nonstop|non-stop)\b/i.test(detalhesVoo) &&
    !/\b\d+\s*(?:parada|escala|stop)s?\b/i.test(detalhesVoo);

  if (ehDireto) {
    return {
      tipo: 'direto',
      escalas: 0,
      rotulo: 'Voo Direto',
      descricao: 'Voo sem conexões intermediárias.',
      detalheTexto: 'Sem escalas',
      aeroporto: null,
      tempoMinutos: 0,
      tempoHoras: 0,
      tempoTexto: null,
      ehNoturna: false,
      ehProlongada: false,
      ehStopover: false,
      icone: '✈️',
      badgeClasse: 'tag-conexao-direto'
    };
  }

  // 2. Detecção de número de escalas
  let escalas = null;
  const matchNumEscalas = textoCompleto.match(/(\d+)\s*(?:parada(?:s)?|escala(?:s)?|stop(?:s)?)/i);
  if (matchNumEscalas) {
    escalas = parseInt(matchNumEscalas[1], 10);
  } else if (/com\s+conexão|com\s+parada|com\s+escala|connecting/i.test(textoCompleto)) {
    escalas = 1;
  } else if (typeof rota.escalas === 'number') {
    escalas = rota.escalas;
  }

  // 3. Detecção de aeroporto/cidade de conexão
  let aeroporto = null;
  const matchAero1 = textoCompleto.match(/(?:parada(?:s)?|escala(?:s)?|stop(?:s)?)\s*(?:em|no|na|at|in|\()\s*([A-Za-zÀ-ÿ0-9\s-]+?\([A-Z]{3}\)|[A-Z]{3}(?:\s*,\s*[A-Z]{3})*|\([A-Z]{3}\))/i);
  if (matchAero1) {
    aeroporto = matchAero1[1].replace(/[()]/g, '').trim();
  }

  if (!aeroporto) {
    const matchAero2 = textoCompleto.match(/\b(?:em|no|na|at|in)\s+([A-Za-zÀ-ÿ0-9\s-]+?\([A-Z]{3}\)|[A-Z]{3}(?:\s*,\s*[A-Z]{3})*)/i);
    if (matchAero2) {
      let bruto = matchAero2[1].trim();
      bruto = bruto.replace(/^(?:no|na|em|at|in)\s+/i, '').trim();
      aeroporto = bruto.replace(/[()]/g, '').trim();
    }
  }

  if (!aeroporto && dicaStopover && dicaStopover !== '-') {
    const matchAeroStop = dicaStopover.match(/em\s+([A-Z]{3})/i);
    if (matchAeroStop) {
      aeroporto = matchAeroStop[1].trim();
    }
  }

  // 4. Detecção de tempo de conexão
  let tempoTexto = null;
  let tempoMinutos = null;

  const matchTempo = textoCompleto.match(/(?:conexão|parada|escala|layover|stop)\s*(?:noturna|longa)?\s*(?:de|of)?\s*(\d+\s*h(?:r|s)?(?:\s*\d+\s*m(?:in(?:uto(?:s)?)?)?)?|\d+\s*m(?:in(?:uto(?:s)?)?)?|\d+\s*h)/i);
  if (matchTempo) {
    tempoTexto = matchTempo[1].trim();
    tempoMinutos = parsearTempoMinutos(tempoTexto);
  }

  // Se não achou tempo direto, tenta extrair da dica de stopover (ex: "conexão noturna de 9h" ou "escala de 10h 30m")
  if (!tempoMinutos && dicaStopover && dicaStopover !== '-') {
    const matchTempoDica = dicaStopover.match(/de\s+(\d+\s*h(?:r|s)?(?:\s*\d+\s*m(?:in(?:uto(?:s)?)?)?)?|\d+\s*h)/i);
    if (matchTempoDica) {
      tempoTexto = matchTempoDica[1].trim();
      tempoMinutos = parsearTempoMinutos(tempoTexto);
    }
  }

  const tempoHoras = tempoMinutos !== null ? parseFloat((tempoMinutos / 60).toFixed(1)) : null;

  // 5. Detecção de Pernoite / Escala Noturna (Overnight)
  const ehNoturna = Boolean(
    rota.overnight ||
    flexObj?.overnight ||
    /\b(?:noturna|noturno|overnight|pernoite|dormir|madrugada)\b/i.test(textoCompleto)
  );

  // 6. Detecção de Escala Prolongada (> 8 horas)
  const ehProlongada = Boolean(
    (tempoMinutos !== null && tempoMinutos >= 480) ||
    /\b(?:longa|prolongada|estendida)\b/i.test(textoCompleto) ||
    (dicaStopover && dicaStopover !== '-' && dicaStopover.toLowerCase().includes('stopover'))
  );

  const qtdEscalas = escalas !== null ? escalas : (ehNoturna || ehProlongada ? 1 : null);

  // Se não foi possível determinar escalas nem características
  if (qtdEscalas === null && !ehNoturna && !ehProlongada) {
    return null;
  }

  const ehStopover = ehNoturna || ehProlongada || (Boolean(dicaStopover) && dicaStopover !== '-');

  // Classificação do Tipo e Rótulo
  if (ehNoturna) {
    const sufixoTempo = tempoTexto ? ` (${tempoTexto})` : (aeroporto ? ` (${aeroporto})` : '');
    return {
      tipo: 'noturna',
      escalas: qtdEscalas || 1,
      rotulo: `🌙 Escala Noturna${sufixoTempo}`,
      descricao: `Escala noturna com pernoite${aeroporto ? ' em ' + aeroporto : ''}${tempoTexto ? ' (' + tempoTexto + ')' : ''}. Oportunidade de descanso ou Stopover.`,
      detalheTexto: `${qtdEscalas || 1} parada com pernoite`,
      aeroporto,
      tempoMinutos,
      tempoHoras,
      tempoTexto,
      ehNoturna: true,
      ehProlongada,
      ehStopover: true,
      icone: '🌙',
      badgeClasse: 'tag-conexao-noturna'
    };
  }

  if (ehProlongada) {
    const sufixoTempo = tempoTexto ? ` (${tempoTexto})` : (aeroporto ? ` (${aeroporto})` : ' (>8h)');
    return {
      tipo: 'longa',
      escalas: qtdEscalas || 1,
      rotulo: `⏳ Escala Prolongada${sufixoTempo}`,
      descricao: `Escala longa de ${tempoTexto || '>8h'}${aeroporto ? ' em ' + aeroporto : ''}. Ideal para turismo 2-em-1 de um dia.`,
      detalheTexto: `${qtdEscalas || 1} parada prolongada`,
      aeroporto,
      tempoMinutos,
      tempoHoras,
      tempoTexto,
      ehNoturna: false,
      ehProlongada: true,
      ehStopover: true,
      icone: '⏳',
      badgeClasse: 'tag-conexao-longa'
    };
  }

  if (tempoMinutos !== null && tempoMinutos <= 180) { // Conexão curta (<= 3h)
    const sufixoTempo = tempoTexto ? ` (${tempoTexto})` : '';
    const plural = (qtdEscalas || 1) === 1 ? 'Parada Rápida' : 'Paradas Rápidas';
    return {
      tipo: 'curta',
      escalas: qtdEscalas || 1,
      rotulo: `⚡ ${qtdEscalas || 1} ${plural}${sufixoTempo}`,
      descricao: `Conexão ágil e rápida${aeroporto ? ' em ' + aeroporto : ''}${tempoTexto ? ' (' + tempoTexto + ')' : ''}.`,
      detalheTexto: `${qtdEscalas || 1} parada rápida`,
      aeroporto,
      tempoMinutos,
      tempoHoras,
      tempoTexto,
      ehNoturna: false,
      ehProlongada: false,
      ehStopover: false,
      icone: '⚡',
      badgeClasse: 'tag-conexao-curta'
    };
  }

  // Conexão Moderada padrão (3h a 8h ou sem tempo explícito)
  const plural = (qtdEscalas || 1) === 1 ? 'Parada' : 'Paradas';
  const sufixoTempo = tempoTexto ? ` (${tempoTexto})` : (aeroporto ? ` (${aeroporto})` : '');
  return {
    tipo: 'moderada',
    escalas: qtdEscalas || 1,
    rotulo: `🔄 ${qtdEscalas || 1} ${plural}${sufixoTempo}`,
    descricao: `Voo com ${qtdEscalas || 1} escala(s)${aeroporto ? ' em ' + aeroporto : ''}${tempoTexto ? ' (' + tempoTexto + ')' : ''}.`,
    detalheTexto: `${qtdEscalas || 1} ${plural}`,
    aeroporto,
    tempoMinutos,
    tempoHoras,
    tempoTexto,
    ehNoturna: false,
    ehProlongada: false,
    ehStopover: false,
    icone: '🔄',
    badgeClasse: 'tag-conexao-moderada'
  };
}

/**
 * Renderiza o elemento HTML da tag de conexão para o cabeçalho do card de rota.
 *
 * @param {Object|null} infoConexao
 * @returns {string} HTML da tag ou string vazia
 */
export function renderizarBadgeConexao(infoConexao) {
  if (!infoConexao) return '';

  return `<span class="tarifa-deal-pill tag-conexao-pill ${infoConexao.badgeClasse}" title="${escapeHtml(infoConexao.descricao)}">` +
    `<span class="tarifa-deal-icon">${infoConexao.icone}</span>` +
    `<span class="tarifa-deal-label">${escapeHtml(infoConexao.rotulo)}</span>` +
  `</span>`;
}

/**
 * Renderiza o banner/callout visual enriquecido de Stopover ou Escala Longa/Noturna
 * para o corpo do card no Cockpit PWA.
 *
 * @param {Object|null} infoConexao
 * @param {string|null} dicaCustomizada
 * @returns {string} HTML do banner de stopover ou string vazia
 */
export function renderizarBannerStopover(infoConexao, dicaCustomizada = null) {
  const dica = (dicaCustomizada && dicaCustomizada !== '-') ? dicaCustomizada : null;

  // Se não tem info de conexão nem dica customizada válida, não renderiza nada
  if (!infoConexao && !dica) return '';

  // 1. Escala Noturna (Pernoite)
  if (infoConexao && infoConexao.ehNoturna) {
    const textoDica = dica || (infoConexao.aeroporto
      ? `Conexão noturna com pernoite em ${escapeHtml(infoConexao.aeroporto)}${infoConexao.tempoTexto ? ' (' + escapeHtml(infoConexao.tempoTexto) + ')' : ''}. Excelente oportunidade de descanso ou stopover sem pagar por passagem extra.`
      : 'Conexão noturna com pernoite. Permite descansar ou explorar a cidade antes do próximo trecho.');

    return `
      <div class="stopover-callout stopover-noturno">
        <div class="stopover-header">
          <div class="stopover-title-wrap">
            <span class="stopover-badge-icon">🌙</span>
            <strong>Escala Noturna (Pernoite)${infoConexao.aeroporto ? ' em ' + escapeHtml(infoConexao.aeroporto) : ''}</strong>
          </div>
          <span class="stopover-pill-badge pill-noturna">Stopover 2-em-1</span>
        </div>
        <div class="stopover-desc">
          💡 ${escapeHtml(textoDica)}
        </div>
      </div>
    `;
  }

  // 2. Escala Prolongada (> 8 horas)
  if (infoConexao && infoConexao.ehProlongada) {
    const textoDica = dica || (infoConexao.aeroporto
      ? `Conexão prolongada de ${escapeHtml(infoConexao.tempoTexto || '>8h')} em ${escapeHtml(infoConexao.aeroporto)}. Permite conhecer a cidade sem custo adicional de bilhete.`
      : `Conexão estendida de ${escapeHtml(infoConexao.tempoTexto || '>8h')}. Oportunidade perfeita de Stopover 2-em-1.`);

    return `
      <div class="stopover-callout stopover-longo">
        <div class="stopover-header">
          <div class="stopover-title-wrap">
            <span class="stopover-badge-icon">⏳</span>
            <strong>Escala Prolongada (>8h)${infoConexao.aeroporto ? ' em ' + escapeHtml(infoConexao.aeroporto) : ''}</strong>
          </div>
          <span class="stopover-pill-badge pill-longa">Stopover 2-em-1</span>
        </div>
        <div class="stopover-desc">
          💡 ${escapeHtml(textoDica)}
        </div>
      </div>
    `;
  }

  // 3. Dica legada de stopover se presente
  if (dica) {
    return `
      <div class="stopover-callout">
        <div class="stopover-desc">
          💡 ${escapeHtml(dica)}
        </div>
      </div>
    `;
  }

  return '';
}
