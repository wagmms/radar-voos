/**
 * Módulo Card de Rota (Cockpit PWA)
 * Renderização Vanilla JS moderna com design system Aero Dark Mode.
 * Suporta consumo dual: navegador (ESM) e Node.js (node:test).
 */

export function escapeHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Remove jargões internos de coletores (ex: "Scrapling Cheapest") para não poluir a UI
 */
export function sanitizarTextoTecnico(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/\bscrapling\s*cheapest\b/gi, '')
    .replace(/\bscrapling\b/gi, '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/^[•\-\s]+|[•\-\s]+$/g, '')
    .trim();
}

export function formatarPreco(valor, moeda = 'BRL') {
  const num = Number(valor);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formata data ISO ("YYYY-MM-DD") para "DD/MM" sem desvio de timezone UTC-3
 */
export function formatarDiaMes(dataIso) {
  if (!dataIso || typeof dataIso !== 'string') return '';
  const partes = dataIso.split('-');
  if (partes.length === 3) {
    const [, mes, dia] = partes;
    return `${dia.slice(0, 2)}/${mes}`;
  }
  return dataIso;
}

/**
 * Validação estrita de protocolo para prevenção contra injeção de links maliciosos (javascript:, data:, etc.)
 */
export function ehUrlSegura(url) {
  if (typeof url !== 'string') return false;
  const limpa = url.trim().toLowerCase();
  return limpa.startsWith('https://') || limpa.startsWith('http://');
}

/**
 * Renderiza badge de meta / teto em R$
 * Destaca visualmente em verde/sucesso quando o menor preço atual estiver abaixo ou igual à meta
 */
export function renderizarBadgeMeta(rota) {
  if (!rota || rota.preco_alvo === null || rota.preco_alvo === undefined) {
    return '';
  }

  const precoAlvo = Number(rota.preco_alvo);
  const precoAtual = Number(rota.preco_atual);
  const moedaCode = (rota.moeda || 'BRL').trim().toUpperCase();
  const simboloMoeda = moedaCode === 'USD' ? 'US$' : (moedaCode === 'EUR' ? '€' : 'R$');

  if (Number.isFinite(precoAtual) && precoAtual > 0 && precoAtual <= precoAlvo) {
    const economia = precoAlvo - precoAtual;
    const econTexto = economia > 0 ? ` (Economia de ${simboloMoeda} ${formatarPreco(economia)})` : ' (No teto)';
    return `<span class="badge badge-meta badge-meta-batida" data-testid="badge-meta-batida">🎯 Meta Batida • ${simboloMoeda} ${formatarPreco(precoAlvo)}${escapeHtml(econTexto)}</span>`;
  }

  return `<span class="badge badge-meta" data-testid="badge-meta">🎯 Meta: ${simboloMoeda} ${formatarPreco(precoAlvo)}</span>`;
}

/**
 * Renderiza badge semântica do Termômetro Google (Preço Baixo / Típico / Alto)
 */
export function renderizarBadgeTermometro(priceInsights) {
  if (!priceInsights || typeof priceInsights !== 'object') return '';

  const nivelRaw = String(priceInsights.nivel || '').toLowerCase().trim();
  if (!nivelRaw) return '';

  let nivelClasse = '';
  let nivelLabel = '';

  if (nivelRaw === 'baixo' || nivelRaw === 'low') {
    nivelClasse = 'badge-termometro-baixo';
    nivelLabel = '🟢 Preço Baixo';
  } else if (nivelRaw === 'tipico' || nivelRaw === 'typical') {
    nivelClasse = 'badge-termometro-tipico';
    nivelLabel = '🟡 Preço Típico';
  } else if (nivelRaw === 'alto' || nivelRaw === 'high') {
    nivelClasse = 'badge-termometro-alto';
    nivelLabel = '🔴 Preço Alto';
  } else {
    return '';
  }

  const min = Number(priceInsights.faixaMinima ?? priceInsights.faixa_minima);
  const max = Number(priceInsights.faixaMaxima ?? priceInsights.faixa_maxima);
  let faixaTexto = '';
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    faixaTexto = ` (R$ ${formatarPreco(min)} – R$ ${formatarPreco(max)})`;
  }

  return `<span class="badge badge-termometro ${nivelClasse}" data-testid="badge-termometro">${nivelLabel}${escapeHtml(faixaTexto)}</span>`;
}

/**
 * Renderiza badge de janela flexível ativa (±1d a ±3d)
 */
export function renderizarBadgeJanelaFlex(diasFlex) {
  const num = Number(diasFlex);
  if (!Number.isFinite(num) || num <= 0) return '';
  return `<span class="badge badge-filtro badge-janela-flex" data-testid="badge-janela-flex">📅 ±${num}d</span>`;
}

/**
 * Renderiza o selo oficial de Point of Sale Brasil (BRL)
 */
export function renderizarBadgePosBrasil() {
  return '<span class="badge badge-pos-br" data-testid="badge-pos-br" title="Tarifa oficial brasileira em Reais (BRL) • Point of Sale Brasil">🇧🇷 Tarifa Brasil</span>';
}

/**
 * Renderiza badges de filtros ativos fast-flights (paradas, bagagem)
 */
export function renderizarBadgesFiltros(rota) {
  if (!rota) return '';
  const badges = [];

  // Armadilha de falsy evitada: max_stops === 0 é estritamente voo direto
  if (rota.max_stops !== null && rota.max_stops !== undefined) {
    const stops = Number(rota.max_stops);
    if (stops === 0) {
      badges.push('<span class="badge badge-filtro" data-testid="badge-direto">✈️ Voo Direto</span>');
    } else if (stops === 1) {
      badges.push('<span class="badge badge-filtro" data-testid="badge-1-parada">1 Parada máx.</span>');
    } else if (stops > 1) {
      badges.push(`<span class="badge badge-filtro">Máx. ${stops} paradas</span>`);
    }
  }

  if (rota.carry_on_bags !== null && rota.carry_on_bags !== undefined && Number(rota.carry_on_bags) > 0) {
    badges.push('<span class="badge badge-filtro" data-testid="badge-mala-mao">🧳 Mala de mão inclusa</span>');
  }

  if (rota.checked_bags !== null && rota.checked_bags !== undefined && Number(rota.checked_bags) > 0) {
    badges.push('<span class="badge badge-filtro">🧳 Mala despachada</span>');
  }

  const durMax = Number(rota.duracao_max_horas);
  if (Number.isFinite(durMax) && durMax > 0 && durMax < 900) {
    badges.push(`<span class="badge badge-filtro" data-testid="badge-duracao-max" title="Filtro ativo: apenas voos com até ${durMax}h de duração total">⏱️ Máx. ${durMax}h</span>`);
  }

  return badges.join(' ');
}

/**
 * Renderiza linha de horários e voo quando disponíveis
 */
export function renderizarLinhaHorarios(rota) {
  if (!rota) return '';
  const partida = rota.horario_partida || rota.horarioPartida || (rota.oferta && rota.oferta.horarioPartida);
  const chegada = rota.horario_chegada || rota.horarioChegada || (rota.oferta && rota.oferta.horarioChegada);
  const vooRaw = rota.numero_voo || rota.numeroVoo || (rota.oferta && rota.oferta.numeroVoo);
  const conexao = rota.tempo_conexao || rota.tempoConexao || (rota.oferta && rota.oferta.tempoConexao);
  const diasExtrasRaw = rota.dias_extras_chegada ?? rota.diasExtrasChegada ?? (rota.oferta && rota.oferta.diasExtrasChegada);
  const diasExtras = Number(diasExtrasRaw);
  const aeronaveRaw = rota.aeronave || (rota.oferta && rota.oferta.aeronave);

  if (!partida || !chegada) return '';

  const voo = sanitizarTextoTecnico(vooRaw);
  const aeronave = sanitizarTextoTecnico(aeronaveRaw);

  const diasExtrasStr = (Number.isFinite(diasExtras) && diasExtras > 0)
    ? `<span class="badge-dias-extras" data-testid="badge-dias-extras">+${diasExtras}d</span>`
    : '';
  const vooStr = voo ? ` • <span class="voo-tag">${escapeHtml(voo)}</span>` : '';
  const aeronaveStr = aeronave ? ` • <span class="aeronave-tag">✈️ ${escapeHtml(aeronave)}</span>` : '';
  const conexaoStr = conexao ? ` • <span class="conexao-tag">⏱️ Espera: ${escapeHtml(conexao)}</span>` : '';

  return `
    <div class="card-horarios" data-testid="card-horarios">
      <span class="horario-icon">🕒</span>
      <span class="horario-texto">${escapeHtml(partida)} ➔ ${escapeHtml(chegada)}${diasExtrasStr}</span>
      ${vooStr}
      ${aeronaveStr}
      ${conexaoStr}
    </div>
  `.trim();
}

/**
 * Renderiza trade-off entre voo mais barato e melhor opção direta/rápida
 */
export function renderizarTradeOff(rota) {
  if (!rota) return '';
  const opcao = rota.melhor_opcao_direta_rapida || (rota.oferta && rota.oferta.melhorOpcaoDiretaOuRapida);
  if (!opcao || typeof opcao !== 'object') return '';

  const preco = Number(opcao.preco) || 0;
  const precoAtual = Number(rota.preco_atual);
  if (!Number.isFinite(preco) || preco <= 0) return '';

  // Blindagem defensiva: se o preço atual estiver disponível, valida se o trade-off faz sentido
  if (Number.isFinite(precoAtual) && precoAtual > 0) {
    // 1. A opção direta deve ser mais cara que o voo atual com escalas (trade-off de pagar mais por rapidez)
    if (preco <= precoAtual) return '';

    // 2. Valida se a diferença bate com o preço atual (tolerância de R$ 10 para evitar snapshots órfãos de outras coletas)
    const diffReal = preco - precoAtual;
    const diffSalva = opcao.diferencaPreco !== undefined ? Number(opcao.diferencaPreco) : diffReal;
    if (Math.abs(diffReal - diffSalva) > 10) return '';
  }

  // 3. Se os detalhes do voo atual indicarem que já é direto, não exibe trade-off de opção direta
  const detalhesStr = String(rota.detalhes_voo || '').toLowerCase();
  if (detalhesStr.includes('direto') || detalhesStr.includes('nonstop') || detalhesStr.includes('sem escalas')) {
    return '';
  }

  const difPreco = (Number.isFinite(precoAtual) && precoAtual > 0) ? (preco - precoAtual) : (opcao.diferencaPreco !== undefined ? Number(opcao.diferencaPreco) : 0);
  const econHoras = opcao.economiaHoras !== undefined ? Number(opcao.economiaHoras) : 0;
  const difTexto = difPreco >= 0 ? `+R$ ${formatarPreco(difPreco)}` : `-R$ ${formatarPreco(Math.abs(difPreco))}`;

  return `
    <div class="card-tradeoff" data-testid="card-tradeoff">
      <div class="tradeoff-header">
        <span class="tradeoff-badge">⚡ Opção Direta/Rápida</span>
        <span class="tradeoff-preco">R$ ${formatarPreco(preco)}</span>
      </div>
      <div class="tradeoff-detalhes">
        ${difTexto} para economizar <strong>${econHoras.toFixed(1)}h</strong> de viagem
      </div>
    </div>
  `.trim();
}

/**
 * Renderiza callout de melhor data alternativa vizinha quando há economia comprovada
 */
export function renderizarCalloutDataAlternativa(melhorDataAlternativa) {
  if (!melhorDataAlternativa || typeof melhorDataAlternativa !== 'object') return '';

  const econReais = Number(melhorDataAlternativa.economiaReais ?? melhorDataAlternativa.economia_reais);
  if (!Number.isFinite(econReais) || econReais <= 0) return '';

  const offset = Number(melhorDataAlternativa.offset) || 0;
  const offsetStr = offset > 0 ? `+${offset}d` : `${offset}d`;
  const dataIda = melhorDataAlternativa.dataIda ?? melhorDataAlternativa.data_ida;
  const dataVolta = melhorDataAlternativa.dataVolta ?? melhorDataAlternativa.data_volta;
  const dataIdaFmt = formatarDiaMes(dataIda);
  const dataVoltaFmt = dataVolta ? ` ➔ ${formatarDiaMes(dataVolta)}` : '';
  const preco = Number(melhorDataAlternativa.preco);
  const econPct = Number(melhorDataAlternativa.economiaPercentual ?? melhorDataAlternativa.economia_percentual);

  const link = melhorDataAlternativa.linkGoogleFlights ?? melhorDataAlternativa.link_google_flights;
  const temLinkSeguro = ehUrlSegura(link);

  const linkHtml = temLinkSeguro
    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="link-data-alternativa">Ver voo alternativo ➔</a>`
    : '';

  return `
    <div class="card-data-alternativa" data-testid="card-data-alternativa">
      <div class="data-alternativa-header">
        <span class="data-alternativa-tag">💡 Dia Vizinho Mais Barato (${escapeHtml(offsetStr)})</span>
        <span class="data-alternativa-economia">-R$ ${formatarPreco(econReais)}${Number.isFinite(econPct) && econPct > 0 ? ` (-${econPct}%)` : ''}</span>
      </div>
      <div class="data-alternativa-corpo">
        <span>📅 <strong>${escapeHtml(dataIdaFmt)}${escapeHtml(dataVoltaFmt)}</strong> por <strong>R$ ${formatarPreco(preco)}</strong></span>
        ${linkHtml}
      </div>
    </div>
  `.trim();
}

/**
 * Renderiza gráfico SVG responsivo e acessível da janela flexível de datas
 * Imune a divisão por zero (maxPreco === minPreco) e sanitizado contra NaN
 */
export function renderizarGraficoCalendarioSvg(calendarioPrecos, precoBase = null) {
  if (!Array.isArray(calendarioPrecos)) return '';

  const itensValidos = calendarioPrecos.filter(item => item && Number(item.preco) > 0);
  if (itensValidos.length < 2) return '';

  const precos = itensValidos.map(item => Number(item.preco));
  const minPreco = Math.min(...precos);
  const maxPreco = Math.max(...precos);

  const barWidth = 40;
  const gap = 12;
  const paddingX = 14;
  const topPadding = 24;
  const maxBarHeight = 52;
  const minBarHeight = 14;
  const totalWidth = paddingX * 2 + itensValidos.length * barWidth + (itensValidos.length - 1) * gap;
  const totalHeight = topPadding + maxBarHeight + 36;

  // Prevenção de divisão por zero: se todos os preços forem iguais, usa altura estável
  const denominadorSeguro = maxPreco > minPreco ? (maxPreco - minPreco) : Math.max(1, maxPreco);

  const barrasSvg = itensValidos.map((item, index) => {
    const preco = Number(item.preco);
    const offset = Number(item.offset) || 0;
    const offsetStr = offset > 0 ? `+${offset}d` : (offset === 0 ? 'Base' : `${offset}d`);
    const ehBase = offset === 0;
    const ehMenor = preco === minPreco;

    let barHeight = minBarHeight;
    if (maxPreco === minPreco) {
      barHeight = Math.round(maxBarHeight * 0.7);
    } else {
      barHeight = Math.round(minBarHeight + ((preco - minPreco) / denominadorSeguro) * (maxBarHeight - minBarHeight));
    }

    const x = paddingX + index * (barWidth + gap);
    const y = topPadding + (maxBarHeight - barHeight);

    let fillColor = 'rgba(148, 163, 184, 0.28)';
    let precoColor = '#94a3b8';
    if (ehMenor) {
      fillColor = '#10b981';
      precoColor = '#34d399';
    } else if (ehBase) {
      fillColor = '#38bdf8';
      precoColor = '#38bdf8';
    }

    const dataFmt = formatarDiaMes(item.dataIda ?? item.data_ida);
    const precoFmt = `R$ ${formatarPreco(preco)}`;

    return `
      <g class="grafico-coluna" data-offset="${offset}">
        <title>${escapeHtml(dataFmt)} (${offsetStr}): ${precoFmt}</title>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="${precoColor}">${precoFmt}</text>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${fillColor}" />
        <text x="${x + barWidth / 2}" y="${topPadding + maxBarHeight + 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#e2e8f0">${escapeHtml(dataFmt)}</text>
        <text x="${x + barWidth / 2}" y="${topPadding + maxBarHeight + 28}" text-anchor="middle" font-size="9" font-weight="500" fill="${ehBase ? '#38bdf8' : '#64748b'}">${offsetStr}</text>
      </g>
    `.trim();
  }).join('');

  return `
    <div class="grafico-calendario-container" data-testid="grafico-calendario">
      <div class="grafico-calendario-header">
        <span>📊 Janela Flexível</span>
        <span>Menor tarifa: <strong>R$ ${formatarPreco(minPreco)}</strong></span>
      </div>
      <svg role="img" aria-label="Gráfico de preços da janela flexível" viewBox="0 0 ${totalWidth} ${totalHeight}" class="grafico-calendario-svg">
        <title>Gráfico de preços da janela flexível</title>
        ${barrasSvg}
      </svg>
    </div>
  `.trim();
}

/**
 * Renderiza ranking de destinos investigados quando a rota é regional / continente multi-hub
 * @param {Array<{ destinoIata: string, nomeCidade: string, preco: number, cia?: string, linkGoogleFlights?: string }>} rankingDestinosRegionais
 * @returns {string} Fragmento HTML seguro
 */
export function renderizarRankingDestinosRegionais(rankingDestinosRegionais) {
  if (!Array.isArray(rankingDestinosRegionais) || rankingDestinosRegionais.length === 0) {
    return '';
  }

  const vencedor = rankingDestinosRegionais[0];
  const nomeVencedor = escapeHtml(sanitizarTextoTecnico(vencedor.nomeCidade || vencedor.destinoIata || 'Destino'));
  const iataVencedor = escapeHtml(vencedor.destinoIata || '');
  const precoVencedor = formatarPreco(vencedor.preco);

  const topDestinos = rankingDestinosRegionais.slice(0, 5);
  const itensHtml = topDestinos.map((item, index) => {
    const posicao = index + 1;
    const nome = escapeHtml(sanitizarTextoTecnico(item.nomeCidade || item.destinoIata || ''));
    const iata = escapeHtml(item.destinoIata || '');
    const preco = formatarPreco(item.preco);
    const ehVencedor = index === 0;
    const temLink = ehUrlSegura(item.linkGoogleFlights);
    const linkHtml = temLink
      ? `<a href="${escapeHtml(item.linkGoogleFlights)}" target="_blank" rel="noopener noreferrer" class="link-ranking-item">Ver ➔</a>`
      : '';

    return `
      <li class="ranking-regional-item ${ehVencedor ? 'ranking-vencedor' : ''}">
        <span class="ranking-pos">${posicao}º</span>
        <span class="ranking-nome">${nome} (${iata})</span>
        <span class="ranking-preco">R$ ${preco}</span>
        ${linkHtml}
      </li>
    `.trim();
  }).join('');

  return `
    <div class="card-ranking-regional" data-testid="ranking-destinos-regionais">
      <div class="ranking-regional-destaque">
        <span class="ranking-icone">🌍</span>
        <span class="ranking-texto"><strong>Melhor destino na região:</strong> ${nomeVencedor} (${iataVencedor}) por <strong>R$ ${precoVencedor}</strong></span>
      </div>
      <ul class="ranking-regional-lista">
        ${itensHtml}
      </ul>
    </div>
  `.trim();
}

/**
 * Determina defensivamente se a rota deve ser exibida como Só Ida
 */
export function ehRotaSoIdaVisual(rota) {
  if (!rota) return false;
  if (rota.tipo_viagem === 'one_way' || rota.tipo === 'one_way') return true;
  if (rota.tipo_viagem === 'round_trip' || rota.tipo === 'round_trip') return false;
  const voltaStr = String(rota.data_volta || '').toLowerCase().trim();
  if (voltaStr === 'só ida' || voltaStr === 'so ida' || voltaStr === 'one-way' || voltaStr === 'one_way') return true;
  if (!rota.data_volta && (!rota.dias_estadia || Number(rota.dias_estadia) === 0)) return true;
  return false;
}

/**
 * Calcula defensivamente a data de volta estimada a partir dos dias de estadia
 */
export function calcularDataVoltaSegura(dataIda, dataVolta, diasEstadia = 10) {
  if (dataVolta && /^\d{4}-\d{2}-\d{2}$/.test(String(dataVolta).trim())) {
    return String(dataVolta).trim();
  }
  if (!dataIda || !/^\d{4}-\d{2}-\d{2}$/.test(String(dataIda).trim())) {
    return null;
  }
  const dias = Number(diasEstadia) || 10;
  try {
    const [ano, mes, dia] = dataIda.split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().split('T')[0];
  } catch (_) {
    return null;
  }
}

/**
 * Renderiza o card completo da rota
 */
export function renderizarCardRota(rota) {
  if (!rota) return '';

  const id = rota.id ?? '';
  const origem = rota.origem || 'Origem';
  const destino = rota.destino_real || rota.destino || 'Destino';
  const precoAtual = Number(rota.preco_atual);
  const precoAlvo = Number(rota.preco_alvo);
  const bateuMeta = Number.isFinite(precoAtual) && precoAtual > 0 && Number.isFinite(precoAlvo) && precoAlvo > 0 && precoAtual <= precoAlvo;

  const moedaCode = (rota.moeda || 'BRL').trim().toUpperCase();
  const simboloMoeda = moedaCode === 'USD' ? 'US$' : (moedaCode === 'EUR' ? '€' : 'R$');
  const precoStr = Number.isFinite(precoAtual) && precoAtual > 0 ? `${simboloMoeda} ${formatarPreco(precoAtual)}` : 'Aguardando checagem';
  const menorHist = Number(rota.menor_preco_historico);
  const menorHistStr = Number.isFinite(menorHist) && menorHist > 0 ? `Menor: ${simboloMoeda} ${formatarPreco(menorHist)}` : '';

  let termometro = sanitizarTextoTecnico(rota.termometro || '⚪ Sem dados recentes');
  if (!termometro) {
    termometro = '⚪ Sem dados recentes';
  }

  const priceInsights = rota.price_insights || rota.priceInsights;
  const melhorDataAlt = rota.melhor_data_alternativa || rota.melhorDataAlternativa;
  const calendario = rota.calendario_precos || rota.calendarioPrecos;
  const diasFlex = rota.dias_flexiveis ?? rota.diasFlexiveis ?? 0;
  const rankingRegionais = rota.ranking_destinos_regionais || rota.rankingDestinosRegionais;

  const badgePosBr = renderizarBadgePosBrasil();
  const badgeMeta = renderizarBadgeMeta(rota);
  const badgeTermometro = renderizarBadgeTermometro(priceInsights);
  const badgeJanelaFlex = renderizarBadgeJanelaFlex(diasFlex);
  const badgesFiltros = renderizarBadgesFiltros(rota);
  const linhaHorarios = renderizarLinhaHorarios(rota);
  const blocoTradeOff = renderizarTradeOff(rota);
  const calloutDataAlt = renderizarCalloutDataAlternativa(melhorDataAlt);
  const blocoRankingRegional = renderizarRankingDestinosRegionais(rankingRegionais);
  const graficoCalendario = renderizarGraficoCalendarioSvg(calendario, precoAtual);

  const soIdaVisual = ehRotaSoIdaVisual(rota);
  const diasEstadiaVisual = Number(rota.dias_estadia) || 10;
  const dataVoltaCalculada = !soIdaVisual ? calcularDataVoltaSegura(rota.data_ida, rota.data_volta, diasEstadiaVisual) : null;
  const duracaoTexto = !soIdaVisual ? ` (${diasEstadiaVisual}d)` : '';

  let periodoTexto = '';
  if (rota.sem_data) {
    if (soIdaVisual) {
      periodoTexto = `🗓️ Flexível • ${escapeHtml(rota.data_ida || 'Próximos meses')} (Só Ida)`;
    } else if (rota.data_ida) {
      const voltaExibicao = dataVoltaCalculada ? ` ➔ ${escapeHtml(dataVoltaCalculada)}` : '';
      periodoTexto = `🗓️ Flexível • ${escapeHtml(rota.data_ida)}${voltaExibicao}${duracaoTexto}`;
    } else {
      periodoTexto = `🗓️ Flexível • Próximos meses${duracaoTexto}`;
    }
  } else {
    if (soIdaVisual) {
      periodoTexto = `📅 ${escapeHtml(rota.data_ida || '')} (Só Ida)`;
    } else {
      const voltaExibicao = dataVoltaCalculada || rota.data_volta;
      if (voltaExibicao) {
        periodoTexto = `📅 ${escapeHtml(rota.data_ida || '')} até ${escapeHtml(voltaExibicao)}${duracaoTexto}`;
      } else {
        periodoTexto = `📅 ${escapeHtml(rota.data_ida || '')}${duracaoTexto}`;
      }
    }
  }

  let linkGoogle = rota.link_google_flights || '#';
  if (linkGoogle && linkGoogle !== '#' && !linkGoogle.includes('gl=BR')) {
    linkGoogle += (linkGoogle.includes('?') ? '&' : '?') + 'hl=pt-BR&gl=BR&curr=BRL';
  }

  const silenciada = rota.esta_silenciada ? '<span class="badge badge-silenciada">🔕 Silenciada</span>' : '';
  const custoDestinoLimpo = sanitizarTextoTecnico(rota.custo_destino_texto);

  return `
    <article class="rota-card${bateuMeta ? ' rota-card-oportunidade' : ''}" data-id="${id}" data-testid="rota-card-${id}">
      <header class="rota-card-header">
        <div class="rota-trajeto">
          <h3 class="rota-titulo">${escapeHtml(origem)} <span class="rota-seta">➔</span> ${escapeHtml(destino)}</h3>
          <span class="rota-periodo">${periodoTexto}</span>
        </div>
        <div class="rota-badges-top">
          ${silenciada}
          ${badgePosBr}
          ${badgeMeta}
          ${badgeTermometro}
          ${badgeJanelaFlex}
        </div>
      </header>

      <div class="rota-preco-bloco">
        <div class="preco-principal">
          <span class="preco-valor">${escapeHtml(precoStr)}</span>
          ${menorHistStr ? `<span class="preco-menor">${escapeHtml(menorHistStr)}</span>` : ''}
        </div>
        <div class="termometro-tag">${escapeHtml(termometro)}</div>
      </div>

      ${badgesFiltros ? `<div class="rota-filtros-badges">${badgesFiltros}</div>` : ''}
      ${linhaHorarios}
      ${blocoTradeOff}
      ${calloutDataAlt}
      ${blocoRankingRegional}
      ${graficoCalendario}

      ${custoDestinoLimpo && custoDestinoLimpo !== '-' ? `
        <div class="rota-custo-destino">
          🏨 ${escapeHtml(custoDestinoLimpo)}
        </div>
      ` : ''}

      <footer class="rota-card-actions">
        <a href="${escapeHtml(linkGoogle)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" title="${escapeHtml(Number.isFinite(Number(rota.duracao_max_horas)) && Number(rota.duracao_max_horas) > 0 && Number(rota.duracao_max_horas) < 900 ? `Abrir no Google Flights (Filtro ativo de duração máxima ≤ ${rota.duracao_max_horas}h)` : 'Abrir no Google Flights')}">
          ✈️ Google Flights
        </a>
        <button type="button" class="btn btn-secondary btn-sm" data-action="verificar" data-id="${id}">
          🔍 Checar Agora
        </button>
        <button type="button" class="btn btn-outline btn-sm" data-action="editar" data-id="${id}">
          ✏️ Editar
        </button>
        <button type="button" class="btn btn-ghost btn-sm btn-danger" data-action="excluir" data-id="${id}">
          🗑️
        </button>
      </footer>
    </article>
  `.trim();
}
