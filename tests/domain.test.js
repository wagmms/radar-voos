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
  resolverCodigoParaLink
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
    assert.strictEqual(resolverCodigoParaLink('(gig)'), 'GIG');
    assert.strictEqual(resolverCodigoParaLink('Buenos Aires (eze)'), 'EZE');

    // KGMID e nomes canônicos de regiões
    assert.strictEqual(resolverCodigoParaLink('/m/02j9z'), 'Europe');
    assert.strictEqual(resolverCodigoParaLink('europa'), 'Europe');
    assert.strictEqual(resolverCodigoParaLink('eua'), 'United States');
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
});
