import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarCardRota,
  copiarLinkGoogleFlights,
  formatarCodigoBadge,
  formatarDataBr,
  escapeHtml,
  calcularMilhasEstimadas,
  renderizarBadgeMilhas,
  salvarMilhasInline,
  COTACOES_MILHA_MILHEIRO
} from '../src/public/js/card_rota.js';

describe('Cockpit PWA: Card de Rota e Cópia Rápida de Link (card_rota.js)', () => {
  const rotaPadrao = {
    id: 101,
    origem: 'São Paulo',
    destino: 'Lisboa',
    codigo_origem: 'GRU',
    codigo_destino: 'LIS',
    data_ida: '2026-11-15',
    data_volta: '2026-11-28',
    preco_atual: 2450.00,
    preco_alvo: 2800.00,
    menor_preco_historico: 2200.00,
    termometro: '🟢 Preço Excelente',
    detalhes_voo: 'TAP Air Portugal • Direto • 10h',
    link_google_flights: 'https://www.google.com/travel/flights?tfs=CBEMA...&curr=BRL',
    historico_recente: [2900, 2750, 2600, 2450]
  };

  it('deve gerar a estrutura HTML do card com botão de cópia rápida do Google Flights', () => {
    const html = criarCardRota(rotaPadrao);

    assert.ok(html.includes('id="card-rota-101"'), 'deve conter o ID do card');
    assert.ok(html.includes('GRU'), 'deve exibir código de origem');
    assert.ok(html.includes('LIS'), 'deve exibir código de destino');
    assert.ok(html.includes('R$ 2450,00'), 'deve formatar preço atual');

    // Botão de link externo tradicional
    assert.ok(html.includes('class="btn-flights-external"'));
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes('rel="noopener noreferrer"'));

    // Novo botão de cópia rápida
    assert.ok(html.includes('btn-copy-link'), 'deve conter classe do botão de cópia rápida');
    assert.ok(html.includes('title="Copiar link do Google Flights"'), 'deve ter tooltip de cópia rápida');
    assert.ok(html.includes('aria-label="Copiar link do Google Flights"'), 'deve ser acessível');
    assert.ok(html.includes('onclick="copiarLinkGoogleFlights(event,'), 'deve vincular evento onclick');
    assert.ok(html.includes(escapeHtml(rotaPadrao.link_google_flights)), 'deve passar o link escapado para a função');
  });

  it('deve escapar atributos HTML defensivamente para evitar quebras por aspas ou caracteres especiais', () => {
    const rotaComLinkEspecial = {
      ...rotaPadrao,
      id: 102,
      link_google_flights: 'https://www.google.com/travel/flights?q="Lisboa"&destino=\'LIS\'&promo=1<2'
    };

    const html = criarCardRota(rotaComLinkEspecial);
    assert.ok(html.includes('&quot;Lisboa&quot;'));
    assert.ok(html.includes('&#39;LIS&#39;'));
    assert.ok(!html.includes('onclick="copiarLinkGoogleFlights(event, \'https://www.google.com/travel/flights?q="Lisboa"'));
  });

  it('deve lidar graciosamente com rota vazia ou propriedades ausentes', () => {
    assert.equal(criarCardRota(null), '');
    assert.equal(criarCardRota(undefined), '');

    const rotaMinima = {
      id: 99,
      origem: 'Rio de Janeiro',
      destino: 'Madrid'
    };

    const html = criarCardRota(rotaMinima);
    assert.ok(html.includes('id="card-rota-99"'));
    assert.ok(html.includes('btn-copy-link'));
    assert.ok(html.includes('Aguardando'));
  });

  it('deve aplicar status visual apropriado (meta atingida, promoção, flexível)', () => {
    // Meta atingida (preço atual <= alvo)
    const cardMeta = criarCardRota({
      ...rotaPadrao,
      preco_atual: 1500,
      preco_alvo: 1600
    });
    assert.ok(cardMeta.includes('status-meta'));

    // Flexível (sem data fixa)
    const cardFlex = criarCardRota({
      ...rotaPadrao,
      sem_data: 1
    });
    assert.ok(cardFlex.includes('status-flexivel'));

    // Promoção
    const cardPromo = criarCardRota({
      ...rotaPadrao,
      preco_atual: 3000,
      preco_alvo: 2000,
      termometro: '🟢 Super Barato'
    });
    assert.ok(cardPromo.includes('status-promo'));
  });

  it('deve identificar Só Ida vs Ida e Volta e tags de cabine', () => {
    const cardSoIda = criarCardRota({
      ...rotaPadrao,
      tipo_viagem: 'one_way',
      data_volta: 'Só Ida'
    });
    assert.ok(cardSoIda.includes('SÓ IDA'));
    assert.ok(cardSoIda.includes('➡️ Apenas Ida'));

    const cardBusiness = criarCardRota({
      ...rotaPadrao,
      cabine: 'business'
    });
    assert.ok(cardBusiness.includes('BUSINESS'));
  });

  describe('copiarLinkGoogleFlights: Lógica de Cópia e Feedback Toast', () => {
    it('deve copiar com sucesso via navigator.clipboard e exibir toast de 2s ("Link copiado! ✓")', async () => {
      let textoCopiado = null;
      let toastMensagem = null;
      let toastErro = null;
      let toastDuracao = null;
      let vibracaoChamada = false;

      const mockClipboard = {
        writeText: async (txt) => {
          textoCopiado = txt;
        }
      };

      const mockToast = (msg, err, duracao) => {
        toastMensagem = msg;
        toastErro = err;
        toastDuracao = duracao;
      };

      const mockVibrar = () => {
        vibracaoChamada = true;
      };

      const fakeEvent = {
        stopPropagation: () => {}
      };

      const url = 'https://www.google.com/travel/flights?tfs=CBEMA123';
      const sucesso = await copiarLinkGoogleFlights(fakeEvent, url, {
        clipboard: mockClipboard,
        mostrarToast: mockToast,
        vibrar: mockVibrar
      });

      assert.equal(sucesso, true);
      assert.equal(textoCopiado, url);
      assert.equal(toastMensagem, 'Link copiado! ✓');
      assert.equal(toastErro, false);
      assert.equal(toastDuracao, 2000, 'o feedback toast deve durar 2000ms (2s)');
      assert.equal(vibracaoChamada, true);
    });

    it('deve impedir propagação do evento para não acionar cliques indesejados no card', async () => {
      let propagacaoParada = false;
      const fakeEvent = {
        stopPropagation: () => {
          propagacaoParada = true;
        }
      };

      await copiarLinkGoogleFlights(fakeEvent, 'https://flights.google.com', {
        clipboard: { writeText: async () => {} },
        mostrarToast: () => {}
      });

      assert.equal(propagacaoParada, true);
    });

    it('deve retornar falso e notificar erro quando o link for vazio, nulo ou inválido', async () => {
      let toastMensagem = null;
      let toastErro = null;

      const mockToast = (msg, err) => {
        toastMensagem = msg;
        toastErro = err;
      };

      // String vazia
      const resVazio = await copiarLinkGoogleFlights(null, '', { mostrarToast: mockToast });
      assert.equal(resVazio, false);
      assert.equal(toastMensagem, 'Link não disponível para cópia');
      assert.equal(toastErro, true);

      // Null
      const resNull = await copiarLinkGoogleFlights(null, null, { mostrarToast: mockToast });
      assert.equal(resNull, false);

      // '#'
      const resHash = await copiarLinkGoogleFlights(null, '#', { mostrarToast: mockToast });
      assert.equal(resHash, false);
    });

    it('deve capturar falhas na API de clipboard defensivamente sem lançar erro não tratado', async () => {
      let toastMensagem = null;
      let toastErro = null;

      const mockClipboardComErro = {
        writeText: async () => {
          throw new Error('NotAllowedError: Permission denied');
        }
      };

      const mockToast = (msg, err) => {
        toastMensagem = msg;
        toastErro = err;
      };

      const sucesso = await copiarLinkGoogleFlights(null, 'https://test.com', {
        clipboard: mockClipboardComErro,
        mostrarToast: mockToast
      });

      assert.equal(sucesso, false);
      assert.equal(toastMensagem, 'Erro ao copiar link');
      assert.equal(toastErro, true);
    });
  });

  describe('Funções Utilitárias: Formatação e Escape', () => {
    it('formatarCodigoBadge deve mapear códigos especiais de continentes', () => {
      assert.equal(formatarCodigoBadge('/m/06_1'), 'AMSUL');
      assert.equal(formatarCodigoBadge('/m/02j9z'), 'EUROPA');
      assert.equal(formatarCodigoBadge('/m/02j1x'), 'ÁSIA');
      assert.equal(formatarCodigoBadge('/m/02_286'), 'AMNORTE');
      assert.equal(formatarCodigoBadge('/m/056_y'), 'AMCENTRAL');
      assert.equal(formatarCodigoBadge('/m/0164v'), 'ÁFRICA');
      assert.equal(formatarCodigoBadge('/m/05h_p'), 'OCEANIA');
      assert.equal(formatarCodigoBadge('gru'), 'GRU');
      assert.equal(formatarCodigoBadge(null), 'DEST');
    });

    it('formatarDataBr deve formatar datas ISO para padrão brasileiro DD/MM/AAAA', () => {
      assert.equal(formatarDataBr('2026-12-25'), '25/12/2026');
      assert.equal(formatarDataBr('2026-01-01'), '01/01/2026');
      assert.equal(formatarDataBr(null), '-');
      assert.equal(formatarDataBr(''), '-');
    });

    it('escapeHtml deve escapar todos os caracteres perigosos', () => {
      assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
      assert.equal(escapeHtml("it's"), 'it&#39;s');
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
    });
  });

  describe('Badge de Milhas Estimadas: calcularMilhasEstimadas e renderizarBadgeMilhas', () => {
    it('calcularMilhasEstimadas deve calcular milhas corretamente com paridade customizada', () => {
      // R$ 1.750 / R$ 17,50 por milheiro = 100.000 milhas exatas (ceil de 100000.0 = 100000)
      const res = calcularMilhasEstimadas(1750, 17.50, 'smiles');
      assert.ok(res !== null, 'deve retornar objeto válido');
      assert.equal(res.milhas, 100000);
      assert.equal(res.programa, 'smiles');
      assert.equal(res.cotacaoMilheiro, 17.50);
    });

    it('calcularMilhasEstimadas deve usar cotação padrão Smiles quando paridade for nula ou inválida', () => {
      // Sem paridade: fallback para 17.50 (Smiles)
      const resNull = calcularMilhasEstimadas(2450, null, 'smiles');
      assert.ok(resNull !== null);
      const cotacaoPadrao = COTACOES_MILHA_MILHEIRO.smiles;
      const milhasEsperadas = Math.ceil((2450 / cotacaoPadrao) * 1000);
      assert.equal(resNull.milhas, milhasEsperadas);
      assert.equal(resNull.cotacaoMilheiro, cotacaoPadrao);

      // Programa inválido: fallback para cotação Smiles
      const resProgInvalido = calcularMilhasEstimadas(2450, null, 'inexistente');
      assert.ok(resProgInvalido !== null);
      assert.equal(resProgInvalido.cotacaoMilheiro, cotacaoPadrao);
    });

    it('calcularMilhasEstimadas deve retornar null para preço zero, negativo ou inválido', () => {
      assert.equal(calcularMilhasEstimadas(0, 17.50), null);
      assert.equal(calcularMilhasEstimadas(-500, 17.50), null);
      assert.equal(calcularMilhasEstimadas(null, 17.50), null);
      assert.equal(calcularMilhasEstimadas(undefined, 17.50), null);
      assert.equal(calcularMilhasEstimadas('abc', 17.50), null);
    });

    it('renderizarBadgeMilhas deve retornar HTML com badge e editor inline quando rota tem id', () => {
      const rota = {
        id: 42,
        preco_atual: 2450,
        paridade_milhas: 24.00,
        programa_milhas: 'latam'
      };
      const html = renderizarBadgeMilhas(rota);
      assert.ok(html.includes('badge-milhas-estimadas'), 'deve conter classe da badge');
      assert.ok(html.includes('id="badge-milhas-42"'), 'deve conter ID do card na badge');
      assert.ok(html.includes('btn-milhas-editar'), 'deve conter botão de edição inline');
      assert.ok(html.includes('toggleMilhasEditor(42)'), 'deve vincular toggle ao ID correto');
      assert.ok(html.includes('milhas-form-42'), 'deve conter ID do formulário inline');
      assert.ok(html.includes('milhas-prog-42'), 'deve conter ID do select de programa');
      assert.ok(html.includes('milhas-cot-42'), 'deve conter ID do input de cotação');
      assert.ok(html.includes('salvarMilhasInline(42)'), 'deve vincular salvar ao ID correto');
      // Com preco_atual deve exibir estimativa
      assert.ok(html.includes('milhas-estimativa-row'), 'deve exibir badge de estimativa');
      assert.ok(html.includes('milhas'), 'deve mencionar milhas na estimativa');
      assert.ok(html.includes('Latam'), 'deve exibir nome do programa capitalizado');
      // 2450 / 24.00 * 1000 = ceil(102083.33) = 102084
      const milhasEsperadas = Math.ceil((2450 / 24.00) * 1000).toLocaleString('pt-BR');
      assert.ok(html.includes(milhasEsperadas), `deve exibir ${milhasEsperadas} milhas na estimativa`);
    });

    it('renderizarBadgeMilhas deve exibir botão "Configurar milhas" quando paridade não definida', () => {
      const rota = { id: 99, preco_atual: 1800, programa_milhas: 'smiles' };
      const html = renderizarBadgeMilhas(rota);
      assert.ok(html.includes('Configurar milhas'), 'deve sugerir configuração quando sem paridade');
    });

    it('renderizarBadgeMilhas deve exibir botão com cotação quando paridade está definida', () => {
      const rota = { id: 55, preco_atual: 1800, paridade_milhas: 17.50, programa_milhas: 'smiles' };
      const html = renderizarBadgeMilhas(rota);
      assert.ok(html.includes('17,50') || html.includes('17.50'), 'deve exibir cotação atual no botão');
    });

    it('renderizarBadgeMilhas deve conter todas as opções de programa no select', () => {
      const rota = { id: 10, preco_atual: 2000, programa_milhas: 'azul' };
      const html = renderizarBadgeMilhas(rota);
      assert.ok(html.includes('<option value="smiles"'), 'deve ter Smiles no select');
      assert.ok(html.includes('<option value="latam"'), 'deve ter Latam no select');
      assert.ok(html.includes('<option value="azul" selected'), 'deve pré-selecionar Azul');
    });

    it('renderizarBadgeMilhas deve retornar string vazia quando rota não tem id', () => {
      assert.equal(renderizarBadgeMilhas(null), '');
      assert.equal(renderizarBadgeMilhas({}), '');
      assert.equal(renderizarBadgeMilhas(undefined), '');
    });

    it('renderizarBadgeMilhas deve ocultar estimativa quando não há preco_atual mas exibir editor', () => {
      const rota = { id: 77 };
      const html = renderizarBadgeMilhas(rota);
      // Deve ainda ter o widget, mas sem a linha de estimativa
      assert.ok(html.includes('badge-milhas-estimadas'), 'deve ter a badge');
      assert.ok(!html.includes('milhas-estimativa-row'), 'não deve ter estimativa sem preço');
    });

    it('criarCardRota deve incluir badge-milhas-estimadas quando rota tem id', () => {
      const rotaComParidade = {
        id: 200,
        origem: 'Brasília',
        destino: 'Paris',
        codigo_origem: 'BSB',
        codigo_destino: 'CDG',
        preco_atual: 3500,
        paridade_milhas: 17.50,
        programa_milhas: 'smiles',
        link_google_flights: 'https://flights.google.com'
      };
      const html = criarCardRota(rotaComParidade);
      assert.ok(html.includes('badge-milhas-estimadas'), 'card deve conter badge de milhas');
      assert.ok(html.includes('milhas-form-200'), 'card deve conter formulário inline');
      // 3500 / 17.50 * 1000 = ceil(200000) = 200.000
      assert.ok(html.includes('200.000') || html.includes('200000'), 'deve exibir 200.000 milhas');
      assert.ok(html.includes('Smiles'), 'deve identificar programa Smiles');
    });
  });

  describe('salvarMilhasInline: Persistência via PATCH /api/rotas/:id/milhas', () => {
    // Cria um mock de document com getElementById funcional
    function criarDocMock(progVal, cotVal) {
      const elements = {
        [`milhas-prog-42`]: { value: progVal, classList: { add: () => {}, remove: () => {} } },
        [`milhas-cot-42`]: { value: cotVal, classList: { add() { this._erro = true; }, remove() { this._erro = false; }, _erro: false } }
      };
      const formEl = { style: { display: 'block' }, _hidden: false };
      elements[`milhas-form-42`] = formEl;
      return { getElementById: (id) => elements[id] || null };
    }

    it('deve salvar com sucesso via PATCH e exibir toast de confirmação', async () => {
      let fetchBody = null;
      let toastMsg = null;
      let toastErro = null;
      let recarregouDados = false;
      const formEl = { style: { display: 'block' } };

      const mockDoc = {
        getElementById: (id) => {
          if (id === 'milhas-prog-42') return { value: 'latam', classList: { add() {}, remove() {} } };
          if (id === 'milhas-cot-42') return { value: '24.00', classList: { add() {}, remove() {} } };
          if (id === 'milhas-form-42') return formEl;
          return null;
        }
      };

      const mockFetch = async (url, opts) => {
        fetchBody = JSON.parse(opts.body);
        return { ok: true, json: async () => ({}) };
      };

      const res = await salvarMilhasInline(42, {
        document: mockDoc,
        fetch: mockFetch,
        mostrarToast: (msg, erro) => { toastMsg = msg; toastErro = erro; },
        recarregarDados: () => { recarregouDados = true; }
      });

      assert.equal(res, true, 'deve retornar true em caso de sucesso');
      assert.equal(fetchBody.paridade_milhas, 24.00, 'deve enviar paridade correta');
      assert.equal(fetchBody.programa_milhas, 'latam', 'deve enviar programa correto');
      assert.ok(toastMsg.includes('salva'), 'toast deve confirmar salvamento');
      assert.equal(toastErro, false, 'toast não deve ser erro');
      assert.equal(recarregouDados, true, 'deve recarregar dados após salvar');
      assert.equal(formEl.style.display, 'none', 'deve fechar o formulário após salvar');
    });

    it('deve rejeitar paridade inválida (zero ou negativa) com feedback visual', async () => {
      let toastMsg = null;
      let classeErroAdicionada = false;

      const inputMock = {
        value: '0',
        classList: { add(cls) { if (cls === 'milhas-input-erro') classeErroAdicionada = true; }, remove() {} }
      };

      const mockDoc = {
        getElementById: (id) => {
          if (id === 'milhas-prog-42') return { value: 'smiles', classList: { add() {}, remove() {} } };
          if (id === 'milhas-cot-42') return inputMock;
          return null;
        }
      };

      const res = await salvarMilhasInline(42, {
        document: mockDoc,
        fetch: async () => ({ ok: true }),
        mostrarToast: (msg, _) => { toastMsg = msg; }
      });

      assert.equal(res, false, 'deve retornar false para cotação zero');
      assert.ok(toastMsg.includes('inválida') || toastMsg.includes('positivo'), 'toast deve descrever o erro');
      assert.equal(classeErroAdicionada, true, 'deve adicionar classe de erro ao input');
    });

    it('deve rejeitar paridade NaN com feedback visual', async () => {
      let toastMsg = null;
      const inputMock = {
        value: 'abc',
        classList: { add() {}, remove() {} }
      };
      const mockDoc = {
        getElementById: (id) => {
          if (id === 'milhas-prog-42') return { value: 'smiles', classList: { add() {}, remove() {} } };
          if (id === 'milhas-cot-42') return inputMock;
          return null;
        }
      };

      const res = await salvarMilhasInline(42, {
        document: mockDoc,
        fetch: async () => ({ ok: true }),
        mostrarToast: (msg) => { toastMsg = msg; }
      });

      assert.equal(res, false, 'deve retornar false para NaN');
      assert.ok(toastMsg.length > 0, 'deve exibir toast de erro');
    });

    it('deve retornar false quando elementos do formulário não são encontrados no DOM', async () => {
      const mockDoc = { getElementById: () => null };
      const res = await salvarMilhasInline(42, {
        document: mockDoc,
        fetch: async () => ({ ok: true }),
        mostrarToast: () => {}
      });
      assert.equal(res, false, 'deve retornar false quando DOM incompleto');
    });

    it('deve retornar false quando fetch lança exceção (erro de rede)', async () => {
      let toastMsg = null;
      const mockDoc = {
        getElementById: (id) => {
          if (id === 'milhas-prog-42') return { value: 'smiles', classList: { add() {}, remove() {} } };
          if (id === 'milhas-cot-42') return { value: '17.50', classList: { add() {}, remove() {} } };
          if (id === 'milhas-form-42') return { style: { display: 'block' } };
          return null;
        }
      };

      const res = await salvarMilhasInline(42, {
        document: mockDoc,
        fetch: async () => { throw new Error('Network error'); },
        mostrarToast: (msg) => { toastMsg = msg; }
      });

      assert.equal(res, false, 'deve retornar false em erro de rede');
      assert.ok(toastMsg.includes('Falha') || toastMsg.includes('comunicação'), 'deve exibir mensagem de falha');
    });

    it('deve retornar false quando servidor retorna erro HTTP', async () => {
      let toastMsg = null;
      const mockDoc = {
        getElementById: (id) => {
          if (id === 'milhas-prog-42') return { value: 'smiles', classList: { add() {}, remove() {} } };
          if (id === 'milhas-cot-42') return { value: '17.50', classList: { add() {}, remove() {} } };
          if (id === 'milhas-form-42') return { style: { display: 'block' } };
          return null;
        }
      };

      const res = await salvarMilhasInline(42, {
        document: mockDoc,
        fetch: async () => ({ ok: false, json: async () => ({ erro: 'paridade_milhas inválida' }) }),
        mostrarToast: (msg) => { toastMsg = msg; }
      });

      assert.equal(res, false, 'deve retornar false em erro do servidor');
      assert.ok(toastMsg.includes('inválida') || toastMsg.includes('Erro'), 'deve exibir erro do servidor');
    });

    it('deve retornar false quando document ou fetch não disponíveis', async () => {
      const res = await salvarMilhasInline(42, {});
      assert.equal(res, false, 'deve retornar false sem document/fetch');
    });
  });
});

