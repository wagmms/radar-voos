import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classificarItemFeed } from '../src/domain/bug_fares.js';

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
});
