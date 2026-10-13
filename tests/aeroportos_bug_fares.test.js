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

  it('deve formatar período da viagem com precisão e clareza', () => {
    const periodoIdaEVolta = formatarPeriodoViagem('2026-12-08', '2026-12-22');
    assert.strictEqual(periodoIdaEVolta, 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');

    const periodoSoIda = formatarPeriodoViagem('2026-12-08', null);
    assert.strictEqual(periodoSoIda, 'Ida: 08/12/2026 (Só Ida)');
  });

  it('deve montar card de Bug Fare com aeroporto de chegada, país, datas e link canônico', () => {
    const card = montarCardBugFare({
      origem: 'São Paulo',
      codigoOrigem: 'SAO',
      destino: 'América do Sul',
      codigoDestino: 'BUE',
      dataIda: '2026-12-08',
      dataVolta: '2026-12-22',
      preco: 414,
      motivo: 'Preço R$ 414 está abaixo do piso estrutural de R$ 850 para América do Sul'
    });

    assert.ok(card);
    assert.strictEqual(card.preco, 414);
    assert.strictEqual(card.cidade_destino, 'Buenos Aires');
    assert.strictEqual(card.pais_destino, 'Argentina');
    assert.ok(card.aeroporto_chegada.includes('Ezeiza') || card.aeroporto_chegada.includes('Aeroparque'));
    assert.strictEqual(card.periodo_texto, 'Ida: 08/12/2026 ➔ Volta: 22/12/2026 (14 dias)');

    // Link NUNCA deve conter through nem termos de continente genérico
    assert.ok(card.link);
    assert.ok(!card.link.includes('through'));
    assert.ok(!card.link.includes('South%20America'));
    assert.ok(!card.link.includes('/m/06_1'));
    // Link canônico deve usar Protobuf tfs da aba Cheapest
    assert.ok(card.link.includes('tfs='));
  });

  it('gerarLinkGoogleFlights deve utilizar returning em vez de through para round-trip', () => {
    const link = gerarLinkGoogleFlights('SAO', 'BUE', '2026-12-08', '2026-12-22');
    assert.ok(!link.includes('through'));
    assert.ok(link.includes('returning'));
    assert.ok(link.includes('Flights%20from%20SAO%20to%20BUE') || link.includes('Flights%20from%20SAO%20to%20EZE'));
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
