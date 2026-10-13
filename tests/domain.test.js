import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  resolverDestino,
  normalizarParaSerpApi,
  ehSoIda,
  calcularDataVolta,
  validarPeriodo,
  gerarLinkGoogleFlights,
  extrairDiasEstadia,
  formatarDataParaBusca,
  gerarTfs,
  gerarLinkGoogleFlightsCheapest,
  resolverCodigoParaLink,
  encodeVarint
} from '../src/domain/rotas.js';

describe('Domínio: Rotas e Resolução Aeronáutica', () => {
  it('deve resolver metrópoles brasileiras e internacionais corretamente', () => {
    assert.strictEqual(resolverDestino('São Paulo'), 'SAO');
    assert.strictEqual(resolverDestino('sp'), 'SAO');
    assert.strictEqual(resolverDestino('Rio de Janeiro'), 'RIO');
    assert.strictEqual(resolverDestino('Buenos Aires'), 'BUE');
    assert.strictEqual(resolverDestino('Nova York'), 'NYC');
    assert.strictEqual(resolverDestino('Londres'), 'LON');
    assert.strictEqual(resolverDestino('Paris'), 'PAR');
  });

  it('deve resolver códigos de regiões e países do Google Flights (KGMID)', () => {
    assert.strictEqual(resolverDestino('Europa'), '/m/02j9z');
    assert.strictEqual(resolverDestino('Estados Unidos'), '/m/09c7w0');
    assert.strictEqual(resolverDestino('Portugal'), '/m/05r4w');
    assert.strictEqual(resolverDestino('América do Sul'), '/m/06_1');
    assert.strictEqual(resolverDestino('america do sul'), '/m/06_1');
    assert.strictEqual(resolverDestino('Ásia'), '/m/02j1x');
    assert.strictEqual(resolverDestino('asia'), '/m/02j1x');
  });

  it('não deve mais resolver regiões brasileiras agrupadas', () => {
    assert.strictEqual(resolverDestino('Nordeste'), null);
    assert.notStrictEqual(resolverDestino('Sul'), 'CWB,POA,FLN');
    assert.strictEqual(resolverDestino('Sudeste'), null);
    assert.strictEqual(resolverDestino('Norte'), null);
    assert.strictEqual(resolverDestino('Centro Oeste'), null);
  });

  it('deve extrair código IATA embutido entre parênteses e resolver múltiplos aeroportos com espaços', () => {
    // Caso 1: Código IATA entre parênteses
    assert.strictEqual(resolverDestino('São Paulo (GRU)'), 'GRU');
    assert.strictEqual(resolverDestino('Miami (MIA)'), 'MIA');
    assert.strictEqual(resolverDestino('Aeroporto Internacional (BSB)'), 'BSB');

    // Caso 2: Múltiplos IATAs com espaços arbitrários em volta das vírgulas
    assert.strictEqual(resolverDestino('GRU, GIG'), 'GRU,GIG');
    assert.strictEqual(resolverDestino('  GRU , BSB , CNF  '), 'GRU,BSB,CNF');
    assert.strictEqual(resolverDestino('gig,sdU'), 'GIG,SDU');

    // Caso 3: Casos de borda e entradas adversariais / inválidas
    assert.strictEqual(resolverDestino(null), null);
    assert.strictEqual(resolverDestino(undefined), null);
    assert.strictEqual(resolverDestino(''), null);
    assert.strictEqual(resolverDestino('   '), null);
    assert.strictEqual(resolverDestino({}), null);
    assert.strictEqual(resolverDestino([]), null);
    assert.strictEqual(resolverDestino(12345), null);
    assert.strictEqual(resolverDestino('GRU,'), null);
    assert.strictEqual(resolverDestino(',GRU'), null);
    assert.strictEqual(resolverDestino('GRU,,GIG'), null);
  });

  it('deve blindar resolverDestino para KGMIDs maiúsculos/mistos e espaços internos em parênteses IATA', () => {
    // Caso 1: KGMIDs com prefixo maiúsculo e identificador misto normalizados para minúsculo canônico
    assert.strictEqual(resolverDestino('/M/02j9z'), '/m/02j9z');
    assert.strictEqual(resolverDestino('/M/02J9Z'), '/m/02j9z');
    assert.strictEqual(resolverDestino('/G/11b6'), '/g/11b6');
    assert.strictEqual(resolverDestino('  /m/09c7w0  '), '/m/09c7w0');

    // Caso 2: Código IATA entre parênteses com espaços internos arbitrários
    assert.strictEqual(resolverDestino('São Paulo ( GRU )'), 'GRU');
    assert.strictEqual(resolverDestino('Miami (  MIA  )'), 'MIA');
    assert.strictEqual(resolverDestino('Paris ( cdg )'), 'CDG');
  });

  it('deve blindar resolverDestino contra prototype pollution e propriedades herdadas de Object', () => {
    // Entradas adversariais que colidem com propriedades de Object.prototype
    assert.strictEqual(resolverDestino('constructor'), null);
    assert.strictEqual(resolverDestino('__proto__'), null);
    assert.strictEqual(resolverDestino('valueOf'), null);
    assert.strictEqual(resolverDestino('toString'), null);
  });

  it('deve normalizar metrópoles para aeroportos físicos compatíveis com SerpAPI', () => {
    assert.strictEqual(normalizarParaSerpApi('SAO'), 'GRU,CGH');
    assert.strictEqual(normalizarParaSerpApi('RIO'), 'GIG,SDU');
    assert.strictEqual(normalizarParaSerpApi('NYC'), 'JFK,EWR,LGA');
    assert.strictEqual(normalizarParaSerpApi('BSB'), 'BSB');
  });

  it('deve identificar variações de Só Ida', () => {
    assert.strictEqual(ehSoIda('Só Ida'), true);
    assert.strictEqual(ehSoIda('so ida'), true);
    assert.strictEqual(ehSoIda('one way'), true);
    assert.strictEqual(ehSoIda(''), true);
    assert.strictEqual(ehSoIda(null), true);
    assert.strictEqual(ehSoIda('2026-11-20'), false);
    assert.strictEqual(ehSoIda('14'), false);
  });

  it('deve extrair dias de estadia de múltiplos formatos numéricos e textuais', () => {
    assert.strictEqual(extrairDiasEstadia('10 dias'), 10);
    assert.strictEqual(extrairDiasEstadia('10'), 10);
    assert.strictEqual(extrairDiasEstadia('10d'), 10);
    assert.strictEqual(extrairDiasEstadia('14 (dias)'), 14);
    assert.strictEqual(extrairDiasEstadia('7 dias de viagem'), 7);
    assert.strictEqual(extrairDiasEstadia(15), 15);
    assert.strictEqual(extrairDiasEstadia(null, 10), 10);
    assert.strictEqual(extrairDiasEstadia('', 10), 10);
  });

  it('extrairDiasEstadia: deve lidar defensivamente com casos de borda adversariais (não-finitos, extremos e padrão inválido)', () => {
    // 1. Valores não-finitos numéricos (Infinity, -Infinity, NaN) devem retornar o padrão seguro
    assert.strictEqual(extrairDiasEstadia(Infinity, 10), 10);
    assert.strictEqual(extrairDiasEstadia(-Infinity, 10), 10);
    assert.strictEqual(extrairDiasEstadia(NaN, 10), 10);

    // 2. Teto defensivo máximo de 3650 dias para valores astronômicos (numéricos ou string)
    assert.strictEqual(extrairDiasEstadia(99999), 3650);
    assert.strictEqual(extrairDiasEstadia('50000 dias'), 3650);

    // 3. Sanitização resiliente do parâmetro padrao quando for inválido
    assert.strictEqual(extrairDiasEstadia(null, 'invalido'), 10);
    assert.strictEqual(extrairDiasEstadia(null, -5), 10);
    assert.strictEqual(extrairDiasEstadia(null, NaN), 10);
    assert.strictEqual(extrairDiasEstadia(-10, 14), 14);
    assert.strictEqual(extrairDiasEstadia(0, 14), 14);
  });

  it('deve calcular data de volta com número de dias de estadia e sufixos de texto', () => {
    assert.strictEqual(calcularDataVolta('2026-11-10', '14'), '2026-11-24');
    assert.strictEqual(calcularDataVolta('2026-11-10', '10 dias'), '2026-11-20');
    assert.strictEqual(calcularDataVolta('2026-11-10', '10d'), '2026-11-20');
    assert.strictEqual(calcularDataVolta('2026-11-10', '14 (dias)'), '2026-11-24');

    const voltaSoIda = calcularDataVolta('2026-11-10', 'Só Ida');
    assert.strictEqual(voltaSoIda, null);
  });

  it('calcularDataVolta: deve tratar com resiliência entradas malformadas, formato brasileiro e nulos sem disparar RangeError', () => {
    // Casos adversariais de entrada malformada
    assert.strictEqual(calcularDataVolta('data-invalida', '10 dias'), null);
    assert.strictEqual(calcularDataVolta('2026-99-99', '10 dias'), null);
    assert.strictEqual(calcularDataVolta(null, '10 dias'), null);
    assert.strictEqual(calcularDataVolta(undefined, '10 dias'), null);

    // Formato brasileiro DD/MM/YYYY suportado graciosamente
    assert.strictEqual(calcularDataVolta('10/05/2026', '10 dias'), '2026-05-20');
    assert.strictEqual(calcularDataVolta('10/05/2026', 14), '2026-05-24');
    assert.strictEqual(calcularDataVolta('2026-11-10', '7 noites'), '2026-11-17');

    // Casos adversariais extremos: números astronômicos e não finitos sem RangeError
    assert.strictEqual(calcularDataVolta('2026-11-10', 100000000), null);
    assert.strictEqual(calcularDataVolta('2026-11-10', '99999999 dias'), null);
    assert.strictEqual(calcularDataVolta('2026-11-10', Infinity), null);
  });

  it('não deve converter números soltos em datas arbitrárias no formato de busca', () => {
    assert.strictEqual(formatarDataParaBusca('10'), null);
    assert.strictEqual(formatarDataParaBusca('10 dias'), null);
    assert.strictEqual(formatarDataParaBusca('10/10'), null);
    assert.strictEqual(formatarDataParaBusca('2026-10-10'), '2026-10-10');
    assert.strictEqual(formatarDataParaBusca('10/10/2026'), '2026-10-10');
  });

  it('formatarDataParaBusca: deve suportar timestamps ISO 8601 e SQLite DateTime e rejeitar adversariais inválidos', () => {
    // 1. Strings ISO 8601 e timestamps de bancos de dados
    assert.strictEqual(formatarDataParaBusca('2026-11-15T00:00:00.000Z'), '2026-11-15');
    assert.strictEqual(formatarDataParaBusca('2026-11-15 14:30:00'), '2026-11-15');
    assert.strictEqual(formatarDataParaBusca('15/11/2026 18:00'), '2026-11-15');

    // 2. Rejeição defensiva de datas inexistentes no calendário mesmo com timestamp
    assert.strictEqual(formatarDataParaBusca('2026-02-31T00:00:00Z'), null);
    assert.strictEqual(formatarDataParaBusca('2026-04-31 12:00:00'), null);
    assert.strictEqual(formatarDataParaBusca('31/02/2026 10:00'), null);

    // 3. Entradas adversariais nulas, vazias e não-datas
    assert.strictEqual(formatarDataParaBusca(null), null);
    assert.strictEqual(formatarDataParaBusca(undefined), null);
    assert.strictEqual(formatarDataParaBusca('   '), null);
    assert.strictEqual(formatarDataParaBusca('data-invalida'), null);
  });

  it('deve validar datas de ida e volta, rejeitando volta anterior à ida', () => {
    const ok = validarPeriodo('2026-11-10', '2026-11-20', 'round_trip');
    assert.strictEqual(ok.ok, true);

    const invalido = validarPeriodo('2026-11-20', '2026-11-10', 'round_trip');
    assert.strictEqual(invalido.ok, false);
    assert.match(invalido.erro, /anterior/);
  });

  it('deve gerar links canônicos estruturados do Google Flights', () => {
    const linkRoundTrip = gerarLinkGoogleFlights('GRU', 'LIS', '2026-11-10', '2026-11-24');
    assert.match(linkRoundTrip, /google\.com\/travel\/flights/);
    assert.match(linkRoundTrip, /Flights%20from%20GRU%20to%20LIS/);
    assert.match(linkRoundTrip, /returning%202026-11-24/);

    const linkOneWay = gerarLinkGoogleFlights('GRU', 'LIS', '2026-11-10', null);
    assert.match(linkOneWay, /one-way/);
  });

  it('gerarLinkGoogleFlights (adversarial): deve lidar com moeda não-string, datas flexíveis e duração relativa', () => {
    // Caso 1: Moeda com tipos adversariais (número, objeto, null) não lança TypeError e adota BRL
    const linkMoedaNum = gerarLinkGoogleFlights('GRU', 'LIS', '2026-11-10', null, 123);
    assert.match(linkMoedaNum, /curr=BRL/);

    const linkMoedaObj = gerarLinkGoogleFlights('GRU', 'LIS', '2026-11-10', null, {});
    assert.match(linkMoedaObj, /curr=BRL/);

    // Caso 2: dataIda como objeto Date ou formato brasileiro DD/MM/YYYY é canonicamente convertida
    const dataIdaDate = new Date(Date.UTC(2026, 10, 15)); // 2026-11-15
    const linkComDate = gerarLinkGoogleFlights('GRU', 'MIA', dataIdaDate, null);
    assert.match(linkComDate, /on%202026-11-15%20one-way/);

    const linkDataBr = gerarLinkGoogleFlights('GIG', 'MIA', '20/12/2026', null);
    assert.match(linkDataBr, /on%202026-12-20%20one-way/);

    // Caso 3: dataVolta expressa em dias ("10 dias" ou 10) é calculada a partir de dataIda
    const linkDiasTexto = gerarLinkGoogleFlights('SAO', 'LIS', '2026-11-10', '10 dias');
    assert.match(linkDiasTexto, /returning%202026-11-20/);

    const linkDiasNum = gerarLinkGoogleFlights('SAO', 'LIS', '2026-11-10', 14);
    assert.match(linkDiasNum, /returning%202026-11-24/);
  });

  it('deve gerar payload Protobuf tfs e link canônico para a aba Cheapest do Google Flights', () => {
    const tfs = gerarTfs({
      origens: ['GIG', 'SDU'],
      destinos: ['RAO'],
      dataIda: '2027-01-17',
      maxDurationMinutes: 360
    });
    assert.ok(tfs);
    assert.strictEqual(typeof tfs, 'string');
    assert.ok(tfs.length > 20);

    const linkCheapestOneWay = gerarLinkGoogleFlightsCheapest('RIO', 'RAO', '2027-01-17', null, 6);
    assert.ok(linkCheapestOneWay);
    assert.match(linkCheapestOneWay, /google\.com\/travel\/flights/);
    assert.match(linkCheapestOneWay, /tfs=/);
    assert.match(linkCheapestOneWay, /tfu=EgoIABAAGAAgAigD/);
    assert.match(linkCheapestOneWay, /curr=BRL/);
    assert.match(linkCheapestOneWay, /hl=pt-BR/);
    assert.match(linkCheapestOneWay, /gl=BR/);

    const linkCheapestRoundTrip = gerarLinkGoogleFlightsCheapest('SAO', 'LIS', '2027-02-10', '2027-02-24', 15);
    assert.ok(linkCheapestRoundTrip);
    assert.match(linkCheapestRoundTrip, /tfs=/);
    assert.match(linkCheapestRoundTrip, /tfu=EgoIABAAGAAgAigD/);
    assert.match(linkCheapestRoundTrip, /gl=BR/);
  });

  it('resolverCodigoParaLink: deve lidar defensivamente com nulos, strings vazias, espaços e IATA minúsculo entre parênteses', () => {
    // Entradas nulas, vazias e somente espaços devem retornar fallback seguro 'SAO'
    assert.strictEqual(resolverCodigoParaLink(null), 'SAO');
    assert.strictEqual(resolverCodigoParaLink(undefined), 'SAO');
    assert.strictEqual(resolverCodigoParaLink(''), 'SAO');
    assert.strictEqual(resolverCodigoParaLink('   '), 'SAO');
    assert.strictEqual(resolverCodigoParaLink('\t\n  '), 'SAO');

    // Código IATA entre parênteses minúsculo ou com espaços deve ser normalizado para maiúsculo
    assert.strictEqual(resolverCodigoParaLink('São Paulo (gru)'), 'GRU');
    assert.strictEqual(resolverCodigoParaLink('São Paulo ( GRU )'), 'GRU');
    assert.strictEqual(resolverCodigoParaLink('Miami (  MIA  )'), 'MIA');
    assert.strictEqual(resolverCodigoParaLink('(gig)'), 'GIG');
    assert.strictEqual(resolverCodigoParaLink('(  gig  )'), 'GIG');
    assert.strictEqual(resolverCodigoParaLink('Buenos Aires (eze)'), 'EZE');

    // Código IATA único minúsculo ou com espaços deve ser normalizado para maiúsculo canônico
    assert.strictEqual(resolverCodigoParaLink('gru'), 'GRU');
    assert.strictEqual(resolverCodigoParaLink('  mia  '), 'MIA');

    // KGMID e nomes canônicos de regiões
    assert.strictEqual(resolverCodigoParaLink('/m/02j9z'), 'Europe');
    assert.strictEqual(resolverCodigoParaLink('europa'), 'Europe');
    assert.strictEqual(resolverCodigoParaLink('eua'), 'United States');
  });

  it('resolverCodigoParaLink: deve tratar entradas adversariais não primitivas, KGMIDs case-insensitive e listas de IATAs', () => {
    // 1. Tipos não primitivos, booleanos e símbolos devem retornar fallback seguro 'SAO'
    assert.strictEqual(resolverCodigoParaLink({}), 'SAO');
    assert.strictEqual(resolverCodigoParaLink([]), 'SAO');
    assert.strictEqual(resolverCodigoParaLink(true), 'SAO');
    assert.strictEqual(resolverCodigoParaLink(false), 'SAO');
    assert.strictEqual(resolverCodigoParaLink(Symbol('iata')), 'SAO');

    // 2. KGMID em maiúsculas ou mistos devem resolver para o nome canônico
    assert.strictEqual(resolverCodigoParaLink('/M/02J9Z'), 'Europe');
    assert.strictEqual(resolverCodigoParaLink('/M/06_1'), 'South America');
    assert.strictEqual(resolverCodigoParaLink('/M/09C7W0'), 'United States');
    assert.strictEqual(resolverCodigoParaLink('/M/12345'), '12345');

    // 3. Múltiplos aeroportos IATA com espaços e minúsculas devem ser limpos e em maiúsculas
    assert.strictEqual(resolverCodigoParaLink('  gru , gig  '), 'GRU,GIG');
    assert.strictEqual(resolverCodigoParaLink('cgh, bsb , cnf'), 'CGH,BSB,CNF');
  });

  it('gerarTfs: deve lidar defensivamente com entradas adversariais, objetos Date, formatos brasileiros e strings unitárias', () => {
    // 1. Deve aceitar instâncias de Date e converter para YYYY-MM-DD sem erro de Buffer
    const dataIdaDate = new Date(Date.UTC(2027, 0, 17));
    const dataVoltaDate = new Date(Date.UTC(2027, 0, 27));
    const tfsComDates = gerarTfs({
      origens: ['GRU'],
      destinos: ['LIS'],
      dataIda: dataIdaDate,
      dataVolta: dataVoltaDate
    });
    assert.ok(tfsComDates);
    assert.strictEqual(typeof tfsComDates, 'string');
    assert.ok(tfsComDates.length > 20);

    // 2. Deve aceitar strings únicas em origens/destinos e formato de data brasileiro DD/MM/YYYY
    const tfsStringsUnitarias = gerarTfs({
      origens: 'GIG',
      destinos: 'MAD',
      dataIda: '17/01/2027',
      dataVolta: '27/01/2027',
      maxDurationMinutes: '480'
    });
    assert.ok(tfsStringsUnitarias);
    assert.strictEqual(typeof tfsStringsUnitarias, 'string');
    assert.ok(tfsStringsUnitarias.length > 20);

    // 3. Deve degradar graciosamente com origens/destinos nulos ou arrays com buracos
    const tfsDefensivo = gerarTfs({
      origens: ['GRU', null, '  '],
      destinos: null,
      dataIda: '2027-01-17',
      dataVolta: null,
      maxDurationMinutes: -50
    });
    assert.ok(tfsDefensivo);
    assert.strictEqual(typeof tfsDefensivo, 'string');
    assert.ok(tfsDefensivo.length > 20);
  });

  it('encodeVarint: deve codificar inteiros canônicos e blindar defensivamente contra negativos, não-finitos e decimais', () => {
    // 1. Valores canônicos de 1 e múltiplos bytes varint
    assert.deepStrictEqual(encodeVarint(0), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint(1), Buffer.from([0x01]));
    assert.deepStrictEqual(encodeVarint(127), Buffer.from([0x7f]));
    assert.deepStrictEqual(encodeVarint(128), Buffer.from([0x80, 0x01]));
    assert.deepStrictEqual(encodeVarint(300), Buffer.from([0xac, 0x02]));
    assert.deepStrictEqual(encodeVarint('300'), Buffer.from([0xac, 0x02]));
    assert.deepStrictEqual(encodeVarint(300.9), Buffer.from([0xac, 0x02]));

    // 2. Entradas adversariais negativas (deve degradar para varint 0 e nunca gerar bytes positivos espúrios)
    assert.deepStrictEqual(encodeVarint(-1), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint(-50), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint('-100'), Buffer.from([0x00]));

    // 3. Entradas não-finitas, nulas e strings malformadas (deve retornar varint 0 e nunca corromper com 0x80 0x00)
    assert.deepStrictEqual(encodeVarint(Infinity), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint(-Infinity), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint(NaN), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint(null), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint(undefined), Buffer.from([0x00]));
    assert.deepStrictEqual(encodeVarint('invalido'), Buffer.from([0x00]));
  });
});
