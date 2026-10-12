# 📜 CHANGELOG - Radar de Voos

Todas as alterações notáveis deste projeto serão registradas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.2.0] - 2026-10-12

### 🛫 Matriz de Flexibilidade de Datas, Bug Fares Estatísticos e Áudio de Cabine
- **Matriz de Flexibilidade de Datas Customizável (±0 a ±7 dias)**:
  - Adicionado seletor de flexibilidade de datas (`flexibilidade_dias`: 0 a 7 dias) por rota no Cockpit e no backend.
  - Funções de domínio `somarDiasData` e `gerarCombinacoesFlexibilidade` priorizando datas pela proximidade da viagem.
  - Orquestração de busca flexível no `flight_scanner.js`: pesquisa combinações da janela, identifica a menor tarifa e calcula a economia líquida e percentual.
  - Persistência e exibição do badge de economia da janela flexível nos cards de voos do Cockpit PWA.
- **Detecção Estatística de Bug Fares no GDS em Tempo Real**:
  - Eliminada a dependência atrasada de blogs e feeds RSS externos.
  - Módulo `detectarBugFareEstatistico` com pisos estruturais regionais (Europa < R$ 1.950, EUA < R$ 1.700, América do Sul < R$ 850, Ásia < R$ 3.000) e gatilho de anomalia por queda > 50% em relação à média histórica.
  - Persistência automática em `bug_fares_detectados`, disparo imediato de alerta Telegram com bypass de silêncio e emissão de evento SSE `bug_fare_detectado`.
- **Remoção Definitiva de Feed RSS**:
  - Higienização e remoção do arquivo `src/services/rss_scanner.js`, variável `feedPromocoesUrl` de `src/config.js` e rotas legadas.
- **Alerta Sonoro de Cabine de Avião (Chime via Web Audio API)**:
  - Sintetizador nativo no PWA via Web Audio API reproduzindo o *chime* tonal clássico de cabine de aeronave (duplo tom D5 587.33 Hz + A4 440.00 Hz) sem arquivos MP3 externos.
  - Gatilho automático ao receber eventos SSE de oportunidade na meta ou Bug Fare, além de botão interativo de teste no Cockpit.
- **Testes Automatizados**:
  - Ampliação da suíte para 44 testes automatizados cobrindo flexibilidade de datas, identificação regional e pisos estruturais de Bug Fares (100% aprovados).

## [2.1.0] - 2026-10-12

### 🚀 Refatoração e Evolução v2.1 (Padrões de 12 Skills)
- **Estratégia Multi-Provedores de Voos (`flight-search` + `scrapling`)**:
  - Camada `FlightProviderInterface` e `FlightProviderManager` com suporte a `GoogleFlightsDirectProvider` (busca direta sem custos de API) e fallback contínuo para `SerpApiProvider`.
  - Suporte a seleção de classe de cabine (`economy`, `premium_economy`, `business`, `first`).
- **Serviço Meteorológico de Destino (`weather`)**:
  - Módulo `weather_service.js` integrando Open-Meteo e wttr.in sem chave de API.
  - Exibição de temperatura média, condição climática e badge meteorológico nos alertas do Telegram e nos cards do Cockpit.
- **SQLite Concorrente de Alta Performance (`sqlite`)**:
  - Pragmas de produção: `busy_timeout = 5000`, `synchronous = NORMAL`, `cache_size = -64000`, e modo `WAL`.
  - Novos métodos de silenciamento temporário por 24h (`rotasRepo.silenciarRota`), atualização de clima e recuperação de histórico recente para sparklines.
- **Telegram Bot com UI Avançada e Callback Queries (`telegram-compose` + `proactive-agent`)**:
  - Teclados inline reativos no Telegram com botões interativos: `[🔍 Checar Agora]`, `[🔕 Silenciar 24h]` e `[🌤️ Previsão do Clima]`.
  - Processamento defensivo de callback queries e proteção contra FloodWait (`HTTP 429`).
  - Comando `/clima <cidade>` para boletins meteorológicos sob demanda.
- **Fastify Best Practices & Telemetria em Tempo Real (`fastify-best-practices`)**:
  - Novo endpoint de Server-Sent Events (SSE) `GET /api/stream/telemetria` para atualização ao vivo do Cockpit sem polling.
  - Prevenção rigorosa de memory leaks no encerramento de conexões SSE.
- **Cockpit PWA iOS HIG & Anti-Slop Visual (`smart-charts` + `remotion-maps` + `ios-design` + `ui-taste`)**:
  - Sparklines ultra-leves vetoriais em SVG puro renderizadas em tempo real em cada card de rota (`sparkline.js`).
  - Arcos geodésicos ortodrômicos (*Great Circle routes*) em SVG calculados entre coordenadas aeroportuárias (`geo_routes.js`).
  - Acabamento *frosted glass* (`backdrop-filter: blur(20px)`), suporte a safe-area insets do iOS, feedback tátil háptico (`navigator.vibrate`) e badge pulsante SSE ao vivo.
- **Testes Automatizados**:
  - Expansão da suíte para 37 testes automatizados cobrindo todas as novas camadas (100% passando).

## [2.0.0] - 2026-10-12

### ✨ Adicionado
- **Desacoplamento e Criação do Projeto Separado**:
  - Criação do repositório dedicado `/home/wagmoraes/Projetos IA/RadarVoos`.
  - Eliminação total de Google Apps Script e dependências de planilhas.
- **Backend Moderno em Node.js 24 + Fastify**:
  - Servidor HTTP com endpoints REST para rotas, monitoramento e bug fares.
  - Banco de dados embutido **SQLite nativo (`node:sqlite`)** com tabelas para rotas, histórico de preços, alertas e cotas.
- **Cockpit PWA Frontend (Aero Dark Mode)**:
  - Design temático de aviação em Glassmorphism sóbrio, responsivo e sem UI slop.
  - PWA instalável com Service Worker e cache offline.
  - Cards visuais com cálculo de **Custo Total da Viagem (Voo + Diária x Dias)** e identificador de **Stopover 2-em-1 (conexões longas >= 8h)**.
- **Pool de Chaves SerpAPI com Fila Justa**:
  - Gerenciador round-robin atômico para 4 chaves SerpAPI (1.000 buscas gratuitas/mês).
  - Algoritmo de fila justa anti-inanição (LRU) e cooldown inteligente de 30 minutos em HTTP 429.
- **Caçador de Bug Fares**:
  - Scanner de feed RSS com filtro implacável contra marketing, afiliados, publiposts e anúncios.
  - Detecção estrita de erros de precificação reais.
- **Telegram Bot Interativo**:
  - Alertas com links estruturados do Google Flights e modo silencioso noturno (22h às 08h).
  - Polling para comandos (`/start`, `/rotas`, `/status`, `/bugs`, `/ping`).
- **Infraestrutura e Testes**:
  - Multi-stage Dockerfile e docker-compose.yml de produção.
  - Suíte de 20 testes automatizados cobrindo resolução IATA, inteligência de preços, pool de chaves e endpoints Fastify.
