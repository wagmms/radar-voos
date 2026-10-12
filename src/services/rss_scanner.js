import { XMLParser } from 'fast-xml-parser';
import { config } from '../config.js';
import { classificarItemFeed } from '../domain/bug_fares.js';
import { bugFaresRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';

export class RssScanner {
  static async verificarFeed() {
    const url = config.radar.feedPromocoesUrl;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { ok: false, erro: `HTTP ${res.status} ao obter RSS` };
      }

      const xmlText = await res.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      });

      const parsed = parser.parse(xmlText);
      const items = parsed?.rss?.channel?.item;

      if (!items) {
        return { ok: true, novos: 0, mensagem: 'Nenhum item encontrado no canal RSS' };
      }

      const itensArray = Array.isArray(items) ? items : [items];
      let novosBugs = 0;

      for (const item of itensArray) {
        const titulo = String(item.title || '');
        const link = String(item.link || '');

        if (!titulo || !link) continue;

        // Verificar se já processamos este link
        if (bugFaresRepo.linkJaExiste(link)) {
          continue;
        }

        const classificacao = classificarItemFeed(titulo, link);

        if (classificacao.valido && classificacao.ehBugFare) {
          bugFaresRepo.inserir(titulo, link, classificacao.tipo);
          novosBugs++;
          // Alerta imediato no Telegram
          await notifierTelegram.enviarAlertaBugFare(titulo, link, classificacao.tipo);
        } else if (classificacao.valido && !classificacao.ehBugFare) {
          // Megapromoção autêntica
          bugFaresRepo.inserir(titulo, link, classificacao.tipo);
        }
      }

      return {
        ok: true,
        novos: novosBugs,
        totalItensFeed: itensArray.length
      };
    } catch (err) {
      return { ok: false, erro: `Erro ao varrer feed RSS: ${err.message}` };
    }
  }
}
