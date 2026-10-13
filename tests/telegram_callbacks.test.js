import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifierTelegram, escapeHtml, ehPeriodoNoturno } from '../src/services/notifier_telegram.js';
import { rotasRepo } from '../src/db.js';

describe('Telegram Compose & Callbacks (notifier_telegram)', () => {
  it('deve escapar caracteres HTML perigosos adequadamente', () => {
    const raw = '<b>Promo & Oferta <teste></b>';
    const escaped = escapeHtml(raw);
    assert.equal(escaped, '&lt;b&gt;Promo &amp; Oferta &lt;teste&gt;&lt;/b&gt;');
  });

  it('deve lidar defensivamente com valores numéricos (inclusive 0), falsy e aspas em atributos', () => {
    // 1. Número zero e booleanos não devem ser convertidos em string vazia por coerção falsy
    assert.equal(escapeHtml(0), '0');
    assert.equal(escapeHtml(false), 'false');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');

    // 2. Aspas duplas devem ser escapadas para segurança de atributos HTML
    assert.equal(escapeHtml('Tarifa "Relâmpago" & Cia'), 'Tarifa &quot;Relâmpago&quot; &amp; Cia');
  });

  it('deve registrar callback de verificação externa', () => {
    let chamada = false;
    notifierTelegram.registrarCallbackVerificacao(() => {
      chamada = true;
    });
    assert.ok(notifierTelegram.onVerificarRotaCallback);
    notifierTelegram.onVerificarRotaCallback({ id: 999 });
    assert.equal(chamada, true);
  });

  it('deve processar callback de silenciamento temporário', async () => {
    // Cria uma rota temporária para teste
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Madrid',
      data_ida: '2026-12-01',
      data_volta: '2026-12-15'
    });

    assert.equal(rotasRepo.estaSilenciada(rota), false);

    // Silencia rota por 24h
    rotasRepo.silenciarRota(rota.id, 24);
    const rotaSilenciada = rotasRepo.buscarPorId(rota.id);
    rotasRepo.excluir(rota.id);
  });

  it('deve processar comando /paridade de milhas e calcular conversão correta', async () => {
    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.processarComando({
        chat: { id: notifierTelegram.chatId || 12345 },
        text: '/paridade 100000 smiles'
      });

      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('CALCULADORA DE PARIDADE DE MILHAS'));
      assert.ok(mensagemEnviada.includes('100.000 milhas/pontos'));
      assert.ok(mensagemEnviada.includes('1750,00'));
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('deve processar comando /teto para ajustar limite de rota', async () => {
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Madrid',
      data_ida: '2026-12-01',
      data_volta: '2026-12-15',
      preco_alvo: 4000
    });

    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.processarComando({
        chat: { id: notifierTelegram.chatId || 12345 },
        text: `/teto ${rota.id} 3200`
      });

      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.toLowerCase().includes('teto atualizado com sucesso'));
      const rotaAtualizada = rotasRepo.buscarPorId(rota.id);
      assert.equal(rotaAtualizada.preco_alvo, 3200);
    } finally {
      rotasRepo.excluir(rota.id);
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('deve calcular e exibir economia em reais e porcentagem no alerta de oportunidade com botão teto_help', async () => {
    let mensagemEnviada = null;
    let botoesEnviados = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto, link, btnTexto, isSilent, inlineKeyboard) => {
      mensagemEnviada = texto;
      botoesEnviados = inlineKeyboard;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: 99,
        origem: 'São Paulo',
        destinoReal: 'Lisboa',
        dataIda: '2027-03-10',
        dataVolta: '2027-03-24',
        preco: 2400,
        precoAlvo: 3200,
        ehRecorde: true,
        duracaoHoras: 10,
        detalhes: 'Direto TAP',
        link: 'https://google.com'
      });

      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('META BATIDA!'));
      assert.ok(mensagemEnviada.includes('Economia de <b>R$ 800,00</b>'));
      assert.ok(mensagemEnviada.includes('25% abaixo'));
      assert.ok(mensagemEnviada.includes('RECORDE HISTÓRICO'));

      assert.ok(botoesEnviados);
      const botaoTeto = botoesEnviados.flat().find(b => b.callback_data === 'teto_help:99');
      assert.ok(botaoTeto, 'Deve conter botão inline para alterar teto');
      assert.equal(botaoTeto.text, '🎯 Alterar Teto');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('deve processar callback teto_help e orientar alteração de limite', async () => {
    const rota = rotasRepo.criar({
      origem: 'São Paulo',
      destino: 'Roma',
      data_ida: '2026-11-01',
      data_volta: '2026-11-15',
      preco_alvo: 3900
    });

    let mensagemEnviada = null;
    let toastCb = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    const backupCb = notifierTelegram.responderCallbackQuery;

    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };
    notifierTelegram.responderCallbackQuery = async (id, texto) => {
      toastCb = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.processarCallbackQuery({
        id: 'cb_test_123',
        data: `teto_help:${rota.id}`,
        message: { chat: { id: notifierTelegram.chatId || 12345 } }
      });

      assert.ok(toastCb);
      assert.ok(toastCb.includes(`/teto ${rota.id}`));
      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('AJUSTAR TETO DE PREÇO'));
      assert.ok(mensagemEnviada.includes(`/teto ${rota.id}`));
    } finally {
      rotasRepo.excluir(rota.id);
      notifierTelegram.enviarMensagem = backupEnviar;
      notifierTelegram.responderCallbackQuery = backupCb;
    }
  });

  it('enviarAlertaBugFare: deve incluir botão inline "🧳 Ver Regras de Bagagem" quando IATAs da rota estão presentes', async () => {
    let botoesEnviados = null;
    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto, link, btnTexto, isSilent, inlineKeyboard) => {
      mensagemEnviada = texto;
      botoesEnviados = inlineKeyboard;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaBugFare({
        titulo: '🚨 BUG FARE: São Paulo ➔ Paris (CDG) por R$ 890!',
        link: 'https://google.com/flights',
        tipo: '🚨 BUG FARE ESTRUTURAL',
        aeroporto_chegada: 'CDG - Aeroporto Charles de Gaulle',
        pais_destino: 'França',
        periodo_texto: '10 dez a 24 dez (14 dias)',
        preco: 890,
        motivo: 'Tarifa anômala confirmada por Z-Score',
        iata_origem: 'GRU',
        iata_destino: 'CDG'
      });

      // Card deve conter o texto de Bug Fare
      assert.ok(mensagemEnviada);
      assert.ok(mensagemEnviada.includes('BUG FARE ESTRUTURAL'));
      assert.ok(mensagemEnviada.includes('Paris'));

      // Deve haver inline keyboard com 2 linhas
      assert.ok(botoesEnviados, 'Inline keyboard deve estar presente');
      assert.equal(botoesEnviados.length, 2, 'Deve ter 2 linhas no teclado inline');

      // Linha 0: botão principal do Google Flights
      const botaoFlights = botoesEnviados[0][0];
      assert.equal(botaoFlights.text, '⚡ Ver no Google Flights');
      assert.ok(botaoFlights.url.includes('google.com'), 'URL principal deve ser Google');

      // Linha 1: botão de bagagem com IATAs da rota
      const botaoBagagem = botoesEnviados[1][0];
      assert.equal(botaoBagagem.text, '🧳 Ver Regras de Bagagem');
      assert.ok(botaoBagagem.url.includes('GRU'), 'URL de bagagem deve conter IATA de origem');
      assert.ok(botaoBagagem.url.includes('CDG'), 'URL de bagagem deve conter IATA de destino');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('enviarAlertaBugFare: não deve incluir botão de bagagem quando IATAs não estão disponíveis (degradação graciosa)', async () => {
    let botoesEnviados = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto, link, btnTexto, isSilent, inlineKeyboard) => {
      botoesEnviados = inlineKeyboard;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaBugFare({
        titulo: '🚨 BUG FARE: São Paulo ➔ Buenos Aires por R$ 490!',
        link: 'https://google.com/flights',
        tipo: '🚨 BUG FARE',
        preco: 490,
        // iata_origem e iata_destino ausentes — simula card antigo sem os campos
      });

      // Deve ter apenas 1 linha de botão (somente o principal, sem bagagem)
      assert.ok(botoesEnviados, 'Inline keyboard deve estar presente com link');
      assert.equal(botoesEnviados.length, 1, 'Deve ter apenas 1 linha sem IATAs');
      assert.equal(botoesEnviados[0][0].text, '⚡ Ver no Google Flights');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('enviarAlertaBugFare: compatibilidade retroativa com chamada via string simples — link incluído no botão inline', async () => {
    let inlineRecebido = null;
    let mensagemRecebida = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto, link, btnTexto, isSilent, inlineKeyboard) => {
      mensagemRecebida = texto;
      inlineRecebido = inlineKeyboard;
      return { ok: true };
    };

    try {
      // Chamada no formato legado: string + link avulso
      await notifierTelegram.enviarAlertaBugFare(
        'Tarifa Absurda para Roma!',
        'https://google.com/flights/roma'
      );

      // Com URL presente, o botão principal é incorporado no inline keyboard (1 linha, sem bagagem)
      assert.ok(mensagemRecebida, 'Mensagem deve ser enviada');
      assert.ok(inlineRecebido, 'Inline keyboard deve estar presente');
      assert.equal(inlineRecebido.length, 1, 'Deve ter 1 linha com botão principal');
      assert.equal(inlineRecebido[0][0].text, '⚡ Ver no Google Flights');
      assert.equal(inlineRecebido[0][0].url, 'https://google.com/flights/roma', 'URL do botão deve ser o link passado');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('enviarAlertaOportunidade: deve incluir mini-tabela de histórico recente quando a rota tem registros de preço', async () => {
    // Cria uma rota temporária e injeta 3 registros históricos no banco
    const rota = rotasRepo.criar({
      origem: 'Campinas',
      destino: 'Buenos Aires',
      data_ida: '2027-01-10',
      data_volta: '2027-01-20',
      preco_alvo: 2500
    });

    // Injeta histórico via rotasRepo.atualizarResultadoChecagem (atualiza preco_atual e grava historico)
    rotasRepo.atualizarResultadoChecagem(rota.id, { preco: 2100, termometro: '🟡 Médio' });
    rotasRepo.atualizarResultadoChecagem(rota.id, { preco: 1980, termometro: '🟢 Baixo' });
    rotasRepo.atualizarResultadoChecagem(rota.id, { preco: 1850, termometro: '🟢 Mínimo' });

    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: rota.id,
        origem: 'Campinas',
        destinoReal: 'Buenos Aires',
        dataIda: '10/01/2027',
        dataVolta: '20/01/2027',
        preco: 1850,
        duracaoHoras: 3.5,
        detalhes: 'Voo direto Azul',
        link: 'https://google.com/flights'
      });

      assert.ok(mensagemEnviada, 'Mensagem deve ser enviada');
      assert.ok(mensagemEnviada.includes('Histórico Recente'), 'Deve conter seção de histórico');
      assert.ok(mensagemEnviada.includes('R$ 2100') || mensagemEnviada.includes('R$ 1980') || mensagemEnviada.includes('R$ 1850'),
        'Deve conter ao menos um dos preços registrados no histórico');
    } finally {
      rotasRepo.excluir(rota.id);
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('enviarAlertaOportunidade: deve omitir seção de histórico silenciosamente quando não há registros', async () => {
    // Rota nova sem nenhum histórico registrado
    const rota = rotasRepo.criar({
      origem: 'Recife',
      destino: 'Miami',
      data_ida: '2027-06-01'
    });

    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: rota.id,
        origem: 'Recife',
        destinoReal: 'Miami',
        dataIda: '01/06/2027',
        dataVolta: null,
        preco: 3200,
        duracaoHoras: 9,
        detalhes: 'LATAM direto',
        link: 'https://google.com/flights'
      });

      assert.ok(mensagemEnviada, 'Mensagem deve ser enviada mesmo sem histórico');
      assert.ok(!mensagemEnviada.includes('Histórico Recente'), 'Não deve conter seção de histórico quando banco está vazio');
      assert.ok(mensagemEnviada.includes('Tarifas dinâmicas'), 'Deve conter o aviso padrão de tarifas dinâmicas');
    } finally {
      rotasRepo.excluir(rota.id);
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('enviarAlertaOportunidade: deve omitir seção de histórico quando rotaId não é fornecido', async () => {
    let mensagemEnviada = null;
    const backupEnviar = notifierTelegram.enviarMensagem;
    notifierTelegram.enviarMensagem = async (texto) => {
      mensagemEnviada = texto;
      return { ok: true };
    };

    try {
      await notifierTelegram.enviarAlertaOportunidade({
        rotaId: null, // sem ID — alerta avulso / programático
        origem: 'São Paulo',
        destinoReal: 'Tokyo',
        dataIda: '15/04/2027',
        dataVolta: null,
        preco: 4800,
        duracaoHoras: 24,
        detalhes: '1 escala ANA',
        link: 'https://google.com/flights'
      });

      assert.ok(mensagemEnviada, 'Mensagem deve ser enviada');
      assert.ok(!mensagemEnviada.includes('Histórico Recente'), 'Não deve tentar buscar histórico sem rotaId');
    } finally {
      notifierTelegram.enviarMensagem = backupEnviar;
    }
  });

  it('ehPeriodoNoturno: deve avaliar com precisão períodos de silêncio (22h às 07h59) e degradar graciosamente para entradas adversariais', () => {
    // 1. Limiares noturnos (silenciosos): >= 22h ou < 8h
    const d22h00 = new Date(2026, 9, 13, 22, 0, 0);
    assert.equal(ehPeriodoNoturno(d22h00), true, '22h00 deve ser considerado noturno');

    const d23h45 = new Date(2026, 9, 13, 23, 45, 0);
    assert.equal(ehPeriodoNoturno(d23h45), true, '23h45 deve ser considerado noturno');

    const d00h30 = new Date(2026, 9, 13, 0, 30, 0);
    assert.equal(ehPeriodoNoturno(d00h30), true, '00h30 deve ser considerado noturno');

    const d07h59 = new Date(2026, 9, 13, 7, 59, 59);
    assert.equal(ehPeriodoNoturno(d07h59), true, '07h59 deve ser considerado noturno');

    // 2. Limiares diurnos (ativos): entre 08h00 e 21h59
    const d08h00 = new Date(2026, 9, 13, 8, 0, 0);
    assert.equal(ehPeriodoNoturno(d08h00), false, '08h00 deve ser considerado diurno');

    const d14h30 = new Date(2026, 9, 13, 14, 30, 0);
    assert.equal(ehPeriodoNoturno(d14h30), false, '14h30 deve ser considerado diurno');

    const d21h59 = new Date(2026, 9, 13, 21, 59, 59);
    assert.equal(ehPeriodoNoturno(d21h59), false, '21h59 deve ser considerado diurno');

    // 3. Suporte a timestamp numérico e string de data
    assert.equal(ehPeriodoNoturno(d22h00.getTime()), true, 'Timestamp numérico de 22h deve ser noturno');
    assert.equal(ehPeriodoNoturno(d14h30.getTime()), false, 'Timestamp numérico de 14h30 deve ser diurno');

    // 4. Casos adversariais: nulo, indefinido, objeto vazio e Date corrompido degradam sem exceção
    assert.equal(typeof ehPeriodoNoturno(null), 'boolean', 'null não deve lançar erro e retorna booleano');
    assert.equal(typeof ehPeriodoNoturno(undefined), 'boolean', 'undefined não deve lançar erro e retorna booleano');
    assert.equal(typeof ehPeriodoNoturno({}), 'boolean', 'Objeto vazio não deve lançar erro');
    assert.equal(typeof ehPeriodoNoturno(new Date('invalida')), 'boolean', 'Date inválido degrada para booleano seguro');
    assert.equal(typeof ehPeriodoNoturno('texto_aleatorio_sem_data'), 'boolean', 'String inválida degrada para booleano seguro');
  });
});
