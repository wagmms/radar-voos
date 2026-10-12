import { config } from '../config.js';
import { rotasRepo, bugFaresRepo } from '../db.js';
import { serpApiPool } from './serpapi_pool.js';

export function escapeHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function ehPeriodoNoturno() {
  const agora = new Date();
  const hora = agora.getHours();
  // Silencioso entre 22h e 07h59
  return hora >= 22 || hora < 8;
}

class NotifierTelegram {
  constructor() {
    this.token = config.telegram.botToken;
    this.chatId = config.telegram.chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
    this.pollingAtivo = false;
    this.ultimoUpdateId = 0;
  }

  async enviarMensagem(textoHtml, urlBotao = null, textoBotao = '✈️ Ver voos', forcarSilencioso = false) {
    if (!this.token || !this.chatId) {
      console.warn('Telegram não configurado (sem token ou chatId)');
      return false;
    }

    const ehSilencioso = forcarSilencioso || ehPeriodoNoturno();

    const payload = {
      chat_id: this.chatId,
      text: textoHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: ehSilencioso
    };

    if (urlBotao) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: textoBotao, url: urlBotao }]]
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data.ok;
    } catch (err) {
      console.error('Erro ao enviar mensagem Telegram:', err.message);
      return false;
    }
  }

  async enviarAlertaOportunidade({
    origem,
    destinoReal,
    dataIda,
    dataVolta,
    preco,
    variacaoTexto,
    ehRecorde,
    custoInfo,
    duracaoHoras,
    detalhes,
    dicaStopover,
    link
  }) {
    const voltaTexto = dataVolta ? ` até ${dataVolta}` : ' (Só Ida)';
    let prefixoAssunto = '✈️ OPORTUNIDADE DE VOO';
    let emoji = '✈️';

    if (variacaoTexto.includes('Caiu')) {
      prefixoAssunto = '🚨 QUEDA RELÂMPAGO';
      emoji = '🚨';
    } else if (ehRecorde) {
      prefixoAssunto = '🏆 NOVO RECORDE DE PREÇO BAIXO';
      emoji = '🏆';
    }

    let msg = `<b>${emoji} ${escapeHtml(prefixoAssunto)}</b>\n\n`;
    msg += `✈️ <b>${escapeHtml(origem)} ➔ ${escapeHtml(destinoReal)}</b>\n`;
    msg += `📅 ${escapeHtml(dataIda)}${escapeHtml(voltaTexto)}\n`;
    msg += `💰 <b>Voo: R$ ${preco.toFixed(2).replace('.', ',')}</b>\n`;

    if (variacaoTexto && variacaoTexto !== 'Estável' && variacaoTexto !== 'Primeira Checagem') {
      msg += `📊 ${escapeHtml(variacaoTexto)}\n`;
    }

    if (custoInfo && custoInfo.diasViagem > 0) {
      msg += `🏨 Estadia (${custoInfo.diasViagem}d): ~R$ ${custoInfo.custoTerrestre.toFixed(0)}\n`;
      msg += `💵 <b>CUSTO TOTAL ESTIMADO: ~R$ ${custoInfo.custoTotalEstimado.toFixed(0)}</b>\n`;
    } else if (custoInfo && custoInfo.textoBase) {
      msg += `🏨 Custo no Destino: ${escapeHtml(custoInfo.textoBase)}\n`;
    }

    msg += `⏱️ ${duracaoHoras.toFixed(1).replace('.', ',')}h | ${escapeHtml(detalhes)}\n`;

    if (dicaStopover && dicaStopover !== '-') {
      msg += `\n💡 <i>${escapeHtml(dicaStopover)}</i>\n`;
    }

    msg += `\n⚠️ <i>Preços sujeitos a alteração em tempo real pelas companhias.</i>`;

    return this.enviarMensagem(msg, link, '✈️ Ver no Google Flights');
  }

  async enviarAlertaBugFare(titulo, link, tipo = '🚨 BUG FARE (ERRO DE TARIFA!)') {
    let msg = `<b>${escapeHtml(tipo)}</b>\n\n`;
    msg += `📢 <b>${escapeHtml(titulo)}</b>\n\n`;
    msg += `⚡ <i>ATENÇÃO: Erros de tarifa esgotam em questão de minutos! Verifique a disponibilidade imediatamente.</i>`;

    return this.enviarMensagem(msg, link, '⚡ Ver Oferta Imediatamente');
  }

  /**
   * Inicia o polling de comandos interativos no Telegram
   */
  iniciarPolling() {
    if (this.pollingAtivo || !config.telegram.polling || !this.token) return;
    this.pollingAtivo = true;

    const loop = async () => {
      while (this.pollingAtivo) {
        try {
          const url = `${this.baseUrl}/getUpdates?offset=${this.ultimoUpdateId + 1}&timeout=20`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.ultimoUpdateId = update.update_id;
              if (update.message && update.message.text) {
                await this.processarComando(update.message);
              }
            }
          }
        } catch (err) {
          // Erro silencioso de rede no polling, aguarda 5s antes de retentar
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    };

    loop();
    console.log('🤖 Bot do Telegram inicializado com polling interativo de comandos!');
  }

  pararPolling() {
    this.pollingAtivo = false;
  }

  async processarComando(msg) {
    const chatId = String(msg.chat.id);
    // Autoriza apenas o chat configurado para segurança
    if (this.chatId && chatId !== String(this.chatId)) {
      return;
    }

    const texto = msg.text.trim();

    if (texto === '/start' || texto === '/ajuda') {
      const resposta =
        `✈️ <b>RADAR DE VOOS - TRAVEL HACKING ENGINE</b>\n\n` +
        `Comandos disponíveis:\n` +
        `• /rotas - Lista todas as rotas monitoradas e preços atuais\n` +
        `• /status - Relatório de saúde do pool de chaves SerpAPI e cotas\n` +
        `• /bugs - Últimos Bug Fares e Erros de Tarifa detectados\n` +
        `• /ping - Verifica se o robô está ativo e operacional\n\n` +
        `<i>Acesse o Dashboard Web completo em http://localhost:${config.port}</i>`;
      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto === '/status') {
      const relatorio = serpApiPool.obterRelatorio();
      let resposta =
        `📊 <b>STATUS DO RADAR DE VOOS</b>\n\n` +
        `• Buscas Hoje: <b>${relatorio.buscasHoje} / ${relatorio.limiteDiarioTotal}</b>\n` +
        `• Buscas no Mês: <b>${relatorio.buscasMes} / ${relatorio.limiteMensalTotal}</b>\n` +
        `• Cota Restante no Mês: <b>${relatorio.cotaMensalRestante}</b>\n\n` +
        `<b>Chaves do Pool:</b>\n`;

      for (const ch of relatorio.chaves) {
        resposta += `• Chave ${ch.indice} (${ch.chaveMascarada}): ${ch.contadorDiario}/${ch.limiteDiario} dia [${ch.estado}]\n`;
      }

      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto === '/rotas') {
      const rotas = rotasRepo.listarTodas(true);
      if (rotas.length === 0) {
        await this.enviarMensagem('Nenhuma rota ativa cadastrada no momento.', null, '', false);
        return;
      }

      let resposta = `✈️ <b>ROTAS MONITORADAS (${rotas.length})</b>\n\n`;
      for (const r of rotas.slice(0, 10)) {
        const precoStr = r.preco_atual ? `R$ ${r.preco_atual.toFixed(2)}` : 'Aguardando checagem';
        resposta += `• <b>${escapeHtml(r.origem)} ➔ ${escapeHtml(r.destino)}</b>\n`;
        resposta += `  📅 ${r.data_ida}${r.data_volta ? ' até ' + r.data_volta : ' (Só Ida)'}\n`;
        resposta += `  💰 Preço Atual: <b>${precoStr}</b> | Meta: R$ ${r.preco_alvo || '-'}\n`;
        resposta += `  🌡️ ${escapeHtml(r.termometro || 'Sem dados')}\n\n`;
      }

      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto === '/bugs') {
      const bugs = bugFaresRepo.listarRecentes(5);
      if (bugs.length === 0) {
        await this.enviarMensagem('Nenhum Bug Fare recente detectado no feed.', null, '', false);
        return;
      }

      let resposta = `🚨 <b>ÚLTIMOS BUG FARES DETECTADOS</b>\n\n`;
      for (const b of bugs) {
        resposta += `• <b>${escapeHtml(b.titulo)}</b>\n🔗 ${b.link}\n\n`;
      }
      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto === '/ping') {
      await this.enviarMensagem('🏓 Pong! O Radar de Voos está 100% online e operante.', null, '', false);
    }
  }
}

export const notifierTelegram = new NotifierTelegram();
