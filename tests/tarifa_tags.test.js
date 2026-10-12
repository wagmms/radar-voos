import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairInfoTarifaEspecial,
  renderizarTagTarifaEspecial,
  renderizarBannerTarifaEspecial
} from '../src/public/js/tarifa_tags.js';

describe('Cockpit PWA: Tags Visuais de Tarifas (Cheapest & Parceiros/OTAs)', () => {
  it('deve retornar null para rota com tarifa regular normal de companhia aérea', () => {
    const rotaRegular = {
      id: 1,
      origem: 'São Paulo',
      destino: 'Lisboa',
      detalhes_voo: '10.5h | Voo Regular | LATAM | Duração: 10h 30m | Tarifa Direta Stealth',
      termometro: '🟡 Preço Médio',
      link_google_flights: 'https://www.google.com/travel/flights?q=voos'
    };

    const info = extrairInfoTarifaEspecial(rotaRegular);
    assert.equal(info, null);

    const tag = renderizarTagTarifaEspecial(info);
    assert.equal(tag, '');

    const banner = renderizarBannerTarifaEspecial(info);
    assert.equal(banner, '');
  });

  it('deve detectar tarifa obtida pela aba Cheapest a partir de detalhes_voo com Menor Tarifa', () => {
    const rotaCheapest = {
      id: 2,
      origem: 'São Paulo',
      destino: 'Belo Horizonte',
      detalhes_voo: 'GOL | Duração: 1h 15m | Menor Tarifa (Aba Cheapest Google Flights: R$ 587)',
      termometro: '🟢 Preço Mais Barato (Google Flights Cheapest)',
      link_google_flights: 'https://www.google.com/travel/flights?tfs=CAEQA&tfu=EgoIABAAGAAgAigD&curr=BRL'
    };

    const info = extrairInfoTarifaEspecial(rotaCheapest);
    assert.ok(info);
    assert.equal(info.tipo, 'cheapest');
    assert.equal(info.nomeExibicao, 'Aba Mais Baratos (Cheapest)');
    assert.equal(info.badgeClasse, 'tag-tarifa-cheapest');
    assert.equal(info.icone, '⚡');
    assert.equal(info.preco, 587);

    const tagHtml = renderizarTagTarifaEspecial(info);
    assert.ok(tagHtml.includes('tarifa-deal-pill tag-tarifa-cheapest'));
    assert.ok(tagHtml.includes('Aba Mais Baratos (Cheapest)'));
    assert.ok(tagHtml.includes('⚡'));

    const bannerHtml = renderizarBannerTarifaEspecial(info);
    assert.ok(bannerHtml.includes('tarifa-deal-banner tag-tarifa-cheapest'));
    assert.ok(bannerHtml.includes('Mais Baratos') && bannerHtml.includes('Google Flights'));
  });

  it('deve detectar tarifa obtida por Parceiro/OTA a partir de Menor Tarifa em detalhes_voo', () => {
    const rotaParceiro = {
      id: 3,
      origem: 'São Paulo',
      destino: 'Paris',
      detalhes_voo: '14.0h | 1 escala(s) | Air France | Menor Tarifa (Decolar: R$ 3250)',
      termometro: '🟢 Excelente Preço',
      link_google_flights: 'https://www.google.com/travel/flights'
    };

    const info = extrairInfoTarifaEspecial(rotaParceiro);
    assert.ok(info);
    assert.equal(info.tipo, 'parceiro');
    assert.equal(info.fonte, 'Decolar');
    assert.equal(info.nomeExibicao, 'Parceiro: Decolar');
    assert.equal(info.badgeClasse, 'tag-tarifa-parceiro');
    assert.equal(info.icone, '🏷️');
    assert.equal(info.preco, 3250);

    const tagHtml = renderizarTagTarifaEspecial(info);
    assert.ok(tagHtml.includes('tarifa-deal-pill tag-tarifa-parceiro'));
    assert.ok(tagHtml.includes('Parceiro: Decolar'));
    assert.ok(tagHtml.includes('🏷️'));

    const bannerHtml = renderizarBannerTarifaEspecial(info);
    assert.ok(bannerHtml.includes('tarifa-deal-banner tag-tarifa-parceiro'));
    assert.ok(bannerHtml.includes('Tarifa Parceiro • Decolar'));
  });

  it('deve detectar parceiro genérico OTA e nomeá-lo como OTA Parceira', () => {
    const rotaOta = {
      id: 4,
      origem: 'Rio de Janeiro',
      destino: 'Miami',
      detalhes_voo: '9.0h | 0 escala(s) | American Airlines | Menor Tarifa (OTA: R$ 2400)',
      termometro: '🟢 Preço Baixo',
      link_google_flights: 'https://www.google.com/travel/flights'
    };

    const info = extrairInfoTarifaEspecial(rotaOta);
    assert.ok(info);
    assert.equal(info.tipo, 'parceiro');
    assert.equal(info.fonte, 'OTA Parceira');
    assert.equal(info.nomeExibicao, 'Parceiro: OTA Parceira');
    assert.equal(info.badgeClasse, 'tag-tarifa-parceiro');
  });

  it('deve detectar Cheapest via parâmetro canônico Protobuf tfu no link do Google Flights', () => {
    const rotaComLinkCheapest = {
      id: 5,
      origem: 'São Paulo',
      destino: 'Roma',
      detalhes_voo: '12h | Alitalia',
      termometro: '🟡 Preço Típico',
      link_google_flights: 'https://www.google.com/travel/flights?tfs=CAEQA&tfu=EgoIABAAGAAgAigD&curr=BRL'
    };

    const info = extrairInfoTarifaEspecial(rotaComLinkCheapest);
    assert.ok(info);
    assert.equal(info.tipo, 'cheapest');
    assert.equal(info.nomeExibicao, 'Aba Mais Baratos (Cheapest)');
  });

  it('deve detectar Cheapest via melhor_opcao_flexivel quando aplicável', () => {
    const rotaFlex = {
      id: 6,
      origem: 'São Paulo',
      destino: 'Madrid',
      detalhes_voo: 'Voo base',
      termometro: '🟡 Normal',
      link_google_flights: 'https://www.google.com/travel/flights',
      melhor_opcao_flexivel: JSON.stringify({
        data_ida: '2027-04-10',
        data_volta: '2027-04-20',
        preco: 2890,
        link: 'https://www.google.com/travel/flights?tfu=EgoIABAAGAAgAigD'
      })
    };

    const info = extrairInfoTarifaEspecial(rotaFlex);
    assert.ok(info);
    assert.equal(info.tipo, 'cheapest');
    assert.equal(info.preco, 2890);
  });
});
