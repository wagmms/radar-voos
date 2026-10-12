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
      const [ano, mes, dia] = dataIdaStr.split('-').map(Number);
      const dataIda = new Date(Date.UTC(ano, mes - 1, dia));
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

export const KGMID_PARA_NOME = {
  "/m/02j9z": "Europe",
  "/m/09c7w0": "United States",
  "/m/05r4w": "Portugal",
  "/m/06mkj": "Spain",
  "/m/0f8l9c": "France",
  "/m/03rjj": "Italy",
  "/m/01n7q": "Chile",
  "/m/06_1": "South America"
};

/**
 * Converte códigos IATA, KGMIDs ou nomes com parênteses em termos aceitos pelo Google Flights
 */
export function resolverCodigoParaLink(cod) {
  if (!cod) return 'SAO';
  const str = String(cod).trim();
  const matchIata = str.match(/\(([A-Z]{3})\)/);
  if (matchIata) return matchIata[1];
  if (KGMID_PARA_NOME[str]) return KGMID_PARA_NOME[str];
  if (str.startsWith('/m/') || str.startsWith('/g/')) return str.replace(/^\/[mg]\//, '');
  return str;
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
    return `https://www.google.com/travel/flights?q=Flights%20to%20${destinoParam}%20from%20${origemParam}&hl=pt-BR&curr=BRL`;
  }

  if (dataVolta) {
    return `https://www.google.com/travel/flights?q=Flights%20to%20${destinoParam}%20from%20${origemParam}%20on%20${dataIda}%20through%20${dataVolta}&hl=pt-BR&curr=BRL`;
  } else {
    return `https://www.google.com/travel/flights?q=Flights%20to%20${destinoParam}%20from%20${origemParam}%20on%20${dataIda}%20one-way&hl=pt-BR&curr=BRL`;
  }
}

/**
 * Desloca uma data YYYY-MM-DD por N dias (positivo ou negativo)
 */
export function somarDiasData(dataStr, dias) {
  if (!dataStr) return null;
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
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
  const base = dataBase || gerarDataPadraoInicial(25);
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

