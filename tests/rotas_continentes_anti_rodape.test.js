import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESTINOS_CONTINENTES,
  MAPA_AEROPORTOS_SERPAPI,
  PADROES_IGNORAR_RODAPE
} from '../src/domain/dicionarios.js';
import {
  normalizarParaSerpApi,
  gerarLinkGoogleFlightsCheapest,
  gerarLinkGoogleFlights
} from '../src/domain/rotas.js';
import { extrairVoosDoHtml, extrairPrecoCheapestTab } from '../src/services/providers/scrapling_client.js';

describe('Blindagem Anti-Rodapé e Destinos Continentais Abrangentes', () => {
  it('PADROES_IGNORAR_RODAPE deve detectar e bloquear textos de carrosséis promocionais do Google Flights', () => {
    const textoRodape1 = 'Encontre voos de Brasília (BSB) para Belo Horizonte (CNF) a partir de R$ 486. Operado por LATAM. 10 de jan. a 16 de jan.. Sem escalas';
    const textoRodape2 = 'Explore flights from São Paulo to Recife starting at R$ 886';
    const textoRodape3 = 'Viagens a partir de R$ 350 para o próximo fim de semana';
    const textoVooLegitimo = 'Preço total a partir de R$ 1.850 Reais brasileiros. Voo da LATAM Airlines direto. Duração total: 4 h 30 min.';

    assert.equal(PADROES_IGNORAR_RODAPE.test(textoRodape1), true);
    assert.equal(PADROES_IGNORAR_RODAPE.test(textoRodape2), true);
    assert.equal(PADROES_IGNORAR_RODAPE.test(textoRodape3), true);
    assert.equal(PADROES_IGNORAR_RODAPE.test(textoVooLegitimo), false);
  });

  it('extrairVoosDoHtml deve descartar voos sugeridos do carrossel de rodapé e evitar tarifa fantasma de R$ 486', () => {
    const htmlComRodape = `
      <html>
        <body>
          <div role="list">
            <div role="listitem">
              <div role="button" aria-label="Encontre voos de Brasília (BSB) para Belo Horizonte (CNF) a partir de R$ 486. Operado por LATAM. 10 de jan. a 16 de jan.. Sem escalas">
                <div class="CQYfx">10 de jan. — 16 de jan.</div>
                <div class="CQYfx">Sem escalas</div>
                <div class="LQVky">a partir de <span class="tVc44e">R$ 486</span></div>
              </div>
            </div>
            <div role="listitem">
              <div role="button" aria-label="Encontre voos de Rio de Janeiro (GIG) para Vitória (VIX) a partir de R$ 510. Operado por LATAM. 7 de jan. a 13 de jan.. Sem escalas">
                <div class="LQVky">a partir de <span>R$ 510</span></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const voos = extrairVoosDoHtml(htmlComRodape);
    assert.equal(voos.length, 0, 'Não deve extrair nenhum voo a partir de carrosséis de sugestão/rodapé');
  });

  it('extrairPrecoCheapestTab deve ignorar callbacks genéricos de rodapé sem token canônico de cheapest', () => {
    const htmlCallbackGenerico = `
      <script>
        [[null, 486], "CjRINUxJQlRxanVQM2NBRGRhaVFCRy0tLS0tLWNlYmNyMy1uMkFBQUFBR3JOTVBBSDFrZHNBEgZmb29iYXIGCgsIzMoDEAIaA0JSTDgdcPtb"]
      </script>
    `;

    const preco = extrairPrecoCheapestTab(htmlCallbackGenerico);
    assert.equal(preco, null, 'Não deve capturar preço 486 de callbacks sem token canônico comprehensiveness_lure');
  });

  it('DESTINOS_CONTINENTES e normalizarParaSerpApi devem mapear continentes para múltiplos aeroportos reais', () => {
    assert.ok(DESTINOS_CONTINENTES.AMERICA_SUL.length >= 5);
    assert.ok(DESTINOS_CONTINENTES.EUROPA.length >= 5);

    const sulNorm = normalizarParaSerpApi('/m/06_1');
    assert.ok(sulNorm.includes('EZE'), 'América do Sul deve incluir EZE');
    assert.ok(sulNorm.includes('SCL'), 'América do Sul deve incluir SCL (Santiago)');
    assert.ok(sulNorm.includes('LIM'), 'América do Sul deve incluir LIM (Lima)');
    assert.ok(sulNorm.includes('BOG'), 'América do Sul deve incluir BOG (Bogotá)');

    const eurNorm = normalizarParaSerpApi('/m/02j9z');
    assert.ok(eurNorm.includes('LIS'), 'Europa deve incluir LIS (Lisboa)');
    assert.ok(eurNorm.includes('BCN'), 'Europa deve incluir BCN (Barcelona)');
    assert.ok(eurNorm.includes('CDG'), 'Europa deve incluir CDG (Paris)');
    assert.ok(eurNorm.includes('MAD'), 'Europa deve incluir MAD (Madrid)');
    assert.ok(eurNorm.includes('FCO'), 'Europa deve incluir FCO (Roma)');
  });

  it('gerarLinkGoogleFlightsCheapest para continente não deve forçar Hub único fixo', () => {
    const linkSul = gerarLinkGoogleFlightsCheapest('SAO', '/m/06_1', '2027-03-09', '2027-03-19', 24, 1, 0, 'economy', 'BRL');
    assert.ok(linkSul, 'Deve gerar link cheapest para o continente');
    assert.ok(linkSul.includes('tfs='), 'Deve conter payload tfs com todos os aeroportos representativos');
    assert.ok(linkSul.includes('curr=BRL'), 'Moeda deve ser BRL');

    const linkEur = gerarLinkGoogleFlightsCheapest('SAO', '/m/02j9z', '2027-02-09', '2027-02-19', 24, 1, 0, 'economy', 'BRL');
    assert.ok(linkEur, 'Deve gerar link cheapest para Europa');
    assert.ok(linkEur.includes('tfs='), 'Deve conter payload tfs');
    assert.ok(linkEur.includes('curr=BRL'), 'Moeda deve ser BRL');
  });
});
