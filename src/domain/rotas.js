import {
  DICIONARIO_CIDADES,
  DICIONARIO_REGIOES,
  MAPA_AEROPORTOS_SERPAPI
} from './dicionarios.js';

/**
 * Normaliza strings para matching robusto (sem acentos, minúsculo, sem espaços extras)
 */
export function normalizarTexto(texto) {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Resolve nome de cidade ou região para código Metropolitano, IATA ou KGMID
 */
export function resolverDestino(texto) {
  if (!texto) return null;
  const limpo = normalizarTexto(texto);

  if (DICIONARIO_REGIOES[limpo]) return DICIONARIO_REGIOES[limpo];
  if (DICIONARIO_CIDADES[limpo]) return DICIONARIO_CIDADES[limpo];

  const trimOriginal = String(texto).trim();
  if (trimOriginal.length === 3 && /^[A-Za-z]{3}$/.test(trimOriginal)) {
    return trimOriginal.toUpperCase();
  }
  if (/^[A-Za-z]{3}(,[A-Za-z]{3})+$/.test(trimOriginal)) {
    return trimOriginal.toUpperCase();
  }
  if (trimOriginal.startsWith('/m/') || trimOriginal.startsWith('/g/')) {
    return trimOriginal;
  }

  return null;
}

/**
 * Mapeia códigos metropolitanos (SAO, RIO, NYC) para listas de aeroportos físicos compatíveis com SerpAPI
 */
export function normalizarParaSerpApi(codigo) {
  if (!codigo) return codigo;
  const codUpper = String(codigo).trim().toUpperCase();
  return MAPA_AEROPORTOS_SERPAPI[codUpper] || codigo;
}

/**
 * Identifica se o campo de volta representa 'Só Ida'
 */
export function ehSoIda(campoVolta) {
  if (campoVolta === null || campoVolta === undefined) return true;
  const str = String(campoVolta).trim();
  if (str === '') return true;

  const limpo = normalizarTexto(str);
  return (
    limpo === 'so ida' ||
    limpo === 'soida' ||
    limpo === 'so-ida' ||
    limpo === 'ida' ||
    limpo === 'one way' ||
    limpo === 'oneway' ||
    limpo.includes('so ida') ||
    limpo.includes('somente ida') ||
    limpo.includes('apenas ida') ||
    limpo.includes('one-way')
  );
}

/**
 * Formata qualquer formato de data para YYYY-MM-DD
 */
export function formatarDataParaBusca(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return valor.toISOString().split('T')[0];
  }
  const str = String(valor).trim();
  if (!str) return null;

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-').map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    if (
      isNaN(data.getTime()) ||
      data.getUTCMonth() !== mes - 1 ||
      data.getUTCDate() !== dia
    ) {
      return null;
    }
    return str;
  }

  // Formato DD/MM/YYYY ou DD-MM-YYYY
  const matchBr = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (matchBr) {
    const dia = parseInt(matchBr[1], 10);
    const mes = parseInt(matchBr[2], 10);
    const ano = parseInt(matchBr[3], 10);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    if (
      isNaN(data.getTime()) ||
      data.getUTCMonth() !== mes - 1 ||
      data.getUTCDate() !== dia
    ) {
      return null;
    }
    const dStr = String(dia).padStart(2, '0');
    const mStr = String(mes).padStart(2, '0');
    return `${ano}-${mStr}-${dStr}`;
  }

  // Não aceita strings numéricas soltas como datas (ex: "10" não deve ser interpretado como data do ano 2001)
  return null;
}

/**
 * Extrai o número de dias de estadia de campos de texto ou números (ex: "10 dias", "10", "14d")
 */
export function extrairDiasEstadia(valor, padrao = 10) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  if (typeof valor === 'number' && !isNaN(valor) && valor > 0) return Math.round(valor);
  const str = String(valor).trim();
  const match = str.match(/^(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n > 0) return n;
  }
  return padrao;
}

/**
 * Calcula a data de volta com base no campo (pode ser número de dias, ex: "10 dias", ou data específica)
 */
export function calcularDataVolta(dataIdaStr, campoVolta) {
  if (ehSoIda(campoVolta)) return null;

  const strTrim = String(campoVolta).trim();
  // Reconhece formatos de duração como: "10", "10 dias", "10d", "14 (dias)", etc.
  const matchDias = strTrim.match(/^(\d+)(?:\s*(?:dias?|d|\(dias?\)))?$/i);
  if ((!isNaN(campoVolta) && typeof campoVolta === 'number') || matchDias) {
    const dias = matchDias ? parseInt(matchDias[1], 10) : parseInt(strTrim, 10);
    if (dias > 0 && dataIdaStr) {
      const dataIdaNorm = formatarDataParaBusca(dataIdaStr);
      if (!dataIdaNorm) return null;
      const [ano, mes, dia] = dataIdaNorm.split('-').map(Number);
      const dataIda = new Date(Date.UTC(ano, mes - 1, dia));
      if (isNaN(dataIda.getTime())) return null;
      dataIda.setUTCDate(dataIda.getUTCDate() + dias);
      return dataIda.toISOString().split('T')[0];
    }
    return null;
  }

  return formatarDataParaBusca(campoVolta);
}

/**
 * Validação rigorosa de período (ida e volta)
 */
export function validarPeriodo(dataIdaStr, dataVoltaStr, tipo, semData = false) {
  if (semData) {
    if (!dataIdaStr) return { ok: true };
  }

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dataIdaStr || !regex.test(dataIdaStr)) {
    return { ok: false, erro: 'Data de ida inválida ou mal formatada' };
  }

  function dataValida(str) {
    const [ano, mes, dia] = str.split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    return !isNaN(d.getTime()) && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  }

  if (!dataValida(dataIdaStr)) {
    return { ok: false, erro: 'Data de ida inexistente no calendário' };
  }

  if (tipo === 'one_way') {
    if (dataVoltaStr !== null && dataVoltaStr !== undefined && dataVoltaStr !== '') {
      return { ok: false, erro: 'Só ida não deve conter data de volta' };
    }
    return { ok: true };
  }

  if (!dataVoltaStr || !regex.test(dataVoltaStr) || !dataValida(dataVoltaStr)) {
    return { ok: false, erro: 'Data de volta inexistente ou inválida' };
  }

  if (dataVoltaStr < dataIdaStr) {
    return { ok: false, erro: 'A data de volta não pode ser anterior à data de ida' };
  }

  return { ok: true };
}

export const KGMID_PARA_HUB_IATA = {
  "/m/02j9z": "MAD",
  "/m/09c7w0": "MIA",
  "/m/05r4w": "LIS",
  "/m/06mkj": "MAD",
  "/m/0f8l9c": "CDG",
  "/m/03rjj": "FCO",
  "/m/01n7q": "SCL",
  "/m/06_1": "EZE",
  "/m/02j1x": "TYO"
};

export const KGMID_PARA_NOME = {
  "/m/02j9z": "Europe",
  "/m/09c7w0": "United States",
  "/m/05r4w": "Portugal",
  "/m/06mkj": "Spain",
  "/m/0f8l9c": "France",
  "/m/03rjj": "Italy",
  "/m/01n7q": "Chile",
  "/m/06_1": "South America",
  "/m/02j1x": "Asia"
};

/**
 * Converte códigos IATA, KGMIDs, regiões ou nomes com parênteses em termos aceitos e funcionais no Google Flights
 */
export function resolverCodigoParaLink(cod) {
  if (!cod) return 'SAO';
  const str = String(cod).trim();
  const matchIata = str.match(/\(([A-Z]{3})\)/);
  if (matchIata) return matchIata[1];
  if (KGMID_PARA_NOME[str]) return KGMID_PARA_NOME[str];
  const limpoLower = normalizarTexto(str);
  if (limpoLower === 'america do sul' || limpoLower === 'south america') return 'South America';
  if (limpoLower === 'europa' || limpoLower === 'europe') return 'Europe';
  if (limpoLower === 'estados unidos' || limpoLower === 'eua' || limpoLower === 'usa') return 'United States';
  if (limpoLower === 'asia') return 'Asia';
  if (str.startsWith('/m/') || str.startsWith('/g/')) return str.replace(/^\/[mg]\//, '');
  return str;
}

/**
 * Determina se uma rota ou dados de rota configuram um voo de Só Ida
 */
export function rotaEhSoIda(rotaOuDados) {
  if (!rotaOuDados) return false;
  if (typeof rotaOuDados === 'string') return ehSoIda(rotaOuDados);

  if (rotaOuDados.tipo === 'one_way' || rotaOuDados.tipo === 'so_ida' || rotaOuDados.tipo_viagem === 'one_way') return true;
  if (rotaOuDados.tipo === 'round_trip' || rotaOuDados.tipo === 'ida_e_volta' || rotaOuDados.tipo_viagem === 'round_trip') return false;

  const campoVolta = rotaOuDados.data_volta !== undefined ? rotaOuDados.data_volta : rotaOuDados.dataVolta;
  const semData = rotaOuDados.sem_data === 1 || Boolean(rotaOuDados.sem_data);
  const diasEstadia = rotaOuDados.dias_estadia || rotaOuDados.diasEstadia;

  if (semData) {
    if (typeof campoVolta === 'string') {
      if (ehSoIda(campoVolta)) return true;
      if (/\d/.test(campoVolta)) return false;
    }
    // Se tiver dias de estadia configurados (> 0), é Ida e Volta!
    if (diasEstadia && Number(diasEstadia) > 0) return false;

    // Se campoVolta for nulo/indefinido e não tem dias de estadia
    return true;
  }

  return ehSoIda(campoVolta);
}

/**
 * Gera link direto e estruturado para o Google Flights que abre direto no voo / rota
 */
export function gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta) {
  const origemRes = resolverCodigoParaLink(origemCod);
  const destinoRes = resolverCodigoParaLink(destinoCod);

  const origemParam = encodeURIComponent(origemRes);
  const destinoParam = encodeURIComponent(destinoRes);

  if (!dataIda) {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${origemParam}%20to%20${destinoParam}&hl=pt-BR&gl=BR&curr=BRL`;
  }

  const soIda = ehSoIda(dataVolta);
  if (!soIda && dataVolta) {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${origemParam}%20to%20${destinoParam}%20on%20${dataIda}%20returning%20${dataVolta}&hl=pt-BR&gl=BR&curr=BRL`;
  } else {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${origemParam}%20to%20${destinoParam}%20on%20${dataIda}%20one-way&hl=pt-BR&gl=BR&curr=BRL`;
  }
}

/**
 * Codifica inteiro como varint do Protocol Buffers
 */
export function encodeVarint(num) {
  const bytes = [];
  let n = num;
  while (n > 0x7f) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n & 0x7f);
  return Buffer.from(bytes);
}

/**
 * Codifica campo length-delimited do Protocol Buffers (wire type 2)
 */
export function encodeLengthDelimited(tag, buf) {
  const tagByte = (tag << 3) | 2;
  return Buffer.concat([Buffer.from([tagByte]), encodeVarint(buf.length), buf]);
}

/**
 * Gera o payload binário protobuf (tfs) compatível com o Google Flights
 */
export function gerarTfs({ origens, destinos, dataIda, dataVolta = null, maxDurationMinutes = null }) {
  const voltaEfetiva = ehSoIda(dataVolta) ? null : dataVolta;
  const leg1Parts = [];
  leg1Parts.push(Buffer.concat([Buffer.from([0x12, 0x0a]), Buffer.from(dataIda)]));
  if (maxDurationMinutes && maxDurationMinutes > 0 && maxDurationMinutes < 900 * 60) {
    leg1Parts.push(Buffer.concat([Buffer.from([0x60]), encodeVarint(maxDurationMinutes)]));
  }
  for (const orig of origens) {
    const isKgmid = orig.startsWith('/m/') || orig.startsWith('/g/');
    const origBytes = Buffer.from(orig);
    const sub = Buffer.concat([
      Buffer.from([0x08, isKgmid ? 0x02 : 0x01]),
      Buffer.from([0x12, origBytes.length]),
      origBytes
    ]);
    leg1Parts.push(Buffer.concat([Buffer.from([0x6a]), encodeVarint(sub.length), sub]));
  }
  for (const dest of destinos) {
    const isKgmid = dest.startsWith('/m/') || dest.startsWith('/g/');
    const destBytes = Buffer.from(dest);
    const sub = Buffer.concat([
      Buffer.from([0x08, isKgmid ? 0x02 : 0x01]),
      Buffer.from([0x12, destBytes.length]),
      destBytes
    ]);
    leg1Parts.push(Buffer.concat([Buffer.from([0x72]), encodeVarint(sub.length), sub]));
  }

  // Trip type: 0x01 para Só Ida (One-Way), 0x02 para Ida e Volta (Round-Trip)
  const tripType = voltaEfetiva ? 0x02 : 0x01;
  const rootParts = [
    Buffer.from([0x08, 0x1c, 0x10, tripType]),
    encodeLengthDelimited(3, Buffer.concat(leg1Parts))
  ];

  if (voltaEfetiva) {
    const leg2Parts = [];
    leg2Parts.push(Buffer.concat([Buffer.from([0x12, 0x0a]), Buffer.from(voltaEfetiva)]));
    if (maxDurationMinutes && maxDurationMinutes > 0 && maxDurationMinutes < 900 * 60) {
      leg2Parts.push(Buffer.concat([Buffer.from([0x60]), encodeVarint(maxDurationMinutes)]));
    }
    for (const dest of destinos) {
      const isKgmid = dest.startsWith('/m/') || dest.startsWith('/g/');
      const destBytes = Buffer.from(dest);
      const sub = Buffer.concat([
        Buffer.from([0x08, isKgmid ? 0x02 : 0x01]),
        Buffer.from([0x12, destBytes.length]),
        destBytes
      ]);
      leg2Parts.push(Buffer.concat([Buffer.from([0x6a]), encodeVarint(sub.length), sub]));
    }
    for (const orig of origens) {
      const isKgmid = orig.startsWith('/m/') || orig.startsWith('/g/');
      const origBytes = Buffer.from(orig);
      const sub = Buffer.concat([
        Buffer.from([0x08, isKgmid ? 0x02 : 0x01]),
        Buffer.from([0x12, origBytes.length]),
        origBytes
      ]);
      leg2Parts.push(Buffer.concat([Buffer.from([0x72]), encodeVarint(sub.length), sub]));
    }
    rootParts.push(encodeLengthDelimited(3, Buffer.concat(leg2Parts)));
  }

  rootParts.push(Buffer.from([0x40, 0x01, 0x48, 0x01, 0x70, 0x01, 0x98, 0x01, 0x02]));
  return Buffer.concat(rootParts).toString('base64url');
}

/**
 * Gera link direto e estruturado para o Google Flights que abre FORÇADAMENTE na aba Cheapest (Menor Preço)
 */
export function gerarLinkGoogleFlightsCheapest(origemCod, destinoCod, dataIda, dataVolta = null, duracaoMaxHoras = null) {
  if (!dataIda) return null;
  const strDest = String(destinoCod || '').trim();
  const limpoLower = normalizarTexto(strDest);
  const ehMacrorregiao = strDest.startsWith('/m/') || strDest.startsWith('/g/') ||
    ['america do sul', 'south america', 'europa', 'europe', 'asia', 'estados unidos', 'eua', 'usa'].includes(limpoLower);

  // Se for macrorregião/continente amplo, resolve para o Hub IATA de entrada de referência
  // garantindo payload Protobuf tfs preciso em vez de página genérica de exploração
  let destinoEfetivo = destinoCod;
  if (ehMacrorregiao) {
    const hubIata = KGMID_PARA_HUB_IATA[strDest] ||
      (limpoLower === 'europa' || limpoLower === 'europe' ? 'MAD' : null) ||
      (limpoLower === 'america do sul' || limpoLower === 'south america' ? 'EZE' : null) ||
      (limpoLower === 'estados unidos' || limpoLower === 'eua' || limpoLower === 'usa' ? 'MIA' : null) ||
      (limpoLower === 'asia' ? 'TYO' : null);

    if (hubIata) {
      destinoEfetivo = hubIata;
    } else {
      return gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta);
    }
  }

  const origCod = resolverCodigoParaLink(origemCod);
  const destCod = resolverCodigoParaLink(destinoEfetivo);
  const origens = normalizarParaSerpApi(origCod).split(',').map(s => s.trim()).filter(Boolean);
  const destinos = normalizarParaSerpApi(destCod).split(',').map(s => s.trim()).filter(Boolean);
  const maxMin = duracaoMaxHoras && duracaoMaxHoras > 0 && duracaoMaxHoras < 900 ? Math.round(duracaoMaxHoras * 60) : null;
  const voltaEfetiva = ehSoIda(dataVolta) ? null : dataVolta;
  const tfs = gerarTfs({ origens, destinos, dataIda, dataVolta: voltaEfetiva, maxDurationMinutes: maxMin });
  return `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL&tfs=${tfs}&tfu=EgoIABAAGAAgAigD`;
}

/**
 * Desloca uma data YYYY-MM-DD por N dias (positivo ou negativo) com validação defensiva contra erros de tempo
 */
export function somarDiasData(dataStr, dias) {
  if (!dataStr) return null;
  const formatada = formatarDataParaBusca(dataStr);
  if (!formatada) return null;

  const delta = typeof dias === 'number' ? dias : parseInt(dias, 10);
  if (!Number.isFinite(delta)) return formatada;

  const [ano, mes, dia] = formatada.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (isNaN(d.getTime())) return null;

  d.setUTCDate(d.getUTCDate() + delta);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().split('T')[0];
}

/**
 * Gera data inicial padrão (ex: D+30 dias, preferencialmente terça-feira)
 */
export function gerarDataPadraoInicial(diasOffset = 30) {
  const agora = new Date();
  agora.setUTCDate(agora.getUTCDate() + diasOffset);
  // Se cair no sábado (6) ou domingo (0), ajusta para terça-feira (+2 ou +3 dias)
  const diaSemana = agora.getUTCDay();
  if (diaSemana === 0) agora.setUTCDate(agora.getUTCDate() + 2); // Domingo -> Terça
  else if (diaSemana === 6) agora.setUTCDate(agora.getUTCDate() + 3); // Sábado -> Terça
  else if (diaSemana === 5) agora.setUTCDate(agora.getUTCDate() + 4); // Sexta -> Terça
  return agora.toISOString().split('T')[0];
}

/**
 * Gera janelas de exploração para voo flexível sem data fixa (movido pelo menor preço nos próximos meses)
 */
export function gerarJanelasExploracaoSemData({ dataBase = null, diasEstadia = 10, qtdAmostras = 4, soIda = false } = {}) {
  const agoraStr = gerarDataPadraoInicial(25);
  // Se dataBase for nula ou anterior à data inicial padrão (ex: drift ou data passada), usa a base atual de hoje
  const base = (!dataBase || dataBase < agoraStr) ? agoraStr : dataBase;
  const [ano, mes, dia] = base.split('-').map(Number);
  const dataReferencia = new Date(Date.UTC(ano, mes - 1, dia));

  const janelas = [];
  // Gera amostras estratégicas espaçadas nos próximos meses
  const offsetsDias = [0, 30, 60, 90, 120, 150];
  const total = Math.min(qtdAmostras, offsetsDias.length);

  for (let i = 0; i < total; i++) {
    const d = new Date(dataReferencia);
    d.setUTCDate(d.getUTCDate() + offsetsDias[i]);

    // Ajusta para a terça-feira mais próxima (historicamente tarifas mais baixas)
    const diaSemana = d.getUTCDay();
    const ajusteTerça = (2 - diaSemana + 7) % 7;
    d.setUTCDate(d.getUTCDate() + ajusteTerça);

    const dataIda = d.toISOString().split('T')[0];
    const dataVolta = soIda ? null : somarDiasData(dataIda, diasEstadia);

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const labelMes = `${mesesNomes[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;

    janelas.push({
      dataIda,
      dataVolta,
      label: `Janela ${i + 1} (${labelMes})`,
      mes: labelMes,
      offsetMes: i
    });
  }

  return janelas;
}

/**
 * Gera as combinações de datas na janela de flexibilidade (±0 a ±7 dias)
 */
export function gerarCombinacoesFlexibilidade(dataIda, dataVolta, flexibilidadeDias = 0) {
  const flex = Math.min(7, Math.max(0, parseInt(flexibilidadeDias, 10) || 0));
  if (flex === 0) {
    return [{ dataIda, dataVolta, deltaDias: 0, label: 'Data Base' }];
  }

  const combinacoes = [
    { dataIda, dataVolta, deltaDias: 0, label: 'Data Base' }
  ];

  for (let delta = 1; delta <= flex; delta++) {
    const idaMenos = somarDiasData(dataIda, -delta);
    const voltaMenos = dataVolta ? somarDiasData(dataVolta, -delta) : null;
    combinacoes.push({
      dataIda: idaMenos,
      dataVolta: voltaMenos,
      deltaDias: -delta,
      label: `${-delta}d`
    });

    const idaMais = somarDiasData(dataIda, delta);
    const voltaMais = dataVolta ? somarDiasData(dataVolta, delta) : null;
    combinacoes.push({
      dataIda: idaMais,
      dataVolta: voltaMais,
      deltaDias: delta,
      label: `+${delta}d`
    });
  }

  return combinacoes;
}

