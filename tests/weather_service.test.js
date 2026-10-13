import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { weatherService, interpretarCodigoWMO, COORDENADAS_AEROPORTOS } from '../src/services/weather_service.js';

describe('Serviço Meteorológico (WeatherService)', () => {
  it('deve interpretar códigos WMO meteorológicos corretamente', () => {
    assert.deepEqual(interpretarCodigoWMO(0), { condicao: 'Céu Limpo', emoji: '☀️' });
    assert.deepEqual(interpretarCodigoWMO(2), { condicao: 'Parcialmente Nublado', emoji: '⛅' });
    assert.deepEqual(interpretarCodigoWMO(61), { condicao: 'Chuva', emoji: '🌧️' });
    assert.deepEqual(interpretarCodigoWMO(71), { condicao: 'Neve', emoji: '❄️' });
  });

  it('deve resolver coordenadas para os principais códigos IATA e cidades', () => {
    const gru = weatherService.resolverCoordenadas('GRU');
    assert.ok(gru);
    assert.equal(gru.cidade, 'São Paulo');
    assert.equal(gru.codigo, 'GRU');

    const cdg = weatherService.resolverCoordenadas('Paris');
    assert.ok(cdg);
    assert.equal(cdg.pais, 'França');

    const mia = weatherService.resolverCoordenadas('MIA');
    assert.ok(mia);
    assert.equal(mia.cidade, 'Miami');
  });

  it('deve lidar defensivamente com casos de borda adversariais em resolverCoordenadas (nulos, espaços, objetos e strings curtas)', () => {
    // Entradas nulas, vazias ou somente espaços não devem retornar o primeiro aeroporto (antigo bug de falso-positivo GRU)
    assert.equal(weatherService.resolverCoordenadas(null), null);
    assert.equal(weatherService.resolverCoordenadas(undefined), null);
    assert.equal(weatherService.resolverCoordenadas(''), null);
    assert.equal(weatherService.resolverCoordenadas('   '), null);
    assert.equal(weatherService.resolverCoordenadas('\t\n'), null);

    // Tipos não primitivos / inválidos
    assert.equal(weatherService.resolverCoordenadas({}), null);
    assert.equal(weatherService.resolverCoordenadas([]), null);

    // Caracteres únicos ou strings muito curtas não devem gerar falso positivo espúrio
    assert.equal(weatherService.resolverCoordenadas('A'), null);
    assert.equal(weatherService.resolverCoordenadas('S'), null);
    assert.equal(weatherService.resolverCoordenadas('1'), null);

    // Resolução resiliente insensível a acentuação
    const bsbSemAcento = weatherService.resolverCoordenadas('Brasilia');
    assert.ok(bsbSemAcento);
    assert.equal(bsbSemAcento.codigo, 'BSB');

    const saoSemAcento = weatherService.resolverCoordenadas('Sao Paulo');
    assert.ok(saoSemAcento);
    assert.equal(saoSemAcento.pais, 'Brasil');
  });

  it('deve obter previsão climática formatada para destino conhecido', async () => {
    const clima = await weatherService.obterClimaDestino('LIS');
    assert.ok(clima.ok);
    assert.equal(clima.cidade, 'Lisboa');
    assert.ok(typeof clima.tempMedia === 'number');
    assert.ok(clima.resumo.includes('°C'));
  });

  it('deve retornar resposta graciosa para destinos não mapeados', async () => {
    const desconhecido = await weatherService.obterClimaDestino('XYZ_DESCONHECIDO');
    assert.equal(desconhecido.ok, false);
    assert.equal(desconhecido.resumo, 'Clima não mapeado');
  });
});

