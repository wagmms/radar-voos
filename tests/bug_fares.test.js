import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classificarItemFeed, identificarRegiaoDestino, detectarBugFareEstatistico } from '../src/domain/bug_fares.js';
import { BugFareFeedWatcher } from '../src/services/bug_fare_feed_watcher.js';
import { BugFareHunter, CORREDORES_GLOBAIS_SWEET_SPOT, ARQUIVO_WORKING_BUFFER_PADRAO } from '../src/services/bug_fare_hunter.js';
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

  it('deve blindar identificarRegiaoDestino contra falsos positivos de substring adversarial (Chile, Santiago, Parnaíba e listas IATA)', () => {
    // 1. "Chile" não deve casar falsamente em "CHI" (Chicago / América do Norte)
    assert.strictEqual(identificarRegiaoDestino('Chile'), 'AMERICA_SUL');
    assert.strictEqual(identificarRegiaoDestino('chile'), 'AMERICA_SUL');

    // 2. "Santiago" não deve casar falsamente em "SAN" (San Diego / América do Norte)
    assert.strictEqual(identificarRegiaoDestino('Santiago'), 'AMERICA_SUL');

    // 3. "Parnaíba" não deve casar falsamente em "PAR" (Paris / Europa)
    assert.notStrictEqual(identificarRegiaoDestino('Parnaiba'), 'EUROPA');

    // 4. Listas IATA e aeroportos múltiplos continuam funcionando com precisão
    assert.strictEqual(identificarRegiaoDestino('JFK,EWR'), 'AMERICA_NORTE');
    assert.strictEqual(identificarRegiaoDestino('GRU,CGH'), 'DOMESTICO');
    assert.strictEqual(identificarRegiaoDestino('MAD,BCN'), 'EUROPA');

    // 5. Casos de borda nulos, vazios ou numéricos
    assert.strictEqual(identificarRegiaoDestino(null), 'OUTRO');
    assert.strictEqual(identificarRegiaoDestino(''), 'OUTRO');
    assert.strictEqual(identificarRegiaoDestino(undefined), 'OUTRO');
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

  it('deve lidar defensivamente com casos de borda adversariais em detectarBugFareEstatistico', () => {
    // 1. Entradas nulas, indefinidas ou parâmetros ausentes
    assert.deepStrictEqual(detectarBugFareEstatistico(null), { ehBugFare: false });
    assert.deepStrictEqual(detectarBugFareEstatistico(undefined), { ehBugFare: false });
    assert.deepStrictEqual(detectarBugFareEstatistico(), { ehBugFare: false });

    // 2. Preços e médias informados como strings numéricas (não deve quebrar .toFixed e deve detectar)
    const bugString = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'MAD',
      preco: '1450',
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(bugString.ehBugFare, true);
    assert.strictEqual(bugString.severidade, 'CRITICA');

    const bugZScoreString = detectarBugFareEstatistico({
      origemCod: 'GRU',
      destinoCod: 'MIA',
      preco: '1850',
      precoMedioHistorico: '4200',
      desvioPadrao: '800',
      dataVolta: '2026-11-20'
    });
    assert.strictEqual(bugZScoreString.ehBugFare, true);
    assert.strictEqual(bugZScoreString.severidade, 'ALTA');

    // 3. Entradas adversariais com NaN, Infinity, strings não numéricas ou valores negativos
    assert.deepStrictEqual(detectarBugFareEstatistico({ preco: NaN }), { ehBugFare: false });
    assert.deepStrictEqual(detectarBugFareEstatistico({ preco: Infinity }), { ehBugFare: false });
    assert.deepStrictEqual(detectarBugFareEstatistico({ preco: -200 }), { ehBugFare: false });
    assert.deepStrictEqual(detectarBugFareEstatistico({ preco: 'gratis' }), { ehBugFare: false });
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

describe('BugFareHunter: Working Buffer + Z-Score + Deduplicação 24h', () => {
  it('deve inicializar Working Buffer vazio e criar estado por demanda', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:LIS';

    // Buffer não existe até ser acessado
    assert(!hunter._workingBuffer.has(chave));

    // Acesso cria automaticamente
    const buffer = hunter._obterBufferCorreder(chave);
    assert.deepStrictEqual(buffer.leituras, []);
    assert.strictEqual(buffer.ultimoAlerta, null);
  });

  it('deve registrar leituras no buffer e respeitar limite máximo de 5 entradas', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:MIA';

    // Inserir 7 leituras; apenas as últimas 5 devem persistir
    [1000, 1100, 1200, 1050, 980, 950, 920].forEach(p => hunter._registrarLeitura(chave, p));

    const buffer = hunter._obterBufferCorreder(chave);
    assert.strictEqual(buffer.leituras.length, 5);
    assert.deepStrictEqual(buffer.leituras, [1200, 1050, 980, 950, 920]);
  });

  it('deve calcular média e desvio padrão amostral corretos no buffer', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:CDG';

    // Sem leituras suficientes
    let stats = hunter._calcularEstatisticasBuffer([]);
    assert.strictEqual(stats.media, null);
    assert.strictEqual(stats.desvioPadrao, null);

    // Com exatamente 2 leituras: média disponível, desvio não
    stats = hunter._calcularEstatisticasBuffer([4000, 4400]);
    assert.strictEqual(stats.media, 4200);
    assert.strictEqual(stats.desvioPadrao, null);

    // Com 3+ leituras: ambos disponíveis
    stats = hunter._calcularEstatisticasBuffer([4000, 4200, 4400]);
    assert.strictEqual(stats.media, 4200);
    assert(stats.desvioPadrao > 150 && stats.desvioPadrao < 250);
  });

  it('deve classificar INFO quando preço é normal (sem anomalia)', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:MAD';

    // Popular buffer com 4 leituras estáveis (~R$ 4.000)
    [3900, 4000, 4100, 4000].forEach(p => hunter._registrarLeitura(chave, p));

    // Preço atual dentro da normalidade
    const resultado = hunter._classificarPrecoBuffer(chave, 4050);
    assert.strictEqual(resultado.categoria, 'INFO');
  });

  it('deve classificar OPORTUNIDADE quando queda > 30% sem Z-Score disponível', () => {
    const hunter = new BugFareHunter();
    const chave = 'RIO:MIA';

    // Apenas 2 leituras: sem desvio padrão robusto, usa queda %
    [4000, 4200].forEach(p => hunter._registrarLeitura(chave, p));

    // Queda de ~35% em relação à média (R$ 4.100 → R$ 2.650)
    const resultado = hunter._classificarPrecoBuffer(chave, 2650);
    assert.strictEqual(resultado.categoria, 'OPORTUNIDADE');
    assert(resultado.quedaPct > 0.30);
    assert.strictEqual(resultado.zScore, null);
  });

  it('deve classificar BUG_FARE quando Z-Score <= -2.5', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:TYO';

    // 5 leituras estáveis com desvio padrão pequeno (~R$ 8.000 ± 400)
    [7800, 8000, 8200, 8000, 7900].forEach(p => hunter._registrarLeitura(chave, p));

    // Preço absurdamente baixo: Z-Score << -2.5
    const resultado = hunter._classificarPrecoBuffer(chave, 3000);
    assert.strictEqual(resultado.categoria, 'BUG_FARE');
    assert(resultado.zScore < -2.5);
    assert(resultado.quedaPct > 0.50);
    assert(resultado.media > 7000);
  });

  it('deve classificar OPORTUNIDADE quando Z-Score está entre -1.5 e -2.5', () => {
    const hunter = new BugFareHunter();
    const chave = 'BSB:CUN';

    // 5 leituras estáveis com desvio padrão bem definido
    [3500, 3600, 3700, 3600, 3500].forEach(p => hunter._registrarLeitura(chave, p));

    // Preço com Z-Score em torno de -2.0 (queda moderada)
    // Média ≈ 3.580, DP ≈ 79 → Z = (3100 - 3580) / 79 ≈ -6 → BUG_FARE com DP pequeno
    // Usar desvio maior: simular com leituras mais dispersas
    const hunter2 = new BugFareHunter();
    const chave2 = 'SAO:DXB';
    [5000, 6000, 4500, 5800, 5200].forEach(p => hunter2._registrarLeitura(chave2, p));

    // Média ≈ 5.300, DP ≈ 580 → Z = (4100 - 5300) / 580 ≈ -2.07 → OPORTUNIDADE
    const resultado2 = hunter2._classificarPrecoBuffer(chave2, 4100);
    assert.strictEqual(resultado2.categoria, 'OPORTUNIDADE');
    assert(resultado2.zScore < -1.5 && resultado2.zScore > -2.5);
  });

  it('deve detectar e suprimir alertas duplicados dentro da janela de 24h', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:NYC';

    // Sem alerta anterior: não é duplicata
    assert.strictEqual(hunter._ehAlertaDuplicado(chave, 'BUG_FARE'), false);

    // Registrar alerta agora
    hunter._registrarAlertaDisparado(chave, 'BUG_FARE', 1500);

    // Mesmo tipo dentro de 24h com mesmo preço → deve suprimir
    assert.strictEqual(hunter._ehAlertaDuplicado(chave, 'BUG_FARE'), true);
    assert.strictEqual(hunter._ehAlertaDuplicado(chave, 'BUG_FARE', 1500), true);

    // Nova queda relevante no mesmo dia (de 1500 para 1200, queda de 20%) → NÃO deve suprimir (libera novo alerta)
    assert.strictEqual(hunter._ehAlertaDuplicado(chave, 'BUG_FARE', 1200), false);

    // Tipo diferente dentro de 24h → não deve suprimir
    assert.strictEqual(hunter._ehAlertaDuplicado(chave, 'OPORTUNIDADE'), false);
  });

  it('deve liberar alerta após expirar a janela de 24h (simulação via ts no passado)', () => {
    const hunter = new BugFareHunter();
    const chave = 'SAO:BUE';

    // Registrar alerta e forçar timestamp para 25 horas atrás
    hunter._registrarAlertaDisparado(chave, 'BUG_FARE', 900);
    const buffer = hunter._obterBufferCorreder(chave);
    buffer.ultimoAlerta.ts = Date.now() - (25 * 60 * 60 * 1000);

    // Janela expirada → alerta não é duplicata
    assert.strictEqual(hunter._ehAlertaDuplicado(chave, 'BUG_FARE'), false);
  });

  it('deve retornar snapshot do Working Buffer via obterEstadoBuffer', () => {
    const hunter = new BugFareHunter();

    // Buffer vazio → objeto vazio
    const estadoVazio = hunter.obterEstadoBuffer();
    assert.deepStrictEqual(estadoVazio, {});

    // Adicionar leituras em dois corredores
    [4000, 4200, 3800].forEach(p => hunter._registrarLeitura('SAO:LIS', p));
    hunter._registrarAlertaDisparado('SAO:LIS', 'BUG_FARE', 1800);
    [2000, 2100].forEach(p => hunter._registrarLeitura('RIO:BUE', p));

    const estado = hunter.obterEstadoBuffer();
    assert(estado['SAO:LIS']);
    assert.strictEqual(estado['SAO:LIS'].leituras, 3);
    assert.strictEqual(estado['SAO:LIS'].media, 4000);
    assert(estado['SAO:LIS'].desvioPadrao > 0);
    assert(estado['SAO:LIS'].ultimoAlerta !== null);
    assert.strictEqual(estado['SAO:LIS'].ultimoAlerta.tipo, 'BUG_FARE');

    assert(estado['RIO:BUE']);
    assert.strictEqual(estado['RIO:BUE'].leituras, 2);
    assert.strictEqual(estado['RIO:BUE'].ultimoAlerta, null);
  });

  it('deve manter retrocompatibilidade via executarVarreduraProativa (alias)', async () => {
    const hunter = new BugFareHunter();
    // Sobrescrever escanearCorredoresProativos para evitar chamadas reais
    let chamado = false;
    hunter.escanearCorredoresProativos = async (params) => {
      chamado = true;
      return { sucesso: true, corredoresVarridos: 0, totalBugsEncontrados: 0, bugs: [] };
    };

    const res = await hunter.executarVarreduraProativa({ limiteRotas: 2 });
    assert.strictEqual(chamado, true);
    assert.strictEqual(res.sucesso, true);
  });
});

describe('BugFareHunter: Persistência Atômica do Working Buffer em Disco', () => {
  const criarCaminhoTemp = () => path.join(os.tmpdir(), `test_working_buffer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.json`);

  it('deve salvar Working Buffer em disco de forma atômica com envelope e estrutura sanitizada', () => {
    const tempFile = criarCaminhoTemp();
    try {
      const hunter = new BugFareHunter({ arquivoBuffer: tempFile });
      hunter._registrarLeitura('SAO:LIS', 3800);
      hunter._registrarLeitura('SAO:LIS', 3900);
      hunter._registrarAlertaDisparado('SAO:LIS', 'BUG_FARE', 1750);
      hunter._registrarLeitura('RIO:MIA', 2800);

      const salvo = hunter.salvarWorkingBufferDisco(tempFile, { forcar: true });
      assert.strictEqual(salvo, true);
      assert(fs.existsSync(tempFile));

      const conteudo = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
      assert.strictEqual(conteudo.versao, 1);
      assert.strictEqual(conteudo.totalCorredores, 2);
      assert(conteudo.atualizadoEm);
      assert(conteudo.corredores['SAO:LIS']);
      assert.deepStrictEqual(conteudo.corredores['SAO:LIS'].leituras, [3800, 3900]);
      assert.strictEqual(conteudo.corredores['SAO:LIS'].ultimoAlerta.tipo, 'BUG_FARE');
      assert.strictEqual(conteudo.corredores['SAO:LIS'].ultimoAlerta.preco, 1750);
      assert.deepStrictEqual(conteudo.corredores['RIO:MIA'].leituras, [2800]);
      assert.strictEqual(conteudo.corredores['RIO:MIA'].ultimoAlerta, null);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('deve restaurar Working Buffer do disco no boot da classe quando configurado', () => {
    const tempFile = criarCaminhoTemp();
    try {
      const payload = {
        versao: 1,
        atualizadoEm: new Date().toISOString(),
        totalCorredores: 1,
        corredores: {
          'SAO:PAR': {
            leituras: [4200, 4100, 4050],
            ultimoAlerta: { tipo: 'OPORTUNIDADE', preco: 2700, ts: 1728800000000 }
          }
        }
      };
      fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8');

      // Boot com arquivo configurado
      const hunter = new BugFareHunter({ arquivoBuffer: tempFile, carregarNoBoot: true });
      assert(hunter._workingBuffer.has('SAO:PAR'));

      const buffer = hunter._obterBufferCorreder('SAO:PAR');
      assert.deepStrictEqual(buffer.leituras, [4200, 4100, 4050]);
      assert.strictEqual(buffer.ultimoAlerta.tipo, 'OPORTUNIDADE');
      assert.strictEqual(buffer.ultimoAlerta.preco, 2700);
      assert.strictEqual(buffer.ultimoAlerta.ts, 1728800000000);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('deve carregar formato plano (sem envelope de versão) com sanitização de leituras', () => {
    const tempFile = criarCaminhoTemp();
    try {
      const payloadPlano = {
        'BSB:CUN': {
          leituras: [3000, 'invalido', -200, null, 3100, 2950],
          ultimoAlerta: { tipo: 'BUG_FARE', preco: 1200, ts: 1728700000000 }
        }
      };
      fs.writeFileSync(tempFile, JSON.stringify(payloadPlano), 'utf-8');

      const hunter = new BugFareHunter();
      const carregou = hunter.carregarWorkingBufferDisco(tempFile);
      assert.strictEqual(carregou, true);
      assert(hunter._workingBuffer.has('BSB:CUN'));

      const buffer = hunter._obterBufferCorreder('BSB:CUN');
      // Filtrou strings, nulos e negativos: apenas [3000, 3100, 2950]
      assert.deepStrictEqual(buffer.leituras, [3000, 3100, 2950]);
      assert.strictEqual(buffer.ultimoAlerta.tipo, 'BUG_FARE');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('deve limitar leituras carregadas a BUFFER_MAX_LEITURAS (últimas 5)', () => {
    const tempFile = criarCaminhoTemp();
    try {
      const payloadExcesso = {
        corredores: {
          'SAO:NYC': {
            leituras: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
            ultimoAlerta: null
          }
        }
      };
      fs.writeFileSync(tempFile, JSON.stringify(payloadExcesso), 'utf-8');

      const hunter = new BugFareHunter();
      hunter.carregarWorkingBufferDisco(tempFile);

      const buffer = hunter._obterBufferCorreder('SAO:NYC');
      assert.strictEqual(buffer.leituras.length, 5);
      assert.deepStrictEqual(buffer.leituras, [4000, 5000, 6000, 7000, 8000]);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('deve lidar defensivamente com arquivo inexistente, corrompido ou vazio sem lançar erro', () => {
    const hunter = new BugFareHunter();

    // Arquivo inexistente
    const resInexistente = hunter.carregarWorkingBufferDisco('/tmp/nao_existe_working_buffer_12345.json');
    assert.strictEqual(resInexistente, false);

    // Arquivo vazio
    const tempVazio = criarCaminhoTemp();
    fs.writeFileSync(tempVazio, '', 'utf-8');
    const resVazio = hunter.carregarWorkingBufferDisco(tempVazio);
    assert.strictEqual(resVazio, false);
    fs.unlinkSync(tempVazio);

    // Arquivo corrompido (JSON inválido)
    const tempCorrompido = criarCaminhoTemp();
    fs.writeFileSync(tempCorrompido, '{ "invalido": true, ...corrompido', 'utf-8');
    const resCorrompido = hunter.carregarWorkingBufferDisco(tempCorrompido);
    assert.strictEqual(resCorrompido, false);
    fs.unlinkSync(tempCorrompido);
  });

  it('deve limpar estado em memória via limparWorkingBuffer', () => {
    const hunter = new BugFareHunter();
    hunter._registrarLeitura('SAO:LIS', 3500);
    assert.strictEqual(hunter._workingBuffer.size, 1);

    hunter.limparWorkingBuffer();
    assert.strictEqual(hunter._workingBuffer.size, 0);
  });

  it('deve invocar salvarWorkingBufferDisco ao término de escanearCorredoresProativos', async () => {
    const hunter = new BugFareHunter();
    let salvarChamado = false;
    hunter.salvarWorkingBufferDisco = () => {
      salvarChamado = true;
      return true;
    };

    // Mock do provedorDirect para responder imediatamente sem rede
    hunter.provedorDirect = {
      buscarOfertas: async () => ({
        ok: true,
        encontrouVoos: true,
        oferta: { preco: 4500, destinoReal: 'Lisboa' }
      })
    };

    const res = await hunter.escanearCorredoresProativos({ limiteRotas: 1, notificar: false });
    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(salvarChamado, true);
  });
});
