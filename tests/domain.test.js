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
  gerarLinkGoogleFlightsCheapest
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
    assert.match(linkRoundTrip, /Flights%20to%20LIS%20from%20GRU/);
    assert.match(linkRoundTrip, /through%202026-11-24/);

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

    const linkCheapestRoundTrip = gerarLinkGoogleFlightsCheapest('SAO', 'LIS', '2027-02-10', '2027-02-24', 15);
    assert.ok(linkCheapestRoundTrip);
    assert.match(linkCheapestRoundTrip, /tfs=/);
    assert.match(linkCheapestRoundTrip, /tfu=EgoIABAAGAAgAigD/);
  });
});
