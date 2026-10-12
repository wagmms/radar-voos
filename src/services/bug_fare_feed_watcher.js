import { classificarItemFeed } from '../domain/bug_fares.js';
import { bugFaresRepo } from '../db.js';
import { notifierTelegram } from './notifier_telegram.js';
import { telemetryEvents } from './telemetry_events.js';

/**
 * Feeds públicos de inteligência de viagens e erros de tarifas
 */
export const FONTES_FEEDS_BUG_FARES = [
  {
    nome: 'Melhores Destinos',
    url: 'https://www.melhoresdestinos.com.br/feed',
    ativo: true
  },
  {
    nome: 'Passagens Imperdíveis',
    url: 'https://www.passagensimperdiveis.com.br/feed/',
    ativo: true
  },
  {
    nome: 'Secret Flying Global',
    url: 'https://www.secretflying.com/feed/',
    ativo: true
  }
];

export class BugFareFeedWatcher {
  /**
   * Extrai itens simples de um documento RSS ou Atom XML via expressões regulares seguras
   */
  static extrairItensXml(xml) {
    const itens = [];
    if (!xml || typeof xml !== 'string') return itens;

    // Padrão RSS 2.0 (<item> ... </item>)
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const bloco = match[0];
      const titleMatch = bloco.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = bloco.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);

      if (titleMatch && linkMatch) {
        itens.push({
          titulo: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
          link: linkMatch[1].replace(/<[^>]+>/g, '').trim()
        });
      }
    }

    // Padrão Atom (<entry> ... </entry>)
    if (itens.length === 0) {
      const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
      while ((match = entryRegex.exec(xml)) !== null) {
        const bloco = match[0];
        const titleMatch = bloco.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = bloco.match(/<link[^>]+href=["']([^"']+)["']/i) || bloco.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);

        if (titleMatch && linkMatch) {
          itens.push({
            titulo: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
            link: (linkMatch[1] || linkMatch[2] || '').trim()
          });
        }
      }
    }

    return itens;
  }

  /**
   * Realiza a leitura e filtragem implacável dos feeds de inteligência
   * @param {Object} options
   * @param {boolean} options.notificar Dispara alerta prioritário no Telegram se encontrar erro autêntico
   */
  static async escanearFeeds({ notificar = true } = {}) {
    console.log('📡 [BugFareFeedWatcher] Varrendo feeds externos de comunidades de viagem...');
    const encontrados = [];
    let totalProcessados = 0;

    for (const fonte of FONTES_FEEDS_BUG_FARES.filter(f => f.ativo)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const resp = await fetch(fonte.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!resp.ok) continue;

        const xml = await resp.text();
        const posts = this.extrairItensXml(xml);

        for (const post of posts) {
          totalProcessados++;
          const classificacao = classificarItemFeed(post.titulo, post.link);

          // Se for classificado como Bug Fare legítimo (ou megapromoção verificada)
          if (classificacao.valido && classificacao.ehBugFare) {
            const jaExiste = bugFaresRepo.linkJaExiste(post.link);
            if (!jaExiste) {
              const tituloCompleto = `🚨 [FEED] ${post.titulo}`;
              bugFaresRepo.inserir(tituloCompleto, post.link, classificacao.tipo);

              telemetryEvents.emitirAtualizacao('bug_fare_detectado', {
                titulo: tituloCompleto,
                link: post.link,
                fonte: fonte.nome,
                tipo: classificacao.tipo
              });

              if (notificar) {
                await notifierTelegram.enviarAlertaBugFare(
                  tituloCompleto,
                  post.link,
                  `🚨 ${classificacao.tipo} (${fonte.nome})`
                );
              }

              encontrados.push({
                fonte: fonte.nome,
                titulo: post.titulo,
                link: post.link,
                tipo: classificacao.tipo
              });
              console.log(`💥 [BUG FARE EM FEED!] (${fonte.nome}) ${post.titulo}`);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ [BugFareFeedWatcher] Falha ao consultar feed ${fonte.nome}: ${err.message}`);
      }
    }

    return {
      sucesso: true,
      totalProcessados,
      totalBugsEncontrados: encontrados.length,
      bugs: encontrados
    };
  }
}
