/**
 * DOMÍNIO: Catálogo e Resolução Canônica de Aeroportos, Cidades e Países
 * Elimina destinos genéricos em Bug Fares e assegura links 100% navegáveis no Google Flights.
 */

import { gerarLinkGoogleFlights, gerarLinkGoogleFlightsCheapest, ehSoIda, formatarDataParaBusca, calcularDataVolta } from './rotas.js';

// Catálogo exaustivo de Aeroportos e Metrópoles com dados geográficos e institucionais
export const CATALOGO_AEROPORTOS = {
  // BRASIL (Doméstico)
  SAO: { iata: 'SAO', codigoLink: 'SAO', nome: 'Aeroportos de São Paulo (Guarulhos/Congonhas)', cidade: 'São Paulo', pais: 'Brasil', regiao: 'DOMESTICO', fisicos: ['GRU', 'CGH'] },
  GRU: { iata: 'GRU', codigoLink: 'GRU', nome: 'Aeroporto Internacional de Guarulhos', cidade: 'São Paulo', pais: 'Brasil', regiao: 'DOMESTICO' },
  CGH: { iata: 'CGH', codigoLink: 'CGH', nome: 'Aeroporto de Congonhas', cidade: 'São Paulo', pais: 'Brasil', regiao: 'DOMESTICO' },
  VCP: { iata: 'VCP', codigoLink: 'VCP', nome: 'Aeroporto Internacional de Viracopos', cidade: 'Campinas', pais: 'Brasil', regiao: 'DOMESTICO' },
  RIO: { iata: 'RIO', codigoLink: 'RIO', nome: 'Aeroportos do Rio de Janeiro (Galeão/Santos Dumont)', cidade: 'Rio de Janeiro', pais: 'Brasil', regiao: 'DOMESTICO', fisicos: ['GIG', 'SDU'] },
  GIG: { iata: 'GIG', codigoLink: 'GIG', nome: 'Aeroporto Internacional do Galeão', cidade: 'Rio de Janeiro', pais: 'Brasil', regiao: 'DOMESTICO' },
  SDU: { iata: 'SDU', codigoLink: 'SDU', nome: 'Aeroporto Santos Dumont', cidade: 'Rio de Janeiro', pais: 'Brasil', regiao: 'DOMESTICO' },
  BSB: { iata: 'BSB', codigoLink: 'BSB', nome: 'Aeroporto Internacional Presidente Juscelino Kubitschek', cidade: 'Brasília', pais: 'Brasil', regiao: 'DOMESTICO' },
  CNF: { iata: 'CNF', codigoLink: 'CNF', nome: 'Aeroporto Internacional de Confins', cidade: 'Belo Horizonte', pais: 'Brasil', regiao: 'DOMESTICO' },
  BHZ: { iata: 'BHZ', codigoLink: 'CNF', nome: 'Aeroporto Internacional de Confins', cidade: 'Belo Horizonte', pais: 'Brasil', regiao: 'DOMESTICO' },
  SSA: { iata: 'SSA', codigoLink: 'SSA', nome: 'Aeroporto Internacional Deputado Luís Eduardo Magalhães', cidade: 'Salvador', pais: 'Brasil', regiao: 'DOMESTICO' },
  REC: { iata: 'REC', codigoLink: 'REC', nome: 'Aeroporto Internacional dos Guararapes', cidade: 'Recife', pais: 'Brasil', regiao: 'DOMESTICO' },
  FOR: { iata: 'FOR', codigoLink: 'FOR', nome: 'Aeroporto Internacional Pinto Martins', cidade: 'Fortaleza', pais: 'Brasil', regiao: 'DOMESTICO' },
  FLN: { iata: 'FLN', codigoLink: 'FLN', nome: 'Aeroporto Internacional Hercílio Luz', cidade: 'Florianópolis', pais: 'Brasil', regiao: 'DOMESTICO' },
  POA: { iata: 'POA', codigoLink: 'POA', nome: 'Aeroporto Internacional Salgado Filho', cidade: 'Porto Alegre', pais: 'Brasil', regiao: 'DOMESTICO' },
  CWB: { iata: 'CWB', codigoLink: 'CWB', nome: 'Aeroporto Internacional Afonso Pena', cidade: 'Curitiba', pais: 'Brasil', regiao: 'DOMESTICO' },
  BEL: { iata: 'BEL', codigoLink: 'BEL', nome: 'Aeroporto Internacional Val-de-Cans', cidade: 'Belém', pais: 'Brasil', regiao: 'DOMESTICO' },
  MAO: { iata: 'MAO', codigoLink: 'MAO', nome: 'Aeroporto Internacional Eduardo Gomes', cidade: 'Manaus', pais: 'Brasil', regiao: 'DOMESTICO' },
  NAT: { iata: 'NAT', codigoLink: 'NAT', nome: 'Aeroporto Internacional Governador Aluízio Alves', cidade: 'Natal', pais: 'Brasil', regiao: 'DOMESTICO' },
  MCZ: { iata: 'MCZ', codigoLink: 'MCZ', nome: 'Aeroporto Internacional Zumbi dos Palmares', cidade: 'Maceió', pais: 'Brasil', regiao: 'DOMESTICO' },
  JPA: { iata: 'JPA', codigoLink: 'JPA', nome: 'Aeroporto Internacional Presidente Castro Pinto', cidade: 'João Pessoa', pais: 'Brasil', regiao: 'DOMESTICO' },
  AJU: { iata: 'AJU', codigoLink: 'AJU', nome: 'Aeroporto Internacional Santa Maria', cidade: 'Aracaju', pais: 'Brasil', regiao: 'DOMESTICO' },
  VIX: { iata: 'VIX', codigoLink: 'VIX', nome: 'Aeroporto de Vitória Eurico de Aguiar Salles', cidade: 'Vitória', pais: 'Brasil', regiao: 'DOMESTICO' },
  IGU: { iata: 'IGU', codigoLink: 'IGU', nome: 'Aeroporto Internacional de Foz do Iguaçu', cidade: 'Foz do Iguaçu', pais: 'Brasil', regiao: 'DOMESTICO' },
  NVT: { iata: 'NVT', codigoLink: 'NVT', nome: 'Aeroporto Internacional de Navegantes', cidade: 'Navegantes', pais: 'Brasil', regiao: 'DOMESTICO' },
  RAO: { iata: 'RAO', codigoLink: 'RAO', nome: 'Aeroporto Estadual Leite Lopes', cidade: 'Ribeirão Preto', pais: 'Brasil', regiao: 'DOMESTICO' },
  SJP: { iata: 'SJP', codigoLink: 'SJP', nome: 'Aeroporto Estadual de São José do Rio Preto', cidade: 'São José do Rio Preto', pais: 'Brasil', regiao: 'DOMESTICO' },
  BPS: { iata: 'BPS', codigoLink: 'BPS', nome: 'Aeroporto de Porto Seguro', cidade: 'Porto Seguro', pais: 'Brasil', regiao: 'DOMESTICO' },
  FEN: { iata: 'FEN', codigoLink: 'FEN', nome: 'Aeroporto de Fernando de Noronha', cidade: 'Fernando de Noronha', pais: 'Brasil', regiao: 'DOMESTICO' },
  GYN: { iata: 'GYN', codigoLink: 'GYN', nome: 'Aeroporto Santa Genoveva', cidade: 'Goiânia', pais: 'Brasil', regiao: 'DOMESTICO' },
  CGB: { iata: 'CGB', codigoLink: 'CGB', nome: 'Aeroporto Internacional Marechal Rondon', cidade: 'Cuiabá', pais: 'Brasil', regiao: 'DOMESTICO' },
  CGR: { iata: 'CGR', codigoLink: 'CGR', nome: 'Aeroporto Internacional de Campo Grande', cidade: 'Campo Grande', pais: 'Brasil', regiao: 'DOMESTICO' },

  // AMÉRICA DO SUL
  BUE: { iata: 'BUE', codigoLink: 'EZE', nome: 'Aeroportos de Buenos Aires (Ezeiza/Aeroparque)', cidade: 'Buenos Aires', pais: 'Argentina', regiao: 'AMERICA_SUL', fisicos: ['EZE', 'AEP'] },
  EZE: { iata: 'EZE', codigoLink: 'EZE', nome: 'Aeroporto Internacional Ministro Pistarini (Ezeiza)', cidade: 'Buenos Aires', pais: 'Argentina', regiao: 'AMERICA_SUL' },
  AEP: { iata: 'AEP', codigoLink: 'AEP', nome: 'Aeroparque Jorge Newbery', cidade: 'Buenos Aires', pais: 'Argentina', regiao: 'AMERICA_SUL' },
  SCL: { iata: 'SCL', codigoLink: 'SCL', nome: 'Aeroporto Internacional Arturo Merino Benítez', cidade: 'Santiago', pais: 'Chile', regiao: 'AMERICA_SUL' },
  MVD: { iata: 'MVD', codigoLink: 'MVD', nome: 'Aeroporto Internacional de Carrasco', cidade: 'Montevidéu', pais: 'Uruguai', regiao: 'AMERICA_SUL' },
  LIM: { iata: 'LIM', codigoLink: 'LIM', nome: 'Aeroporto Internacional Jorge Chávez', cidade: 'Lima', pais: 'Peru', regiao: 'AMERICA_SUL' },
  BOG: { iata: 'BOG', codigoLink: 'BOG', nome: 'Aeroporto Internacional El Dorado', cidade: 'Bogotá', pais: 'Colômbia', regiao: 'AMERICA_SUL' },
  MDE: { iata: 'MDE', codigoLink: 'MDE', nome: 'Aeroporto Internacional José María Córdova', cidade: 'Medellín', pais: 'Colômbia', regiao: 'AMERICA_SUL' },
  CTG: { iata: 'CTG', codigoLink: 'CTG', nome: 'Aeroporto Internacional Rafael Núñez', cidade: 'Cartagena', pais: 'Colômbia', regiao: 'AMERICA_SUL' },
  ASU: { iata: 'ASU', codigoLink: 'ASU', nome: 'Aeroporto Internacional Silvio Pettirossi', cidade: 'Assunção', pais: 'Paraguai', regiao: 'AMERICA_SUL' },
  UIO: { iata: 'UIO', codigoLink: 'UIO', nome: 'Aeroporto Internacional Mariscal Sucre', cidade: 'Quito', pais: 'Equador', regiao: 'AMERICA_SUL' },
  GYE: { iata: 'GYE', codigoLink: 'GYE', nome: 'Aeroporto Internacional José Joaquín de Olmedo', cidade: 'Guayaquil', pais: 'Equador', regiao: 'AMERICA_SUL' },
  MDZ: { iata: 'MDZ', codigoLink: 'MDZ', nome: 'Aeroporto Internacional El Plumerillo', cidade: 'Mendoza', pais: 'Argentina', regiao: 'AMERICA_SUL' },
  BRC: { iata: 'BRC', codigoLink: 'BRC', nome: 'Aeroporto Internacional Teniente Luis Candelaria', cidade: 'Bariloche', pais: 'Argentina', regiao: 'AMERICA_SUL' },
  COR: { iata: 'COR', codigoLink: 'COR', nome: 'Aeroporto Internacional Ingeniero Taravella', cidade: 'Córdoba', pais: 'Argentina', regiao: 'AMERICA_SUL' },
  ROS: { iata: 'ROS', codigoLink: 'ROS', nome: 'Aeroporto Internacional Islas Malvinas', cidade: 'Rosário', pais: 'Argentina', regiao: 'AMERICA_SUL' },

  // EUROPA
  LIS: { iata: 'LIS', codigoLink: 'LIS', nome: 'Aeroporto Humberto Delgado', cidade: 'Lisboa', pais: 'Portugal', regiao: 'EUROPA' },
  OPO: { iata: 'OPO', codigoLink: 'OPO', nome: 'Aeroporto Francisco Sá Carneiro', cidade: 'Porto', pais: 'Portugal', regiao: 'EUROPA' },
  MAD: { iata: 'MAD', codigoLink: 'MAD', nome: 'Aeroporto Adolfo Suárez Madrid-Barajas', cidade: 'Madrid', pais: 'Espanha', regiao: 'EUROPA' },
  BCN: { iata: 'BCN', codigoLink: 'BCN', nome: 'Aeroporto Josep Tarradellas Barcelona-El Prat', cidade: 'Barcelona', pais: 'Espanha', regiao: 'EUROPA' },
  PAR: { iata: 'PAR', codigoLink: 'CDG', nome: 'Aeroportos de Paris (Charles de Gaulle/Orly)', cidade: 'Paris', pais: 'França', regiao: 'EUROPA', fisicos: ['CDG', 'ORY'] },
  CDG: { iata: 'CDG', codigoLink: 'CDG', nome: 'Aeroporto Internacional Charles de Gaulle', cidade: 'Paris', pais: 'França', regiao: 'EUROPA' },
  ORY: { iata: 'ORY', codigoLink: 'ORY', nome: 'Aeroporto de Paris-Orly', cidade: 'Paris', pais: 'França', regiao: 'EUROPA' },
  ROM: { iata: 'ROM', codigoLink: 'FCO', nome: 'Aeroportos de Roma (Fiumicino/Ciampino)', cidade: 'Roma', pais: 'Itália', regiao: 'EUROPA', fisicos: ['FCO', 'CIA'] },
  FCO: { iata: 'FCO', codigoLink: 'FCO', nome: 'Aeroporto Internacional Leonardo da Vinci (Fiumicino)', cidade: 'Roma', pais: 'Itália', regiao: 'EUROPA' },
  CIA: { iata: 'CIA', codigoLink: 'CIA', nome: 'Aeroporto de Roma-Ciampino', cidade: 'Roma', pais: 'Itália', regiao: 'EUROPA' },
  MIL: { iata: 'MIL', codigoLink: 'MXP', nome: 'Aeroportos de Milão (Malpensa/Linate)', cidade: 'Milão', pais: 'Itália', regiao: 'EUROPA', fisicos: ['MXP', 'LIN'] },
  MXP: { iata: 'MXP', codigoLink: 'MXP', nome: 'Aeroporto de Milão-Malpensa', cidade: 'Milão', pais: 'Itália', regiao: 'EUROPA' },
  LIN: { iata: 'LIN', codigoLink: 'LIN', nome: 'Aeroporto de Milão-Linate', cidade: 'Milão', pais: 'Itália', regiao: 'EUROPA' },
  LON: { iata: 'LON', codigoLink: 'LHR', nome: 'Aeroportos de Londres (Heathrow/Gatwick)', cidade: 'Londres', pais: 'Reino Unido', regiao: 'EUROPA', fisicos: ['LHR', 'LGW'] },
  LHR: { iata: 'LHR', codigoLink: 'LHR', nome: 'Aeroporto de Londres-Heathrow', cidade: 'Londres', pais: 'Reino Unido', regiao: 'EUROPA' },
  LGW: { iata: 'LGW', codigoLink: 'LGW', nome: 'Aeroporto de Londres-Gatwick', cidade: 'Londres', pais: 'Reino Unido', regiao: 'EUROPA' },
  AMS: { iata: 'AMS', codigoLink: 'AMS', nome: 'Aeroporto de Amsterdã-Schiphol', cidade: 'Amsterdã', pais: 'Holanda', regiao: 'EUROPA' },
  FRA: { iata: 'FRA', codigoLink: 'FRA', nome: 'Aeroporto de Frankfurt', cidade: 'Frankfurt', pais: 'Alemanha', regiao: 'EUROPA' },
  BER: { iata: 'BER', codigoLink: 'BER', nome: 'Aeroporto de Berlim-Brandemburgo', cidade: 'Berlim', pais: 'Alemanha', regiao: 'EUROPA' },
  MUC: { iata: 'MUC', codigoLink: 'MUC', nome: 'Aeroporto de Munique Franz Josef Strauss', cidade: 'Munique', pais: 'Alemanha', regiao: 'EUROPA' },
  ZRH: { iata: 'ZRH', codigoLink: 'ZRH', nome: 'Aeroporto de Zurique-Kloten', cidade: 'Zurique', pais: 'Suíça', regiao: 'EUROPA' },
  VIE: { iata: 'VIE', codigoLink: 'VIE', nome: 'Aeroporto Internacional de Viena', cidade: 'Viena', pais: 'Áustria', regiao: 'EUROPA' },
  DUB: { iata: 'DUB', codigoLink: 'DUB', nome: 'Aeroporto de Dublin', cidade: 'Dublin', pais: 'Irlanda', regiao: 'EUROPA' },
  ATH: { iata: 'ATH', codigoLink: 'ATH', nome: 'Aeroporto Internacional de Atenas Eleftherios Venizelos', cidade: 'Atenas', pais: 'Grécia', regiao: 'EUROPA' },

  // AMÉRICA DO NORTE
  MIA: { iata: 'MIA', codigoLink: 'MIA', nome: 'Aeroporto Internacional de Miami', cidade: 'Miami', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  MCO: { iata: 'MCO', codigoLink: 'MCO', nome: 'Aeroporto Internacional de Orlando', cidade: 'Orlando', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  NYC: { iata: 'NYC', codigoLink: 'JFK', nome: 'Aeroportos de Nova York (JFK/Newark/LaGuardia)', cidade: 'Nova York', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE', fisicos: ['JFK', 'EWR', 'LGA'] },
  JFK: { iata: 'JFK', codigoLink: 'JFK', nome: 'Aeroporto Internacional John F. Kennedy', cidade: 'Nova York', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  EWR: { iata: 'EWR', codigoLink: 'EWR', nome: 'Aeroporto Internacional de Newark Liberty', cidade: 'Newark', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  LAX: { iata: 'LAX', codigoLink: 'LAX', nome: 'Aeroporto Internacional de Los Angeles', cidade: 'Los Angeles', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  SFO: { iata: 'SFO', codigoLink: 'SFO', nome: 'Aeroporto Internacional de San Francisco', cidade: 'San Francisco', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  ORD: { iata: 'ORD', codigoLink: 'ORD', nome: 'Aeroporto Internacional O\'Hare', cidade: 'Chicago', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  CHI: { iata: 'CHI', codigoLink: 'ORD', nome: 'Aeroportos de Chicago (O\'Hare/Midway)', cidade: 'Chicago', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE', fisicos: ['ORD', 'MDW'] },
  WAS: { iata: 'WAS', codigoLink: 'IAD', nome: 'Aeroportos de Washington (Dulles/Reagan)', cidade: 'Washington', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE', fisicos: ['IAD', 'DCA'] },
  IAD: { iata: 'IAD', codigoLink: 'IAD', nome: 'Aeroporto Internacional Washington Dulles', cidade: 'Washington', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  BOS: { iata: 'BOS', codigoLink: 'BOS', nome: 'Aeroporto Internacional Logan', cidade: 'Boston', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  ATL: { iata: 'ATL', codigoLink: 'ATL', nome: 'Aeroporto Internacional Hartsfield-Jackson', cidade: 'Atlanta', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  DFW: { iata: 'DFW', codigoLink: 'DFW', nome: 'Aeroporto Internacional Dallas/Fort Worth', cidade: 'Dallas', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  LAS: { iata: 'LAS', codigoLink: 'LAS', nome: 'Aeroporto Internacional Harry Reid', cidade: 'Las Vegas', pais: 'Estados Unidos', regiao: 'AMERICA_NORTE' },
  YYZ: { iata: 'YYZ', codigoLink: 'YYZ', nome: 'Aeroporto Internacional Toronto Pearson', cidade: 'Toronto', pais: 'Canadá', regiao: 'AMERICA_NORTE' },
  YUL: { iata: 'YUL', codigoLink: 'YUL', nome: 'Aeroporto Internacional Montréal-Trudeau', cidade: 'Montreal', pais: 'Canadá', regiao: 'AMERICA_NORTE' },

  // CARIBE & AMÉRICA CENTRAL
  CUN: { iata: 'CUN', codigoLink: 'CUN', nome: 'Aeroporto Internacional de Cancún', cidade: 'Cancún', pais: 'México', regiao: 'CARIBE_AMERICA_CENTRAL' },
  PUJ: { iata: 'PUJ', codigoLink: 'PUJ', nome: 'Aeroporto Internacional de Punta Cana', cidade: 'Punta Cana', pais: 'República Dominicana', regiao: 'CARIBE_AMERICA_CENTRAL' },
  SDQ: { iata: 'SDQ', codigoLink: 'SDQ', nome: 'Aeroporto Internacional Las Américas', cidade: 'Santo Domingo', pais: 'República Dominicana', regiao: 'CARIBE_AMERICA_CENTRAL' },
  PTY: { iata: 'PTY', codigoLink: 'PTY', nome: 'Aeroporto Internacional de Tocumen', cidade: 'Cidade do Panamá', pais: 'Panamá', regiao: 'CARIBE_AMERICA_CENTRAL' },
  SJO: { iata: 'SJO', codigoLink: 'SJO', nome: 'Aeroporto Internacional Juan Santamaría', cidade: 'San José', pais: 'Costa Rica', regiao: 'CARIBE_AMERICA_CENTRAL' },
  HAV: { iata: 'HAV', codigoLink: 'HAV', nome: 'Aeroporto Internacional José Martí', cidade: 'Havana', pais: 'Cuba', regiao: 'CARIBE_AMERICA_CENTRAL' },
  AUA: { iata: 'AUA', codigoLink: 'AUA', nome: 'Aeroporto Internacional Rainha Beatrix', cidade: 'Oranjestad', pais: 'Aruba', regiao: 'CARIBE_AMERICA_CENTRAL' },

  // ÁSIA, ORIENTE MÉDIO & OCEANIA
  TYO: { iata: 'TYO', codigoLink: 'NRT', nome: 'Aeroportos de Tóquio (Narita/Haneda)', cidade: 'Tóquio', pais: 'Japão', regiao: 'ASIA_OCEANIA', fisicos: ['NRT', 'HND'] },
  NRT: { iata: 'NRT', codigoLink: 'NRT', nome: 'Aeroporto Internacional de Narita', cidade: 'Tóquio', pais: 'Japão', regiao: 'ASIA_OCEANIA' },
  HND: { iata: 'HND', codigoLink: 'HND', nome: 'Aeroporto de Tóquio-Haneda', cidade: 'Tóquio', pais: 'Japão', regiao: 'ASIA_OCEANIA' },
  DXB: { iata: 'DXB', codigoLink: 'DXB', nome: 'Aeroporto Internacional de Dubai', cidade: 'Dubai', pais: 'Emirados Árabes Unidos', regiao: 'ORIENTE_MEDIO' },
  DOH: { iata: 'DOH', codigoLink: 'DOH', nome: 'Aeroporto Internacional Hamad', cidade: 'Doha', pais: 'Catar', regiao: 'ORIENTE_MEDIO' },
  BKK: { iata: 'BKK', codigoLink: 'BKK', nome: 'Aeroporto Internacional de Suvarnabhumi', cidade: 'Bangkok', pais: 'Tailândia', regiao: 'ASIA_OCEANIA' },
  SIN: { iata: 'SIN', codigoLink: 'SIN', nome: 'Aeroporto Internacional de Changi', cidade: 'Cingapura', pais: 'Cingapura', regiao: 'ASIA_OCEANIA' },
  SYD: { iata: 'SYD', codigoLink: 'SYD', nome: 'Aeroporto Internacional de Sydney Kingsford Smith', cidade: 'Sydney', pais: 'Austrália', regiao: 'ASIA_OCEANIA' }
};

// Mapeamento canônico de continentes / macrorregiões para hubs concretos de referência
export const HUBS_REGIOES_CANONICOS = {
  AMERICA_SUL: { iata: 'EZE', codigoLink: 'EZE', cidade: 'Buenos Aires', pais: 'Argentina', nome: 'Aeroporto Internacional Ezeiza (EZE)' },
  '/M/06_1': { iata: 'EZE', codigoLink: 'EZE', cidade: 'Buenos Aires', pais: 'Argentina', nome: 'Aeroporto Internacional Ezeiza (EZE)' },
  'AMERICA DO SUL': { iata: 'EZE', codigoLink: 'EZE', cidade: 'Buenos Aires', pais: 'Argentina', nome: 'Aeroporto Internacional Ezeiza (EZE)' },

  EUROPA: { iata: 'MAD', codigoLink: 'MAD', cidade: 'Madrid', pais: 'Espanha', nome: 'Aeroporto Adolfo Suárez Madrid-Barajas (MAD)' },
  '/M/02J9Z': { iata: 'MAD', codigoLink: 'MAD', cidade: 'Madrid', pais: 'Espanha', nome: 'Aeroporto Adolfo Suárez Madrid-Barajas (MAD)' },

  AMERICA_NORTE: { iata: 'MIA', codigoLink: 'MIA', cidade: 'Miami', pais: 'Estados Unidos', nome: 'Aeroporto Internacional de Miami (MIA)' },
  '/M/09C7W0': { iata: 'MIA', codigoLink: 'MIA', cidade: 'Miami', pais: 'Estados Unidos', nome: 'Aeroporto Internacional de Miami (MIA)' },
  'ESTADOS UNIDOS': { iata: 'MIA', codigoLink: 'MIA', cidade: 'Miami', pais: 'Estados Unidos', nome: 'Aeroporto Internacional de Miami (MIA)' },

  CARIBE_AMERICA_CENTRAL: { iata: 'CUN', codigoLink: 'CUN', cidade: 'Cancún', pais: 'México', nome: 'Aeroporto Internacional de Cancún (CUN)' },
  ORIENTE_MEDIO: { iata: 'DXB', codigoLink: 'DXB', cidade: 'Dubai', pais: 'Emirados Árabes Unidos', nome: 'Aeroporto Internacional de Dubai (DXB)' },
  ASIA_OCEANIA: { iata: 'TYO', codigoLink: 'NRT', cidade: 'Tóquio', pais: 'Japão', nome: 'Aeroporto Internacional de Narita (NRT)' },
  '/M/02J1X': { iata: 'TYO', codigoLink: 'NRT', cidade: 'Tóquio', pais: 'Japão', nome: 'Aeroporto Internacional de Narita (NRT)' },
  DOMESTICO: { iata: 'SAO', codigoLink: 'GRU', cidade: 'São Paulo', pais: 'Brasil', nome: 'Aeroporto Internacional de Guarulhos (GRU)' }
};

/**
 * Normaliza string removendo acentos e espaços extras
 */
function normalizar(texto) {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resolve informações ricas completas de qualquer código IATA, metropolitano, cidade ou KGMID
 */
export function obterInfoAeroporto(codigoOuNome) {
  if (!codigoOuNome) return null;

  let entrada = codigoOuNome;
  if (typeof entrada === 'object' && entrada !== null) {
    entrada = entrada.iata || entrada.codigo || entrada.code || entrada.airport || entrada.cidade || entrada.city || entrada.nome || entrada.name || '';
    if (!entrada || typeof entrada !== 'string') return null;
  }

  const limpo = normalizar(entrada);
  if (!limpo) return null;

  // 1. Match direto no catálogo por IATA
  if (CATALOGO_AEROPORTOS[limpo]) {
    return { ...CATALOGO_AEROPORTOS[limpo] };
  }

  // 2. Extrair código de 3 letras entre parênteses (ex: "Buenos Aires (EZE)", "Doha (DOH)", "Reykjavik (KEF)")
  const matchParenteses = limpo.match(/\(([A-Z]{3})\)/);
  if (matchParenteses) {
    const cod = matchParenteses[1];
    if (CATALOGO_AEROPORTOS[cod]) {
      return { ...CATALOGO_AEROPORTOS[cod] };
    }
    const nomeCidade = String(entrada).replace(/\s*\([A-Za-z]{3}\).*/, '').trim();
    return {
      iata: cod,
      codigoLink: cod,
      nome: nomeCidade ? `Aeroporto de ${nomeCidade} (${cod})` : `Aeroporto ${cod}`,
      cidade: nomeCidade || cod,
      pais: 'Destino Internacional',
      regiao: 'OUTRO'
    };
  }

  // 3. Match por separadores traço ou barra com IATA de 3 letras (ex: "AKL - Auckland", "Hamad / DOH")
  const matchSeparador = limpo.match(/^([A-Z]{3})\s*[-/]/) || limpo.match(/[-/]\s*([A-Z]{3})$/);
  if (matchSeparador) {
    const cod = matchSeparador[1];
    if (CATALOGO_AEROPORTOS[cod]) {
      return { ...CATALOGO_AEROPORTOS[cod] };
    }
    return {
      iata: cod,
      codigoLink: cod,
      nome: `Aeroporto ${cod}`,
      cidade: cod,
      pais: 'Destino Internacional',
      regiao: 'OUTRO'
    };
  }

  // 4. Match por nome da cidade no catálogo
  for (const info of Object.values(CATALOGO_AEROPORTOS)) {
    if (normalizar(info.cidade) === limpo) {
      return { ...info };
    }
  }

  // 5. Match por hub regional / continente canônico
  if (HUBS_REGIOES_CANONICOS[limpo]) {
    return { ...HUBS_REGIOES_CANONICOS[limpo] };
  }

  // 6. Se for código de 3 letras desconhecido, devolve estrutura padrão defensiva
  if (/^[A-Z]{3}$/.test(limpo)) {
    return {
      iata: limpo,
      codigoLink: limpo,
      nome: `Aeroporto ${limpo}`,
      cidade: limpo,
      pais: 'Destino Internacional',
      regiao: 'OUTRO'
    };
  }

  return null;
}

/**
 * Resolve com precisão o Destino Concreto do voo (NUNCA genérico)
 * Mescla o destino cadastrado na rota, a oferta e o código IATA real retornado
 */
export function resolverDestinoConcreto(opcoes = {}) {
  const opts = (typeof opcoes === 'string')
    ? { destino: opcoes, codigoDestino: opcoes }
    : (opcoes && typeof opcoes === 'object' && !Array.isArray(opcoes) ? opcoes : {});

  const { destino, codigoDestino, destinoReal = null, codigoDestinoReal = null } = opts;

  // 1. Se veio codigoDestinoReal concreto (ex: retornado pela SerpApi: "SCL", "EZE"), prioridade máxima
  if (codigoDestinoReal) {
    const infoCodigo = obterInfoAeroporto(codigoDestinoReal);
    if (infoCodigo) return infoCodigo;
  }

  // 2. Se veio um destinoReal concreto (ex: retornado pela SerpApi ou Direct), busca info
  if (destinoReal) {
    const infoReal = obterInfoAeroporto(destinoReal);
    if (infoReal) return infoReal;
  }

  // 3. Se o codigoDestino for um aeroporto ou metrópole concreta (ex: BUE, SCL, MAD, LIS, BEL)
  if (codigoDestino && CATALOGO_AEROPORTOS[normalizar(codigoDestino)]) {
    return { ...CATALOGO_AEROPORTOS[normalizar(codigoDestino)] };
  }

  // 4. Se destino for nome de cidade concreta (ex: "Buenos Aires", "Madrid")
  const infoNome = obterInfoAeroporto(destino);
  if (infoNome) return infoNome;

  // 5. Se for continente ou região genérica (ex: "América do Sul", "/m/06_1", "Europa")
  const infoHub = HUBS_REGIOES_CANONICOS[normalizar(codigoDestino)] || HUBS_REGIOES_CANONICOS[normalizar(destino)];
  if (infoHub) return infoHub;

  // Fallback seguro com sanitização defensiva de strings
  const codFallback = codigoDestino ? String(codigoDestino).trim().toUpperCase() : '';
  const nomeFallback = destino ? String(destino).trim() : (codFallback || 'Destino');

  return {
    iata: codFallback || 'DEST',
    codigoLink: codFallback || 'DEST',
    nome: nomeFallback,
    cidade: nomeFallback,
    pais: 'Internacional',
    regiao: 'OUTRO'
  };
}

/**
 * Formata datas do voo de forma clara e amigável (DD/MM/AAAA)
 */
export function formatarPeriodoViagem(dataIdaStr, dataVoltaStr) {
  if (!dataIdaStr) return 'Data a Definir';
  const idaNorm = formatarDataParaBusca(dataIdaStr);
  if (!idaNorm) return 'Data a Definir';

  function fmtData(normStr) {
    if (normStr && /^\d{4}-\d{2}-\d{2}$/.test(normStr)) {
      const [ano, mes, dia] = normStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    return '';
  }

  const idaFmt = fmtData(idaNorm);
  const voltaTrim = typeof dataVoltaStr === 'string' ? dataVoltaStr.trim() : (dataVoltaStr !== null && dataVoltaStr !== undefined ? String(dataVoltaStr).trim() : '');
  const soIda = ehSoIda(voltaTrim);

  if (soIda || !voltaTrim) {
    return `Ida: ${idaFmt} (Só Ida)`;
  }

  // Resolve volta (pode ser número de dias como "14 dias", ou data YYYY-MM-DD / DD/MM/AAAA)
  const voltaCalculada = calcularDataVolta(idaNorm, dataVoltaStr);
  const voltaNorm = voltaCalculada || formatarDataParaBusca(dataVoltaStr);

  if (!voltaNorm || voltaNorm < idaNorm) {
    return `Ida: ${idaFmt} (Só Ida)`;
  }

  const voltaFmt = fmtData(voltaNorm);

  // Calcular duração em dias de forma consistente via UTC
  try {
    const [ano1, mes1, dia1] = idaNorm.split('-').map(Number);
    const [ano2, mes2, dia2] = voltaNorm.split('-').map(Number);
    const d1 = new Date(Date.UTC(ano1, mes1 - 1, dia1));
    const d2 = new Date(Date.UTC(ano2, mes2 - 1, dia2));
    const diffDias = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    const labelDias = diffDias > 0 ? (diffDias === 1 ? ' (1 dia)' : ` (${diffDias} dias)`) : '';
    return `Ida: ${idaFmt} ➔ Volta: ${voltaFmt}${labelDias}`;
  } catch (_) {
    return `Ida: ${idaFmt} ➔ Volta: ${voltaFmt}`;
  }
}

/**
 * Monta os dados enriquecidos de um Bug Fare para persistência, notificação e cockpit
 * GARANTIA: NUNCA exibe termos genéricos ("América do Sul", "Europa"). Sempre explicita:
 * - Cidade e País
 * - Aeroporto de Chegada (IATA e Nome)
 * - Datas Completas
 * - Link Canônico no Google Flights que abre direto no voo
 */
export function montarCardBugFare({
  origem,
  codigoOrigem,
  destino,
  codigoDestino,
  dataIda,
  dataVolta = null,
  preco,
  motivo,
  tipo = '🚨 BUG FARE ESTRUTURAL (TARIFA IRREAL)',
  destinoReal = null,
  codigoDestinoReal = null,
  linkOriginal = null
}) {
  const origemInfo = obterInfoAeroporto(codigoOrigem) || obterInfoAeroporto(origem) || {
    iata: codigoOrigem || 'SAO',
    codigoLink: codigoOrigem || 'SAO',
    cidade: origem || 'São Paulo',
    pais: 'Brasil',
    nome: 'Aeroporto de Origem'
  };

  const destinoInfo = resolverDestinoConcreto({
    destino,
    codigoDestino,
    destinoReal,
    codigoDestinoReal
  });

  const periodoTexto = formatarPeriodoViagem(dataIda, dataVolta);
  const precoFmt = Number(preco).toFixed(0);

  // Código concreto para o link do Google Flights (ex: EZE em vez de /m/06_1)
  const origemLink = origemInfo.codigoLink || origemInfo.iata || 'SAO';
  const destinoLink = destinoInfo.codigoLink || destinoInfo.iata || 'EZE';

  // Gerar link 100% canônico (Prioriza Protobuf tfs Cheapest, com fallback para query estruturada correta)
  const soIda = ehSoIda(dataVolta);
  const voltaEfetiva = soIda ? null : dataVolta;

  let linkGoogleFlights = null;
  if (dataIda) {
    linkGoogleFlights = gerarLinkGoogleFlightsCheapest(origemLink, destinoLink, dataIda, voltaEfetiva);
  }
  if (!linkGoogleFlights) {
    linkGoogleFlights = gerarLinkGoogleFlights(origemLink, destinoLink, dataIda, voltaEfetiva);
  }

  // Se o destino cadastrado na rota foi uma macrorregião (ex: América do Sul), acrescenta o contexto
  const destinoNorm = normalizar(destino);
  const cidadeNorm = normalizar(destinoInfo.cidade);
  const iataNorm = normalizar(destinoInfo.iata);
  const ehRegiaoMacro = destino && destinoNorm !== cidadeNorm && destinoNorm !== iataNorm && !destinoNorm.includes(cidadeNorm);
  const labelMacro = ehRegiaoMacro ? ` (${destino})` : '';

  // Título canônico NÃO GENÉRICO contendo cidade, país e IATA real
  const tituloCompleto = `🚨 BUG FARE: ${origemInfo.cidade} ➔ ${destinoInfo.cidade}, ${destinoInfo.pais} (${destinoInfo.iata})${labelMacro} por R$ ${precoFmt}!`;

  return {
    titulo: tituloCompleto,
    link: linkGoogleFlights,
    tipo,
    motivo: motivo || `Tarifa anômala de R$ ${precoFmt}`,
    preco: Number(preco),
    origem: `${origemInfo.cidade} (${origemInfo.iata})`,
    destino: `${destinoInfo.cidade}, ${destinoInfo.pais}`,
    aeroporto_chegada: `${destinoInfo.iata} - ${destinoInfo.nome}`,
    pais_destino: destinoInfo.pais,
    cidade_destino: destinoInfo.cidade,
    data_ida: dataIda,
    data_volta: voltaEfetiva,
    periodo_texto: periodoTexto,
    iata_origem: origemLink,
    iata_destino: destinoLink
  };
}
