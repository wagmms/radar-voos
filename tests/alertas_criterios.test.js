import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getDb, alertasRepo } from '../src/db.js';

describe('Inteligência de Alertas e Critérios Estritos (alertasRepo.deveDisparar)', () => {
  const chaveTeste = 'TESTE_SAO_LIS_2026-11-10_2026-11-24';

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM alertas_disparados WHERE chave_alerta = ?').run(chaveTeste);
  });

  it('1. NUNCA deve alertar na primeira checagem após deploy (baseline inicial)', () => {
    // Primeira checagem (precoAnterior é 0 ou null)
    const res = alertasRepo.deveDisparar(
      chaveTeste,
      2800, // precoAtual
      0,    // precoAnterior (novo deploy/primeira checagem)
      3500, // precoAlvo
      true, // ehRecorde
      'LOW',
      0
    );

    assert.strictEqual(res.deve, false);
    assert.strictEqual(res.motivo, 'baseline_inicial_deploy');
  });

  it('2. NUNCA deve alertar se o preço estiver acima do preço alvo do usuário', () => {
    // Preço anterior era 4500, caiu para 4000 (queda de mais de 10% e novo recorde)
    // MAS a meta do usuário é 3500!
    const res = alertasRepo.deveDisparar(
      chaveTeste,
      4000,  // precoAtual (acima do alvo de 3500)
      4500,  // precoAnterior
      3500,  // precoAlvo
      true,  // ehRecorde
      'LOW',
      -11.1  // variação percentual
    );

    assert.strictEqual(res.deve, false);
    assert.strictEqual(res.motivo, 'acima_preco_alvo');
  });

  it('3. DEVE alertar quando o preço cruzar a meta do usuário para baixo', () => {
    // Preço anterior era 3800 (fora da meta), agora caiu para 3400 (dentro da meta 3500)
    const res = alertasRepo.deveDisparar(
      chaveTeste,
      3400,  // precoAtual (dentro da meta)
      3800,  // precoAnterior (estava fora)
      3500,  // precoAlvo
      true,
      'LOW',
      -10.5
    );

    assert.strictEqual(res.deve, true);
    assert.strictEqual(res.tipo, 'ATINGIU_META');
  });

  it('4. NUNCA deve alertar novamente para oscilações mínimas ou preços maiores', () => {
    // Primeiro alerta registrado a 3200
    const res1 = alertasRepo.deveDisparar(chaveTeste, 3200, 3600, 3500, true, 'LOW', -11.1);
    assert.strictEqual(res1.deve, true);

    // No ciclo seguinte, preço oscilou de 3200 para 3250 (subiu)
    const resSubiu = alertasRepo.deveDisparar(chaveTeste, 3250, 3200, 3500, false, 'LOW', 1.5);
    assert.strictEqual(resSubiu.deve, false);
    assert.strictEqual(resSubiu.motivo, 'preco_nao_melhorou');

    // No ciclo seguinte, preço caiu de 3200 para 3180 (redução irrisória de < 5%)
    const resMinima = alertasRepo.deveDisparar(chaveTeste, 3180, 3200, 3500, true, 'LOW', -0.6);
    assert.strictEqual(resMinima.deve, false);
    assert.strictEqual(resMinima.motivo, 'variacao_insignificante');
  });

  it('5. DEVE alertar se o preço cair significativamente no mesmo dia (nova queda > 5%)', () => {
    // Primeiro alerta registrado a 3200
    const res1 = alertasRepo.deveDisparar(chaveTeste, 3200, 3600, 3500, true, 'LOW', -11.1);
    assert.strictEqual(res1.deve, true);

    // Algumas horas depois no mesmo dia, preço cai para 2800 (queda de 12.5% em relação aos 3200)
    // Cooldown de anti-rajada expirado (simulamos ajustando timestamp do alerta anterior)
    const db = getDb();
    db.prepare(`
      UPDATE alertas_disparados
      SET disparado_em = ?
      WHERE chave_alerta = ?
    `).run(new Date(Date.now() - 2 * 3600 * 1000).toISOString(), chaveTeste);

    const resNovaQueda = alertasRepo.deveDisparar(chaveTeste, 2800, 3200, 3500, true, 'LOW', -12.5);
    assert.strictEqual(resNovaQueda.deve, true);
    assert.strictEqual(resNovaQueda.tipo, 'NOVO_RECORDE');
  });

  it('6. deveDispararBugFare: suprime repetição do mesmo preço mas dispara nova queda no mesmo dia', () => {
    const chaveBug = 'BUG_SAO_MAD_2026-12-15_2026-12-27';
    const db = getDb();
    db.prepare('DELETE FROM alertas_disparados WHERE chave_alerta = ?').run(chaveBug);

    // Primeiro disparo de bug fare a R$ 1500
    const d1 = alertasRepo.deveDispararBugFare(chaveBug, 1500);
    assert.strictEqual(d1.deve, true);
    alertasRepo.registrarDisparo(chaveBug, 1500, 'BUG_FARE');

    // Minuto seguinte: mesmo preço R$ 1500 -> suprime com sucesso (zero spam)
    const dRepetido = alertasRepo.deveDispararBugFare(chaveBug, 1500);
    assert.strictEqual(dRepetido.deve, false);
    assert.strictEqual(dRepetido.motivo, 'mesmo_preco_em_cooldown_24h');

    // Horas depois no mesmo dia: preço cai ainda mais para R$ 1100 (queda de 26.6%)
    const dNovaQueda = alertasRepo.deveDispararBugFare(chaveBug, 1100);
    assert.strictEqual(dNovaQueda.deve, true);
    assert.strictEqual(dNovaQueda.motivo, 'nova_queda_mesmo_dia');
  });

  it('7. NUNCA deve alertar quando oscilação for normal de mercado (INFO) e usuário não tem meta', () => {
    const chaveSemMeta = 'TESTE_RIO_MIA_SEM_META';
    const db = getDb();
    db.prepare('DELETE FROM alertas_disparados WHERE chave_alerta = ?').run(chaveSemMeta);

    // Rota oscilou de R$ 3500 para R$ 3400 (queda de ~2.8%, delta INFO sem cruzamento de meta)
    const resInfo = alertasRepo.deveDisparar(
      chaveSemMeta,
      3400,
      3500,
      null, // Sem preço alvo
      true,
      'TYPICAL',
      -2.8,
      {
        classificacaoDelta: 'INFO',
        zScore: -0.3,
        deltaMediaPct: 2.8
      }
    );

    assert.strictEqual(resInfo.deve, false);
    assert.strictEqual(resInfo.motivo, 'oscilacao_normal_mercado_info');
  });

  it('8. DEVE alertar quando análise estatística comprova OPORTUNIDADE (Z-Score <= -1.5)', () => {
    const chaveOportunidade = 'TESTE_SAO_JFK_OPORTUNIDADE';
    const db = getDb();
    db.prepare('DELETE FROM alertas_disparados WHERE chave_alerta = ?').run(chaveOportunidade);

    // Preço caiu para R$ 2400 (média era R$ 3500, Z-Score = -1.8)
    const resOportunidade = alertasRepo.deveDisparar(
      chaveOportunidade,
      2400,
      3200,
      null, // Sem meta manual do usuário, detectada por exceção
      true,
      'LOW',
      -25.0,
      {
        classificacaoDelta: 'OPORTUNIDADE',
        zScore: -1.8,
        deltaMediaPct: 31.4
      }
    );

    assert.strictEqual(resOportunidade.deve, true);
    assert.strictEqual(resOportunidade.tipo, 'OPORTUNIDADE_ESTATISTICA');
  });

  it('9. enviarAlertaOportunidade: DEVE formatar horarioPartida, horarioChegada e numeroVoo com escapeHtml', async () => {
    const { notifierTelegram } = await import('../src/services/notifier_telegram.js');
    let msgCapturada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      msgCapturada = texto;
      return true;
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 1,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Lisboa (LIS)',
        dataIda: '2026-11-15',
        dataVolta: '2026-11-29',
        preco: 3200,
        variacaoTexto: 'Caiu 10%',
        ehRecorde: false,
        duracaoHoras: 10.5,
        detalhes: 'Direto | TAP Air Portugal',
        link: 'https://flights.google.com',
        horarioPartida: '20:45',
        horarioChegada: '10:15',
        numeroVoo: 'TP 088'
      });

      assert.ok(msgCapturada, 'Mensagem deve ter sido montada');
      assert.ok(msgCapturada.includes('🕒 <b>Horário:</b> 20:45 ➔ 10:15 (TP 088)'),
        'Deve conter linha de horário com número de voo formatado');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('10. enviarAlertaOportunidade: DEVE formatar tempoConexao quando escalas > 0', async () => {
    const { notifierTelegram } = await import('../src/services/notifier_telegram.js');
    let msgCapturada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      msgCapturada = texto;
      return true;
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 2,
        origem: 'Rio de Janeiro (GIG)',
        destinoReal: 'Paris (CDG)',
        dataIda: '2026-12-01',
        dataVolta: '2026-12-15',
        preco: 2850,
        variacaoTexto: 'Caiu 15%',
        ehRecorde: true,
        duracaoHoras: 14.2,
        detalhes: '1 escala em MAD | Iberia',
        link: 'https://flights.google.com',
        escalas: 1,
        tempoConexao: '2h 15min'
      });

      assert.ok(msgCapturada, 'Mensagem deve ter sido montada');
      assert.ok(msgCapturada.includes('⏱️ <b>Tempo de espera em conexão:</b> 2h 15min'),
        'Deve conter tempo de conexão formatado para voo com escalas');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('11. enviarAlertaOportunidade: DEVE exibir bloco de trade-off quando melhorOpcaoDiretaOuRapida estiver presente', async () => {
    const { notifierTelegram } = await import('../src/services/notifier_telegram.js');
    let msgCapturada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      msgCapturada = texto;
      return true;
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 3,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Santiago (SCL)',
        dataIda: '2026-11-10',
        dataVolta: '2026-11-20',
        preco: 1200,
        variacaoTexto: 'Estável',
        ehRecorde: false,
        duracaoHoras: 8.5,
        detalhes: '1 escala em EZE',
        link: 'https://flights.google.com',
        melhorOpcaoDiretaOuRapida: {
          preco: 1450,
          diferencaPreco: 250,
          economiaHoras: 4.5,
          cia: 'LATAM'
        }
      });

      assert.ok(msgCapturada, 'Mensagem deve ter sido montada');
      assert.ok(msgCapturada.includes('⚡ <b>Opção Direta/Rápida:</b> R$ 1450,00 (+R$ 250,00 para economizar 4,5h)'),
        'Deve conter bloco de trade-off direto/rápido com acréscimo de preço e horas economizadas');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('12. enviarAlertaOportunidade: DEVE exibir Termômetro Google para niveis baixo, tipico e alto com faixa típica', async () => {
    const { notifierTelegram } = await import('../src/services/notifier_telegram.js');
    let msgCapturada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      msgCapturada = texto;
      return true;
    };

    try {
      // 12a. Nível Baixo com faixa típica
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 4,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Miami (MIA)',
        dataIda: '2026-11-10',
        preco: 2200,
        duracaoHoras: 9.0,
        detalhes: 'Voo direto | American',
        link: 'https://flights.google.com',
        priceInsights: {
          nivel: 'baixo',
          faixaMinima: 2600,
          faixaMaxima: 3800
        }
      });

      assert.ok(msgCapturada.includes('🟢 <b>Termômetro Google:</b> Preço Baixo para a rota (Faixa típica: R$ 2600 – R$ 3800)'),
        'Deve formatar linha do termômetro para nível baixo com faixa típica');

      // 12b. Nível Típico
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 4,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Miami (MIA)',
        dataIda: '2026-11-10',
        preco: 2900,
        duracaoHoras: 9.0,
        detalhes: 'Voo direto',
        link: 'https://flights.google.com',
        priceInsights: {
          nivel: 'tipico'
        }
      });
      assert.ok(msgCapturada.includes('🟡 <b>Termômetro Google:</b> Preço Típico para a rota'),
        'Deve formatar linha do termômetro para nível típico');

      // 12c. Nível Alto
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 4,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Miami (MIA)',
        dataIda: '2026-11-10',
        preco: 4200,
        duracaoHoras: 9.0,
        detalhes: 'Voo direto',
        link: 'https://flights.google.com',
        priceInsights: {
          nivel: 'alto'
        }
      });
      assert.ok(msgCapturada.includes('🔴 <b>Termômetro Google:</b> Preço Alto para a rota'),
        'Deve formatar linha do termômetro para nível alto');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('13. enviarAlertaOportunidade: DEVE exibir dia vizinho mais barato (melhorDataAlternativa) com link seguro e bloquear links maliciosos', async () => {
    const { notifierTelegram } = await import('../src/services/notifier_telegram.js');
    let msgCapturada = null;
    let botoesCapturados = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto, url, btnTxt, silencioso, keyboard) => {
      msgCapturada = texto;
      botoesCapturados = keyboard;
      return true;
    };

    try {
      // 13a. Melhor data com link seguro https://
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 5,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Lisboa (LIS)',
        dataIda: '2026-11-10',
        dataVolta: '2026-11-20',
        preco: 3200,
        duracaoHoras: 10.0,
        detalhes: 'Voo direto | TAP',
        link: 'https://flights.google.com/base',
        melhorDataAlternativa: {
          offset: 1,
          dataIda: '2026-11-11',
          dataVolta: '2026-11-21',
          preco: 2600,
          economiaReais: 600,
          economiaPercentual: 19,
          linkGoogleFlights: 'https://flights.google.com/alt'
        }
      });

      assert.ok(msgCapturada.includes('📅 <b>Dia Vizinho Mais Barato (+1d):</b> 2026-11-11 ➔ 2026-11-21 por <b>R$ 2600</b> (Economia de R$ 600 / -19%)'),
        'Deve formatar bloco de destaque da melhor data alternativa');
      assert.ok(msgCapturada.includes('<a href="https://flights.google.com/alt">Ver no Google Flights</a>'),
        'Deve incluir link seguro no texto HTML');

      // Botão inline deve ter sido adicionado
      const botaoAlt = botoesCapturados.flat().find(b => b.text && b.text.includes('+1d'));
      assert.ok(botaoAlt, 'Deve incluir botão inline para data vizinha');
      assert.equal(botaoAlt.url, 'https://flights.google.com/alt');

      // 13b. Link malicioso com protocolo javascript: NÃO deve renderizar <a href>
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 5,
        origem: 'São Paulo (GRU)',
        destinoReal: 'Lisboa (LIS)',
        dataIda: '2026-11-10',
        preco: 3200,
        duracaoHoras: 10.0,
        detalhes: 'Voo direto',
        link: 'https://flights.google.com/base',
        melhorDataAlternativa: {
          offset: -1,
          dataIda: '2026-11-09',
          preco: 2800,
          economiaReais: 400,
          economiaPercentual: 13,
          linkGoogleFlights: 'javascript:alert("xss")'
        }
      });

      assert.ok(!msgCapturada.includes('javascript:'), 'NÃO deve renderizar payload javascript:');
      assert.ok(!msgCapturada.includes('Ver no Google Flights'), 'NÃO deve renderizar link para protocolo inseguro');
      const botaoInseguro = botoesCapturados.flat().find(b => b.url && b.url.includes('javascript:'));
      assert.equal(botaoInseguro, undefined, 'Não deve criar botão inline para link inseguro');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('14. enviarAlertaOportunidade: DEVE formatar ranking regional com destaque do vencedor e top destinos', async () => {
    const { notifierTelegram } = await import('../src/services/notifier_telegram.js');
    let msgCapturada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (msg) => {
      msgCapturada = msg;
      return true;
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 10,
        origem: 'São Paulo',
        destinoReal: 'Lisboa (LIS)',
        dataIda: '2027-05-15',
        dataVolta: '2027-05-25',
        preco: 3120,
        duracaoHoras: 10.0,
        detalhes: 'Voo direto',
        link: 'https://flights.google.com/lis',
        rankingDestinosRegionais: [
          { destinoIata: 'LIS', nomeCidade: 'Lisboa', preco: 3120 },
          { destinoIata: 'MAD', nomeCidade: 'Madri', preco: 3390 },
          { destinoIata: 'MXP', nomeCidade: 'Milão', preco: 3510 }
        ]
      });

      assert.ok(msgCapturada.includes('Melhor destino na região:'), 'Deve incluir linha de melhor destino na região');
      assert.ok(msgCapturada.includes('Lisboa (LIS)'), 'Deve citar o vencedor');
      assert.ok(msgCapturada.includes('3120,00'), 'Deve exibir preço do vencedor');
      assert.ok(msgCapturada.includes('Ranking Regional:'), 'Deve incluir título do ranking');
      assert.ok(msgCapturada.includes('1º Lisboa (LIS): R$ 3120'), 'Deve listar 1º colocado');
      assert.ok(msgCapturada.includes('2º Madri (MAD): R$ 3390'), 'Deve listar 2º colocado');
      assert.ok(msgCapturada.includes('3º Milão (MXP): R$ 3510'), 'Deve listar 3º colocado');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });
});

