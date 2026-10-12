import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classificarItemFeed, identificarRegiaoDestino, detectarBugFareEstatistico } from '../src/domain/bug_fares.js';
import { BugFareFeedWatcher } from '../src/services/bug_fare_feed_watcher.js';
import { BugFareHunter, CORREDORES_GLOBAIS_SWEET_SPOT } from '../src/services/bug_fare_hunter.js';
import { rotasRepo, getDb } from '../src/db.js';

describe('Domínio: Filtro de Bug Fares e Erros de Tarifa', () => {
  it('deve descartar imediatamente posts com termos comerciais banidos', () => {
    const postHotel = classificarItemFeed('Mega desconto em hotel e resort em Cancun com cupom', 'https://exemplo.com/promo-hotel');
    assert.strictEqual(postHotel.valido, false);

    const postMilhas = classificarItemFeed('Ganhe até 100% de bônus livelo transferindo para smiles', 'https://exemplo.com/milhas');
    assert.strictEqual(postMilhas.valido, false);

    const postPacote = classificarItemFeed('Pacote Disney 7 dias com aéreo e hotel incluso', 'https://exemplo.com/pacote-disney');
    assert.strictEqual(postPacote.valido, false);
  });

  it('deve reconhecer positivamente erros autênticos de tarifa (Bug Fares)', () => {
    const bugFare = classificarItemFeed('URGENTE: Erro de tarifa para Paris e Roma por R$ 890 ida e volta!', 'https://exemplo.com/erro-tarifa-paris');
    assert.strictEqual(bugFare.valido, true);
    assert.strictEqual(bugFare.ehBugFare, true);
    assert.match(bugFare.tipo, /BUG FARE/);

    const bugFareIngles = classificarItemFeed('Bug Fare absurdo: voos para os EUA por preço errado', 'https://exemplo.com/bug-fare-eua');
    assert.strictEqual(bugFareIngles.valido, true);
    assert.strictEqual(bugFareIngles.ehBugFare, true);
  });

  it('deve identificar corretamente a região do destino para checagem de piso estrutural', () => {
    assert.strictEqual(identificarRegiaoDestino('LIS'), 'EUROPA');
    assert.strictEqual(identificarRegiaoDestino('CDG'), 'EUROPA');
    assert.strictEqual(identificarRegiaoDestino('MIA'), 'AMERICA_NORTE');
    assert.strictEqual(identificarRegiaoDestino('JFK'), 'AMERICA_NORTE');
    assert.strictEqual(identificarRegiaoDestino('EZE'), 'AMERICA_SUL');
    assert.strictEqual(identificarRegiaoDestino('/m/06_1'), 'AMERICA_SUL');
    assert.strictEqual(identificarRegiaoDestino('HND'), 'ASIA_OCEANIA');
    assert.strictEqual(identificarRegiaoDestino('/m/02j1x'), 'ASIA_OCEANIA');
    assert.strictEqual(identificarRegiaoDestino('REC'), 'DOMESTICO');

    // Novas regiões expandidas
    assert.strictEqual(identificarRegiaoDestino('CUN'), 'CARIBE_AMERICA_CENTRAL');
    assert.strictEqual(identificarRegiaoDestino('PUJ'), 'CARIBE_AMERICA_CENTRAL');
    assert.strictEqual(identificarRegiaoDestino('DXB'), 'ORIENTE_MEDIO');
    assert.strictEqual(identificarRegiaoDestino('DOH'), 'ORIENTE_MEDIO');
    assert.strictEqual(identificarRegiaoDestino('JNB'), 'AFRICA');
    assert.strictEqual(identificarRegiaoDestino('CPT'), 'AFRICA');
  });

  it('deve detectar Bug Fares estruturais e por anomalia estatística (Z-Score)', () => {
    // Caso 1: Tarifa para Europa abaixo do piso estrutural de R$ 1.950 (ida e volta)
    const bugPiso = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'MAD',
      preco: 1450,
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(bugPiso.ehBugFare, true);
    assert.strictEqual(bugPiso.severidade, 'CRITICA');
    assert.match(bugPiso.tipo, /BUG FARE/);
    assert.match(bugPiso.motivo, /abaixo do piso estrutural/);

    // Caso 2: Bug Fare em classe Executiva (Business) com multiplicador de cabine
    // Piso Europa Executiva: R$ 1.950 * 2.8 = R$ 5.460. Passagem por R$ 3.800 é bug fare!
    const bugExecutiva = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'LIS',
      preco: 3800,
      cabine: 'business',
      dataVolta: '2026-12-10'
    });
    assert.strictEqual(bugExecutiva.ehBugFare, true);
    assert.strictEqual(bugExecutiva.severidade, 'CRITICA');
    assert.match(bugExecutiva.motivo, /BUSINESS/);

    // Caso 3: Anomalia estatística confirmada por Z-Score
    const bugZScore = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'MIA',
      preco: 1850,
      precoMedioHistorico: 4200,
      desvioPadrao: 800,
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(bugZScore.ehBugFare, true);
    assert.strictEqual(bugZScore.severidade, 'ALTA');
    assert.match(bugZScore.tipo, /Z-SCORE/);

    // Caso 4: Tarifa normal e equilibrada
    const vooNormal = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'CDG',
      preco: 3900,
      precoMedioHistorico: 4100,
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(vooNormal.ehBugFare, false);
  });

  it('deve extrair itens válidos de XML RSS e Atom no BugFareFeedWatcher', () => {
    const rssMock = `
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[URGENTE: Erro de tarifa para Paris por R$ 850 ida e volta]]></title>
            <link>https://exemplo.com/bug-paris</link>
          </item>
          <item>
            <title>Pacote completo para Cancun com hotel</title>
            <link>https://exemplo.com/pacote</link>
          </item>
        </channel>
      </rss>
    `;

    const itens = BugFareFeedWatcher.extrairItensXml(rssMock);
    assert.strictEqual(itens.length, 2);
    assert.strictEqual(itens[0].titulo, 'URGENTE: Erro de tarifa para Paris por R$ 850 ida e volta');
    assert.strictEqual(itens[0].link, 'https://exemplo.com/bug-paris');
  });

  it('deve calcular média e desvio padrão amostral no rotasRepo', () => {
    const db = getDb();
    // Cria rota temporária de teste
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Madrid',
      codigo_origem: 'SAO',
      codigo_destino: 'MAD',
      data_ida: '2026-11-01',
      data_volta: '2026-11-15'
    });

    // Insere 3 registros de preços históricos
    const agora = new Date().toISOString();
    db.prepare('INSERT INTO historico_precos (rota_id, preco, termometro, data_checagem) VALUES (?, ?, ?, ?)').run(rota.id, 4000, 'Normal', agora);
    db.prepare('INSERT INTO historico_precos (rota_id, preco, termometro, data_checagem) VALUES (?, ?, ?, ?)').run(rota.id, 4200, 'Normal', agora);
    db.prepare('INSERT INTO historico_precos (rota_id, preco, termometro, data_checagem) VALUES (?, ?, ?, ?)').run(rota.id, 3800, 'Normal', agora);

    const stats = rotasRepo.obterEstatisticasPreco(rota.id);
    assert.strictEqual(stats.total, 3);
    assert.strictEqual(stats.media, 4000);
    assert.strictEqual(stats.menor, 3800);
    assert.strictEqual(stats.maior, 4200);
    assert(stats.desvioPadrao > 150 && stats.desvioPadrao < 250);

    // Limpeza
    rotasRepo.excluir(rota.id);
  });

  it('deve gerar datas estratégicas e manter corredores globais no BugFareHunter', () => {
    const hunter = new BugFareHunter();
    assert(CORREDORES_GLOBAIS_SWEET_SPOT.length >= 15);

    const datas = hunter.gerarDatasEstrategicas(60, 10);
    assert(datas.dataIda.match(/^\d{4}-\d{2}-\d{2}$/));
    assert(datas.dataVolta.match(/^\d{4}-\d{2}-\d{2}$/));
    assert(datas.dataIda < datas.dataVolta);
  });
});
