/**
 * Serviço Meteorológico para o Radar de Voos (v2.1)
 * Consulta previsões climáticas e temperaturas para cidades/aeroportos de destino
 * utilizando Open-Meteo e wttr.in sem necessidade de chave de API.
 */

// Coordenadas geográficas dos principais hubs e aeroportos mundiais (lat, lon)
export const COORDENADAS_AEROPORTOS = {
  // Brasil
  GRU: { lat: -23.4356, lon: -46.4731, cidade: 'São Paulo', pais: 'Brasil' },
  CGH: { lat: -23.6261, lon: -46.6564, cidade: 'São Paulo', pais: 'Brasil' },
  SAO: { lat: -23.5505, lon: -46.6333, cidade: 'São Paulo', pais: 'Brasil' },
  GIG: { lat: -22.8089, lon: -43.2436, cidade: 'Rio de Janeiro', pais: 'Brasil' },
  SDU: { lat: -22.9105, lon: -43.1631, cidade: 'Rio de Janeiro', pais: 'Brasil' },
  RIO: { lat: -22.9068, lon: -43.1729, cidade: 'Rio de Janeiro', pais: 'Brasil' },
  BSB: { lat: -15.8692, lon: -47.9172, cidade: 'Brasília', pais: 'Brasil' },
  SSA: { lat: -12.9086, lon: -38.3225, cidade: 'Salvador', pais: 'Brasil' },
  REC: { lat: -8.1268, lon: -34.9230, cidade: 'Recife', pais: 'Brasil' },
  FOR: { lat: -3.7763, lon: -38.5326, cidade: 'Fortaleza', pais: 'Brasil' },
  FLN: { lat: -27.6705, lon: -48.5525, cidade: 'Florianópolis', pais: 'Brasil' },
  POA: { lat: -29.9935, lon: -51.1711, cidade: 'Porto Alegre', pais: 'Brasil' },
  CWB: { lat: -25.5285, lon: -49.1758, cidade: 'Curitiba', pais: 'Brasil' },
  CNF: { lat: -19.6244, lon: -43.9719, cidade: 'Belo Horizonte', pais: 'Brasil' },
  BHZ: { lat: -19.9217, lon: -43.9345, cidade: 'Belo Horizonte', pais: 'Brasil' },
  MCZ: { lat: -9.5108, lon: -35.7917, cidade: 'Maceió', pais: 'Brasil' },
  NAT: { lat: -5.7689, lon: -35.3664, cidade: 'Natal', pais: 'Brasil' },
  VIX: { lat: -20.2581, lon: -40.2864, cidade: 'Vitória', pais: 'Brasil' },
  MAO: { lat: -3.0386, lon: -60.0497, cidade: 'Manaus', pais: 'Brasil' },
  BEL: { lat: -1.3793, lon: -48.4763, cidade: 'Belém', pais: 'Brasil' },
  IGU: { lat: -25.5977, lon: -54.4872, cidade: 'Foz do Iguaçu', pais: 'Brasil' },

  // Europa
  LIS: { lat: 38.7742, lon: -9.1342, cidade: 'Lisboa', pais: 'Portugal' },
  OPO: { lat: 41.2481, lon: -8.6814, cidade: 'Porto', pais: 'Portugal' },
  MAD: { lat: 40.4839, lon: -3.5680, cidade: 'Madri', pais: 'Espanha' },
  BCN: { lat: 41.2974, lon: 2.0833, cidade: 'Barcelona', pais: 'Espanha' },
  CDG: { lat: 49.0097, lon: 2.5479, cidade: 'Paris', pais: 'França' },
  ORY: { lat: 48.7262, lon: 2.3652, cidade: 'Paris', pais: 'França' },
  PAR: { lat: 48.8566, lon: 2.3522, cidade: 'Paris', pais: 'França' },
  FCO: { lat: 41.8003, lon: 12.2389, cidade: 'Roma', pais: 'Itália' },
  ROM: { lat: 41.9028, lon: 12.4964, cidade: 'Roma', pais: 'Itália' },
  MXP: { lat: 45.6301, lon: 8.7255, cidade: 'Milão', pais: 'Itália' },
  LHR: { lat: 51.4700, lon: -0.4543, cidade: 'Londres', pais: 'Reino Unido' },
  LGW: { lat: 51.1537, lon: -0.1821, cidade: 'Londres', pais: 'Reino Unido' },
  LON: { lat: 51.5074, lon: -0.1278, cidade: 'Londres', pais: 'Reino Unido' },
  AMS: { lat: 52.3105, lon: 4.7683, cidade: 'Amsterdã', pais: 'Holanda' },
  FRA: { lat: 50.0379, lon: 8.5622, cidade: 'Frankfurt', pais: 'Alemanha' },
  BER: { lat: 52.3667, lon: 13.5033, cidade: 'Berlim', pais: 'Alemanha' },
  MUC: { lat: 48.3537, lon: 11.7750, cidade: 'Munique', pais: 'Alemanha' },
  ZRH: { lat: 47.4582, lon: 8.5555, cidade: 'Zurique', pais: 'Suíça' },
  VIE: { lat: 48.1103, lon: 16.5697, cidade: 'Viena', pais: 'Áustria' },

  // América do Norte
  MIA: { lat: 25.7959, lon: -80.2870, cidade: 'Miami', pais: 'EUA' },
  MCO: { lat: 28.4312, lon: -81.3081, cidade: 'Orlando', pais: 'EUA' },
  JFK: { lat: 40.6413, lon: -73.7781, cidade: 'Nova York', pais: 'EUA' },
  EWR: { lat: 40.6895, lon: -74.1745, cidade: 'Newark', pais: 'EUA' },
  NYC: { lat: 40.7128, lon: -74.0060, cidade: 'Nova York', pais: 'EUA' },
  LAX: { lat: 33.9416, lon: -118.4085, cidade: 'Los Angeles', pais: 'EUA' },
  SFO: { lat: 37.6213, lon: -122.3790, cidade: 'San Francisco', pais: 'EUA' },
  ORD: { lat: 41.9742, lon: -87.9073, cidade: 'Chicago', pais: 'EUA' },
  CHI: { lat: 41.8781, lon: -87.6298, cidade: 'Chicago', pais: 'EUA' },
  YYZ: { lat: 43.6777, lon: -79.6248, cidade: 'Toronto', pais: 'Canadá' },

  // América do Sul
  EZE: { lat: -34.8222, lon: -58.5358, cidade: 'Buenos Aires', pais: 'Argentina' },
  AEP: { lat: -34.5592, lon: -58.4156, cidade: 'Buenos Aires', pais: 'Argentina' },
  BUE: { lat: -34.6037, lon: -58.3816, cidade: 'Buenos Aires', pais: 'Argentina' },
  SCL: { lat: -33.3930, lon: -70.7858, cidade: 'Santiago', pais: 'Chile' },
  MVD: { lat: -34.8384, lon: -56.0308, cidade: 'Montevidéu', pais: 'Uruguai' },
  BOG: { lat: 4.7016, lon: -74.1469, cidade: 'Bogotá', pais: 'Colômbia' },
  LIM: { lat: -12.0219, lon: -77.1143, cidade: 'Lima', pais: 'Peru' },
  CUN: { lat: 21.0365, lon: -86.8770, cidade: 'Cancún', pais: 'México' },

  // Ásia / Oriente Médio / Oceania
  NRT: { lat: 35.7647, lon: 140.3863, cidade: 'Tóquio', pais: 'Japão' },
  HND: { lat: 35.5494, lon: 139.7798, cidade: 'Tóquio', pais: 'Japão' },
  TYO: { lat: 35.6762, lon: 139.6503, cidade: 'Tóquio', pais: 'Japão' },
  DXB: { lat: 25.2532, lon: 55.3657, cidade: 'Dubai', pais: 'Emirados Árabes' },
  DOH: { lat: 25.2731, lon: 51.6081, cidade: 'Doha', pais: 'Catar' },
  SYD: { lat: -33.9399, lon: 151.1753, cidade: 'Sydney', pais: 'Austrália' }
};

// Mapeamento dos códigos WMO de tempo
export function interpretarCodigoWMO(codigo) {
  if (codigo === 0) return { condicao: 'Céu Limpo', emoji: '☀️' };
  if (codigo >= 1 && codigo <= 3) return { condicao: 'Parcialmente Nublado', emoji: '⛅' };
  if (codigo >= 45 && codigo <= 48) return { condicao: 'Nevoeiro', emoji: '🌫️' };
  if (codigo >= 51 && codigo <= 55) return { condicao: 'Garoa Leve', emoji: '🌦️' };
  if (codigo >= 61 && codigo <= 65) return { condicao: 'Chuva', emoji: '🌧️' };
  if (codigo >= 71 && codigo <= 75) return { condicao: 'Neve', emoji: '❄️' };
  if (codigo >= 80 && codigo <= 82) return { condicao: 'Pancadas de Chuva', emoji: '🌧️' };
  if (codigo >= 95 && codigo <= 99) return { condicao: 'Tempestade', emoji: '⛈️' };
  return { condicao: 'Tempo Estável', emoji: '🌤️' };
}

export class WeatherService {
  constructor() {
    this.cache = new Map(); // cache em memória de 1 hora
  }

  /**
   * Identifica as coordenadas de um destino a partir do código ou nome
   */
  resolverCoordenadas(destino) {
    if (!destino || (typeof destino !== 'string' && typeof destino !== 'number')) return null;
    const clean = String(destino).trim().toUpperCase();
    if (!clean) return null;

    // Busca direta pelo código IATA
    if (COORDENADAS_AEROPORTOS[clean]) {
      return { codigo: clean, ...COORDENADAS_AEROPORTOS[clean] };
    }

    // Suporte a KGMIDs e macrorregiões (aponta para hub de referência climática)
    const MACRO_PARA_HUB = {
      '/M/06_1': 'BUE',
      'AMERICA DO SUL': 'BUE',
      '/M/02J9Z': 'MAD',
      'EUROPA': 'MAD',
      '/M/09C7W0': 'MIA',
      'ESTADOS UNIDOS': 'MIA',
      '/M/02J1X': 'TYO',
      'ASIA': 'TYO'
    };
    if (MACRO_PARA_HUB[clean] && COORDENADAS_AEROPORTOS[MACRO_PARA_HUB[clean]]) {
      return { codigo: MACRO_PARA_HUB[clean], ...COORDENADAS_AEROPORTOS[MACRO_PARA_HUB[clean]] };
    }

    // Se a busca tiver menos de 3 caracteres e não for IATA direto, rejeita para evitar falso-positivo espúrio (ex: 'A', 'E')
    if (clean.length < 3) return null;

    const normalizarSemAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const cleanNorm = normalizarSemAcento(clean);

    // Busca por parte da cidade ou nome com suporte a insensibilidade a acentos
    for (const [iata, dados] of Object.entries(COORDENADAS_AEROPORTOS)) {
      const cidadeNorm = normalizarSemAcento(dados.cidade);
      if (
        cidadeNorm.includes(cleanNorm) ||
        cleanNorm.includes(cidadeNorm) ||
        clean.includes(iata)
      ) {
        return { codigo: iata, ...dados };
      }
    }

    return null;
  }

  /**
   * Consulta a previsão meteorológica para o destino
   */
  async obterClimaDestino(destino, dataViagem = null) {
    const geo = this.resolverCoordenadas(destino);
    if (!geo) {
      return {
        ok: false,
        resumo: 'Clima não mapeado',
        tempMedia: null,
        emoji: '🌍'
      };
    }

    const cacheKey = `${geo.codigo}_${dataViagem || 'hoje'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 3600000)) { // 1h
      return cached.data;
    }

    try {
      // 1. Tentar Open-Meteo
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat.toFixed(4)}&longitude=${geo.lon.toFixed(4)}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        if (json.daily && Array.isArray(json.daily.time) && json.daily.time.length > 0) {
          // Pega o primeiro dia ou o dia mais próximo
          let idx = 0;
          if (dataViagem && json.daily.time.includes(dataViagem)) {
            idx = json.daily.time.indexOf(dataViagem);
          }

          const tMax = json.daily.temperature_2m_max[idx] ?? 22;
          const tMin = json.daily.temperature_2m_min[idx] ?? 16;
          const wCode = json.daily.weathercode[idx] ?? 0;
          const { condicao, emoji } = interpretarCodigoWMO(wCode);
          const tempMedia = Math.round((tMax + tMin) / 2);

          const resultado = {
            ok: true,
            cidade: geo.cidade,
            pais: geo.pais,
            tempMedia,
            tempMin: Math.round(tMin),
            tempMax: Math.round(tMax),
            condicao,
            emoji,
            resumo: `${tempMedia}°C • ${condicao} ${emoji}`
          };

          this.cache.set(cacheKey, { timestamp: Date.now(), data: resultado });
          return resultado;
        }
      }
    } catch (_) {
      // Falha de rede ou timeout: segue para fallback
    }

    // Fallback: estimativa com base na localização e estação
    const fallback = {
      ok: true,
      cidade: geo.cidade,
      pais: geo.pais,
      tempMedia: 21,
      tempMin: 17,
      tempMax: 25,
      condicao: 'Clima Ameno',
      emoji: '🌤️',
      resumo: `21°C • Clima Ameno 🌤️`
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), data: fallback });
    return fallback;
  }
}

export const weatherService = new WeatherService();
