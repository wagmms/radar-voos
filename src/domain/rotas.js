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
  if (!texto || (typeof texto !== 'string' && typeof texto !== 'number')) return null;
  const strOriginal = String(texto).trim();
  if (!strOriginal) return null;

  // 1. Extração prioritária se contiver código IATA entre parênteses (ex: "São Paulo (GRU)", "Miami (MIA)")
  const matchIata = strOriginal.match(/\(\s*([A-Za-z]{3})\s*\)/i);
  if (matchIata) {
    return matchIata[1].toUpperCase();
  }

  // 2. Resolução por dicionários canônicos (regiões e metrópoles)
  const limpo = normalizarTexto(strOriginal);
  if (Object.hasOwn(DICIONARIO_REGIOES, limpo) && typeof DICIONARIO_REGIOES[limpo] === 'string') return DICIONARIO_REGIOES[limpo];
  if (Object.hasOwn(DICIONARIO_CIDADES, limpo) && typeof DICIONARIO_CIDADES[limpo] === 'string') return DICIONARIO_CIDADES[limpo];

  // 3. Código IATA único de 3 letras
  if (strOriginal.length === 3 && /^[A-Za-z]{3}$/.test(strOriginal)) {
    return strOriginal.toUpperCase();
  }

  // 4. Múltiplos aeroportos IATA separados por vírgula (com ou sem espaços, ex: "GRU, GIG", "GRU , CGH")
  if (/^[A-Za-z]{3}(\s*,\s*[A-Za-z]{3})+$/.test(strOriginal)) {
    return strOriginal.toUpperCase().replace(/\s*,\s*/g, ',');
  }

  // 5. Identificadores KGMID/Freebase (/m/ ou /g/)
  if (/^\/[mg]\//i.test(strOriginal)) {
    return strOriginal.toLowerCase();
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
  if (campoVolta === null || campoVolta === undefined || campoVolta === false) return true;
  if (typeof campoVolta === 'number') {
    return !Number.isFinite(campoVolta) || campoVolta <= 0;
  }
  const str = String(campoVolta).trim();
  if (str === '') return true;

  const limpo = normalizarTexto(str).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    limpo === 'so ida' ||
    limpo === 'soida' ||
    limpo === 'so-ida' ||
    limpo === 'ida' ||
    limpo === 'one way' ||
    limpo === 'oneway' ||
    limpo === 'single' ||
    limpo === 'single trip' ||
    limpo === 'sem volta' ||
    limpo === 'sem-volta' ||
    limpo === 'sem retorno' ||
    limpo === 'sem data' ||
    limpo === 'sem data de volta' ||
    limpo === 'null' ||
    limpo === 'undefined' ||
    limpo === 'none' ||
    limpo === 'n/a' ||
    limpo === 'na' ||
    limpo === 'false' ||
    limpo === '0' ||
    limpo.includes('so ida') ||
    limpo.includes('somente ida') ||
    limpo.includes('apenas ida') ||
    limpo.includes('one-way') ||
    limpo.includes('sem volta') ||
    limpo.includes('sem retorno') ||
    limpo.includes('no return')
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

  // Formato YYYY-MM-DD (com ou sem timestamp ISO/SQLite: T00:00:00Z ou 00:00:00)
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (matchIso) {
    const ano = parseInt(matchIso[1], 10);
    const mes = parseInt(matchIso[2], 10);
    const dia = parseInt(matchIso[3], 10);
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

  // Formato DD/MM/YYYY ou DD-MM-YYYY (com ou sem horário)
  const matchBr = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[T\s].*)?$/);
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
  const padraoValido = (typeof padrao === 'number' && Number.isFinite(padrao) && padrao > 0)
    ? Math.min(Math.round(padrao), 3650)
    : 10;

  if (valor === undefined || valor === null || valor === '') return padraoValido;

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor <= 0) return padraoValido;
    return Math.min(Math.round(valor), 3650);
  }

  const str = String(valor).trim();
  if (!str) return padraoValido;

  // Rejeita valores negativos em formato textual (ex: "-10", "-5 dias")
  if (/^\s*-/.test(str)) return padraoValido;

  // Se for uma data absoluta de calendário (YYYY-MM-DD ou DD/MM/YYYY), não representa quantidade de dias
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(str)) {
    return padraoValido;
  }

  // Extrai o número de dias (suporta início direto como "14 dias" ou prefixos como "~14 dias", "aprox. 14 dias", "estadia de 14 dias")
  const match = str.match(/^(?:[~≈\s]|aprox\.?|cerca\s+de|estadia(?:\s+de)?)*(\d+)/i) || str.match(/(?:^|[~≈\s])(\d+)\s*(?:dias?|d|\(dias?\)|noites?|n)\b/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n > 0 && Number.isFinite(n)) {
      return Math.min(n, 3650);
    }
  }
  return padraoValido;
}

/**
 * Calcula a data de volta com base no campo (pode ser número de dias, ex: "10 dias", ou data específica)
 */
export function calcularDataVolta(dataIdaStr, campoVolta) {
  if (ehSoIda(campoVolta)) return null;

  const strTrim = String(campoVolta).trim();
  // Reconhece formatos de duração como: "10", "10 dias", "10d", "14 (dias)", "7 noites", "7n", etc.
  const matchDias = strTrim.match(/^(\d+)(?:\s*(?:dias?|d|\(dias?\)|noites?|n))?$/i);
  if ((!isNaN(campoVolta) && typeof campoVolta === 'number') || matchDias) {
    const dias = matchDias ? parseInt(matchDias[1], 10) : parseInt(strTrim, 10);
    if (dias > 0 && Number.isFinite(dias) && dias <= 3650 && dataIdaStr) {
      const dataIdaNorm = formatarDataParaBusca(dataIdaStr);
      if (!dataIdaNorm) return null;
      const [ano, mes, dia] = dataIdaNorm.split('-').map(Number);
      const dataIda = new Date(Date.UTC(ano, mes - 1, dia));
      if (isNaN(dataIda.getTime())) return null;
      dataIda.setUTCDate(dataIda.getUTCDate() + dias);
      if (isNaN(dataIda.getTime())) return null;
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
  const idaTrim = typeof dataIdaStr === 'string' ? dataIdaStr.trim() : (dataIdaStr ? String(dataIdaStr).trim() : '');
  const semDataBool = semData === 1 || Boolean(semData);

  if (semDataBool) {
    if (!idaTrim) return { ok: true };
  }

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!idaTrim || !regex.test(idaTrim)) {
    return { ok: false, erro: 'Data de ida inválida ou mal formatada' };
  }

  function dataValida(str) {
    const [ano, mes, dia] = str.split('-').map(Number);
    if (!Number.isFinite(ano) || ano < 2000 || ano > 2099) return false;
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    return !isNaN(d.getTime()) && d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  }

  if (!dataValida(idaTrim)) {
    return { ok: false, erro: 'Data de ida inexistente no calendário' };
  }

  const tipoNorm = typeof tipo === 'string' ? tipo.trim().toLowerCase().replace(/-/g, '_') : '';
  const ehTipoSoIda = tipoNorm === 'one_way' || tipoNorm === 'so_ida' || tipoNorm === 'oneway';

  const voltaTrim = typeof dataVoltaStr === 'string' ? dataVoltaStr.trim() : (dataVoltaStr !== null && dataVoltaStr !== undefined ? String(dataVoltaStr).trim() : '');
  const voltaSemanticaSoIda = ehSoIda(dataVoltaStr);

  if (ehTipoSoIda) {
    if (voltaTrim && !voltaSemanticaSoIda) {
      return { ok: false, erro: 'Só ida não deve conter data de volta' };
    }
    return { ok: true };
  }

  // Se o tipo não foi especificado explicitamente mas o campo de volta indica Só Ida
  if (!tipoNorm && voltaSemanticaSoIda) {
    return { ok: true };
  }

  if (!voltaTrim || !regex.test(voltaTrim) || !dataValida(voltaTrim)) {
    return { ok: false, erro: 'Data de volta inexistente ou inválida' };
  }

  if (voltaTrim < idaTrim) {
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
  if (cod === null || cod === undefined) return 'SAO';
  if (typeof cod !== 'string' && typeof cod !== 'number') return 'SAO';
  const str = String(cod).trim();
  if (!str) return 'SAO';

  const matchIata = str.match(/\(\s*([A-Za-z]{3})\s*\)/i);
  if (matchIata) return matchIata[1].toUpperCase();

  // Múltiplos aeroportos IATA separados por vírgula (ex: "GRU, GIG" ou "gru , gig")
  if (/^[A-Za-z]{3}(\s*,\s*[A-Za-z]{3})+$/.test(str)) {
    return str.toUpperCase().replace(/\s*,\s*/g, ',');
  }

  const strLower = str.toLowerCase();
  if (KGMID_PARA_NOME[strLower]) return KGMID_PARA_NOME[strLower];

  const limpoLower = normalizarTexto(str);
  if (limpoLower === 'america do sul' || limpoLower === 'south america') return 'South America';
  if (limpoLower === 'europa' || limpoLower === 'europe') return 'Europe';
  if (limpoLower === 'estados unidos' || limpoLower === 'eua' || limpoLower === 'usa') return 'United States';
  if (limpoLower === 'asia') return 'Asia';
  if (/^\/[mg]\//i.test(str)) return str.replace(/^\/[mg]\//i, '');

  // Código IATA único de 3 letras (ex: "gru", "mia")
  if (str.length === 3 && /^[A-Za-z]{3}$/.test(str)) {
    return str.toUpperCase();
  }

  return str;
}

/**
 * Determina se uma rota ou dados de rota configuram um voo de Só Ida
 */
export function rotaEhSoIda(rotaOuDados) {
  if (!rotaOuDados) return false;
  if (typeof rotaOuDados === 'string') return ehSoIda(rotaOuDados);
  if (typeof rotaOuDados !== 'object' || Array.isArray(rotaOuDados)) return false;

  const normalizarTipo = (val) => (typeof val === 'string' ? val.trim().toLowerCase().replace(/-/g, '_') : '');
  const tipo = normalizarTipo(rotaOuDados.tipo);
  const tipoViagem = normalizarTipo(rotaOuDados.tipo_viagem);

  if (tipo === 'one_way' || tipo === 'so_ida' || tipoViagem === 'one_way' || tipoViagem === 'so_ida') return true;
  if (tipo === 'round_trip' || tipo === 'ida_e_volta' || tipoViagem === 'round_trip' || tipoViagem === 'ida_e_volta') return false;

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
export function gerarLinkGoogleFlights(origemCod, destinoCod, dataIda, dataVolta, moeda = 'BRL') {
  const moedaCode = (typeof moeda === 'string' && moeda.trim())
    ? moeda.trim().toUpperCase()
    : 'BRL';
  const origemRes = resolverCodigoParaLink(origemCod);
  const destinoRes = resolverCodigoParaLink(destinoCod);

  const origemParam = encodeURIComponent(origemRes);
  const destinoParam = encodeURIComponent(destinoRes);

  const dataIdaNorm = formatarDataParaBusca(dataIda);

  if (!dataIdaNorm) {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${origemParam}%20to%20${destinoParam}&hl=pt-BR&gl=BR&curr=${moedaCode}`;
  }

  const soIda = ehSoIda(dataVolta);
  let voltaEfetiva = null;
  if (!soIda && dataVolta !== null && dataVolta !== undefined && dataVolta !== '') {
    const voltaResolvida = calcularDataVolta(dataIdaNorm, dataVolta) || formatarDataParaBusca(dataVolta);
    if (voltaResolvida && voltaResolvida >= dataIdaNorm) {
      voltaEfetiva = voltaResolvida;
    }
  }

  if (voltaEfetiva) {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${origemParam}%20to%20${destinoParam}%20on%20${dataIdaNorm}%20returning%20${voltaEfetiva}&hl=pt-BR&gl=BR&curr=${moedaCode}`;
  } else {
    return `https://www.google.com/travel/flights?q=Flights%20from%20${origemParam}%20to%20${destinoParam}%20on%20${dataIdaNorm}%20one-way&hl=pt-BR&gl=BR&curr=${moedaCode}`;
  }
}

/**
 * Codifica inteiro como varint do Protocol Buffers
 */
export function encodeVarint(num) {
  const val = Number(num);
  if (!Number.isFinite(val) || val <= 0) {
    return Buffer.from([0]);
  }
  let n = Math.floor(val);
  const bytes = [];
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
  const tagNum = (Number.isFinite(+tag) && +tag > 0) ? Math.floor(+tag) : 1;
  const tagVarint = encodeVarint((tagNum << 3) | 2);

  let bufferEfetivo;
  if (Buffer.isBuffer(buf)) {
    bufferEfetivo = buf;
  } else if (buf instanceof Uint8Array) {
    bufferEfetivo = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  } else if (typeof buf === 'string') {
    bufferEfetivo = Buffer.from(buf, 'utf8');
  } else {
    bufferEfetivo = Buffer.alloc(0);
  }

  return Buffer.concat([tagVarint, encodeVarint(bufferEfetivo.length), bufferEfetivo]);
}

/**
 * Gera o payload binário protobuf (tfs) compatível com o Google Flights
 */
export function gerarTfs({ origens, destinos, dataIda, dataVolta = null, maxDurationMinutes = null } = {}) {
  // Normalização defensiva de origens e destinos (suporta arrays, strings únicas e filtra entradas inválidas)
  const listaOrigens = (Array.isArray(origens) ? origens : (origens ? [origens] : ['SAO']))
    .map(o => (o !== null && o !== undefined) ? String(o).trim() : '')
    .filter(Boolean);
  const origensEfetivas = listaOrigens.length > 0 ? listaOrigens : ['SAO'];

  const listaDestinos = (Array.isArray(destinos) ? destinos : (destinos ? [destinos] : []))
    .map(d => (d !== null && d !== undefined) ? String(d).trim() : '')
    .filter(Boolean);
  const destinosEfetivos = listaDestinos.length > 0 ? listaDestinos : ['SAO'];

  // Normalização e validação das datas para formato YYYY-MM-DD
  const idaNorm = formatarDataParaBusca(dataIda) || (typeof dataIda === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataIda.trim()) ? dataIda.trim() : '2027-01-01');
  const voltaRaw = ehSoIda(dataVolta) ? null : dataVolta;
  const voltaEfetiva = voltaRaw ? (formatarDataParaBusca(voltaRaw) || (typeof voltaRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(voltaRaw.trim()) ? voltaRaw.trim() : null)) : null;

  const criarLeg = (dataStr, origList, destList) => {
    const parts = [];
    // Data: Field 2 (string)
    parts.push(Buffer.concat([Buffer.from([0x12, 0x0a]), Buffer.from(dataStr)]));
    // Max duration: Field 12 (varint)
    const maxMinNum = Number(maxDurationMinutes);
    if (Number.isFinite(maxMinNum) && maxMinNum > 0 && maxMinNum < 900 * 60) {
      parts.push(Buffer.concat([Buffer.from([0x60]), encodeVarint(Math.round(maxMinNum))]));
    }
    // from_airport: Field 13 (Airport: string airport = 2)
    for (const o of origList) {
      const oBytes = Buffer.from(o);
      const aeroBuf = Buffer.concat([Buffer.from([0x12, oBytes.length]), oBytes]);
      parts.push(encodeLengthDelimited(13, aeroBuf));
    }
    // to_airport: Field 14 (Airport: string airport = 2)
    for (const d of destList) {
      const dBytes = Buffer.from(d);
      const aeroBuf = Buffer.concat([Buffer.from([0x12, dBytes.length]), dBytes]);
      parts.push(encodeLengthDelimited(14, aeroBuf));
    }
    return Buffer.concat(parts);
  };

  const legs = [];
  legs.push(encodeLengthDelimited(3, criarLeg(idaNorm, origensEfetivas, destinosEfetivos)));
  const tripType = voltaEfetiva ? 0x01 : 0x02; // 1 = ROUND_TRIP, 2 = ONE_WAY
  if (voltaEfetiva) {
    legs.push(encodeLengthDelimited(3, criarLeg(voltaEfetiva, destinosEfetivos, origensEfetivas)));
  }

  const rootParts = [
    ...legs,
    // Passengers: Field 8 (Passenger.ADULT = 1) -> tag 0x42 (packed)
    Buffer.from([0x42, 0x01, 0x01]),
    // Seat: Field 9 (ECONOMY = 1) -> tag 0x48
    Buffer.from([0x48, 0x01]),
    // Trip: Field 19 (ROUND_TRIP = 1, ONE_WAY = 2) -> tag 0x98, 0x01
    Buffer.from([0x98, 0x01, tripType])
  ];

  return Buffer.concat(rootParts).toString('base64');
}

/**
 * Constrói o payload binário tfu (Travel Filter URL) do Google Flights,
 * que controla número de passageiros e classe de cabine na URL do Cheapest.
 *
 * @param {number} adultos - Número total de adultos (>= 1, padrão 1)
 * @param {number} criancas - Número de crianças (2-11 anos, padrão 0)
 * @param {number} bebes - Número de bebês no colo (< 2 anos, padrão 0)
 * @param {string} classeViagem - 'economy' | 'premium_economy' | 'business' | 'first' (padrão 'economy')
 * @returns {string} Payload base64url compatível com o parâmetro tfu do Google Flights
 */
export function construirTfu(adultos = 1, criancas = 0, bebes = 0, classeViagem = 'economy') {
  // Mapa canônico de cabines para o encoding Protobuf do Google Flights
  const CABIN_MAP = {
    economy: 1,
    premium_economy: 2,
    business: 3,
    first: 4
  };

  // Sanitização defensiva dos parâmetros numéricos
  const nAdultos = Math.max(1, Math.min(9, Number.isFinite(+adultos) ? Math.floor(+adultos) : 1));
  const nCriancas = Math.max(0, Math.min(8, Number.isFinite(+criancas) ? Math.floor(+criancas) : 0));
  const nBebes = Math.max(0, Math.min(nAdultos, Number.isFinite(+bebes) ? Math.floor(+bebes) : 0));
  const classeStr = typeof classeViagem === 'string' ? classeViagem.toLowerCase().trim() : 'economy';
  const classeNum = CABIN_MAP[classeStr] || 1;

  // Google Flights codifica adultos adicionais acima do padrão de 1 (adultos - 1 = extras)
  const adultosExtras = nAdultos - 1;

  // Submensagem interna: passageiros e cabine
  const innerParts = [
    Buffer.from([0x08, adultosExtras]), // field 1 varint = adultos extras (0 = 1 adulto padrão)
    Buffer.from([0x10, nCriancas]),     // field 2 varint = crianças
    Buffer.from([0x18, nBebes]),        // field 3 varint = bebês no colo
    Buffer.from([0x20, 0x02]),          // field 4 varint = 2 (max_stops canônico fixo do Google)
    Buffer.from([0x28, 0x03])           // field 5 varint = 3 (sort_by=melhor preço, padrão do Google)
  ];

  // Classe de cabine: field 6 varint — omitir quando economy (1) pois é o padrão implícito
  if (classeNum > 1) {
    innerParts.push(Buffer.from([0x30, classeNum]));
  }

  const inner = Buffer.concat(innerParts);
  // Envelope externo: field 2, length-delimited
  const outer = Buffer.concat([Buffer.from([0x12, inner.length]), inner]);
  return outer.toString('base64url');
}

/**
 * Gera link direto e estruturado para o Google Flights que abre FORÇADAMENTE na aba Cheapest (Menor Preço).
 * Suporta múltiplos passageiros (adultos, crianças) e seleção de classe de cabine.
 *
 * @param {string} origemCod - Código IATA ou KGMID da origem
 * @param {string} destinoCod - Código IATA, KGMID ou macrorregião do destino
 * @param {string} dataIda - Data de ida no formato YYYY-MM-DD
 * @param {string|null} dataVolta - Data de volta (ou 'Só Ida' / null para one-way)
 * @param {number|null} duracaoMaxHoras - Duração máxima do voo em horas
 * @param {number} adultos - Número de adultos (padrão 1)
 * @param {number} criancas - Número de crianças 2-11 anos (padrão 0)
 * @param {string} classeViagem - 'economy' | 'premium_economy' | 'business' | 'first' (padrão 'economy')
 * @returns {string|null} URL canônica do Google Flights aba Cheapest ou null se sem dataIda
 */
export function gerarLinkGoogleFlightsCheapest(
  origemCod,
  destinoCod,
  dataIda,
  dataVolta = null,
  duracaoMaxHoras = null,
  adultos = 1,
  criancas = 0,
  classeViagem = 'economy',
  moeda = 'BRL'
) {
  if (!dataIda) return null;
  const dataIdaNorm = formatarDataParaBusca(dataIda);
  if (!dataIdaNorm) return null;

  const strDest = String(destinoCod || '').trim();
  const limpoLower = normalizarTexto(strDest);
  const ehMacrorregiao = strDest.startsWith('/m/') || strDest.startsWith('/g/') ||
    ['america do sul', 'south america', 'europa', 'europe', 'asia', 'estados unidos', 'eua', 'usa'].includes(limpoLower);

  // Para macrorregiões/continentes, normalizarParaSerpApi resolve a lista completa de aeroportos
  // representativos do continente inteiro (ex: EZE,AEP,SCL,MVD,LIM... ou LIS,OPO,MAD,BCN,CDG...)
  const origCod = resolverCodigoParaLink(origemCod);
  const destCod = resolverCodigoParaLink(destinoCod);
  const origens = normalizarParaSerpApi(origCod).split(',').map(s => s.trim()).filter(Boolean);
  const destinos = normalizarParaSerpApi(destCod).split(',').map(s => s.trim()).filter(Boolean);

  if (destinos.length === 0) {
    return gerarLinkGoogleFlights(origemCod, destinoCod, dataIdaNorm, dataVolta, moeda);
  }
  const maxMin = duracaoMaxHoras && duracaoMaxHoras > 0 && duracaoMaxHoras < 900 ? Math.round(duracaoMaxHoras * 60) : null;

  const soIda = ehSoIda(dataVolta);
  let voltaEfetiva = null;
  if (!soIda && dataVolta !== null && dataVolta !== undefined && dataVolta !== '') {
    const voltaResolvida = calcularDataVolta(dataIdaNorm, dataVolta) || formatarDataParaBusca(dataVolta);
    if (voltaResolvida && voltaResolvida >= dataIdaNorm) {
      voltaEfetiva = voltaResolvida;
    }
  }

  const tfs = gerarTfs({ origens, destinos, dataIda: dataIdaNorm, dataVolta: voltaEfetiva, maxDurationMinutes: maxMin });
  const tfu = construirTfu(adultos, criancas, 0, classeViagem);
  const moedaCode = (typeof moeda === 'string' && moeda.trim()) ? moeda.trim().toUpperCase() : 'BRL';
  return `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=${moedaCode}&tfs=${tfs}&tfu=${tfu}`;
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
  const parsed = typeof diasOffset === 'number' ? diasOffset : parseInt(diasOffset, 10);
  const offsetFinal = (Number.isFinite(parsed) && parsed >= 0) ? Math.min(parsed, 3650) : 30;

  const agora = new Date();
  agora.setUTCDate(agora.getUTCDate() + offsetFinal);
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
  // Se dataBase for nula, inválida ou anterior à data inicial padrão (ex: drift ou data passada), usa a base atual de hoje
  const dataBaseNorm = formatarDataParaBusca(dataBase);
  const base = (!dataBaseNorm || dataBaseNorm < agoraStr) ? agoraStr : dataBaseNorm;
  const [ano, mes, dia] = base.split('-').map(Number);
  const dataReferencia = new Date(Date.UTC(ano, mes - 1, dia));

  const janelas = [];
  // Gera amostras estratégicas espaçadas nos próximos meses
  const offsetsDias = [0, 30, 60, 90, 120, 150];
  const qtdNum = Number(qtdAmostras);
  const total = Math.max(0, Math.min(Number.isFinite(qtdNum) ? Math.round(qtdNum) : 4, offsetsDias.length));
  const estadiaDias = extrairDiasEstadia(diasEstadia, 10);
  const ehSoIdaFinal = (typeof soIda === 'string') ? ehSoIda(soIda) : Boolean(soIda);

  for (let i = 0; i < total; i++) {
    const d = new Date(dataReferencia);
    d.setUTCDate(d.getUTCDate() + offsetsDias[i]);

    // Ajusta para a terça-feira mais próxima (historicamente tarifas mais baixas)
    const diaSemana = d.getUTCDay();
    const ajusteTerça = (2 - diaSemana + 7) % 7;
    d.setUTCDate(d.getUTCDate() + ajusteTerça);

    const dataIda = d.toISOString().split('T')[0];
    const dataVolta = ehSoIdaFinal ? null : somarDiasData(dataIda, estadiaDias);

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
  const idaNorm = formatarDataParaBusca(dataIda);

  let voltaEfetiva = null;
  if (!ehSoIda(dataVolta) && dataVolta !== null && dataVolta !== undefined) {
    const voltaCalculada = calcularDataVolta(idaNorm, dataVolta) || formatarDataParaBusca(dataVolta);
    if (voltaCalculada) {
      if (!idaNorm || voltaCalculada >= idaNorm) {
        voltaEfetiva = voltaCalculada;
      }
    }
  }

  const flexRaw = typeof flexibilidadeDias === 'number' ? flexibilidadeDias : parseInt(flexibilidadeDias, 10);
  const flex = Number.isFinite(flexRaw) ? Math.min(7, Math.max(0, flexRaw)) : 0;
  if (!idaNorm || flex === 0) {
    return [{ dataIda: idaNorm, dataVolta: voltaEfetiva, deltaDias: 0, label: 'Data Base' }];
  }

  const combinacoes = [
    { dataIda: idaNorm, dataVolta: voltaEfetiva, deltaDias: 0, label: 'Data Base' }
  ];

  for (let delta = 1; delta <= flex; delta++) {
    const idaMenos = somarDiasData(idaNorm, -delta);
    const voltaMenos = voltaEfetiva ? somarDiasData(voltaEfetiva, -delta) : null;
    combinacoes.push({
      dataIda: idaMenos,
      dataVolta: voltaMenos,
      deltaDias: -delta,
      label: `${-delta}d`
    });

    const idaMais = somarDiasData(idaNorm, delta);
    const voltaMais = voltaEfetiva ? somarDiasData(voltaEfetiva, delta) : null;
    combinacoes.push({
      dataIda: idaMais,
      dataVolta: voltaMais,
      deltaDias: delta,
      label: `+${delta}d`
    });
  }

  return combinacoes;
}

