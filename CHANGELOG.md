# 📜 CHANGELOG - Radar de Voos

Todas as alterações notáveis deste projeto serão registradas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.7.5] - 2026-10-12

### 🏛️ Governança Canônica com AGENTS.md e Blindagem Total do Autoloop contra Travamentos
- **Diretrizes Técnicas Canônicas (`AGENTS.md`)**:
  - Criado arquivo canônico de engenharia na raiz do repositório definindo padrões estritos de arquitetura: Fastify 4 modular com Ajv, SQLite nativo Node.js 22 operando em WAL mode (`busy_timeout=5000`, `synchronous=NORMAL`, `BEGIN IMMEDIATE`), web scraping anti-bloqueio com `scrapling`, Google Flights (aba Cheapest via Protobuf `tfs`), caçador proativo de Bug Fares (`proactive-agent`), Cockpit PWA mobile-first anti-slop com `smart-charts` e `remotion-maps`, e notificações seguras com `telegram-compose`.
  - Injeção contextual e dinâmica do `AGENTS.md` diretamente no prompt do autoloop em cada ciclo executado.
- **Blindagem do Autoloop contra Travamentos e Congelamentos (`scripts/autoloop_radarvoos.py`)**:
  - **Timeout Estrito de 15 Minutos (900s)**: Invocação do AGY CLI protegida por timeout rígido (`timeout=TIMEOUT_TURNO_AGY`), eliminando travamentos indefinidos por chamadas bloqueadas ou gargalos de rede.
  - **Encerramento de Grupo de Processos (`stop_process_group`)**: Interrupção limpa e em árvore de todos os processos descendentes caso o tempo limite seja excedido (código 124), seguida de auto-rollback defensivo imediato.
  - **Limpeza Automática de Travas Residuais do Git**: Rotina `limpar_travas_residuais` que remove com segurança travas órfãs (`.git/index.lock`, `refs/heads/*.lock`, `HEAD.lock`) na inicialização, no início de cada ciclo e antes de qualquer operação de rollback.
- **Filtro Cirúrgico de Notificações no Telegram (Zero Ruído)**:
  - Adicionado filtro mandatório: relatórios de ciclo só são despachados quando o commit recém-gerado for uma entrega real de funcionalidade (`commit_msg.startswith("feat:")`).
  - Commits secundários (`fix:`, `chore:`, `test:`, `refactor:`) permanecem estritamente silenciosos, mantendo a tranquilidade do usuário e respeitando o cooldown protetor de 5 minutos (300s).
- **Cobertura de Testes Unitários Expandida (`tests/test_autoloop_radarvoos_throttling.py`)**:
  - Ampliada a suíte para 8 testes unitários cobrindo o novo filtro de commits `feat:`, a rotina de remoção de travas `.git/index.lock` e o carregador seguro de `AGENTS.md`.

## [2.7.4] - 2026-10-12

### 🛡️ Blindagem do Autoloop e Throttling Estrito Anti-Spam no Telegram
- **Blindagem do Ciclo de Execução da IA (`scripts/autoloop_radarvoos.py` e `autoloop-radarvoos`)**:
  - Implementado bloqueio estrito pós-execução do AGY: se `ret_code != 0`, o ciclo falha imediatamente, aciona auto-rollback defensivo, aplica pausa protetora de 15 segundos e NUNCA prossegue para envio de notificação ou falsa validação de sucesso.
  - Adicionada detecção de alterações reais no repositório (`sha_final != sha_inicial`). Se o turno da IA não gerar commits novos nem arquivos modificados, nenhuma notificação é enviada.
  - Implementada rotina de salvaguarda automática de commits para alterações válidas aprovadas na suíte de testes caso o agente não as tenha commitado.
- **Deduplicação de Commit e Cooldown Estrito de Notificações**:
  - Implementada checagem anti-redundância: se o commit já foi notificado anteriormente (`commit_hash == last_notified_commit`), a notificação é sumariamente suprimida.
  - Estabelecido cooldown protetor de 300 segundos (5 minutos) entre relatórios automáticos consecutivos no Telegram.
  - Persistência atômica do estado em `data/autoloop_telegram_state.json`.
- **Mapeamento Preciso de Modelos Compatíveis com o CLI do AGY**:
  - Normalizados identificadores de modelo em `MAPA_MODELOS` e `resolver_modelo_para_conta` para utilizar exclusivamente modelos válidos suportados pelo AGY CLI (`gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`), prevenindo falhas instantâneas de invocação.
- **Cobertura de Testes Unitários (`tests/test_autoloop_radarvoos_throttling.py`)**:
  - Criada suíte com 5 testes unitários validando persistência de estado, supressão por commit duplicado, cooldown de 300s, liberação após expiração e rejeição de hashes inválidos.

## [2.7.3] - 2026-10-12

### 🌡️ Cockpit PWA: Filtro por Faixa de Temperatura Climática e Badges Enriquecidos
- **Módulo Modular de Filtragem Climática (`src/public/js/clima_filtro.js`)**:
  - Implementada função `extrairTemperaturaMedia` com priorização da coluna `clima_temp_media` do SQLite e fallback defensivo sobre strings textuais em `clima_destino_resumo`.
  - Implementada função `classificarFaixaClima` mapeando temperaturas em faixas canônicas: **Quente** (>25°C), **Ameno** (15°C a 25°C) e **Frio** (<15°C).
  - Implementada função `obterMetaFaixaClima` com metadados visuais, classes CSS, paleta de cores contextual e ícones semânticos (☀️, ⛅, ❄️).
  - Implementada função `filtrarPorFaixaClima` permitindo filtragem precisa de rotas por temperatura ou integração como filtro combinável.
  - Implementada função `renderizarWeatherBadge` gerando badges meteorológicos enriquecidos com micro-tags informativas de faixa no Cockpit PWA.
- **Interface e Toolbar do Cockpit PWA (`src/public/index.html`, `src/public/styles.css` e `src/public/app.js`)**:
  - Adicionado novo grupo visual de filtros rápidos na toolbar (`.filter-clima-group` com seletor de chips): **Todos**, **☀️ Quente (>25°C)**, **⛅ Ameno (15-25°C)** e **❄️ Frio (<15°C)**.
  - Integração no `state.filtroClima` com disparo tátil (háptica via `vibrarAoTocar`) e renderização reativa instantânea em `renderizarRotas`.
  - Cards de voos receberam badges estilizados com cores contextuais (âmbar/solar para quente, esmeralda para ameno e ciano/gelo para frio).
- **Cobertura de Testes Automatizados (`tests/clima_filtro.test.js`)**:
  - Criada suíte completa com 21 novos testes automatizados cobrindo extração numérica e textual de temperatura, faixas de borda, tratamento gracioso de valores nulos, filtragem de rotas e renderização de badges, elevando a suíte para 102/102 testes aprovados.

## [2.7.2] - 2026-10-12

### 🔍 Parser Enriquecido do Google Flights: Conexões Detalhadas (Escalas) e Bagagens
- **Módulo de Extração Direta (`src/services/providers/google_flights_direct_provider.js`)**:
  - Implementada função `extrairInfoConexoes` com suporte a voos diretos (`Direto`), escalas simples e conexões detalhadas com extração de aeroporto IATA e tempos de layover (ex: `1 parada em Campinas (VCP)`, `1 parada em Aeroporto de Brasília (BSB)` com tempo de conexão).
  - Implementada função `extrairInfoBagagem` identificando modalidades de mala de mão (`incluida`, `nao_incluida`), bagagens despachadas (`incluida`, `paga`) e itens pessoais.
  - Implementada função `limparNomeCompanhia` para sanitização de resíduos de paradas e voos operados (eliminando sufixos como `Azul com 1 parada`).
  - Implementada função `extrairPrecoNumerico` com suporte a separadores de milhares (`1.250`, `2,450`, etc.).
  - Parser multicamada no `buscarOfertas` com varredura em nós `aria-label` e elementos adjacentes do HTML direto, estruturando `escalas`, `detalhesEscalas`, `tempoConexao`, `aeroportoConexao` e `bagagem` nas ofertas e amostras de voo.
- **Cobertura de Testes Automatizados (`tests/flight_providers.test.js`)**:
  - Adicionados 5 novos testes unitários e de integração cobrindo parsing de conexões, identificação de bagagens, sanitização de companhias e extração enriquecida em HTML com nós filhos, elevando a suíte para 81/81 testes aprovados.

## [2.7.1] - 2026-10-12

### 🏷️ Identificação e Destaque Visual de Tarifas Especiais (Aba Cheapest & Parceiros/OTAs)
- **Módulo de Detecção e Renderização de Tags (`src/public/js/tarifa_tags.js`)**:
  - Criadas funções modulares `extrairInfoTarifaEspecial`, `renderizarTagTarifaEspecial` e `renderizarBannerTarifaEspecial`.
  - Detecção inteligente da aba "Cheapest" via atributos de voo, palavras-chave e tokens canônicos Protobuf do Google Flights (`tfu=EgoIABAAGAAgAigD`).
  - Reconhecimento automático de agências parceiras e OTAs integradas (Decolar, MyTrip, Gotogate, eDreams, ViajaNet ou OTA genérica).
- **Interface Cockpit PWA Refinada (`src/public/app.js`, `src/public/index.html` e `src/public/styles.css`)**:
  - Cards de voos ganham tags contextuais (`.tarifa-deal-pill`) no cabeçalho e banners estilizados (`.tarifa-deal-banner`) no corpo do cartão com contraste refinado, gradiente translúcido e ícones específicos (`⚡` para Cheapest e `🏷️` para Parceiros).
  - Adicionado novo chip de filtro dinâmico no toolbar do Cockpit: `⚡ Cheapest / OTAs`.
- **Cobertura de Testes Automatizados (`tests/tarifa_tags.test.js`)**:
  - Implementada suíte completa de testes cobrindo todos os cenários (rotas regulares, aba Cheapest direta, parceiros OTAs com preço, parâmetro Protobuf canônico e janelas flexíveis), elevando a suíte para 76/76 testes aprovados.

## [2.7.0] - 2026-10-12

### 🛫 Motor Autônomo de Desenvolvimento Contínuo (Autoloop Radar de Voos) & Integração IA-Hub
- **Orquestrador Especializado (`autoloop-radarvoos` em `~/.local/bin/autoloop-radarvoos`)**:
  - Motor de autoloop multi-contas e multi-modelos acoplado ao Antigravity CLI (`agy`).
  - Isolamento rigoroso de branch operando na `autoloop/dev` com salvaguarda total da `main`.
  - Validação estrita por gates (`./validate.sh fast`) e auto-rollback defensivo em caso de regressão.
  - Injeção contextual das skills especializadas (`google-flights`, `scrapling`, `fastify-best-practices`, `sqlite`, `smart-charts`, `remotion-maps`, `telegram-compose`, `anti-ui-slop`, `weather` e `tdd`).
  - Roteamento cognitivo de modelos: Gemini Pro para inteligência aeronáutica, Bug Fares, Z-score, paridade de milhas e concorrência SQLite; Gemini Flash para Cockpit PWA, rotas Fastify, notificações e testes.
- **Validação Automatizada em Camadas (`validate.sh`)**:
  - Script executável validando sintaxe JS em todos os arquivos de `src/` e `tests/`, integridade do `PROGRESS.md` e 100% de aprovação na suíte de 70 testes automatizados.
- **Integração Completa ao Mission Control IA-Hub**:
  - Adicionado botão interativo `✈️ RadarVoos` no menu do Telegram.
  - Comandos `/radarvoos` e `/radar` mapeados no router do IA-Hub.
  - Suporte completo no executor visual de janela única do PC (`ia-hub-janela-runner`).
  - Inclusão do Radar de Voos no ciclo de revezamento periódico 24/7 e telemetria de saúde do sistema.

## [2.6.4] - 2026-10-12

### 🎯 Escopo Cristalino do Teto de Preço para Voos Flexíveis (Só Ida vs Ida e Volta)
- **Seletor de Tipo de Viagem Explícito e Contexto do Teto (`src/public/index.html` e `src/public/app.js`)**:
  - Adicionado seletor visual com chips dedicados para **🔄 Ida e Volta** e **➡️ Apenas Ida** no formulário de inclusão e edição de rotas.
  - Criado indicador dinâmico de escopo (`#badge-teto-escopo`) e caixa explicativa em tempo real (`#hint-teto-explicacao`) junto ao campo de **Preço Alvo / Teto (R$)**.
  - O usuário visualiza com 100% de clareza se o teto que está estipulando é para o **valor total de ida + volta** (com estadia configurada) ou para a **tarifa de apenas ida**, contextualizando automaticamente o comportamento do algoritmo nos modos de data flexível (sem data fixa ou janela de ±X dias).
- **Exibição do Teto e Modalidade nos Cards do Cockpit Web (`src/public/app.js` e `src/public/styles.css`)**:
  - Cards de voos no Cockpit PWA agora exibem tags específicas (`🗓️ FLEXÍVEL • SÓ IDA` vs `🗓️ FLEXÍVEL • IDA E VOLTA (Xd)`).
  - Adicionada linha dedicada `.card-teto-row` exibindo o teto cadastrado acompanhado de pílula visual indicativa (`Apenas Ida` ou `Ida e Volta`).
- **Comunicação Enriquecida no Telegram Bot (`src/services/notifier_telegram.js`)**:
  - Comando `/rotas` e alertas de oportunidade passam a declarar explicitamente se a tarifa encontrada e a meta pertencem a `Ida e Volta` ou `Apenas Ida`.
- **Validação e Scanner Defensivo (`src/services/flight_scanner.js` e `tests/rotas_flexibilidade.test.js`)**:
  - Incorporada verificação canônica com `ehSoIda` na geração de janelas flexíveis e matriz adjacente, eliminando divergências de tipos.
  - Adicionados testes automatizados validando o escopo do teto para Só Ida e Ida e Volta (70/70 testes aprovados).

## [2.6.3] - 2026-10-12

### ⚡ Estratégia Híbrida de Provedores com Descoberta de Tarifas de OTAs em Nuvem
- **Inteligência de Menor Preço no Gerenciador de Provedores (`src/services/providers/provider_manager.js`)**:
  - Em ambientes de nuvem (datacenter do Render em Ohio), o Google Flights omite as tarifas de parceiros e OTAs brasileiras (Kiwi, Zupper) do HTML direto, entregando apenas as tarifas oficiais de cias aéreas (ex: Azul R$ 741).
  - O `FlightProviderManager` agora detecta quando o provedor direto entrega apenas tarifa oficial sem desconto de agência e, se a SerpAPI estiver disponível com pool ativo, realiza busca complementar via proxy residencial.
  - A menor tarifa encontrada entre os provedores é eleita automaticamente, capturando tarifas de parceiros (R$ 587 a R$ 593) com precisão absoluta.
- **Limpeza e Fixação de Mercado Emissor**:
  - Injeção obrigatória de `gl=BR` e headers nos provedores.

## [2.6.2] - 2026-10-12

### 🎯 Link Canônico Protobuf (tfs) e Forçamento da Aba Cheapest (tfu) do Google Flights
- **Geração Canônica de Protobuf `tfs` e Parâmetro `tfu` (`src/domain/rotas.js`)**:
  - Implementadas funções `gerarTfs` e `gerarLinkGoogleFlightsCheapest` com codificação binária Protocol Buffers (varint e length-delimited) para os filtros de origens, destinos, datas e duração máxima.
  - Injeção obrigatória do parâmetro canônico `&tfu=EgoIABAAGAAgAigD`, forçando o Google Flights a renderizar diretamente a aba **Cheapest** (Mais Baratos) no HTML inicial e ao abrir o link no navegador.
- **Integração no Provedor Direto (`src/services/providers/google_flights_direct_provider.js`)**:
  - Consulta inicial e links de retorno utilizam prioritariamente o link canônico `gerarLinkGoogleFlightsCheapest`, garantindo que os cartões extraídos correspondam à menor tarifa real (R$ 587 em vez do voo selecionado pela aba "Best" de R$ 741).
- **Aumento de Timeout na SerpAPI (`src/services/providers/serpapi_provider.js`)**:
  - Timeout da requisição de `booking_options` expandido de 8000ms para 25000ms, permitindo que as consultas a OTAs e parceiros retornem sem abort prematuro por timeout.
- **Validação e Persistência da Rota RIO ➔ RAO**:
  - Rota ID 4 (Rio de Janeiro ➔ Ribeirão Preto para 17/01/2027) escaneada e confirmada em **R$ 587** (Azul com 1 parada, 3h 40min, duração <= 6h) com link direto para a aba Cheapest.
- **Suíte de Testes Automatizados (`tests/domain.test.js`)**:
  - Adicionado teste unitário cobrindo a geração de `tfs` e links canônicos para a aba Cheapest em viagens só ida e ida e volta (68/68 testes passando, 100% de sucesso).

## [2.6.1] - 2026-10-12

### 🐛 Correção da Varredura Proativa no Cockpit PWA e Invalidação de Cache do Service Worker
- **Correção da Chamada de Atualização no Cockpit PWA (`src/public/app.js`)**:
  - Corrigido o erro que disparava exceção ao invocar `carregarDados(true)` após o retorno positivo da varredura proativa; ajustado cirurgicamente para a função real `carregarDadosCompletos(true)`.
  - Implementados aliases globais defensivos `carregarDados = carregarDadosCompletos` (e expostos em `window.carregarDados`), eliminando qualquer risco de `ReferenceError`.
  - Robustece a captura e exibição de mensagens de falha no toast de notificação in-app com fallbacks defensivos.
- **Invalidação de Cache e Atualização do Service Worker (`src/public/sw.js`)**:
  - Elevada a chave de cache do Service Worker de `radar-voos-v2.2` para `radar-voos-v2.6.1`, forçando o ciclo de ativação e limpeza de cache antigo em todos os navegadores e PWAs instalados.
  - Adicionados os módulos estáticos `/js/geo_routes.js` e `/js/sparkline.js` à lista de pré-cache de assets.
- **Tratamento Defensivo no Backend Fastify (`src/server/routes/bug_fares_routes.js`)**:
  - Envolvido o handler do endpoint `POST /api/bug-fares/escanear` com bloco `try/catch` defensivo, garantindo resposta JSON estruturada `{ ok: false, mensagemErro: ... }` com status 500 em qualquer eventualidade.

## [2.6.0] - 2026-10-12

### 🧭 Caçador Proativo Global de Bug Fares, Detecção Multi-Cabine, Z-Score no SQLite e Cockpit Turbinado
- **Caçador Proativo Autônomo de Corredores Mundiais (`src/services/bug_fare_hunter.js`)**:
  - Implementado o serviço `BugFareHunter` com matriz estratégica de corredores de alta sensibilidade (*sweet spots*) partindo dos principais hubs brasileiros (SAO, RIO, BSB, CNF) rumo aos grandes eixos mundiais (Europa `/m/02j9z`, EUA `/m/09c7w0`, América do Sul, Caribe e Ásia).
  - Execução 100% direta via `GoogleFlightsDirectProvider` a **custo zero de API** (zero consumo de cotas da SerpAPI), gerando janelas estratégicas de terça-feira no futuro com estadias típicas (7 a 14 dias).
  - Integrado ao `Scheduler` com disparo intercalado automático para manter o radar global ativo 24/7.
- **Inteligência Estatística Expandida e Multi-Cabine (`src/domain/bug_fares.js`, `src/db.js`)**:
  - Adicionado suporte a novas regiões mundiais nos pisos estruturais: `CARIBE_AMERICA_CENTRAL` (R$ 1.300 ida/volta), `ORIENTE_MEDIO` (R$ 2.800) e `AFRICA` (R$ 2.200).
  - Implementados multiplicadores de piso por classe de cabine (`MULTIPLICADORES_CABINE_BUG_FARE`: Executiva 2.8x, Premium 1.6x, Primeira Classe 4.5x), viabilizando a captura de erros de tarifa raros em classe Executiva (Business).
  - Adicionado método `rotasRepo.obterEstatisticasPreco(rotaId)` para cálculo de média móvel real (`AVG(preco)`) e desvio padrão amostral no SQLite, alimentando a detecção de anomalias por **Z-Score** ($Z \le -2.2$) em `detectarBugFareEstatistico`.
- **Monitor Híbrido de Feeds de Comunidade com Filtro Anti-Marketing (`src/services/bug_fare_feed_watcher.js`)**:
  - Coletor assíncrono leve para feeds públicos de comunidades de viagens (Melhores Destinos, Passagens Imperdíveis, Secret Flying).
  - Aplicação estrita de `classificarItemFeed` para descartar publiposts, afiliados, pacotes e milhas, retendo e alertando exclusivamente erros autênticos de tarifa.
- **Correção Crítica e UX Renovada no Cockpit PWA (`src/public/app.js`, `src/public/index.html`)**:
  - Corrigido o bug na leitura da resposta em `app.js` (`state.bugFares = resBugs.items || resBugs.bugFares || []`), que impedia a exibição das ofertas na aba de Bug Fares.
  - Adicionado botão interativo **"🔍 Varrer Corredores Globais"** com spinner de progresso em tempo real no Cockpit e acionamento via `POST /api/bug-fares/escanear`.
  - Novos badges visuais de severidade (🚨 Estrutural Crítico, ⚡ Anomalia Estatística, ✈️ Feed).
- **Novos Comandos no Telegram Bot (`src/services/notifier_telegram.js`)**:
  - Implementado comando `/varrerbugs` (ou `/radar`) para acionar a caçada proativa sob demanda diretamente pelo chat.
  - Enriquecido o comando `/bugs` com tags de severidade e links estruturados do Google Flights.
- **Suíte de Testes Expandida (`tests/bug_fares.test.js`, `tests/routes.test.js`)**:
  - 5 novos testes cobrindo novas regiões, cabine executiva, Z-score, XML parser, estatísticas do SQLite e endpoint REST (67/67 testes passando, 100% de aprovação).

## [2.5.3] - 2026-10-12

### 🎯 Captura da Aba "Cheapest" do Google Flights e Menor Tarifa com Critérios Estritos
- **Extração da Aba "Cheapest" (`src/services/providers/google_flights_direct_provider.js`)**:
  - Adicionado extrator de dados da aba "Cheapest" (`comprehensiveness_lure` e blocos de dados `AF_initDataCallback`), permitindo capturar o menor preço absoluto da rota (ex: R$ 587 em vez do voo "Best" padrão de R$ 741 escolhido pelo algoritmo de conveniência do Google).
  - Reformulação da Camada A de cartões para suportar múltiplos padrões textuais autênticos do Google Flights (`A partir de X Reais...`, `Preço total a partir de X Reais...`, `From X...`).
  - Extração de duração real, companhias aéreas e paradas respeitando o teto de duração (`duracaoMaxHoras`) estipulado pelo usuário.
- **Ordenação por Menor Preço e OTAs na SerpAPI (`src/services/providers/serpapi_provider.js`)**:
  - Injeção obrigatória de `sort_by: '2'` (menor preço primeiro), substituindo a ordenação padrão por conveniência (`sort_by=1`).
  - Inspeção de `booking_options` via `booking_token` com códigos físicos de aeroportos para desvendar tarifas menores de parceiros e OTAs.
- **Suíte de Testes Expandida (`tests/flight_providers.test.js`)**:
  - Novo teste automatizado garantindo que o provedor direto seleciona R$ 587 da aba Cheapest em vez de R$ 741 do voo regular. Total de 62 testes 100% aprovados.

## [2.5.2] - 2026-10-12

### 🔗 Correção de Links Diretos do Google Flights e Captura Canônica de Destino Real
- **Eliminação de Links Quebrados com KGMID (`src/domain/rotas.js`)**:
  - `gerarLinkGoogleFlights` agora resolve códigos internos como `/m/02j9z` (Europa), `/m/09c7w0` (EUA) para termos de busca semântica em inglês válidos (`Europe`, `United States`) com `hl=pt-BR&curr=BRL`.
  - Links nunca mais são descartados pelo Google Flights, eliminando o redirecionamento indevido para a tela inicial vazia.
- **Rastreamento e Persistência do Destino Específico em Rotas Regionais**:
  - Em buscas abrangentes (ex: São Paulo ➔ Europa), os provedores agora capturam o aeroporto e cidade reais de chegada (ex: `Aeroporto Humberto Delgado (LIS)`).
  - A coluna `destino_real` foi adicionada na tabela `rotas` do SQLite e persistida via `atualizarResultadoChecagem`.
  - O card no Cockpit PWA agora exibe claramente o destino verificado (ex: `📍 Aeroporto Humberto Delgado (LIS)`).
  - O link do Google Flights aponta diretamente para o voo encontrado no aeroporto de destino final ou usa a URL canônica com parâmetros `tfs` da SerpAPI.
- **Saneamento e Correção de Bug Fares**:
  - Removidos registros espúrios antigos de Bug Fare que apontavam para links quebrados.
  - Alertas de Bug Fare agora trazem o destino real da oferta (ex: `São Paulo ➔ Aeroporto Humberto Delgado (LIS) (Europa)`).

## [2.5.1] - 2026-10-12

### 🥷 Evasão Stealth e Parser Multicamada do Google Flights (Custo Zero Real)
- **Descoberta e Engenharia Reversa do Google Flights DOM (`src/services/providers/google_flights_direct_provider.js`)**:
  - Identificada a estrutura de dados de acessibilidade nos atributos `aria-label` do Google Flights, onde as tarifas completas, durações, companhias aéreas e paradas são expostas em texto estruturado em português (`aria-label="Preço total a partir de X Reais brasileiros..."`).
- **Parser Multicamada de Alta Precisão**:
  - **Camada A**: Extrai cartões de voos ricos com preço em reais, companhia aérea (ex: Tap Air Portugal, LATAM, Azul, Air Canada), tipo de voo (direto vs com escalas) e duração em horas.
  - **Camada B**: Fallback para marcações pontuais de tarifas em `aria-label`.
  - **Camada C**: Fallback para padrões textuais monetários em `BRL`/`R$`.
- **Evasão Anti-Bot com Headers e Cookies Autênticos**:
  - Injeção forçada de parâmetros de localização canônicos (`hl=pt-BR&curr=BRL`), garantindo consistência monetária.
  - Rotação de User-Agents Chromium 130 nos três principais SOs (Windows, macOS, Linux).
  - Injeção de cookies de sessão e consentimento pré-aceito (`SOCS`, `1P_JAR`, `NID`) para neutralizar redirecionamentos do GDPR/consent.
- **Failover Instantâneo para o Pool SerpAPI**:
  - Se uma rota for redirecionada para exploração ou vier sem blocos imediatos no HTML cru, o `FlightProviderManager` aciona transparentemente o pool SerpAPI sem perda de continuidade.

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
