# 📜 CHANGELOG - Radar de Voos

Todas as alterações notáveis deste projeto serão registradas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.5.0] - 2026-10-12

### 🔄 Sincronização Bidirecional Real (Two-Way Sync: Web/Produção ↔ Ambiente Local)
- **Pull Automático Remoto do GitHub no Startup (`src/services/rotas_sync.js`, `src/index.js`)**:
  - Implementado método `puxarDoGitHub()` que busca a versão canônica mais recente de `data/rotas.json` no GitHub Contents API e raw fallback.
  - O startup do servidor (`src/index.js` -> `bootstrap()`) agora sincroniza o banco SQLite local (`data/radar_voos.sqlite`) com o repositório remoto antes de iniciar agendador e APIs.
  - Alterações feitas pelo usuário no Cockpit Web do Render agora são puxadas automaticamente para o ambiente local sem perdas.
- **Sincronização Atômica com o SQLite (`sincronizarRotasComBanco`)**:
  - Algoritmo de merge que insere novas rotas criadas na nuvem, atualiza parâmetros de rotas modificadas e remove do SQLite local as rotas excluídas pelo usuário na Web.
- **Blindagem Estrita do Ambiente de Testes**:
  - `rotasSync.salvarArquivoRotas()` agora protege o arquivo canônico `data/rotas.json` em modo `NODE_ENV=test`, impedindo que execuções de testes automatizados sobrescrevam as rotas reais do usuário no disco.
- **Endpoint e Ação de Sync no Cockpit (`POST /api/rotas/sync-pull`)**:
  - Endpoint REST dedicado para acionar puxada e alinhamento imediato com o GitHub sob demanda.
  - Suporte ao parâmetro `?sync=true` em `GET /api/rotas`.
  - Botão "Sync GitHub" no Cockpit Web agora aciona a puxada e re-alinhamento da interface em tempo real.
- **Suíte de Testes Expandida (`tests/rotas_sync.test.js`)**:
  - 3 novos testes automatizados cobrindo inserção, atualização, remoção remota e proteção em modo teste (total de 60 testes, 100% aprovados).

## [2.4.2] - 2026-10-12

### 🔕 Política Estrita de Notificações Telegram: Fim de Alertas no Deploy e Oscilações Fora da Meta
- **Bloqueio Absoluto de Alertas Pós-Deploy (`baseline_inicial_deploy`)**:
  - Eliminado o gatilho automático de `PRIMEIRA_CHECAGEM` que inundava o canal do Telegram com todas as rotas a cada reinicialização ou novo deploy no Render.
  - A primeira verificação de qualquer rota no motor agora calibra silenciosamente a linha de base no SQLite sem disparar alertas.
- **Respeito Irrestrito aos Critérios do Usuário (`preco_alvo`)**:
  - Quando a rota possui `preco_alvo`, o motor só autoriza notificações regulares se a tarifa estiver estritamente dentro da meta do usuário (`precoAtual <= precoAlvo`).
  - Bloqueados falsos alertas de "queda relâmpago" ou "novo recorde" para passagens que caíram mas continuam acima do teto estipulado pelo usuário.
- **Filtro Anti-Spam e Deduplicação de Mudanças de Preço**:
  - Pequenas oscilações rotineiras (< 5% de melhoria em relação ao último alerta disparado) são sumariamente descartadas.
  - Implementado cooldown mínimo de 48 horas para renotificação de uma mesma rota, evitando mensagens repetitivas a cada ciclo horário de varredura.
- **Suíte de Testes Dedicada (`tests/alertas_criterios.test.js`)**:
  - 4 novos testes unitários adicionados cobrindo rejeição de alertas no deploy, rejeição acima da meta, aprovação de cruze da meta e supressão de pequenas oscilações (total: 57 testes 100% aprovados).

## [2.4.1] - 2026-10-12

### 🛠️ Correção e Aprimoramento de Voos Flexíveis e Parsing de Dias de Estadia
- **Resolução de Ambiguidade no Parsing de Dias vs Datas (`src/domain/rotas.js`)**:
  - Implementada função `extrairDiasEstadia(valor, padrao)` para extrair números inteiros de expressões como `"10 dias"`, `"10"`, `"10d"`, `"14 (dias)"`.
  - Atualizada a função `calcularDataVolta` para aceitar sufixos como `"dias"` ou `"d"` sem quebrar o cálculo de soma na data de ida.
  - Removido o fallback cego `new Date(str)` de `formatarDataParaBusca`, que convertia strings curtas (como `"10"` ou `"10/10"`) em datas do ano 2001 (mês de outubro) de forma espúria.
- **Tratamento de Rotas Flexíveis Sem Data Fixa (`src/db.js`, `src/server/routes/rotas_routes.js`)**:
  - Ao criar ou atualizar rotas em modo `sem_data: 1`, `dias_estadia` agora é preservado e persistido corretamente a partir do input de volta.
  - A data de volta agora é calculada somando a estadia na data de referência (ou mantida nula caso o usuário escolha "Só Ida"), sem forçar datas fixas rígidas de calendário.
- **Aprimoramento Visual no Cockpit PWA (`src/public/app.js`, `src/public/index.html`)**:
  - O card de rotas flexíveis agora exibe claramente `⏱️ Duração: 10 dias de estadia` (em vez de exibir `Volta: [data fixa]`), eliminando a confusão de que a data de retorno foi fixada no calendário.
  - No modal de edição de rotas (`abrirEdicaoRota`), o campo de duração agora é preenchido com `10 dias` em vez da data calculada de volta.
  - Placeholders dos campos ajustados para exemplificar `"Ex: 10 dias ou Só Ida"`.
- **Suíte de Testes Expandida**:
  - Testes unitários e de integração adicionados cobrindo `extrairDiasEstadia`, `calcularDataVolta` com sufixo "dias", `formatarDataParaBusca` com strings numéricas e `POST /api/rotas` com `"10 dias"` (total: 53 testes 100% aprovados).

## [2.4.0] - 2026-10-12

### 🔄 Persistência Canônica e Via de Mão Dupla de Rotas (Two-Way Sync com GitHub & LocalStorage)
- **Fim da Sobrescrita Hardcoded em Novos Deploys**:
  - Eliminado o reset/reinserção forçada de rotas hardcoded de código que sobrescrevia as preferências do usuário no Render.
  - Implementado arquivo canônico versionado `data/rotas.json` como fonte canônica da verdade.
  - `popularDadosIniciaisSeVazio()` agora lê primeiro `data/rotas.json` e respeita integralmente qualquer dado já existente (`contagem > 0`).
- **Two-Way Sync Automático com Repositório GitHub (`src/services/rotas_sync.js`)**:
  - Criado serviço de sincronização remota via GitHub Contents API (`PUT /repos/wagmms/radar-voos/contents/data/rotas.json`).
  - Qualquer criação, edição ou exclusão de rotas no Cockpit PWA salva localmente em `data/rotas.json` e dispara auto-commit silencioso remoto.
  - No próximo deploy no Render, o container efêmero já clona o repositório com o `data/rotas.json` atualizado pelo usuário.
- **Backup, Restauração e Contingência LocalStorage no Cockpit PWA (`src/public/app.js`, `src/public/index.html`)**:
  - Adicionado botão **Backup** (`GET /api/rotas/exportar`) para baixar snapshot `.json` das rotas monitoradas com 1 clique.
  - Adicionado botão **Restaurar** (`POST /api/rotas/importar`) com diálogo para substituição total ou agregação de rotas.
  - Adicionado botão **Sync GitHub** (`POST /api/rotas/sincronizar-github`) para forçar alinhamento com a nuvem a qualquer momento.
  - Mecanismo de contingência local: o navegador salva automaticamente snapshot no `localStorage` e, se detectar que o backend reiniciou sem rotas, dispara auto-restore instantâneo para o servidor.
- **Suíte de Testes Expandida**:
  - 50 testes automatizados cobrindo exportação e importação de rotas e sincronização (100% aprovados).

## [2.3.0] - 2026-10-12

### 🌐 Voo Flexível Sem Data Fixa (Best Price Explorer - Movido a Menor Preço)
- **Modo Flexível sem Data Fixa (`sem_data: 1` e `dias_estadia`)**:
  - Implementado suporte completo para monitorar rotas sem exigir uma data de partida rígida.
  - O motor gera janelas de exploração distribuídas nos próximos meses (`gerarJanelasExploracaoSemData`), ajustando as terças/quartas-feiras com tarifas estatisticamente mais baixas.
- **Motor de Eleição de Menor Preço (`src/services/flight_scanner.js`)**:
  - No escaneamento de rotas flexíveis, o scanner varre as janelas candidatas e elege estritamente a opção com o **menor preço absoluto**.
  - Atualização automática da data da rota e link direto do Google Flights para a data vencedora da menor tarifa.
- **Interface Cockpit PWA e Telegram Alinhados**:
  - Adicionado toggle `🗓️ Voo Flexível / Sem Data Fixa (Movido a Menor Preço)` no modal de criação e edição de rotas.
  - Adicionado filtro de categoria `🗓️ Flexíveis` na barra de busca do Cockpit PWA.
  - Cards de voos com tag visual destacada e indicação da melhor data identificada no período.
  - Alerta do Telegram configurado com prefixo `🔥 MENOR PREÇO ENCONTRADO (DATAS FLEXÍVEIS)` e comando `/rotas` adaptado.
- **Cobertura de Testes**:
  - Suíte expandida para 48 testes automatizados cobrindo geração de janelas sem data, persistência SQLite e criação via API REST.

## [2.2.1] - 2026-10-12

### 🐛 Correções Críticas de Renderização e Resiliência 24/7
- **Correção de ReferenceError no Cockpit PWA (`src/public/app.js`)**:
  - Corrigido typo na função `atualizarMetricasRotas` onde avaliava `rota.preco_alvo` em vez de `r.preco_alvo` no filtro de oportunidades, o que causava lançamento de exceção não tratada e impedia a execução de `renderizarRotas()`, deixando a tela sem nenhuma rota exibida.
  - Atualizada versão de cache do Service Worker (`src/public/sw.js`) para `radar-voos-v2.2` garantindo invalidação imediata de cache legado no cliente.
- **Implementação de `temChaveDisponivel()` no Pool SerpAPI (`src/services/serpapi_pool.js`)**:
  - Implementado método `temChaveDisponivel()` ausente que causava `TypeError` durante a troca de provedor no `FlightProviderManager`, derrubando o processo Node do servidor no ciclo inicial.
- **Blindagem e Resiliência em Falhas Inesperadas (`src/services/scheduler.js` e `src/services/flight_scanner.js`)**:
  - Envolvido ciclo de monitoramento e cada rota individual em blocos defensivos com log de erros, garantindo que o servidor Fastify permaneça online 24/7 sem interrupções por falha de provedor individual.
- **Suíte de Testes Ampliada**:
  - Adicionado teste unitário cobrindo `SerpApiProvider.estaDisponivel()` e `serpApiPool.temChaveDisponivel()` (45/45 testes passando).

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
