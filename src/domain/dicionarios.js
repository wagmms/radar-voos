/**
 * DOMÍNIO: Dicionários e Conhecimento Canônico de Aviação e Viagens
 */

// Resolução Metropolitana Universal (cobre cidades com múltiplos aeroportos sem falso negativo)
export const DICIONARIO_CIDADES = {
  "sao paulo": "SAO", "sp": "SAO", "sampa": "SAO", // Cobre GRU, CGH e VCP
  "rio de janeiro": "RIO", "rio": "RIO", "rj": "RIO", // Cobre GIG e SDU
  "buenos aires": "BUE", "bue": "BUE", // Cobre AEP e EZE
  "londres": "LON", // Cobre LHR, LGW, STN, LTN, LCY
  "nova york": "NYC", "ny": "NYC", "nyc": "NYC", // Cobre JFK, EWR, LGA
  "paris": "PAR", // Cobre CDG, ORY, BVA
  "milao": "MIL", // Cobre MXP, LIN, BGY
  "roma": "ROM", // Cobre FCO, CIA
  "toquio": "TYO", // Cobre HND, NRT
  "washington": "WAS", // Cobre IAD, DCA, BWI
  "chicago": "CHI", // Cobre ORD, MDW
  "belo horizonte": "BHZ", "bh": "BHZ", // Cobre CNF e PLU

  "ribeirao preto": "RAO", "ribeirao": "RAO",
  "campinas": "VCP",
  "sao jose do rio preto": "SJP",
  "bauru": "JTC", "marilia": "MII", "presidente prudente": "PPB",
  "uberlandia": "UDI", "vitoria": "VIX",
  "belem": "BEL", "manaus": "MAO", "porto velho": "PVH",
  "palmas": "PMW", "macapa": "MCP", "boa vista": "BVB", "rio branco": "RBR",
  "salvador": "SSA", "recife": "REC", "fortaleza": "FOR",
  "natal": "NAT", "maceio": "MCZ", "joao pessoa": "JPA",
  "aracaju": "AJU", "teresina": "THE", "sao luis": "SLZ",
  "porto seguro": "BPS", "fernando de noronha": "FEN",
  "brasilia": "BSB", "bsb": "BSB", "goiania": "GYN",
  "cuiaba": "CGB", "campo grande": "CGR",
  "curitiba": "CWB", "porto alegre": "POA",
  "florianopolis": "FLN", "floripa": "FLN", "navegantes": "NVT",
  "foz do iguacu": "IGU", "londrina": "LDB", "maringa": "MGF",
  "chapeco": "XAP", "caxias do sul": "CXJ", "joinville": "JOI",

  "santiago": "SCL", "scl": "SCL",
  "montevideu": "MVD", "montevideo": "MVD",
  "bariloche": "BRC", "mendoza": "MDZ",
  "lima": "LIM", "bogota": "BOG",
  "cancun": "CUN", "punta cana": "PUJ",
  "lisboa": "LIS", "porto": "OPO",
  "madrid": "MAD", "madri": "MAD", "barcelona": "BCN",
  "amsterdam": "AMS", "frankfurt": "FRA", "zurique": "ZRH",
  "miami": "MIA", "orlando": "MCO",
  "los angeles": "LAX", "san francisco": "SFO"
};

// Destinos Canônicos por Continente / Macrorregião (busca abrangente e representativa)
export const DESTINOS_CONTINENTES = Object.freeze({
  AMERICA_SUL: Object.freeze(['EZE', 'AEP', 'SCL', 'MVD', 'LIM', 'BOG', 'ASU', 'MDZ', 'BRC']),
  EUROPA: Object.freeze(['LIS', 'OPO', 'MAD', 'BCN', 'CDG', 'FCO', 'MXP', 'LHR', 'AMS', 'FRA']),
  AMERICA_NORTE: Object.freeze(['MIA', 'MCO', 'JFK', 'EWR', 'LAX', 'ORD', 'BOS']),
  ASIA: Object.freeze(['TYO', 'NRT', 'HND', 'BKK', 'SIN', 'DXB', 'DOH'])
});

// Mapeamento de Cidades Metropolitanas e Continentes para Aeroportos Físicos exigidos pela SerpAPI/Provedores
export const MAPA_AEROPORTOS_SERPAPI = {
  "SAO": "GRU,CGH",
  "RIO": "GIG,SDU",
  "BUE": "EZE,AEP",
  "LON": "LHR,LGW",
  "NYC": "JFK,EWR,LGA",
  "PAR": "CDG,ORY",
  "MIL": "MXP,LIN",
  "ROM": "FCO,CIA",
  "TYO": "HND,NRT",
  "WAS": "IAD,DCA",
  "CHI": "ORD,MDW",
  "BHZ": "CNF",

  // Continentes e Macrorregiões (varredura de múltiplos aeroportos para todo o continente)
  "/M/06_1": DESTINOS_CONTINENTES.AMERICA_SUL.join(','),
  "AMERICA DO SUL": DESTINOS_CONTINENTES.AMERICA_SUL.join(','),
  "SOUTH AMERICA": DESTINOS_CONTINENTES.AMERICA_SUL.join(','),

  "/M/02J9Z": DESTINOS_CONTINENTES.EUROPA.join(','),
  "EUROPA": DESTINOS_CONTINENTES.EUROPA.join(','),
  "EUROPE": DESTINOS_CONTINENTES.EUROPA.join(','),

  "/M/09C7W0": DESTINOS_CONTINENTES.AMERICA_NORTE.join(','),
  "ESTADOS UNIDOS": DESTINOS_CONTINENTES.AMERICA_NORTE.join(','),
  "USA": DESTINOS_CONTINENTES.AMERICA_NORTE.join(','),

  "/M/02J1X": DESTINOS_CONTINENTES.ASIA.join(','),
  "ASIA": DESTINOS_CONTINENTES.ASIA.join(',')
};

// Regiões e Países (IDs KGMID/Freebase para busca abrangente no Google Flights)
export const DICIONARIO_REGIOES = {
  "europa": "/m/02j9z",
  "estados unidos": "/m/09c7w0",
  "eua": "/m/09c7w0",
  "usa": "/m/09c7w0",
  "asia": "/m/02j1x",
  "america do sul": "/m/06_1",
  "portugal": "/m/05r4w",
  "espanha": "/m/06mkj",
  "franca": "/m/0f8l9c",
  "italia": "/m/03rjj",
  "chile": "/m/01n7q",
  "argentina": "BUE",
  "uruguai": "MVD",
  "peru": "LIM",
  "colombia": "BOG",
  "caribe": "CUN,PUJ"
};

// Custo Diário Médio no Destino (em R$, considerando hospedagem econômica + refeições + transporte local)
export const DICIONARIO_CUSTO_DESTINO = {
  "buenos aires": { texto: "🟢 $ Econômico (~R$ 180/dia)", diario: 180 },
  "argentina": { texto: "🟢 $ Econômico (~R$ 180/dia)", diario: 180 },
  "mendoza": { texto: "🟢 $ Econômico (~R$ 220/dia)", diario: 220 },
  "bariloche": { texto: "🟢 $ Econômico (~R$ 250/dia)", diario: 250 },
  "santiago": { texto: "🟢 $ Econômico (~R$ 240/dia)", diario: 240 },
  "chile": { texto: "🟢 $ Econômico (~R$ 240/dia)", diario: 240 },
  "lima": { texto: "🟢 $ Econômico (~R$ 190/dia)", diario: 190 },
  "peru": { texto: "🟢 $ Econômico (~R$ 190/dia)", diario: 190 },
  "bogota": { texto: "🟢 $ Econômico (~R$ 180/dia)", diario: 180 },
  "colombia": { texto: "🟢 $ Econômico (~R$ 180/dia)", diario: 180 },
  "america do sul": { texto: "🟢 $ Econômico (~R$ 200/dia)", diario: 200 },
  "asia": { texto: "🟡 $$ Moderado (~R$ 350/dia)", diario: 350 },
  "belem": { texto: "🟢 $ Nacional (~R$ 170/dia)", diario: 170 },
  "ribeirao preto": { texto: "🟢 $ Nacional (~R$ 160/dia)", diario: 160 },
  "curitiba": { texto: "🟢 $ Nacional (~R$ 190/dia)", diario: 190 },
  "salvador": { texto: "🟢 $ Nacional (~R$ 180/dia)", diario: 180 },
  "recife": { texto: "🟢 $ Nacional (~R$ 180/dia)", diario: 180 },
  "fortaleza": { texto: "🟢 $ Nacional (~R$ 180/dia)", diario: 180 },
  "natal": { texto: "🟢 $ Nacional (~R$ 190/dia)", diario: 190 },
  "lisboa": { texto: "🟡 $$ Moderado (~R$ 380/dia)", diario: 380 },
  "porto": { texto: "🟡 $$ Moderado (~R$ 340/dia)", diario: 340 },
  "portugal": { texto: "🟡 $$ Moderado (~R$ 360/dia)", diario: 360 },
  "madrid": { texto: "🟡 $$ Moderado (~R$ 420/dia)", diario: 420 },
  "barcelona": { texto: "🟡 $$ Moderado (~R$ 450/dia)", diario: 450 },
  "espanha": { texto: "🟡 $$ Moderado (~R$ 420/dia)", diario: 420 },
  "roma": { texto: "🟡 $$ Moderado (~R$ 460/dia)", diario: 460 },
  "italia": { texto: "🟡 $$ Moderado (~R$ 450/dia)", diario: 450 },
  "montevideu": { texto: "🟡 $$ Moderado (~R$ 350/dia)", diario: 350 },
  "uruguai": { texto: "🟡 $$ Moderado (~R$ 350/dia)", diario: 350 },
  "cancun": { texto: "🟡 $$ Moderado (~R$ 400/dia)", diario: 400 },
  "punta cana": { texto: "🟡 $$ Moderado (~R$ 420/dia)", diario: 420 },
  "rio de janeiro": { texto: "🟡 $$ Moderado (~R$ 260/dia)", diario: 260 },
  "sao paulo": { texto: "🟡 $$ Moderado (~R$ 280/dia)", diario: 280 },
  "orlando": { texto: "🟠 $$$ Caro (~R$ 650/dia)", diario: 650 },
  "miami": { texto: "🟠 $$$ Caro (~R$ 750/dia)", diario: 750 },
  "paris": { texto: "🟠 $$$ Caro (~R$ 700/dia)", diario: 700 },
  "franca": { texto: "🟠 $$$ Caro (~R$ 680/dia)", diario: 680 },
  "berlim": { texto: "🟠 $$$ Caro (~R$ 550/dia)", diario: 550 },
  "amsterdam": { texto: "🟠 $$$ Caro (~R$ 750/dia)", diario: 750 },
  "los angeles": { texto: "🟠 $$$ Caro (~R$ 800/dia)", diario: 800 },
  "san francisco": { texto: "🟠 $$$ Caro (~R$ 850/dia)", diario: 850 },
  "estados unidos": { texto: "🟠 $$$ Caro (~R$ 750/dia)", diario: 750 },
  "eua": { texto: "🟠 $$$ Caro (~R$ 750/dia)", diario: 750 },
  "europa": { texto: "🟡 $$ a $$$ (~R$ 500/dia)", diario: 500 },
  "nova york": { texto: "🔴 $$$$ Ultra Caro (~R$ 1.100/dia)", diario: 1100 },
  "londres": { texto: "🔴 $$$$ Ultra Caro (~R$ 1.050/dia)", diario: 1050 },
  "zurique": { texto: "🔴 $$$$ Ultra Caro (~R$ 1.200/dia)", diario: 1200 },
  "suica": { texto: "🔴 $$$$ Ultra Caro (~R$ 1.200/dia)", diario: 1200 },
  "toquio": { texto: "🔴 $$$$ Alto (~R$ 750/dia)", diario: 750 }
};

// Termos estritos de detecção de erro de tarifa legítimo
export const TERMOS_BUG_FARE = [
  "erro de tarifa",
  "bug fare",
  "bug de tarifa",
  "tarifa com erro",
  "tarifa errada",
  "erro no preço",
  "erro no preco",
  "preço errado",
  "preco errado"
];

// Termos comerciais banidos (afiliados, publiposts, pacotes)
export const TERMOS_MARKETING_BANIDOS = [
  "pacote", "pacotes",
  "hotel", "hotéis", "hoteis", "resort", "resorts", "pousada", "pousadas", "fazenda",
  "cupom", "cupons", "off", "desconto",
  "executiva", "business", "primeira classe",
  "seguro", "seguro viagem",
  "carro", "aluguel", "locação", "rent a car",
  "cartão", "cartao", "cartões", "cartoes",
  "milhas", "pontos", "pontuação", "clube", "livelo", "esfera", "smiles", "latam pass", "tudoazul",
  "cruzeiro", "navio", "ingressos", "disney"
];
