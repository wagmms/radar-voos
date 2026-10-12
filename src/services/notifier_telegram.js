import { config } from '../config.js';
import { rotasRepo, bugFaresRepo } from '../db.js';
import { serpApiPool } from './serpapi_pool.js';
import { weatherService } from './weather_service.js';

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
    this.onVerificarRotaCallback = null; // injetado externamente para evitar ciclo
  }

  registrarCallbackVerificacao(fn) {
    this.onVerificarRotaCallback = fn;
  }

  async enviarMensagem(textoHtml, urlBotao = null, textoBotao = '✈️ Ver voos', forcarSilencioso = false, inlineKeyboard = null) {
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

    if (inlineKeyboard && Array.isArray(inlineKeyboard)) {
      payload.reply_markup = { inline_keyboard: inlineKeyboard };
    } else if (urlBotao) {
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

      if (data && data.error_code === 429) {
        const retryAfter = (data.parameters && data.parameters.retry_after) || 5;
        console.warn(`[Telegram FloodWait] Aguardando ${retryAfter}s devido a rate limit.`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return this.enviarMensagem(textoHtml, urlBotao, textoBotao, forcarSilencioso, inlineKeyboard);
      }

      return Boolean(data.ok);
    } catch (err) {
      console.error('Erro ao enviar mensagem Telegram:', err.message);
      return false;
    }
  }

  async responderCallbackQuery(callbackQueryId, textoToast = '', showAlert = false) {
    try {
      await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: textoToast,
          show_alert: showAlert
        })
      });
    } catch (err) {
      console.error('Erro ao responder callback query:', err.message);
    }
  }

  async enviarAlertaOportunidade({
    rotaId,
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
    link,
    clima = null,
    semData = false,
    labelJanela = null
  }) {
    const voltaTexto = dataVolta ? ` até ${dataVolta}` : ' (Só Ida)';
    let prefixoAssunto = '✈️ OPORTUNIDADE DE VOO';
    let emoji = '✈️';

    if (semData) {
      prefixoAssunto = '🔥 MENOR PREÇO ENCONTRADO (DATAS FLEXÍVEIS)';
      emoji = '🔥';
    } else if (variacaoTexto && variacaoTexto.includes('Caiu')) {
      prefixoAssunto = '🚨 QUEDA RELÂMPAGO';
      emoji = '🚨';
    } else if (ehRecorde) {
      prefixoAssunto = '🏆 NOVO RECORDE DE PREÇO BAIXO';
      emoji = '🏆';
    }

    let msg = `<b>${emoji} ${escapeHtml(prefixoAssunto)}</b>\n\n`;
    msg += `✈️ <b>${escapeHtml(origem)} ➔ ${escapeHtml(destinoReal)}</b>\n`;

    if (semData) {
      msg += `📅 <b>Melhor Período:</b> ${escapeHtml(dataIda)}${escapeHtml(voltaTexto)}${labelJanela ? ` • <i>${escapeHtml(labelJanela)}</i>` : ''}\n`;
      msg += `✨ <i>Modo Flexível Ativo: rastreando a menor tarifa nos próximos meses.</i>\n`;
    } else {
      msg += `📅 ${escapeHtml(dataIda)}${escapeHtml(voltaTexto)}\n`;
    }

    msg += `💰 <b>Voo: R$ ${preco.toFixed(2).replace('.', ',')}</b>\n`;

    if (variacaoTexto && variacaoTexto !== 'Estável' && variacaoTexto !== 'Primeira Checagem') {
      msg += `📊 ${escapeHtml(variacaoTexto)}\n`;
    }

    if (clima && clima.resumo) {
      msg += `🌤️ Destino: <b>${escapeHtml(clima.resumo)}</b>\n`;
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

    msg += `\n⚠️ <i>Tarifas dinâmicas sujeitas a alteração pelas companhias.</i>`;

    const inlineKeyboard = [
      [{ text: '✈️ Comprar no Google Flights', url: link }]
    ];

    if (rotaId) {
      inlineKeyboard.push([
        { text: '🔍 Checar Agora', callback_data: `check:${rotaId}` },
        { text: '🔕 Silenciar 24h', callback_data: `mute24:${rotaId}` }
      ]);
      inlineKeyboard.push([
        { text: '🌤️ Previsão do Clima', callback_data: `weather:${rotaId}` }
      ]);
    }

    return this.enviarMensagem(msg, null, '', false, inlineKeyboard);
  }

  async enviarAlertaBugFare(titulo, link, tipo = '🚨 BUG FARE (ERRO DE TARIFA!)') {
    let msg = `<b>${escapeHtml(tipo)}</b>\n\n`;
    msg += `📢 <b>${escapeHtml(titulo)}</b>\n\n`;
    msg += `⚡ <i>ATENÇÃO: Erros de tarifa esgotam em questão de minutos! Verifique a disponibilidade imediatamente.</i>`;

    return this.enviarMensagem(msg, link, '⚡ Ver Oferta Imediatamente');
  }

  /**
   * Inicia o polling de comandos interativos e callback queries no Telegram
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
              } else if (update.callback_query) {
                await this.processarCallbackQuery(update.callback_query);
              }
            }
          }
        } catch (err) {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    };

    loop();
    console.log('🤖 Bot do Telegram inicializado com polling interativo de comandos e botões!');
  }

  pararPolling() {
    this.pollingAtivo = false;
  }

  async processarCallbackQuery(cb) {
    const data = cb.data || '';
    const chatId = String((cb.message && cb.message.chat && cb.message.chat.id) || '');

    if (this.chatId && chatId && chatId !== String(this.chatId)) {
      await this.responderCallbackQuery(cb.id, 'Acesso não autorizado', true);
      return;
    }

    const [acao, idStr] = data.split(':');
    const rotaId = parseInt(idStr, 10);
    const rota = rotaId ? rotasRepo.buscarPorId(rotaId) : null;

    if (!rota && rotaId) {
      await this.responderCallbackQuery(cb.id, 'Rota não encontrada ou já excluída.', true);
      return;
    }

    if (acao === 'check') {
      await this.responderCallbackQuery(cb.id, '🔍 Varredura iniciada para a rota!');
      if (this.onVerificarRotaCallback) {
        this.onVerificarRotaCallback(rota);
      }
    } else if (acao === 'mute24') {
      rotasRepo.silenciarRota(rotaId, 24);
      await this.responderCallbackQuery(cb.id, '🔕 Notificações silenciadas por 24 horas!', true);
      await this.enviarMensagem(`🔕 A rota <b>${escapeHtml(rota.origem)} ➔ ${escapeHtml(rota.destino)}</b> foi silenciada por 24h.`, null, '', false);
    } else if (acao === 'weather') {
      const clima = await weatherService.obterClimaDestino(rota.codigo_destino || rota.destino, rota.data_ida);
      await this.responderCallbackQuery(cb.id, `🌤️ ${clima.resumo || 'Clima obtido'}`);
      const textoClima =
        `🌤️ <b>BOLETIM METEOROLÓGICO • ${escapeHtml(clima.cidade || rota.destino)}</b>\n\n` +
        `• Condição: <b>${escapeHtml(clima.condicao || 'Estável')} ${clima.emoji || '🌤️'}</b>\n` +
        `• Temperatura Média: <b>${clima.tempMedia || '--'}°C</b>\n` +
        `• Mínima: ${clima.tempMin || '--'}°C | Máxima: ${clima.tempMax || '--'}°C\n` +
        `• Período Viagem: ${rota.data_ida}${rota.data_volta ? ' até ' + rota.data_volta : ''}\n\n` +
        `<i>Dados fornecidos por Open-Meteo & wttr.in.</i>`;
      await this.enviarMensagem(textoClima, null, '', false);
    }
  }

  async processarComando(msg) {
    const chatId = String(msg.chat.id);
    if (this.chatId && chatId !== String(this.chatId)) {
      return;
    }

    const texto = msg.text.trim();

    if (texto === '/start' || texto === '/ajuda') {
      const resposta =
        `✈️ <b>RADAR DE VOOS - TRAVEL HACKING ENGINE (v2.1)</b>\n\n` +
        `Comandos disponíveis:\n` +
        `• /rotas - Lista todas as rotas monitoradas, clima e preços\n` +
        `• /status - Relatório do pool de busca e sentinela autônomo\n` +
        `• /clima [cidade] - Previsão do tempo para um destino (ex: /clima Paris)\n` +
        `• /bugs - Últimos Bug Fares e Erros de Tarifa detectados\n` +
        `• /varrerbugs - Dispara varredura proativa global nos corredores mundiais\n` +
        `• /ping - Verifica se o robô está ativo e operacional\n\n` +
        `<i>Acesse o Cockpit PWA completo em http://localhost:${config.port}</i>`;
      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto.startsWith('/clima')) {
      const partes = texto.split(' ');
      partes.shift();
      const cidade = partes.join(' ').trim();
      if (!cidade) {
        await this.enviarMensagem('Informe a cidade ou aeroporto. Exemplo: <code>/clima LIS</code> ou <code>/clima Paris</code>', null, '', false);
        return;
      }
      const clima = await weatherService.obterClimaDestino(cidade);
      const msgClima =
        `🌤️ <b>PREVISÃO METEOROLÓGICA • ${escapeHtml(clima.cidade || cidade)}</b>\n\n` +
        `• Condição: <b>${escapeHtml(clima.condicao)} ${clima.emoji}</b>\n` +
        `• Temperatura Média: <b>${clima.tempMedia}°C</b> (Mín: ${clima.tempMin}°C / Máx: ${clima.tempMax}°C)\n` +
        `• Resumo: ${escapeHtml(clima.resumo)}`;
      await this.enviarMensagem(msgClima, null, '', false);
    } else if (texto === '/status') {
      const relatorio = serpApiPool.obterRelatorio();
      let resposta =
        `📊 <b>STATUS DO RADAR DE VOOS</b>\n\n` +
        `• Provedores: Google Flights Direct (0 custo) + SerpAPI Pool\n` +
        `• Buscas Hoje: <b>${relatorio.buscasHoje} / ${relatorio.limiteDiarioTotal}</b>\n` +
        `• Buscas no Mês: <b>${relatorio.buscasMes} / ${relatorio.limiteMensalTotal}</b>\n` +
        `• Cota Restante SerpAPI: <b>${relatorio.cotaMensalRestante}</b>\n\n` +
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
        const silenciada = rotasRepo.estaSilenciada(r) ? ' 🔕 [Silenciada]' : '';
        const climaStr = r.clima_destino_resumo ? ` | 🌤️ ${r.clima_destino_resumo}` : '';
        const tagFlex = r.sem_data ? ' 🗓️ [Flexível / Menor Preço]' : '';

        resposta += `• <b>${escapeHtml(r.origem)} ➔ ${escapeHtml(r.destino)}</b>${tagFlex}${silenciada}\n`;
        resposta += r.sem_data
          ? `  📅 Melhor período: ${r.data_ida}${r.data_volta ? ' até ' + r.data_volta : ' (Só Ida)'}\n`
          : `  📅 ${r.data_ida}${r.data_volta ? ' até ' + r.data_volta : ' (Só Ida)'}\n`;
        resposta += `  💰 Preço Atual: <b>${precoStr}</b> | Meta: R$ ${r.preco_alvo || '-'}\n`;
        resposta += `  🌡️ ${escapeHtml(r.termometro || 'Sem dados')}${climaStr}\n\n`;
      }

      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto === '/bugs') {
      const bugs = bugFaresRepo.listarRecentes(8);
      if (bugs.length === 0) {
        await this.enviarMensagem('🔍 Nenhum Bug Fare registrado no momento.\nEnvie <code>/varrerbugs</code> para acionar a caçada proativa global!', null, '', false);
        return;
      }

      let resposta = `🚨 <b>ÚLTIMOS BUG FARES DETECTADOS</b>\n\n`;
      for (const b of bugs) {
        resposta += `• <b>${escapeHtml(b.titulo)}</b>\n  🏷️ <i>${escapeHtml(b.tipo)}</i>\n  🔗 <a href="${escapeHtml(b.link)}">Ver no Google Flights</a>\n\n`;
      }
      await this.enviarMensagem(resposta, null, '', false);
    } else if (texto === '/varrerbugs' || texto === '/radar') {
      await this.enviarMensagem('🧭 <i>Iniciando varredura proativa em corredores mundiais... Aguarde cerca de 15 segundos.</i>', null, '', false);
      try {
        const { bugFareHunter } = await import('./bug_fare_hunter.js');
        const { BugFareFeedWatcher } = await import('./bug_fare_feed_watcher.js');
        const [resProativo, resFeeds] = await Promise.allSettled([
          bugFareHunter.executarVarreduraProativa({ limiteRotas: 4, notificar: false }),
          BugFareFeedWatcher.escanearFeeds({ notificar: false })
        ]);
        const bugs = bugFaresRepo.listarRecentes(5);
        let rep = `🏁 <b>Varredura Proativa Concluída!</b>\n\n`;
        if (bugs.length > 0) {
          rep += `🚨 <b>Últimas anomalias registradas no Radar:</b>\n\n`;
          for (const b of bugs) {
            rep += `• <b>${escapeHtml(b.titulo)}</b>\n  🔗 <a href="${escapeHtml(b.link)}">Acessar Oferta</a>\n\n`;
          }
        } else {
          rep += `Nenhum erro de tarifa anômalo nos corredores pesquisados neste instante. Tarifas dentro dos parâmetros regulares do GDS.`;
        }
        await this.enviarMensagem(rep, null, '', false);
      } catch (err) {
        await this.enviarMensagem(`⚠️ Falha ao executar varredura: ${escapeHtml(err.message)}`, null, '', false);
      }
    } else if (texto === '/ping') {
      await this.enviarMensagem('🏓 Pong! O Radar de Voos v2.5.2 está 100% online e operante.', null, '', false);
    }
  }
}

export const notifierTelegram = new NotifierTelegram();
