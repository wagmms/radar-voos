import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  obterInfoAeroporto,
  resolverDestinoConcreto,
  formatarPeriodoViagem,
  montarCardBugFare
} from '../src/domain/aeroportos.js';
import { gerarLinkGoogleFlights, gerarLinkGoogleFlightsCheapest } from '../src/domain/rotas.js';
import { getDb, bugFaresRepo } from '../src/db.js';

describe('Domínio: Resolução de Aeroportos, Cidades e Links Canônicos de Bug Fare', () => {
  it('deve obter informações completas de aeroportos conhecidos e metropolitanos', () => {
    const bue = obterInfoAeroporto('BUE');
    assert.strictEqual(bue.cidade, 'Buenos Aires');
    assert.strictEqual(bue.pais, 'Argentina');
    assert.strictEqual(bue.codigoLink, 'EZE');

    const mad = obterInfoAeroporto('MAD');
    assert.strictEqual(mad.cidade, 'Madrid');
    assert.strictEqual(mad.pais, 'Espanha');

    const sao = obterInfoAeroporto('SAO');
    assert.strictEqual(sao.cidade, 'São Paulo');
    assert.strictEqual(sao.pais, 'Brasil');
  });

  it('deve resolver destino concreto para América do Sul sem termos genéricos', () => {
    const concretoAmSul = resolverDestinoConcreto({
      destino: 'América do Sul',
      codigoDestino: '/m/06_1'
    });

    assert.ok(concretoAmSul);
    assert.strictEqual(concretoAmSul.cidade, 'Buenos Aires');
    assert.strictEqual(concretoAmSul.pais, 'Argentina');
    assert.strictEqual(concretoAmSul.iata, 'EZE');
    assert.notStrictEqual(concretoAmSul.cidade, 'América do Sul');
  });

  it('deve resolver destino concreto priorizando destinoReal e codigoDestinoReal quando informados', () => {
    const concretoScl = resolverDestinoConcreto({
      destino: 'América do Sul',
      codigoDestino: '/m/06_1',
      destinoReal: 'Santiago (SCL)',
      codigoDestinoReal: 'SCL'
    });

    assert.ok(concretoScl);
    assert.strictEqual(concretoScl.cidade, 'Santiago');
    assert.strictEqual(concretoScl.pais, 'Chile');
    assert.strictEqual(concretoScl.iata, 'SCL');
  });

  it('deve lidar defensivamente com resolverDestinoConcreto para entradas nulas, indefinidas ou strings diretas', () => {
    // Chamada sem parâmetros, null ou undefined não devem lançar TypeError
    const vazio = resolverDestinoConcreto();
    assert.strictEqual(vazio.iata, 'DEST');
    assert.strictEqual(vazio.cidade, 'Destino');

    const nulo = resolverDestinoConcreto(null);
    assert.strictEqual(nulo.iata, 'DEST');

    const indefinido = resolverDestinoConcreto(undefined);
    assert.strictEqual(indefinido.iata, 'DEST');

    // Entrada direta como string com código ou nome de aeroporto
    const diretoIata = resolverDestinoConcreto('MIA');
    assert.strictEqual(diretoIata.cidade, 'Miami');
    assert.strictEqual(diretoIata.iata, 'MIA');

    const diretoEspacos = resolverDestinoConcreto('  cdg  ');
    assert.strictEqual(diretoEspacos.cidade, 'Paris');
    assert.strictEqual(diretoEspacos.iata, 'CDG');
  });

  it('deve sanitizar código e nome no fallback de resolverDestinoConcreto para destinos desconhecidos', () => {
    const fallbackSanitizado = resolverDestinoConcreto({
      destino: '  Ilha Remota  ',
      codigoDestino: '  xyz  '
    });

    assert.strictEqual(fallbackSanitizado.iata, 'XYZ');
    assert.strictEqual(fallbackSanitizado.codigoLink, 'XYZ');
    assert.strictEqual(fallbackSanitizado.cidade, 'Ilha Remota');
    assert.strictEqual(fallbackSanitizado.pais, 'Internacional');
  });

  it('deve formatar período da viagem com precisão e clareza', () => {
    const periodoIdaEVolta = formatarPeriodoViagem('2026-12-08', '2026-12-22');
    assert.strictEqual(periodoIdaEVolta, 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');

    const periodoSoIda = formatarPeriodoViagem('2026-12-08', null);
    assert.strictEqual(periodoSoIda, 'Ida: 08/12/2026 (Só Ida)');
  });

  it('deve tratar entradas de data nulas, vazias ou com espaços defensivamente em formatarPeriodoViagem', () => {
    assert.strictEqual(formatarPeriodoViagem(null, null), 'Data a Definir');
    assert.strictEqual(formatarPeriodoViagem('', null), 'Data a Definir');
    assert.strictEqual(formatarPeriodoViagem('   ', '   '), 'Data a Definir');
  });

  it('deve formatar viagem de 1 dia no singular (1 dia) e suportar espaços ao redor das datas', () => {
    const periodo1Dia = formatarPeriodoViagem('2026-12-08', '2026-12-09');
    assert.strictEqual(periodo1Dia, 'Ida: 08/12/2026 ➔ Volta: 09/12/2026 (1 dia)');

    const periodoComEspacos = formatarPeriodoViagem('  2026-12-08  ', '  2026-12-15  ');
    assert.strictEqual(periodoComEspacos, 'Ida: 08/12/2026 ➔ Volta: 15/12/2026 (7 dias)');
  });

  it('deve tratar defensivamente em formatarPeriodoViagem: objetos Date, formato brasileiro DD/MM/AAAA e duração no campo de volta', () => {
    // 1. Objetos Date devem ser formatados como DD/MM/AAAA (sem toString nativo longo com fuso inglês)
    const d1 = new Date(Date.UTC(2026, 11, 8)); // 08/12/2026
    const d2 = new Date(Date.UTC(2026, 11, 22)); // 22/12/2026
    assert.strictEqual(formatarPeriodoViagem(d1, d2), 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');

    // 2. Datas em formato brasileiro DD/MM/AAAA devem calcular diffDias corretamente
    assert.strictEqual(formatarPeriodoViagem('08/12/2026', '22/12/2026'), 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');

    // 3. Campo de volta com duração textual ("14 dias") deve calcular data de volta e dias de estadia
    assert.strictEqual(formatarPeriodoViagem('2026-12-08', '14 dias'), 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');
  });

  it('deve montar card de Bug Fare com aeroporto de chegada, país, datas e link canônico', () => {
    const card = montarCardBugFare({
      origem: 'São Paulo',
      codigoOrigem: 'SAO',
      destino: 'América do Sul',
      codigoDestino: '/m/06_1',
      codigoDestinoReal: 'SCL',
      destinoReal: 'Santiago (SCL)',
      dataIda: '2026-12-08',
      dataVolta: '2026-12-22',
      preco: 414,
      motivo: 'Preço R$ 414 está abaixo do piso estrutural de R$ 850 para América do Sul'
    });

    assert.ok(card);
    assert.strictEqual(card.preco, 414);
    assert.strictEqual(card.cidade_destino, 'Santiago');
    assert.strictEqual(card.pais_destino, 'Chile');
    assert.ok(card.aeroporto_chegada.includes('SCL') || card.aeroporto_chegada.includes('Arturo Merino'));
    assert.strictEqual(card.periodo_texto, 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');

    // Link NUNCA deve conter through nem termos de continente genérico
    assert.ok(card.link);
    assert.ok(!card.link.includes('through'));
    // Link canônico para o aeroporto físico achado (SCL) deve usar Protobuf tfs da aba Cheapest
    assert.ok(card.link.includes('tfs='));
  });

  it('gerarLinkGoogleFlights deve utilizar returning e converter KGMID para nome em inglês aceito pelo Google Flights', () => {
    const link = gerarLinkGoogleFlights('SAO', '/m/06_1', '2026-12-08', '2026-12-22');
    assert.ok(!link.includes('through'));
    assert.ok(link.includes('returning'));
    assert.ok(link.includes('Flights%20from%20SAO%20to%20South%20America'));
  });

  it('deve persistir e recuperar Bug Fare com campos enriquecidos no SQLite', () => {
    const card = montarCardBugFare({
      origem: 'São Paulo',
      codigoOrigem: 'SAO',
      destino: 'Santiago',
      codigoDestino: 'SCL',
      dataIda: '2027-01-10',
      dataVolta: '2027-01-18',
      preco: 390,
      motivo: 'Abaixo do piso estrutural'
    });

    const res = bugFaresRepo.inserir(card);
    assert.ok(res);

    const recentes = bugFaresRepo.listarRecentes(10);
    const encontrado = recentes.find(b => b.link === card.link);
    assert.ok(encontrado);
    assert.strictEqual(encontrado.cidade_destino, 'Santiago');
    assert.strictEqual(encontrado.pais_destino, 'Chile');
    assert.strictEqual(encontrado.preco, 390);
    assert.ok(encontrado.periodo_texto.includes('10/01/2027'));
  });
});
