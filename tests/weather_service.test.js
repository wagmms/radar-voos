import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { weatherService, WeatherService, TTL_CACHE_CLIMA_MS, interpretarCodigoWMO, COORDENADAS_AEROPORTOS } from '../src/services/weather_service.js';

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

  it('deve exportar TTL_CACHE_CLIMA_MS padrão de 6 horas (21.600.000 ms)', () => {
    assert.equal(TTL_CACHE_CLIMA_MS, 6 * 60 * 60 * 1000);
    assert.equal(weatherService.ttlMs, 21600000);
  });

  it('deve armazenar resultado em cache de 6h e reutilizar dados em chamadas subsequentes', async () => {
    weatherService.limparCache();
    assert.equal(weatherService.obterTamanhoCache(), 0);

    const primeira = await weatherService.obterClimaDestino('MIA', '2026-11-01');
    assert.ok(primeira.ok);
    assert.equal(weatherService.obterTamanhoCache(), 1);

    // Segunda chamada para a mesma chave deve reutilizar o cache em memória
    const segunda = await weatherService.obterClimaDestino('MIA', '2026-11-01');
    assert.deepEqual(segunda, primeira);
  });

  it('deve invalidar automaticamente dados expirados e nunca retornar dados com mais de 6h', async () => {
    const servico = new WeatherService(100); // TTL curto de 100ms para teste

    const dados = await servico.obterClimaDestino('MAD');
    assert.ok(dados.ok);
    assert.equal(servico.obterTamanhoCache(), 1);

    // Simula passagem do tempo além do TTL (expiração)
    const chave = 'MAD_hoje';
    const entrada = servico.cache.get(chave);
    assert.ok(entrada);
    entrada.timestamp = Date.now() - 1000; // 1s atrás, excedendo TTL de 100ms

    // Ao consultar novamente com chave expirada, o cache deve descartar a entrada antiga
    assert.equal(servico.obterTamanhoCache(), 0); // expurgado automaticamente

    // Inserção manual expirada de 7h atrás para simular chave > 6h no serviço padrão
    const chavePadrao = 'OPO_hoje';
    weatherService.cache.set(chavePadrao, {
      timestamp: Date.now() - (7 * 60 * 60 * 1000), // 7 horas atrás (> 6h)
      data: { ok: true, cidade: 'Porto', tempMedia: -99, resumo: 'Dado desatualizado' }
    });

    // Ao chamar obterClimaDestino, a entrada de 7h atrás deve ser invalidada e substituída
    const climaAtualizado = await weatherService.obterClimaDestino('OPO');
    assert.ok(climaAtualizado.ok);
    assert.notEqual(climaAtualizado.tempMedia, -99);
    assert.notEqual(climaAtualizado.resumo, 'Dado desatualizado');
  });

  it('deve limpar integralmente o cache quando limparCache for acionado', async () => {
    const servico = new WeatherService();
    servico.cache.set('TESTE_1', { timestamp: Date.now(), data: { ok: true } });
    servico.cache.set('TESTE_2', { timestamp: Date.now(), data: { ok: true } });
    assert.equal(servico.cache.size, 2);

    servico.limparCache();
    assert.equal(servico.cache.size, 0);
    assert.equal(servico.obterTamanhoCache(), 0);
  });

  it('deve expurgar apenas entradas expiradas e preservar entradas válidas via expurgarExpirados', () => {
    const servico = new WeatherService(1000); // 1 segundo
    const agora = Date.now();

    servico.cache.set('VALIDA', { timestamp: agora, data: { ok: true } });
    servico.cache.set('EXPIRADA', { timestamp: agora - 2000, data: { ok: true } });

    assert.equal(servico.cache.size, 2);
    servico.expurgarExpirados();
    assert.equal(servico.cache.size, 1);
    assert.ok(servico.cache.has('VALIDA'));
    assert.equal(servico.cache.has('EXPIRADA'), false);
  });
});

