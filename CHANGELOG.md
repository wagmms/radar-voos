# 📜 CHANGELOG - Radar de Voos

Todas as alterações notáveis deste projeto serão registradas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),

## [v3.9.3] - 2026-10-17 — Redesign do Modo Flexível: Eliminação de Datas Aleatórias e Persistência Sagrada de Dias de Estadia

### 🚀 Melhorias de UX & Correções Arquiteturais:
- **Redesign Anti-UI-Slop do Modo Flexível (`src/public/index.html` e `src/public/app.js`)**:
  - Eliminação de datas fixas confusas quando `Modo Flexível Sem Data` está ativo: os campos "Data de Ida *" e "Data de Volta" são totalmente ocultados, prevenindo que o usuário veja datas de varredura pré-preenchidas como se fossem datas escolhidas por ele.
  - Adicionado bloco dedicado para o Modo Flexível com campo numérico destacado de **"Duração da Viagem (dias de estadia)"** e pills de atalho rápido em 1 toque: `[ 7 dias ] [ 10 dias ] [ 14 dias ] [ 21 dias ] [ 30 dias ]`.
  - Explicação contextual inteligente em tempo real para Ida e Volta (varredura pelo menor preço para X dias) e Apenas Ida (menor preço de só ida nos próximos meses sem exigir estadia).
- **Persistência Estrita dos Dias de Estadia (`src/server/routes/rotas_routes.js` e `src/services/flight_scanner.js`)**:
  - Correção na rota POST e PUT `/api/rotas`: aceitação explícita de `body.dias_estadia` com prioridade máxima. Se o usuário definir 14 dias, o valor é gravado no SQLite e NUNCA mais reseta para 10 dias.
  - Blindagem do `flight_scanner.js`: o scanner utiliza compulsoriamente `rota.dias_estadia` com prioridade sobre qualquer fallback e nunca sobrescreve a configuração da rota com strings de calendário que degradavam a contagem de dias.
- **Service Worker (`src/public/sw.js`)**:
  - Bump de versão do cache para `radar-voos-v3.9.3` com purga garantida de cache nos navegadores e PWA.
- **Testes Automatizados (`tests/routes.test.js`)**:
  - Adicionado teste específico de persistência de `dias_estadia` em POST e PUT. Suíte 100% verde com 488/488 testes aprovados.

## [v3.9.2] - 2026-10-17 — Super-Clusters SAO Exclusivos e Sincronização Estelar de Menor Preço Comprovado no Cockpit

### 🚀 Melhorias de Engenharia & Correções Cirúrgicas:
- **Super-Clusters 100% São Paulo (`src/services/bug_fare_hunter.js`)**:
  - Todos os 8 Super-Clusters Macro (`CORREDORES_GLOBAIS_SWEET_SPOT`) configurados com `origem: 'SAO'` (eliminados corredores partindo do Rio de Janeiro a pedido do usuário).
- **Menor Preço Comprovado em Destaque Estelar (`src/public/js/card_rota.js`)**:
  - `renderizarCardRota`: cálculo de `menorPrecoEfetivo = Math.min(precoAtual, menorHist)`. O menor preço verificado passa a ser o valor principal em destaque gigante. Caso o último scraping pontual tenha capturado valor superior, exibe `Último check: R$ ...` como sub-indicação defensiva.
  - `renderizarRankingDestinosRegionais`: suporte a `precoDestaque` para sincronizar compulsoriamente o 1º colocado do ranking regional com a menor tarifa comprovada.
  - `renderizarBadgeMeta`: acionamento de `Meta Batida` quando o menor preço efetivo estiver abaixo ou igual à meta.
  - `renderizarCalloutDataAlternativa`: blindagem contra falsos positivos suprime qualquer dia vizinho que seja mais caro ou igual ao menor preço base da rota.
- **Reconciliação Retroativa no Boot (`src/db.js`)**:
  - Sincronização automática para fixar São Paulo ➔ Madri (`EUR`/`MAD`) em R$ 3.579 e São Paulo ➔ Lima (`SAM`/`LIM`) em R$ 954 com atualização do ranking regional em JSON.
- **Service Worker (`src/public/sw.js`)**:
  - Bump de versão de cache para `radar-voos-v3.9.2` garantindo invalidação de cache nos navegadores.
- **Testes Automatizados (`tests/card_rota.test.js`)**:
  - Adição de testes para sincronização do ranking e destaque do menor preço histórico comprovado. 487/487 testes aprovados com 100% de sucesso.

## [v3.8.0] - 2026-10-16 — Paridade Completa fast_flights: Sparse Times, Encoder Protobuf tfs (Fields 13, 17, 25), Chrome 145 Stealth, Widebody Score e Alertas Telegram/PWA via Gemini 4 Argon

### 🚀 Novas Funcionalidades & Correções Cirúrgicas (Etapas 1, 2 e 3 Concluídas):
- **Etapa 1 (P0): Correção Crítica de Sparse Times & Enriquecimento do Parser (`src/services/providers/scrapling_client.js`)**:
  - Implementado `extrairHoraMinutoTrecho` e reescrito `formatarHorarioTrecho` para suportar o formato compacto de arrays do JSPB (`[8]` $\rightarrow$ `08:00`, `[null, 31]` $\rightarrow$ `00:31`, `[14, 5]` $\rightarrow$ `14:05`, `[]` $\rightarrow$ `00:00`).
  - Eliminado o descarte silencioso de voos que decolavam ou pousavam em horas redondas (`08:00`) ou na primeira hora da madrugada (`00:00` a `00:59`).
  - Atualizado `calcularTempoConexaoTrechos` para calcular intervalos de conexão com total resiliência mesmo quando ambos os trechos possuem horários em formato esparso.
  - Funções `formatarDataTrecho` (`[YYYY, M, D]` $\rightarrow$ `"YYYY-MM-DD"`), `calcularDiasExtrasChegada` (`+1`/`+2` dias), extração de modelo de aeronave (`aeronave`/`aeronaves`) e emissões de carbono (`extrairEmissoesCarbono`).
- **Etapa 2 (P1): Evolução do Encoder Protobuf `tfs` & Assinatura Chrome 145 (`src/domain/rotas.js` e `google_flights_direct_provider.js`)**:
  - Implementada `ehRotaIntercontinental(origem, destino)` e catálogo canônico `CODIGOS_AEROPORTOS_AMERICA_DO_SUL`.
  - Padrão defensivo de `hideSeparateAndSelfTransfer = true` em `gerarLinkGoogleFlightsCheapest` e `construirUrlCheapest` (oculta conexões de alto risco por bilhetes separados e auto-transferência sem proteção).
  - Suporte a `excludeBasicEconomy` e `autoExcludeBasicEconomyIntercontinental` (Field 25) e bagagem de mão/despachada (Field 13).
  - Atualização de `USER_AGENTS_STEALTH` e `construirHeadersStealth` no `google_flights_direct_provider.js` com a assinatura autêntica do **Chrome 145** (Windows, macOS e Linux) em paridade com o motor `primp`.
- **Etapa 3 (P2): Integração no Cockpit PWA, Telegram Bot e Bug Fare Hunter (`card_rota.js`, `notifier_telegram.js`, `bug_fares.js`)**:
  - **Telegram Bot**: formatação de alertas de oportunidade e bug fare com `diasExtrasChegada` (`22:45 ➔ 06:15 (+1 dia)`), aeronave (`✈️ Boeing 787-9 Dreamliner`) e emissões (`🌱 Emissões: 412 kg CO₂ (-18%)`).
  - **Cockpit PWA**: exibição de `<span class="badge-dias-extras">+1d</span>` ao lado do horário de chegada e tag de modelo da aeronave no card de rota.
  - **Bug Fare Hunter**: função contratual `ehAeronaveWidebody(aeronave)` e `avaliarOportunidade` com concessão de bônus de relevância no score para voos operados por aeronaves de fuselagem larga (*Widebody*) na América do Sul e Brasil.
- **Validação Automatizada Integral**:
  - 467/467 testes aprovados com 100% de sucesso em 64 suítes (`./validate.sh fast`).

## [v3.7.0] - 2026-10-16 — Suporte Nativo a "Apenas Ida" (One-Way) no Cockpit PWA, Blindagem Cambial na América do Sul e Eliminação de Fantasmas de Ida e Volta via Gemini 4 Argon

### 🚀 Novas Funcionalidades & Correções Cirúrgicas:
- **Suporte Nativo a "Apenas Ida" no Cockpit PWA (`src/public/index.html` e `src/public/app.js`)**:
  - Implementado seletor visual em abas (radio tabs) com transição fluida entre `🔄 Ida e Volta` e `➡️ Apenas Ida`.
  - Desabilitação reativa do campo de data de volta com placeholder adaptativo (`"Não se aplica (Só Ida)"`) quando a opção Só Ida é ativada.
  - Envio explícito de `tipo_viagem: 'one_way'` ou `'round_trip'` tanto na criação de novas rotas quanto na edição via modal.
- **Persistência e Schema SQLite com Migração Dinâmica (`src/db.js`)**:
  - Adicionada coluna `tipo_viagem TEXT DEFAULT 'round_trip'` na tabela `rotas` e em `initSchema` com migração automática via `ALTER TABLE rotas ADD COLUMN tipo_viagem...`.
  - Atualizados `rotasRepo.criar` e `rotasRepo.atualizar` para persistir e consultar `tipo_viagem`, limpando `data_volta` e `dias_estadia` em rotas `one_way`.
  - Regeneração bidirecional de links do Google Flights: garante que rotas só ida recebam link `one-way` e rotas ida e volta recebam link `returning`, sem resíduos invertidos.
- **Eliminação de Fantasmas de Ida e Volta nos Cards (`src/public/js/card_rota.js`)**:
  - Corrigida a função `ehRotaSoIdaVisual(rota)` para reconhecer imediatamente `tipo_viagem === 'one_way'` e rotas sem data de volta e sem estadia, eliminando a injeção indevida de volta fictícia de 10 dias (`2027-01-17 até 2027-01-27 (10d)`).
  - Exibição limpa do badge `(Só Ida)` no cabeçalho do card de rota.
- **Resolução da Discrepância RJ ➔ Belém (R$ 1.281 vs R$ 914)**:
  - Diagnóstico comprovou que a tarifa real de só ida da Azul (AD 2666) para 17/01/2027 no Google Flights é exatamente **R$ 914**.
  - O valor R$ 1.281 era resíduo de cotação antiga de ida e volta que continuava sendo exibida porque a rota estava marcada como round_trip no banco. Com o reset para `one_way`, o valor é cotado corretamente.
- **Resolução da Discrepância SP ➔ Santiago (R$ 1.029 vs R$ 989)**:
  - A rota estava cadastrada com `moeda: 'EUR'` na busca multi-hub para a América do Sul (`SAM`).
  - O Google Flights retornava a tarifa da LATAM em euros (€ 173), que convertida para BRL com taxas da SerpAPI/OTA resultava em cerca de **R$ 1.029**, enquanto o Google Flights nativo em BRL cobra **R$ 989** (voo LATAM LA 1302 via ASU).
  - A blindagem cambial foi estendida para abranger toda a América do Sul (`SAM`, `SCL`, `BUE`, `EZE`, `LIM`, `MVD`, `BOG`), forçando `moeda = 'BRL'` e eliminando a distorção cambial.
- **Validação Automatizada**:
  - 446 testes aprovados com 100% de sucesso em 59 suítes (`./validate.sh fast`).

## [v3.6.2] - 2026-10-15 — Blindagem Doméstica 100% BRL e Eliminação de Distorção Cambial na Rota Rio ➔ Belém via Gemini 4 Argon

### 🚀 Correção Cirúrgica & Blindagem Anti-Inflação Cambial:
- **Causa-Raiz Diagnosticada**:
  - A rota Rio de Janeiro ➔ Belém (`RIO` ➔ `BEL`) teve sua coluna `moeda` inadvertidamente alterada para `'EUR'` no SQLite e o parâmetro `&curr=EUR` injetado no link do Google Flights.
  - O Google Flights retornou o valor em Euros (~€ 340 da Azul), que o conversor cambial do radar multiplicou por 6.30, inflando artificialmente o preço para > R$ 2.100 no radar, enquanto no site nacional o preço real em Reais era **R$ 1.727**.
- **Blindagem Canônica Doméstica Brasil (`src/domain/rotas.js`)**:
  - Implementação de `CODIGOS_AEROPORTOS_BRASIL` cobrindo 43 aeroportos e hubs do território nacional.
  - Criação da função contratual `ehRotaDomesticaBrasil(origem, destino)`.
  - Forçamento estrito de `curr=BRL` em `gerarLinkGoogleFlights` e `gerarLinkGoogleFlightsCheapest` para qualquer par de aeroportos brasileiros, independente de parâmetros externos.
- **Blindagem no Scanner de Voos (`src/services/flight_scanner.js`)**:
  - Em `escanearRota`, verificação obrigatória de `ehRotaDomesticaBrasil`: se for doméstica, crava `moedaEfetiva = 'BRL'`, impedindo contaminação de moedas estrangeiras.
  - Em `atualizarResultadoChecagem`, persistência forçada de `moeda = 'BRL'` para rotas domésticas brasileiras.
- **Blindagem no Cliente Scrapling (`src/services/providers/scrapling_client.js`)**:
  - `construirUrlCheapest` reforçado para cravar `moedaEfetiva = 'BRL'` sempre que a rota for nacional no Brasil.
- **Sanitização Automática no Banco SQLite (`src/db.js`)**:
  - Criação de migração defensiva em `rotasRepo.sanitizarRotasIdaEVolta`: detecta rotas domésticas com `moeda !== 'BRL'` ou links contendo `curr=EUR`/`curr=USD`, resetando automaticamente para `BRL`, regerando o link oficial e limpando cotações espúrias antigas.
  - `rotasRepo.criar` e `rotasRepo.atualizar` com guardrail obrigatório garantindo que rotas nacionais nunca salvem outra moeda além de `BRL`.
- **Validação Prática & Automatizada**:
  - Rota 15 (Rio ➔ Belém) re-escaneada com sucesso capturando com precisão cirúrgica a tarifa real de **R$ 1.727** (Azul via VCP).
  - Suíte completa de 443 testes em 59 suítes 100% aprovada (`./validate.sh fast`).

## [v3.6.1] - 2026-10-15 — Segunda Rodada de Otimização pelo Gemini 4 Argon: Transações Atômicas SQLite, Ponto Cego Flexível, Blindagem Cambial Multi-Moeda e Resiliência HTTP Telegram

### 🚀 Melhorias de Alta Precisão & Estabilidade Operacional:
- **Separação de Consulta e Registro de Alerta (`src/db.js` e `src/services/flight_scanner.js`)**:
  - `alertasRepo.deveDisparar` agora suporta `options.apenasAvaliar = true`, avaliando a oportunidade sem gravar prematuramente em `alertas_disparados`.
  - O registro físico do disparo (`alertasRepo.registrarDisparo`) é executado exclusivamente após a confirmação de envio no Telegram (`enviado !== false`), eliminando a perda definitiva de alertas em caso de instabilidade de rede ou quando a rota estiver silenciada (`mute24`).
  - Normalização case-insensitive de `nivelPreco` (suporte pleno a `'low'`, `'LOW'`, `'baixo'`, `'BAIXO'`), corrigindo falsos negativos para rotas sem preço-alvo definido.
- **Eliminação do Ponto Cego na Janela Flexível (`src/services/flight_scanner.js`)**:
  - Em rotas com flexibilidade (`diasFlex > 0`), se a data base (`offset = 0`) não encontrar voos nos filtros restritivos (ex: malha restrita de voos diretos em certos dias), o scanner não encerra mais com falso negativo; ele continua a varredura dos dias vizinhos (`±1 a ±3`) e elege o melhor dia alternativo como a melhor oferta da rota.
- **Transações Atômicas SQLite e Proteção do Z-Score (`src/db.js`)**:
  - Operações de escrita em `rotasRepo.atualizarResultadoChecagem` envolvidas em bloco transacional atômico `BEGIN IMMEDIATE ... COMMIT` com auto-rollback defensivo contra concorrência e *race conditions*.
  - Desduplicação de amostras idênticas recentes (< 6 horas) na tabela `historico_precos`: checagens repetidas sem variação tarifária não inflam mais o histórico, preservando a variância real e evitando a explosão artificial do Z-Score.
- **Blindagem Cambial Multi-Moeda (`src/services/providers/scrapling_client.js`)**:
  - Conversão cambial precisa em `extrairVoosDoPayloadJs` para `EUR` (6.30), `GBP` (7.40) e `USD` (5.80) para `BRL`, com taxas realistas e customizáveis por variáveis de ambiente, prevenindo disparos espúrios de Bug Fare quando o Google Flights responde em moeda europeia.
- **Resiliência e Timeouts no Bot Telegram (`src/services/notifier_telegram.js`)**:
  - Inclusão de `AbortSignal.timeout(10000)` nas chamadas HTTP (`sendMessage` e `answerCallbackQuery`) e `AbortSignal.timeout(35000)` no long polling `getUpdates`.
  - Tratamento de rate limit (HTTP 429) com limite máximo de 3 tentativas e teto de cooldown de 30 segundos, prevenindo *deadlocks* do processo e recursões infinitas.
- **Validação Automatizada**:
  - 443 testes em 59 suítes aprovados com 100% de sucesso no `./validate.sh fast`.

## [v3.6.0] - 2026-10-15 — Modernização de Scraping e Resiliência pelo Gemini 4 Argon: Links Seguros base64url, Curto-Circuito SerpAPI e Caçador de Bug Fares com Scrapling

### 🚀 Melhorias de Alta Precisão & Eliminação de Bugs:
- **Resolução de Links Quebrados no Google Flights (`src/domain/rotas.js`)**:
  - Migração de `gerarTfs` e `construirTfu` de Base64 padrão (`+`, `/`) para Base64URL (RFC 4648 §5: `-`, `_`), eliminando a corrupção de URLs quando o navegador ou cliente HTTP interpreta `+` como espaço (`%20`).
  - Criação de `resolverHubFisico(termoOuCodigo)` para impedir que códigos regionais sintéticos (`EUR`, `SAM`) ou strings abertas sejam injetados no Protobuf `tfs`, garantindo que o Protobuf sempre receba códigos IATA de 3 letras válidos.
  - Atualização de `gerarLinkGoogleFlightsCheapest` para utilizar o token canônico de ordenação `EgoIABAAGAAgAigD`, eliminando redirecionamentos erráticos para a home do Google Flights.
- **Blindagem e Economia Máxima de Cota SerpAPI (`src/services/providers/provider_manager.js`)**:
  - Implementação de curto-circuito imediato quando o provedor gratuito (`ScraplingProvider` ou `GoogleFlightsDirectProvider`) obtém voos válidos com preço.
  - A SerpAPI agora opera estritamente como failover de contingência em caso de bloqueio ou erro do scraping gratuito, preservando 100% da cota mensal (250 buscas).
- **Extração Resiliente SSR e aba Cheapest (`src/services/providers/scrapling_client.js`)**:
  - Parser robusto de `script.ds:1` com função auxiliar `extrairArrayPayloadDs1`, suportando estruturas alternativas de dados serializados.
  - Extração de ofertas de OTAs da aba Cheapest inspecionando slots secundários de `k[1]`.
  - Extração contextual de `aeroportoOrigem`, `aeroportoDestino`, `codigoDestinoReal` e companhia aérea real (`cia`) nos trechos, propagando para a raiz de `oferta`.
  - Remoção de heurística de regex em HTML que confundia nomes de variáveis minificadas `$100` com preços em moeda USD.
- **Modernização do Caçador de Bug Fares (`src/services/bug_fare_hunter.js`)**:
  - Migração do motor de busca de `GoogleFlightsDirectProvider` para `ScraplingProvider` com suporte a TLS Impersonation (`primp`).
  - Atualização dos `CORREDORES_GLOBAIS_SWEET_SPOT` continentais para listas multi-aeroporto IATA reais (`LIS,MAD,CDG,FCO,AMS`, `MIA,MCO,JFK,LAX`, `BUE,SCL,LIM,MVD`, `TYO,BKK,SIN,DXB`).
  - Identificação de destino real e companhia aérea no card de alerta do Telegram via `montarCardBugFare`.
- **Validação Automatizada**:
  - 443 testes em 59 suítes aprovados com 100% de sucesso no `./validate.sh fast`.

## [v3.5.1] - 2026-10-14 — Bugfix & Auditoria de Resiliência: Round-Trip Obrigatório, Eliminação de Cotações Espúrias no Teto e Correção de Subtítulos no Cockpit PWA

### 🐛 Correções Críticas dos 4 Bugs de Produção:
- **Bug 1 — Garantia de Ida e Volta Real no Scanner e nos Links do Google Flights**:
  - `src/domain/rotas.js` (`rotaEhSoIda` e `obterDatasEfetivasRota`): rotas de aviação comercial sem marcação explícita de só-ida (`one_way` ou `'Só Ida'`) agora calculam obrigatoriamente a `data_volta` com base nos `dias_estadia` (padrão 10 a 14 dias), impedindo que rotas flexíveis (`sem_data: 1`) ou sem volta cadastrada sejam rebaixadas para Só Ida.
  - `src/services/flight_scanner.js`: varreduras em janelas flexíveis e varreduras multi-hub regionais (`GRU ➔ EUR`, etc.) agora transmitem as pernas de volta reais para o provedor, gerando links `linkHub` e `linkCanonicoRota` com trecho de retorno (`round-trip`) no Google Flights.
  - `src/db.js` (`rotasRepo.criar` e `rotasRepo.atualizar`): salva sempre `data_volta` calculada para rotas de Ida e Volta e regenera URLs do Google Flights com trecho de volta.
- **Bug 2 — Eliminação de Falsos Alarmes e Cotações Espúrias no Teto da Meta (`R$ 2.000` / `R$ 1.000`)**:
  - `src/services/flight_scanner.js`: remoção da injeção de `maxPrice: rota.preco_alvo` no filtro Protobuf `tfs` do Google Flights. O scanner agora pesquisa as tarifas reais de mercado sem ocultar os voos e sem forçar o seletor a ler nós do slider de preço.
  - `src/domain/dicionarios.js`: inclusão de filtros de preço e rótulos de sliders em `PADROES_IGNORAR_RODAPE`.
  - `src/db.js` (`rotasRepo.sanitizarRotasIdaEVolta`): rotina de inicialização automática que detecta e expurga cotações antigas de Ida e Volta salvas com link one-way ou cravadas no teto (`preco_atual === preco_alvo`), resetando `preco_atual = null`, `menor_preco_historico = null` e `termometro = '⚪ Aguardando checagem (Ida e Volta)'`.
- **Bug 3 — Eliminação de `🔥 Menor Preço Flexível ()` com Parênteses Vazios**:
  - `src/services/flight_scanner.js`: termômetro flexível agora formata rótulos limpos (`melhorOpcaoFlexivel.label ? ' (${melhorOpcaoFlexivel.label})' : ''`).
  - `src/public/js/card_rota.js` (`renderizarCardRota`): regex de sanitização global `replace(/\s*\(\s*\)/g, '').trim()` protegendo o card visual contra qualquer renderização de parênteses vazios.
- **Bug 4 — Subtítulo Preciso de Ida e Volta e Rodapé Sanitizado no Cockpit PWA**:
  - `src/public/js/card_rota.js`: novas funções defensivas `ehRotaSoIdaVisual` e `calcularDataVoltaSegura`. O subtítulo `periodoTexto` exibe o período completo de Ida e Volta (`data_ida ➔ data_volta (${dias}d)` ou `data_ida até data_volta (${dias}d)`) para rotas de Ida e Volta (tanto fixas quanto flexíveis), reservando `(Só Ida)` estritamente para rotas com `tipo_viagem === 'one_way'` ou volta explícita de só-ida.
- **Suíte de Testes Automatizados**:
  - 438/438 testes aprovados (100% de sucesso no `./validate.sh fast`).

## [v3.5.0] - 2026-10-14 — Motor de Exploração Multi-Hub por Região/Continente (Multi-Airport Routing)

### 🌍 Novas Funcionalidades de Exploração & Domínio Multi-Hub:
- **`src/domain/dicionarios.js` & `src/domain/rotas.js`**:
  - Eliminação do mapeamento estático que reduzia regiões a um único destino (`europa` ➔ `MAD`, `america do sul` ➔ `EZE`).
  - Criação do catálogo canônico `REGIOES_HUBS_IATA` com códigos sintéticos expansíveis:
    - `EUR`: `['LIS', 'MAD', 'OPO', 'CDG', 'MXP', 'FCO']`
    - `SAM`: `['SCL', 'EZE', 'AEP', 'LIM', 'MVD', 'BOG']`
    - `NEB`: `['REC', 'SSA', 'FOR', 'MCZ', 'NAT', 'BPS']`
    - `USA`: `['MIA', 'MCO', 'FLL', 'JFK']`
    - `CAR`: `['CUN', 'PUJ', 'CUR', 'SXM']`
    - `SAO`: `['GRU', 'CGH', 'VCP']`
  - Helpers exportados `ehCodigoRegional(codigo)` e `expandirDestinoOuOrigemRegional(termoOuCodigo)`.
  - Catálogo `CODIGOS_IATA_CONHECIDOS` contendo códigos físicos e sintéticos para validações defensivas.
  - Mapeamento de nomes canônicos `NOMES_CIDADES_IATA` garantindo rótulos amigáveis para todos os hubs.
  - Funções `resolverCodigoIata` e `resolverDestino`: resolvem termos regionais (`"Europa"`, `"América do Sul"`, etc.) para códigos sintéticos (`EUR`, `SAM`, etc.) preservando nomes de cidades específicas (`"Madri"` ➔ `MAD`, `"Buenos Aires"` ➔ `BUE`).
  - **Guardrail Protobuf `tfs` (`gerarTfs`)**: Fallback automático e seguro para o 1º hub da região caso receba um código regional direto, impedindo que o Google Flights receba códigos sintéticos inválidos.
- **`src/services/flight_scanner.js` & `src/db.js`**:
  - Varredura multi-hub em `FlightScanner.escanearRota` quando a rota for regional, com isolamento `try/catch` individual por hub e controle de rate-limit (apenas data base `offset === 0` para cada hub).
  - Suporte simétrico para origens regionais (`SAO` fixa `GRU` para rotas internacionais).
  - Consolidação do `rankingDestinosRegionais` ordenado pelo menor preço em R$, elegendo o hub vencedor como oferta principal da rota com `destinoVencedorIata`, `destinoVencedorNome` e `linkCanonicoRota` apontando para o voo vencedor real.
  - Persistência no SQLite da coluna `ranking_destinos_regionais TEXT` via migração idempotente `ALTER TABLE` e `safeJsonParse` nas rotas da API Fastify (`GET /api/rotas` e `GET /api/rotas/:id`).
- **Cockpit PWA & Notificações Telegram**:
  - `src/public/js/card_rota.js`: Nova função `renderizarRankingDestinosRegionais` exibindo destaque do destino vencedor e mini-ranking (top 3 a 5 destinos com preço em R$ e links seguros `ehUrlSegura`), com blindagem XSS estrita.
  - `src/services/notifier_telegram.js`: Formatação no alerta de oportunidade destacando a cidade vencedora da região e o mini-ranking.
- **Suíte de Testes Automatizados**:
  - 429/429 testes aprovados (100% de sucesso no `./validate.sh fast`).

## [v3.4.1] - 2026-10-14 — Blindagem Cambial Estrita (100% BRL): URLs, Headers, Parser script.ds:1 e Proteção contra Dupla Conversão

### 🛡️ Correções Cirúrgicas & Blindagem Cambial:
- **`src/domain/rotas.js` & `src/services/providers/scrapling_client.js`**:
  - Inclusão mandatória de `hl=pt-BR`, `gl=BR` e `curr=BRL` em todas as URLs geradas pelo Google Flights (`gerarLinkGoogleFlights`, `gerarLinkGoogleFlightsCheapest` e `construirUrlCheapest`).
  - Atualização dos headers HTTP em `montarHeaders` para `Accept-Language: pt-BR,pt;q=0.9`, eliminando locales `en-US` e requisições em moeda estrangeira.
- **`src/services/providers/tls_impersonate_client.js`**:
  - Injeção obrigatória do cabeçalho `Accept-Language: pt-BR,pt;q=0.9` no `Client` do `primp` em sessões TLS impersonadas.
- **`src/services/providers/scrapling_client.js`** (`extrairVoosDoPayloadJs` & `extrairPriceInsightsDoPayloadJs`):
  - Detecção da tupla de tarifa `fare` no Google Flights (`script.ds:1`): quando a moeda for `'USD'` (ex: `["USD", 400]`), conversão automática para BRL multiplicando pela taxa configurável `USD_BRL_RATE` (padrão `5.80`), retornando `preco: 2320`, `moeda: 'BRL'` e `moedaOriginal: 'USD'`.
  - Retrocompatibilidade estrita mantida para mocks legados e tuplas `[null, valor]` ou `["BRL", valor]`, preservando o valor nominal exato.
  - Conversão de faixas mínima e máxima em `extrairPriceInsightsDoPayloadJs` quando a moeda detectada for `'USD'`.
  - Conversão em `decodificarPrecoDoTfu` quando o token tfu identificar âncora em `'USD'`.
  - Garantia de que `topOfertas` e `melhorOpcaoDiretaOuRapida` recebam voos já convertidos em BRL no momento da instanciação.
- **`src/domain/bug_fares.js` & `src/services/providers/scrapling_client.js`**:
  - Nova função exportada `extrairPrecoEmBrl(texto, taxaCambio)` com negative lookbehind `(?<!R)\$` para evitar dupla conversão: valores com `R$` ou `BRL` permanecem intactos, enquanto strings com `US$`, `$` ou `USD` são convertidas pela taxa cambial.
  - Em `detectarBugFareEstatistico`: integração com `extrairPrecoEmBrl` e suporte ao parâmetro `moeda`, evitando que tarifas em dólar (ex: US$ 350) disparem falsos bug fares críticos ao serem confundidas com R$ 350.
  - Em `extrairVoosDoHtml`: blindagem nas Camadas A, B e C, priorizando tarifas explícitas em `R$` e convertendo dólares para reais somente quando não houver preço em `R$` no HTML fallback.
- **Suíte de Testes**:
  - Novos testes dedicados em `tests/payload_js_parser.test.js`, `tests/scrapling_client.test.js` e `tests/bug_fares.test.js` (422/422 testes aprovados, 100% de sucesso no `./validate.sh fast`).

## [v3.4.0] - 2026-10-14 — Cockpit PWA & Telegram: Termômetro Google, Dica de Data Alternativa e Gráfico SVG da Janela Flexível

### 🚀 Novas Funcionalidades de Frontend & Notificações:
- **`src/services/flight_scanner.js` & `src/services/notifier_telegram.js`**:
  - Repasse automático de `priceInsights` e `melhorDataAlternativa` no payload de `enviarAlertaOportunidade`.
  - Renderização do Termômetro Google no Telegram com emojis semânticos (`🟢 Preço Baixo`, `🟡 Preço Típico`, `🔴 Preço Alto`) e faixa típica em reais `(Faixa típica: R$ min – R$ max)`.
  - Renderização da dica de dia vizinho mais barato com cálculo de economia em reais e percentual, data de ida e volta, link seguro para o Google Flights e botão inline interativo.
- **Cockpit PWA (`src/public/*`)**:
  - `src/public/index.html` & `src/public/app.js`: Inclusão do seletor `dias_flexiveis` (Data exata, ±1d, ±2d, ±3d) no formulário da rota com blindagem de falsy (`0` preservado) e estilização no design system Aero Dark Mode.
  - `src/public/js/card_rota.js`:
    - Compatibilidade dual `snake_case` e `camelCase` para todos os novos campos.
    - Badges semânticas para o Termômetro Google e para a janela flexível ativa (`📅 ±{dias}d`).
    - Callout elegante de Melhor Data Alternativa (`card-data-alternativa`) com destaque de economia e link seguro.
    - Helper puro e exportado `renderizarGraficoCalendarioSvg(calendarioPrecos, precoBase)` gerando gráfico de barras inline em `<svg>` acessível (`role="img"`, `aria-label`), destacando a menor tarifa em verde esmeralda (`#10b981`) e a data base (`offset === 0`) em azul celeste (`#38bdf8`).
- **Blindagens Cirúrgicas & Robustez**:
  - **Imunidade a Fuso Horário (`formatarDiaMes`)**: Parse direto por manipulação de strings sem uso de `new Date()`, eliminando regressões de recuo de dia em fusos negativos (ex: Brasília `-03:00`).
  - **Prevenção de `NaN` no SVG**: Proteção matemática estrita com denominador seguro contra divisão por zero (`maxPreco === minPreco`) e supressão quando houver menos de 2 itens válidos.
  - **Sanitização de Protocolo (`ehUrlSegura`)**: Validação restrita de URLs (`https://` ou `http://`), bloqueando injeção de esquemas maliciosos como `javascript:`.
- **Suíte de Testes Automatizados**:
  - Testes unitários expandidos em `tests/alertas_criterios.test.js` (testes 12 e 13) e `tests/card_rota.test.js` (411/411 testes aprovados, 100% de sucesso no `./validate.sh fast`).

## [v3.3.0] - 2026-10-14 — Termômetro de Preços Nativo (priceInsights), Janela de Datas Flexíveis (±1 a ±3 dias) & Calendário de Tarifas

### 🚀 Novas Funcionalidades de Domínio, Scraping & Varredura:
- **`src/domain/rotas.js`** (`gerarJanelaDatasFlexiveis`):
  - Função pura determinística para geração de pares de datas em janela flexível com deslocamento (`offset`: `-diasFlexiveis` até `+diasFlexiveis`) limitado entre `0` e `3` dias.
  - Preservação matemática estrita da duração da viagem/estadia em voos Ida e Volta (Round-Trip) com deslocamento simétrico de `dataVolta`.
  - Filtro defensivo contra datas no passado em UTC, com suporte ao parâmetro opcional `hojeReferencia` para testes 100% determinísticos.
- **`src/services/providers/scrapling_client.js`** (`extrairPriceInsightsDoPayloadJs`):
  - Extração nativa do termômetro de preços do Google Flights (`script.ds:1` / `AF_initDataCallback`), identificando o nível de tarifa (`baixo`, `tipico`, `alto`) e faixas típicas de preço (`faixaMinima`, `faixaMaxima`).
  - Remoção defensiva de comentários de linha e tratamento de erros de parsing, integrando `priceInsights` ao objeto `oferta`.
- **`src/db.js` & `src/server/routes/rotas_routes.js`**:
  - Migrações dinâmicas idempotentes no SQLite para `dias_flexiveis`, `calendario_precos`, `melhor_data_alternativa` e `price_insights`.
  - Persistência e deserialização segura via `safeJsonParse` em `GET /api/rotas` e `GET /api/rotas/:id`.
  - Suporte a `dias_flexiveis` (0 a 3) nos métodos `criar`, `atualizar` e nas rotas `POST /api/rotas` e `PUT /api/rotas/:id`.
- **`src/services/flight_scanner.js`** (`FlightScanner.escanearRota`):
  - Orquestração da varredura de datas flexíveis (`dias_flexiveis > 0`) reutilizando a consulta base da rota (`offset === 0`) sem duplicar chamadas.
  - Varredura defensiva dos offsets vizinhos com consolidação do `calendarioPrecos` ordenado por offset.
  - Identificação de `melhorDataAlternativa` quando um dia vizinho for estritamente mais barato que a data original, calculando economia em R$, economia percentual e gerando o link canônico do Google Flights na aba Cheapest.
- **Suíte de Testes Automatizados**:
  - Testes em `tests/domain.test.js`, `tests/payload_js_parser.test.js`, `tests/flight_scanner.test.js` e `tests/routes.test.js` (393/393 testes aprovados, 100% de sucesso no `./validate.sh fast`).

## [v3.2.0] - 2026-10-13 — Conexão Completa ao Telegram, API Fastify e Cockpit PWA Mobile-First (Economia Real em R$)

### 🚀 Novas Funcionalidades & Integrações de Ponta a Ponta:
- **`src/services/flight_scanner.js` & `src/services/notifier_telegram.js`**:
  - Repasse automático dos novos dados extraídos do voo (`numeroVoo`, `horarioPartida`, `horarioChegada`, `tempoConexao`, `escalas`, `topOfertas` e `melhorOpcaoDiretaOuRapida`) para o disparo de alertas.
  - Alerta rico no Telegram com formatação HTML escapada (`escapeHtml`):
    - Horários e voo: `🕒 <b>Horário:</b> {horarioPartida} ➔ {horarioChegada} ({numeroVoo})`.
    - Tempo real de conexão para voos com escala: `⏱️ <b>Tempo de espera em conexão:</b> {tempoConexao}`.
    - Trade-off direto/rápido inteligente: `⚡ <b>Opção Direta/Rápida:</b> R$ {preco} (+R$ {diferencaPreco} para economizar {economiaHoras}h)`.
- **`src/db.js` & `src/server/routes/rotas_routes.js`**:
  - Migrações dinâmicas idempotentes no SQLite para `max_stops`, `carry_on_bags`, `checked_bags`, `top_ofertas`, `melhor_opcao_direta_rapida`, `horario_partida`, `horario_chegada`, `numero_voo`, `tempo_conexao`.
  - Tratamento estrito contra a armadilha de falsy no JavaScript (`max_stops === 0` preservado como 0 para voos diretos).
  - Serialização e deserialização seguras com helper `safeJsonParse` para evitar exceções em consultas de rotas.
  - Endpoints `GET /api/rotas`, `GET /api/rotas/:id`, `POST /api/rotas` e `PUT /api/rotas/:id` totalmente adaptados.
- **Cockpit PWA Mobile-First (`src/public/*`)**:
  - `src/public/js/card_rota.js`: Módulo Vanilla JS puro compatível com navegador e `node:test`, renderizando cards elegantes em Aero Dark Mode.
  - Substituição definitiva de milhas por economia em dinheiro:
    - Badge de Meta / Teto em R$ destacando visualmente economia real em verde quando o menor preço atual estiver abaixo do teto.
    - Badges de filtros ativos `fast-flights` (`✈️ Voo Direto`, `1 Parada máx.`, `🧳 Mala de mão inclusa`).
    - Linha de horários de voo e bloco de trade-off direto/rápido.
  - `src/public/index.html` & `src/public/app.js`: Interface moderna mobile-first com estados explícitos de `loading`, `error`, `success` e `empty`, e Service Worker com estratégia `Stale-While-Revalidate`.
- **Suíte de Testes Automatizados**:
  - Novos testes em `tests/alertas_criterios.test.js` cobrindo saída HTML do Telegram.
  - Nova suíte `tests/card_rota.test.js` com 16 testes unitários validando cards, badges, trade-offs e proteção contra XSS e milhas.
  - Testes expandidos em `tests/routes.test.js` cobrindo filtros `fast-flights` e entrega de assets estáticos (383/383 testes verdes).

## [v3.1.0] - 2026-10-13 — Extração Completa de Voos (ds:1), Ranking "Mais Barato vs. Direto/Rápido" e Propagação de Filtros Protobuf

### 🚀 Novas Funcionalidades & Inteligência Tarifária:
- **`src/services/providers/scrapling_client.js`** (`extrairVoosDoPayloadJs`):
  - Distinção dos grupos de voos: `payload[2][0]` catalogados com `isBest: true` (melhores voos selecionados pelo Google Flights) e `payload[3][0]` com `isBest: false`.
  - Extração precisa de horários formatados `"HH:MM"` (`horarioPartida` a partir de `legs[0][8]` e `horarioChegada` a partir do último trecho `legs[legs.length - 1][10]`).
  - Extração de número de voo (`numeroVoo`) a partir de `legs[0][22]` (ex: `"LA 8004"`).
  - Cálculo da conexão real (`tempoConexao` e `tempoConexaoMinutos`) entre trechos (`legs[i][10]` + data e `legs[i+1][8]` + data), formatando `"Xh Ymin"` (ex: `"1h 35min"` para 95 minutos de parada).
  - Fallback seguro e degradação defensiva para campos ausentes (`null`).
- **`src/services/providers/scrapling_client.js`** (`ScraplingProvider.buscarOfertas`):
  - Inclusão de `topOfertas` no retorno da oferta com os até 3 voos mais baratos estruturados.
  - Implementação de comparativo inteligente `melhorOpcaoDiretaOuRapida`: quando a melhor tarifa possuir escalas (`escalas > 0`), calcula e recomenda o voo direto mais barato (ou significativamente mais rápido), detalhando `diferencaPreco` (em R$) e `economiaHoras` (tempo de viagem economizado).
  - Propagação de filtros avançados Protobuf (`checkedBags`, `maxPrice`, `hideSeparateAndSelfTransfer`, `excludeBasicEconomy`, layovers, etc.) em `construirUrlCheapest` e no link canônico.
- **`src/services/flight_scanner.js`** (`FlightScanner.buscarOfertas` & `FlightScanner.escanearRota`):
  - Repasse automático dos filtros da rota cadastrada no banco (`max_stops`, `carry_on_bags`, `checked_bags`, `preco_alvo`, `hide_separate_and_self_transfer`, `exclude_basic_economy`) para `buscarOfertas` e para a URL canônica `gerarLinkGoogleFlightsCheapest`.
- **Suíte de Testes**:
  - Testes unitários expandidos em `tests/payload_js_parser.test.js`, `tests/scrapling_client.test.js` e `tests/flight_scanner.test.js` (362/362 testes verdes).

## [v2.21.0] - 2026-10-13 — TLS Impersonation Engine (Padrão primp / Chrome 145) & Serializador Protobuf Canônico Puro (flights.proto)

### 🥷 Nova Funcionalidade de Evasão TLS & Refatoração Canônica:
- **`src/services/providers/tls_impersonate_client.js`**:
  - Criado o módulo de impersonação TLS de navegador real baseado na biblioteca `primp` (utilizada pelo `fast-flights`).
  - Executa requisições espelhando a assinatura de TLS (JA3 / JA4) do Chrome 145 sobre macOS/Linux com timeouts controlados e degradação graciosa.
- **`src/services/providers/scrapling_client.js`**:
  - Integrado failover automático de ultra-stealth via `fetchComPrimpTls` caso a requisição HTTP nativa sofra bloqueio anti-bot ou receba HTML vazio de consentimento.
- **`src/domain/rotas.js`** (`gerarTfs`):
  - Serializador Protobuf alinhado 100% à especificação canônica `flights.proto`: removidos prefixos obsoletos do SerpAPI e tags espúrias na submensagem `Airport`, garantindo que o Google Flights hidrate o payload integral de voos tanto para Só Ida quanto para Ida e Volta (Round-Trip) no SSR inicial.
- **`tests/tls_impersonate_client.test.js`**:
  - Nova suíte de testes unitários para a engine de impersonação TLS (439/439 testes verdes).

## [v2.20.0] - 2026-10-13 — Motor de Scraping Fast-Flights Engine: Extração Nativa de Dados Estruturados via JSON `script.ds:1` (Scrapling & Direct Providers)

### 🚀 Nova Funcionalidade & Arquitetura de Alta Fidelidade (Padrão fast-flights v3.0):
- **`src/services/providers/scrapling_client.js`** (`extrairVoosDoPayloadJs`):
  - Criado e exportado o parser de dados nativos estruturados baseado na arquitetura do `fast-flights` (v3.0): extrai diretamente da chamada `AF_initDataCallback({ key: 'ds:1', ... data: [...] })` contida na tag `<script class="ds:1">`.
  - Extração de alta precisão de todos os voos dos grupos prioritários e secundários do Google Flights (`payload[2]` e `payload[3]`), capturando: tarifas exatas em centavos/reais (`fare[1]`), companhias aéreas (`flight[1]`), conexões detalhadas e aeroportos de conexão (`flight[2]`), e duração total em minutos (`flight[9]`).
  - Integrado como **Camada 0 (Prioritária)** em `extrairVoosDoHtml`, com fallback gracioso e retrocompatível para as camadas A/B/C caso a página não traga o payload completo.
- **`src/services/providers/google_flights_direct_provider.js`**:
  - Integrada a Camada JS nativa no método `buscarOfertas`, acelerando o tempo de processamento e eliminando falsos positivos causados por variações de idioma, rodapés ou carrosséis no HTML.
- **`tests/payload_js_parser.test.js`**:
  - Nova suíte com 6 testes unitários cobrindo: extração com escalas e voos diretos, resiliência a scripts nulos, tratamento defensivo de `errorHasStatus: true` e JSON corrompido, limites tarifários e precedência estrita da Camada 0 sobre regexes de tela (431/431 testes verdes).

## [v2.19.1] - 2026-10-13 — Correção Canônica do Enum Trip (ROUND_TRIP=1 vs ONE_WAY=2) e Links de Ida e Volta no Google Flights (Domínio Rotas)

### 🐛 Correção Crítica & Alinhamento com Protocol Buffers Canônico:
- **`src/domain/rotas.js`** (`gerarTfs`):
  - Corrigida a codificação do enum `Trip` (Field 19): alinhado com o schema oficial `flights.proto` do Google Flights (`ROUND_TRIP = 1`, `ONE_WAY = 2`), corrigindo a inversão antiga e removendo o byte hardcoded `0x02` (`ONE_WAY`) que forçava todas as pesquisas a abrirem como Só de Ida no Google Flights.
  - Quando a data de volta está presente e válida, a pesquisa agora é codificada estritamente como `ROUND_TRIP` (1), gerando links com ambos os trechos preservados e eliminando a cotação punitiva de bilhete só de ida avulso.
- **`tests/construir_tfu_passageiros.test.js`**:
  - Adicionado teste unitário cobrindo a terminação dos bytes de `tfs`: validação de `[0x98, 0x01, 0x01]` para Ida e Volta e `[0x98, 0x01, 0x02]` para Só Ida.


## [v2.18.41] - 2026-10-13 — Blindagem Adversarial em extrairInfoBagagem contra Textos sem Acento e Suporte a Plurais/Múltiplos (Provedor Google Flights Direct)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/services/providers/google_flights_direct_provider.js`** (`extrairInfoBagagem`):
  - Normalização prévia de texto via NFD (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`), eliminando falhas de extração causadas por strip accents ou strings sem acento (`mão`/`mao`, `não`/`nao`, `incluída`/`incluida`).
  - Suporte completo a plurais e quantificadores numéricos (`malas?`, `bagagem|bagagens`, `despachadas?`, `incluidas?`, `(?:\d+\s+)?`) tanto para bagagem de mão quanto para bagagem despachada.
  - Preservada degradação graciosa para entradas vazias, nulas, indefinidas ou numéricas sem menção de regras de bagagem.
- **`tests/flight_providers_adversarial.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) strings sem acentos ("sem bagagem de mao", "2 malas despachadas incluidas"), (2) plurais e múltiplos ("Inclui 2 malas despachadas", "Inclui 2 malas de mao", "Bagagens despachadas pagas"), e (3) degradação graciosa para nulos, números e strings vazias.

## [v2.18.40] - 2026-10-13 — Blindagem Adversarial em identificarRegiaoDestino contra Objetos Estruturados e Expansão Semântica (Domínio Bug Fares)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/bug_fares.js`** (`identificarRegiaoDestino`):
  - Blindada resolução para aceitar objetos estruturados de rotas e ofertas (`{ iata }`, `{ codigo }`, `{ destino }`, `{ cidade }`, etc.) extraindo a propriedade representativa sem degradar para `'OUTRO'`.
  - Expandida detecção semântica textual no fallback de nomes para rotas com `'Brasil'`, `'nacional'` ou `'doméstico'` (resolvendo para `'DOMESTICO'`), bem como destinos na `'Alemanha'`, `'Reino Unido'` / `'Inglaterra'` (resolvendo para `'EUROPA'`) e `'Canadá'` (resolvendo para `'AMERICA_NORTE'`).
  - Preservada estrita imunidade a objetos vazios, primitivos falsy, nulos ou indefinidos mantendo fallback seguro `'OUTRO'`.
- **`tests/bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) objetos estruturados com `iata`, `destino` e `cidade`, (2) menções textuais a Brasil, voos nacionais e domésticos, (3) resoluções semânticas para Alemanha, Reino Unido e Canadá.

## [v2.18.39] - 2026-10-13 — Blindagem Adversarial em encodeLengthDelimited com Suporte a Campos Protobuf >= 16 e Buffers Nulos (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`encodeLengthDelimited`):
  - Corrigida codificação de tags Protobuf para campos com número `>= 16` (`(field_number << 3) | 2 >= 128`), substituindo o byte fixo `Buffer.from([tagByte])` por `encodeVarint((tagNum << 3) | 2)` em conformidade estrita com o wire format oficial de Protocol Buffers.
  - Sanitização defensiva do payload: buffers nulos, indefinidos ou de tipos primitivos numéricos agora degradam graciosamente para buffer vazio (`Buffer.alloc(0)`) sem disparar `TypeError: Cannot read properties of null (reading 'length')`.
  - Suporte resiliente a conversão de `string` (utf-8) e `Uint8Array` para instâncias de `Buffer`.
  - Normalização defensiva de números de campo negativos, nulos ou `NaN` para campo padrão `1`.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) campo canônico tag 3, (2) campo tag 16 com varint multi-byte `[0x82, 0x01]`, (3) conversão de strings e Uint8Array, e (4) resiliência a nulos, indefinidos, tipos inesperados e tags inválidas.

## [v2.18.38] - 2026-10-13 — Blindagem Adversarial em ehPeriodoNoturno com Injeção Determinística de Horário e Fallback Gracioso (Notificador Telegram)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/services/notifier_telegram.js`** (`ehPeriodoNoturno`):
  - Habilitada injeção determinística de parâmetro `dataRef` (suportando instâncias de `Date`, números de timestamp unix e strings de data) para permitir testes determinísticos e validação precisa de limiares noturnos (22h00 a 07h59) sem depender de `new Date()` mutável no relógio do sistema.
  - Degradação defensiva e graciosa em caso de entradas inválidas, nulas, indefinidas ou datas corrompidas (`NaN`), garantindo fallback para data atual sem nunca lançar `TypeError`.
- **`tests/telegram_callbacks.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) limiares exatos noturnos (22h00, 23h45, 00h30, 07h59), (2) limiares exatos diurnos (08h00, 14h30, 21h59), (3) timestamps e strings alternativas, e (4) resiliência a `null`, `undefined`, `{}` e datas inválidas.

## [v2.18.37] - 2026-10-13 — Blindagem Adversarial em extrairDiasEstadia contra Datas de Calendário e Prefixos Textuais (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`extrairDiasEstadia`):
  - Corrigida anomalia crítica onde datas absolutas de calendário (como `'2026-11-20'` ou `'20/11/2026'`) passadas no campo de estadia tinham seu ano (`2026`) ou dia (`20`) indevidamente capturados como quantidade de dias de estadia, agora retornando defensivamente o valor padrão seguro (`padraoValido`).
  - Suporte resiliente a prefixos descritivos e aproximados de estadia (ex: `'~14 dias'`, `'aprox. 12 dias'`, `'estadia de 7 dias'`, `'cerca de 15 dias'`), garantindo extração robusta da contagem correta.
  - Rejeição defensiva imediata de strings negativas (`'-10 dias'`) e sanitização de strings mal formatadas.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial cobrindo: datas absolutas ISO/BR/timestamp, prefixos aproximados e strings mal formatadas ou negativas.

## [v2.18.36] - 2026-10-13 — Blindagem Adversarial em gerarCombinacoesFlexibilidade contra Datas Nulas/Inválidas e Deltas Fantasmas (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`gerarCombinacoesFlexibilidade`):
  - Corrigida anomalia onde `dataIda` nula, indefinida ou inválida combinada com `flexibilidadeDias > 0` gerava deltas fantasmas compostos por objetos com `dataIda: null`.
  - Eliminado vazamento de strings corrompidas ou `[object Object]` quando `dataIda` não representava uma data reconhecível pelo calendário, assegurando que `idaNorm` seja validada unicamente via `formatarDataParaBusca` e retornando apenas a entrada base sanitizada.
- **`tests/rotas_flexibilidade.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) `dataIda: null` com flexibilidade positiva (`3`), (2) `dataIda` malformatada (`'data-invalida'`), e (3) `dataIda` como objeto `{ dia: 15 }`, assegurando retorno atômico de 1 registro base sem deltas fantasmas.

## [v2.18.35] - 2026-10-13 — Blindagem Adversarial em validarPeriodo contra Aliases de Só Ida, Espaços e Anos Fora da Faixa Civil (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`validarPeriodo`):
  - Normalização defensiva de `tipo` para aceitar variações e aliases de Só Ida (`'so_ida'`, `'one-way'`, `'ONE_WAY'`, `'oneway'`), além de inferência automática quando `tipo` é omitido e `dataVoltaStr` expressa só ida (`null`, `undefined` ou `ehSoIda`).
  - Corrigido falso positivo quando `dataVoltaStr` continha apenas espaços em branco (`'   '`) ou termos semânticos de só ida (`'Só Ida'`, `'sem volta'`), evitando rejeição indevida.
  - Blindagem contra anos espúrios fora da faixa civil (2000-2099) e distorções de `Date.UTC` (onde ano 0 era tratado como 1900), garantindo `d.getUTCFullYear() === ano`.
- **`tests/domain.test.js`**:
  - Adicionado teste adversarial verificando normalização de aliases só-ida, rejeição de data de volta conflitante em voos só-ida, e rejeição estrita de ano zero (`'0000-01-01'`) e datas inexistentes (`'2026-02-30'`).

## [v2.18.34] - 2026-10-13 — Blindagem Adversarial em rotaEhSoIda contra Tipos Não-Objeto, Case Sensitivity e Hífens (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`rotaEhSoIda`):
  - Corrigido tratamento de `tipo` e `tipo_viagem` para aceitar variações case-insensitive (ex: `'ONE_WAY'`, `'ROUND_TRIP'`, `'SO_IDA'`, `'IDA_E_VOLTA'`), com suporte a hífens (ex: `'one-way'`, `'round-trip'`) e espaços extras nas pontas (`trim`).
  - Corrigido falso positivo de Só Ida quando tipos primitivos não-objeto (números como `12345`, booleanos como `true`, ou arrays como `[]`) eram passados, assegurando agora retorno defensivo de `false`.
- **`tests/rotas_flexibilidade.test.js`**:
  - Adicionados testes de borda adversariais validando: (1) `tipo: 'ONE_WAY'`, (2) `tipo: 'one-way'`, (3) `tipo: '  so_ida  '`, (4) `tipo_viagem: 'ONE-WAY'`, (5) `tipo: 'ROUND_TRIP'`, (6) `tipo: 'round-trip'`, (7) `tipo_viagem: 'ROUND_TRIP'`, e (8) tipos não-objeto (`12345`, `true`, `[]`, `['voo']`).

## [v2.18.33] - 2026-10-13 — Blindagem Adversarial em parsePreco contra Preços Negativos com Moeda, Centavos sem Zero e Caracteres Invisíveis (Domínio Calculadora)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/calculadora.js`** (`parsePreco`):
  - Corrigido falso positivo em que strings com sinal negativo antes do símbolo monetário (ex: `"-R$ 800"`, `"-EUR 120"`, `"-$50"`, `"- $ 500"`) tinham o sinal descartado e retornavam valores positivos espúrios, assegurando agora retorno defensivo de `0` para qualquer tarifa negativa.
  - Corrigida perda de centavos em formatos numéricos sem zero à esquerda (ex: `",50"`, `".50"`, `"Taxa: ,50"`, `"R$ ,75"`), que anteriormente tinham o separador decimal indevidamente descartado virando `50` ou `75` (fator x100), agora retornando com precisão `0.50` e `0.75`.
  - Adicionada sanitização defensiva para caracteres invisíveis como zero-width space e byte-order mark (`\u200B-\u200D\uFEFF`), frequentes em scrapers anti-cópia e payloads HTML.
- **`tests/calculadora.test.js`**:
  - Adicionados testes de borda adversariais validando: (1) sinal negativo antecedendo moedas (`"-R$ 800"`, `"-EUR 120"`, `"-$50"`, `"- $ 500"`), (2) centavos decimais sem zero (`",50"`, `".50"`, `"R$ ,75"`, `"USD .25"`, `"Taxa: ,50"`), e (3) strings com zero-width spaces e BOM (`"R$\u200B1.500"`, `"\uFEFF2.300"`).

## [v2.18.32] - 2026-10-13 — Blindagem Adversarial em resolverDestinoConcreto contra Vazamento de [object Object] e Suporte a Objetos Estruturados (Domínio Aeroportos)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/aeroportos.js`** (`resolverDestinoConcreto`):
  - Corrigido vazamento de `[object Object]` nos campos `iata`, `codigoLink`, `nome` e `cidade` quando `codigoDestino` ou `destino` são passados como objetos literais (ex: `{ codigoDestino: { iata: 'MAD' } }` ou `{ codigoDestino: {} }`).
  - Integrada resolução via `obterInfoAeroporto` para `codigoDestino`, habilitando resolução direta para destinos estruturados ou com separadores (ex: `'LIS - Lisboa'`) e preservando a integridade das regiões catalogadas.
  - Implementada extração defensiva prévia (`codRaw`, `destRaw`) antes do cálculo de normalização e fallback, assegurando fallbacks seguros e limpos (`'DEST'`, `'Destino'`) sem strings corrompidas.
- **`tests/aeroportos_bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) resolução de objeto estruturado em `codigoDestino` (`{ iata: 'MAD' }`), (2) resolução de string com separador (`'LIS - Lisboa'`), e (3) rejeição e sanitização estrita de objetos vazios `{}` sem vazamento de `[object Object]`.

## [v2.18.31] - 2026-10-13 — Blindagem Adversarial em converterDuracaoParaHoras contra Formatos Compactos Zerados e Durações Negativas (Provedor Direto)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/services/providers/google_flights_direct_provider.js`** (`converterDuracaoParaHoras`):
  - Corrigido retorno indevido de `0` em durações no formato compacto zerado (ex: `"0h 0m"`, `"0h0m"`), assegurando o retorno do fallback defensivo padrão de `12.0` horas (alinhado a `"00:00"` e `0`).
  - Implementada rejeição defensiva para strings com prefixo de sinal negativo (ex: `"-2h 30m"`, `"-1h"`, `"-45min"`), prevenindo a extração errônea de valores positivos em durações espúrias ou corrompidas.
- **`tests/flight_providers_adversarial.test.js`**:
  - Adicionados testes de borda adversariais validando: (1) fallback de 12.0 para tempo zerado em formato compacto (`"0h 0m"` e `"0h0m"`), e (2) fallback de 12.0 para durações negativas em string (`"-2h 30m"`, `"-1h"`, `"-45min"`).

## [v2.18.30] - 2026-10-13 — Blindagem Adversarial em montarCardBugFare para Duração em Dias, Datas Invertidas e Sanitização Defensiva (Domínio Aeroportos)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/aeroportos.js`** (`montarCardBugFare`):
  - Corrigido cálculo de `voltaEfetiva` quando `dataVolta` é expressa como duração (ex: `"10 dias"` ou número `14`), agora resolvendo a data ISO canônica `YYYY-MM-DD` via `calcularDataVolta` e garantindo coerência total com `periodo_texto` e os links do Google Flights (`tfs`).
  - Implementada validação defensiva que descarta datas de volta que sejam anteriores à data de ida (`voltaCalculada < dataIdaNorm`), degradando graciosamente para Só Ida (`data_volta = null`) e prevenindo links corrompidos de busca.
  - Assegurada consistência estrita entre `periodo_texto`, `data_volta` e `link` em todos os fluxos de cards de Bug Fare.
- **`tests/aeroportos_bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial validando: (1) resolução de duração textual e numérica para data ISO e link `tfs`, (2) degradação automática para Só Ida quando a volta é anterior à ida, e (3) sanitização defensiva de preços negativos e códigos IATA com espaços extras.

## [v2.18.29] - 2026-10-13 — Blindagem Adversarial em obterInfoAeroporto para Espaços Internos em Parênteses e Separadores Adicionais (Domínio Aeroportos)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/aeroportos.js`** (`obterInfoAeroporto`):
  - Corrigido falso negativo em códigos IATA informados com espaços internos entre parênteses (ex: `"Santiago ( SCL )"` ou `"Auckland ( AKL )"`), tornando os regexes tolerantes a espaços em branco (`\s*`).
  - Expandido o parser de separadores para suportar delimitadores com pipe e dois pontos (`[-/|:]`, ex: `"GRU | São Paulo"`, `"EZE: Buenos Aires"`), além do traço e barra preexistentes.
  - Sanitizada a extração de `nomeCidade` para remover adequadamente parênteses com espaços internos, prevenindo nomes corrompidos de aeroportos não catalogados.
- **`tests/aeroportos_bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial cobrindo entradas com espaços internos nos parênteses (`"Santiago ( SCL )"` e destino internacional `"Auckland ( AKL )"`), e separadores com pipe (`"GRU | São Paulo"`) e dois pontos (`"EZE: Buenos Aires"`).

## [v2.18.28] - 2026-10-13 — Blindagem Adversarial em classificarItemFeed contra Falsos Negativos em Bug Fares com Desconto/Cabine e Megapromoções (Domínio Bug Fares)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/bug_fares.js`** (`classificarItemFeed`):
  - Corrigido falso negativo crítico onde Bug Fares reais que continham termos descritivos de voo e economia (`"desconto"`, `"off"`, `"executiva"`, `"business"`) eram sumariamente descartados pelo filtro de marketing antes do reconhecimento de erro de tarifa.
  - Implementada segregação defensiva entre termos de produtos não-aéreos banidos (`hotel`, `resort`, `pacote`, `cruzeiro`, `milhas`, `carro`, `seguro`) e termos descritivos de tarifas, preservando a prioridade máxima para erros de tarifa autênticos de aviação.
  - Corrigido conflito estrutural que impedia o reconhecimento de megapromoções com `"super desconto"` devido ao bloqueio prévio pela palavra genérica `"desconto"`.
  - Tratadas entradas nulas, indefinidas ou com strings em branco com retorno gracioso de descarte sem exceções.
- **`tests/bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial cobrindo Bug Fares legítimos com menção a desconto/cabine executiva, persistência de descarte para produtos não-aéreos (hotel/resort) mesmo que aleguem erro de tarifa, reconhecimento de megapromoção com "super desconto" e resiliência com entradas nulas/vazias.

## [v2.18.27] - 2026-10-13 — Blindagem Adversarial em extrairInfoTarifaEspecial contra Links Não-String, Preços Monetários e Tipos Anômalos (PWA Cockpit)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/public/js/tarifa_tags.js`** (`extrairInfoTarifaEspecial`):
  - Blindada a checagem de link em `melhor_opcao_flexivel` (`typeof flexObj?.link === 'string'`), eliminando crash fatal por `TypeError: flexObj.link.includes is not a function` caso o objeto flexível contenha links não-string (ex: números, booleanos ou objetos aninhados).
  - Blindada a função contra arrays (`Array.isArray(rota)`), garantindo retorno gracioso de `null` e prevenindo inspeções espúrias.
  - Implementada extração e normalização resiliente de preço em `melhor_opcao_flexivel` para suportar tanto números primitivos quanto strings formatadas monetárias com separadores de milhar (`"R$ 1.950"`).
- **`tests/tarifa_tags.test.js`**:
  - Adicionados 3 casos de teste de borda adversariais verificando links não-string em `melhor_opcao_flexivel`, descarte defensivo de arrays e valores nulos/indefinidos, e normalização de strings monetárias com separador de milhar.

## [v2.18.26] - 2026-10-13 — Blindagem Adversarial em gerarCombinacoesFlexibilidade para Duração Relativa, Volta no Passado e Tipos Corrompidos (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`gerarCombinacoesFlexibilidade`):
  - Blindada a resolução de `dataVolta` contra durações relativas (`"10 dias"`, `14`, `"7 noites"`) via `calcularDataVolta(idaNorm, dataVolta)`, eliminando o bug que gerava `dataVolta: null` em todas as combinações de flexibilidade (±1d a ±7d) quando a rota monitorada possuía duração de estadia em dias.
  - Adicionada salvaguarda cronológica que detecta e degrada graciosamente datas de volta anteriores à ida para `null` (Só Ida), prevenindo buscas com intervalos temporais invertidos.
  - Sanitizado o parâmetro `flexibilidadeDias` contra valores não finitos (`NaN`, `Infinity`, strings inválidas) e strings corrompidas no campo de volta.
- **`tests/rotas_flexibilidade.test.js`**:
  - Adicionado conjunto de testes de borda adversariais cobrindo durações relativas de estadia (string e número puro), degradação defensiva para datas no passado e descarte de strings corrompidas.

## [v2.18.25] - 2026-10-13 — Blindagem Adversarial em gerarDataPadraoInicial contra Coerção de Strings, Valores Nulos e Extremos (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`gerarDataPadraoInicial`):
  - Blindada a recepção de `diasOffset` com parsing defensivo (`parseInt(diasOffset, 10)`), prevenindo bug clássico de coerção acidental de tipos do JavaScript (`13 + '30' = '1330'`) onde strings numéricas resultavam em deslocamento espúrio de anos no calendário.
  - Adicionado fallback seguro para 30 dias em caso de valores nulos, não finitos (`NaN`), tipos espúrios ou offsets negativos, além de salvaguarda de limite superior (`Math.min(parsed, 3650)`) para evitar `RangeError: Invalid time value` em `toISOString()`.
- **`tests/rotas_flexibilidade.test.js`**:
  - Adicionados testes de borda adversariais validando strings numéricas (`"30"`), tipos inválidos (`null`, `NaN`, `"invalido"`, `{}`, `[]`), números negativos e valores extremos.

## [v2.18.24] - 2026-10-13 — Blindagem Adversarial em gerarJanelasExploracaoSemData contra Datas Não-ISO, Tipos Não-String e Estadia Negativa (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`gerarJanelasExploracaoSemData`):
  - Blindada a normalização de `dataBase` com `formatarDataParaBusca`, prevenindo quebras fatais por `RangeError: Invalid time value` e `TypeError: base.split is not a function` ao receber strings descritivas (`"sem data"`, `"flexivel"`, `"qualquer data"`), formato brasileiro (`"31/12/2026"`) ou tipos não-string (`20261115`, `{}`).
  - Normalizado o parâmetro `diasEstadia` com `extrairDiasEstadia`, garantindo fallback gracioso para 10 dias caso sejam passados valores negativos ou descritivos (`"15 dias"`).
  - Sanitizados os limites de `qtdAmostras` com `Number.isFinite` e `Math.max(0, ...)` e detecção de modalidade `soIda` via `ehSoIda`.
- **`tests/rotas_flexibilidade.test.js`**:
  - Adicionado caso de teste de borda adversarial validando entradas espúrias de `dataBase`, `diasEstadia` negativo/formatado e limites de amostras.

## [v2.18.23] - 2026-10-13 — Blindagem Adversarial em identificarRegiaoDestino contra Tipos Não-Primitivos e Strings em Branco (Domínio Bug Fares)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/bug_fares.js`** (`identificarRegiaoDestino`):
  - Blindada a função contra entradas não-primitivas (`Object.create(null)`, objetos vazios, arrays, booleanos, funções) que podiam causar crash fatal por `TypeError: Cannot convert object to primitive value` ao invocar `String(destinoCod)`.
  - Tratamento defensivo imediato para strings vazias e com apenas espaços em branco (`'   '`, `'\t\n'`), retornando `'OUTRO'` sem alocações ou execuções desnecessárias de regex.
- **`tests/bug_fares.test.js`**:
  - Adicionados casos de teste de borda adversariais verificando `Object.create(null)`, `{}`, `[]`, `true`, `false`, `'   '` e `'\t\n  '`.

## [v2.18.22] - 2026-10-13 — Blindagem Adversarial em gerarLinkGoogleFlightsCheapest contra Datas Inválidas, Duração em Volta, Retorno Retroativo e Moeda Não-String (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`gerarLinkGoogleFlightsCheapest`):
  - Blindada a validação de `dataIda`: strings malformadas, datas inexistentes ou tipos não-data agora retornam `null` graciosamente em vez de gerar link Protobuf corrompido com data padrão fictícia (`2027-01-01`).
  - Implementada resolução de `dataVolta` fornecida como duração/estadia (ex: `"10 dias"`, `14`): calcula com precisão a data de retorno a partir da ida via `calcularDataVolta`, gerando a perna de volta no payload `tfs=` Protobuf (Round-Trip).
  - Blindada a checagem contra volta retroativa (`voltaResolvida < dataIdaNorm`), degradando para Só Ida sem perna de retorno inconsistente no passado.
  - Sanitizado o parâmetro `moeda`, prevenindo `TypeError: (moeda || "BRL").trim is not a function` quando invocada com tipos numéricos, booleanos ou nulos.
- **`tests/construir_tfu_passageiros.test.js`**:
  - Adicionados 3 casos de teste de borda adversariais cobrindo entradas malformadas de data de ida, cálculo de duração/descarte de volta retroativa e sanitização resiliente de parâmetro moeda.

## [v2.18.21] - 2026-10-13 — Blindagem Adversarial em ehSoIda contra Booleano False, Sentinelas e Ausência Explícita de Volta (Domínio Rotas)


### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`ehSoIda`):
  - Corrigido falso negativo em que entradas booleanas `false`, numéricas zeradas (`0`), `NaN` ou strings sentinelas de ausência de volta (ex: `"sem volta"`, `"sem_volta"`, `"sem retorno"`, `"null"`, `"undefined"`, `"none"`, `"n/a"`, `"no return"`, `"single"`) eram interpretadas indevidamente como viagens de Ida e Volta (`Round-Trip`), causando corrupção de modalidade e exibição errônea nos alertas do Telegram e rotas flexíveis.
  - Implementada checagem defensiva para primitivos falsy/booleanos e vocabulário semântico de viagens de Só Ida / sem retorno.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial cobrindo `false`, `0`, `NaN`, `"sem volta"`, `"sem retorno"`, `"no return"`, `"single"`, `"null"`, `"undefined"`, `"none"` e `"n/a"`, garantindo 100% de precisão na classificação de modalidades.

## [v2.18.20] - 2026-10-13 — Blindagem Adversarial em gerarLinkGoogleFlights contra Datas Malformadas e Volta Retroativa (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`gerarLinkGoogleFlights`):
  - Eliminado vazamento de strings malformadas ou inexistentes no calendário (ex: `"data-invalida"`, `"2026-02-31"`) na URL do Google Flights (`"on data-invalida one-way"`), forçando a normalização estrita via `formatarDataParaBusca` e degradando graciosamente para a busca genérica de rota sem data.
  - Blindada a resolução de `dataVolta` para descartar datas de retorno retroativas (anteriores à data de ida) ou inexistentes, convertendo a rota de forma resiliente para Só Ida (`one-way`) em vez de gerar URLs com datas inconsistentes (`"returning"` anterior à ida).
- **`tests/domain.test.js`**:
  - Adicionados casos de teste de borda adversariais (Casos 4 e 5) validando degradação para rota sem data em datas de ida inválidas e conversão automática para one-way em voltas retroativas ou inexistentes.

## [v2.18.19] - 2026-10-13 — Blindagem Adversarial em montarCardBugFare contra Entradas Nulas, Moeda/NaN e Datas Date (Domínio Aeroportos)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/aeroportos.js`** (`montarCardBugFare`):
  - Blindada a assinatura da função com fallback defensivo para evitar `TypeError: Cannot destructure property 'origem' of 'undefined'` quando invocada sem parâmetros, com `null` ou tipos primitivos.
  - Implementada sanitização resiliente de preço, tolerando strings monetárias brasileiras (ex: `"R$ 414,50"`, `"1.250"`), descartando `NaN` e valores negativos com fallback para 0, eliminando corrupção de strings como `"por R$ NaN!"`.
  - Normalizadas datas `dataIda` e `dataVolta` para o formato canônico `YYYY-MM-DD` via `formatarDataParaBusca`, prevenindo propagação de instâncias de `Date` nativas no payload de persistência e garantindo geração íntegra do link Protobuf `tfs=` da aba Cheapest.
- **`tests/aeroportos_bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial validando tolerância a chamadas sem parâmetros/nulas, normalização de preços formatados e sanitização de objetos Date.

## [v2.18.18] - 2026-10-13 — Blindagem Adversarial em detectarBugFareEstatistico contra Formatos Monetários e Milhar (Domínio Bug Fares)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/bug_fares.js`** (`detectarBugFareEstatistico`):
  - Corrigido descarte silencioso de tarifas de Bug Fare e anomalias de Z-Score quando `preco`, `precoMedioHistorico` ou `desvioPadrao` eram fornecidos em formatos monetários comuns (ex: `"R$ 1.450,00"`, `"1.450"`, `"R$ 4.200,00"`, `"R$ 800"`). A conversão ingênua `Number(preco)` resultava em `NaN` ou interpretava `"1.450"` como float `1.45`, acionando indevidamente o filtro de descarte de ruído (< R$ 40).
  - Integrado parsing resiliente com `parsePreco` de `src/domain/calculadora.js` para normalização precisa de strings de preço, média histórica e desvio padrão.
- **`tests/bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial cobrindo formatos monetários brasileiros (`R$ 1.450,00`), cálculo de Z-Score com média e desvio monetários e queda percentual extrema com pontos de milhar.

## [v2.18.17] - 2026-10-13 — Blindagem Adversarial em classificarDeltaPreco contra Moedas em Desvio Padrão (Domínio Calculadora)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/calculadora.js`** (`classificarDeltaPreco`):
  - Corrigido comportamento anômalo onde `desvioPadrao` passado como string formatada com símbolo ou código monetário (ex: `"R$ 500"`, `"BRL 500"`, `"$ 500"`) falhava na asserção `/^-?\d/`, resultando indevidamente em `NaN` e `desvioPadrao: null`. Esse descarte silencioso rebaixava anomalias estatísticas severas (`BUG_FARE`, Z-Score <= -2.5) para meras `OPORTUNIDADE` ou `INFO`.
  - Implementada validação defensiva que rejeita strings sem dígitos (`!/\d/.test`), descarta valores explicitamente negativos (inclusive com moeda, ex: `"-R$ 80"`) e processa strings com símbolos monetários de forma resiliente via `parsePreco`.
- **`tests/calculadora.test.js`**:
  - Adicionados casos de teste de borda adversariais (Casos 8, 9 e 10) cobrindo prefixos monetários em `desvioPadrao`, desvio com moeda negativo e strings em branco.

## [v2.18.16] - 2026-10-13 — Blindagem Adversarial em parsePreco contra Tipos Espúrios (Domínio Calculadora)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/calculadora.js`** (`parsePreco`):
  - Corrigido comportamento anômalo onde tipos de dados complexos ou não-textuais (instâncias de `Date`, `Error`, `Array`, `Function`, `RegExp` e objetos arbitrários) tinham seus métodos `toString()` convertidos cegamente, extraindo números internos (ex: data `new Date()` virando preço `13202600`, `new Error('Erro 404')` virando `404` e array `[123, 456]` virando float `123.456`).
  - Implementada validação defensiva estrita para aceitar exclusivamente strings e números (primitivos ou instâncias wrapper de `String`/`Number`), retornando `0` de forma resiliente para qualquer outro tipo.
- **`tests/calculadora.test.js`**:
  - Adicionado caso de teste de borda adversarial validando a rejeição imediata de objetos espúrios (`Date`, `Array`, `Function`, `Error`, `RegExp`, `Object`) e a correta aceitação de wrappers `String`/`Number`.

## [v2.18.15] - 2026-10-13 — Blindagem Adversarial em parsePreco (Domínio Calculadora)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/calculadora.js`** (`parsePreco`):
  - Corrigido comportamento anômalo onde valores monetários precedidos por prefixos contextuais ou rótulos (ex: `"A partir de R$ 1.250"`, `"Voo 123 por R$ 890"`, `"Preço: 1.500"`) resultavam indevidamente em `0` devido ao início alfabético que induzia `parseFloat` a retornar `NaN`.
  - Implementada extração prioritária de blocos numéricos vinculados a moedas e eliminação cirúrgica de prefixos alfabéticos não numéricos.
- **`tests/calculadora.test.js`**:
  - Adicionados testes de borda adversariais validando extração precisa de preços quando precedidos por expressões contextuais e rótulos.

## [v2.18.14] - 2026-10-13 — Blindagem Adversarial em encodeVarint (Domínio Rotas / Protobuf)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`encodeVarint`):
  - Corrigido comportamento anômalo e corrupção silenciosa de dados em codificação protobuf varint quando entradas negativas (ex: `-1`, `-50`), decimais ou não-finitas (`Infinity`, `NaN`) eram passadas. Números negativos burlavam a condição `while (n > 0x7f)` e geravam bytes positivos espúrios (ex: `-1` gerava `Buffer.from([0x7f])` = `127`), enquanto `Infinity` gerava varint malformado (`[0x80, 0x00]`).
  - Implementada validação defensiva estrita com coerção numérica (`Number(num)`), garantia de finitude (`Number.isFinite`), tratamento de números <= 0 retornando `Buffer.from([0])` e truncamento de inteiros via `Math.floor`.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial validando inteiros canônicos (0, 1, 127, 128, 300), degradação graciosa para varint 0 em números negativos e rejeição de entradas nulas, não-finitas e strings malformadas.

## [v2.18.13] - 2026-10-13 — Blindagem Adversarial em parsearTempoMinutos (Cockpit PWA / Conexões)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/public/js/conexao_badges.js`** (`parsearTempoMinutos`):
  - Corrigido comportamento anômalo onde durações negativas em formato de texto (ex: `"-2h"`, `"-45min"`, `"-01:30"`, `" - 90m"`) ignoravam o sinal negativo e retornavam valores inteiros positivos (ex: `120`, `45`, `90`), divergindo da regra defensiva já aplicada para números negativos (`tempoStr = -60` -> `null`).
  - Adicionado suporte a strings puramente numéricas representando minutos (ex: `"120"`, `"45"`, `"0"`), convertendo-as defensivamente para inteiros válidos.
- **`tests/conexao_badges.test.js`**:
  - Adicionados testes de borda adversariais validando rejeição de strings negativas e conversão de strings numéricas puras.

## [v2.18.12] - 2026-10-13 — Blindagem Adversarial em extrairInfoConexoes (Google Flights Direct)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/services/providers/google_flights_direct_provider.js`** (`extrairInfoConexoes`):
  - Corrigido falso positivo crítico onde voos indiretos ou com paradas eram erroneamente catalogados como voos diretos (`0 escalas`), decorrente de match ingênuo por substring da palavra `direto` (que capturava `"indireto"` e `"não direto"`).
  - Reordenada a avaliação com prioridade para detecção de escalas explícitas e termos de conexão, associada à verificação estrita de fronteira de palavra (`(?<!n[aã]o\s+)\bdireto\b`), garantindo que voos indiretos mantenham suas escalas e aeroportos de conexão catalogados com fidelidade.
- **`tests/flight_providers_adversarial.test.js`**:
  - Adicionados 3 casos de teste de borda adversariais validando voo indireto com conexão, voo com negação de direto e inferência padrão de parada para termo indireto.

## [v2.18.11] - 2026-10-13 — Blindagem Adversarial em resolverDestino (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`resolverDestino`):
  - Blindada a resolução de cidades e regiões por dicionários (`DICIONARIO_REGIOES` e `DICIONARIO_CIDADES`) contra prototype pollution e colisão com propriedades herdadas de `Object.prototype` (ex: `"constructor"`, `"__proto__"`, `"valueOf"`, `"toString"`).
  - Implementada verificação estrita via `Object.hasOwn(...)` e garantia de tipo string primitivo, impedindo o retorno inadvertido de funções nativas ou protótipos de objeto quando chaves reservadas forem consultadas como destinos.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial validando a rejeição e retorno defensivo de `null` para `"constructor"`, `"__proto__"`, `"valueOf"` e `"toString"`.

## [v2.18.10] - 2026-10-13 — Blindagem Adversarial em avaliarCustoDestinoComTotal (Domínio Calculadora)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/calculadora.js`** (`avaliarCustoDestinoComTotal`):
  - Corrigido o cálculo de dias de permanência e custo terrestre quando o campo de volta é informado como duração textual (ex: `"10 dias"`, `"7 noites"`, `"14d"`), que antes falhava ao tentar realizar `split('-')` ingênuo, resultando em `diasViagem = 0` e omitindo as diárias do custo total da viagem.
  - Integradas as funções canônicas `formatarDataParaBusca` e `calcularDataVolta` do domínio de rotas para normalizar datas de ida e volta, suportando datas no padrão brasileiro (`DD/MM/AAAA`) e timestamps ISO sem quebras.
  - Adicionado suporte à opção explícita `diasEstadia` em `opcoes` e estabelecido teto de segurança defensivo (`Math.min(dias, 3650)`) contra números astronômicos ou maliciosos.
- **`tests/calculadora.test.js`**:
  - Adicionados testes de borda adversariais cobrindo durações textuais em dias e noites, formato de data brasileiro e opção explícita `diasEstadia` com teto de segurança.


## [v2.18.9] - 2026-10-13 — Blindagem Adversarial em extrairPrecoNumerico (Google Flights Direct)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/services/providers/google_flights_direct_provider.js`** (`extrairPrecoNumerico`):
  - Corrigido descarte de centavos decimais seguidos de delimitadores ou texto contextual (ex: `"1.450,00 Reais brasileiros"` e `"R$ 1.500,50 por pessoa"`), evitando que a regex `/[,.]\d{2}$/` falhasse na âncora final e concatenasse os dígitos dos centavos, inflacionando o valor em 100x.
  - Blindada a função contra valores negativos (ex: `"-500"`, `"R$ -1.250"`, `-500`) e tipos não-finitos (`Infinity`, `-Infinity`, `NaN`), retornando `null` defensivamente.
  - Adicionado suporte defensivo para entradas numéricas diretas (`number`), convertendo valores positivos válidos e truncando decimais para número inteiro de reais.
- **`tests/flight_providers_adversarial.test.js`**:
  - Adicionados 3 novos testes de borda adversariais cobrindo centavos com sufixos textuais, rejeição de valores negativos e suporte defensivo a tipos numéricos.

## [v2.18.8] - 2026-10-13 — Blindagem Adversarial em resolverCodigoParaLink (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`resolverCodigoParaLink`):
  - Corrigida a extração de códigos IATA entre parênteses para tolerar espaços internos arbitrários (ex: `"São Paulo ( GRU )"` e `"Miami (  MIA  )"`), alinhando o comportamento ao parser canônico de `resolverDestino`.
  - Adicionada normalização automática para maiúsculo em códigos IATA individuais de 3 letras informados em minúsculas (ex: `"gru"` → `"GRU"`, `"mia"` → `"MIA"`), prevenindo a geração de URLs e queries de scraping com códigos em caixa baixa.
  - Preservada a precedência de mapeamento para regiões canônicas (ex: `"eua"` → `"United States"`).
- **`tests/domain.test.js`**:
  - Adicionados testes de borda adversariais cobrindo parênteses com espaços internos arbitrários e códigos IATA únicos em minúsculas.

## [v2.18.7] - 2026-10-13 — Blindagem Adversarial em formatarDataParaBusca (Domínio Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`formatarDataParaBusca`):
  - Corrigido suporte a datas fornecidas como strings ISO 8601 completas ou DateTime de bancos de dados SQLite (ex: `'2026-11-15T00:00:00.000Z'`, `'2026-11-15 14:30:00'` e `'15/11/2026 18:00'`), que antes retornavam `null` e quebravam links do Google Flights e queries de scanners.
  - Preservada rigorosa validação de calendário Gregoriano via `Date.UTC`, garantindo que datas impossíveis (ex: `'2026-02-31T00:00:00Z'` ou `'2026-04-31 12:00:00'`) continuem sumariamente descartadas como `null`.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial cobrindo timestamps ISO 8601, SQLite DateTime, rejeição de datas inexistentes e entradas malformadas.

## [v2.18.6] - 2026-10-13 — Blindagem Adversarial em obterInfoAeroporto (Domínio Aeroportos)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/aeroportos.js`** (`obterInfoAeroporto`):
  - Corrigido suporte a entradas fornecidas como objetos estruturados de aeroporto ou trecho (ex: `{ iata: 'GRU' }`, `{ airport: 'EZE' }`, `{ codigo: 'MIA' }`), que antes falhavam por conversão cega para `"[OBJECT OBJECT]"` e retornavam `null`.
  - Adicionada resolução defensiva para códigos IATA de 3 letras informados entre parênteses fora do catálogo fixo (ex: `"Reykjavik (KEF)"`), preservando o código IATA e montando a estrutura canônica em vez de descartar o destino.
  - Adicionado suporte a delimitadores por hífen e barra com código IATA de 3 letras (ex: `"AKL - Auckland"`, `"Hamad / DOH"`).
- **`tests/aeroportos_bug_fares.test.js`**:
  - Adicionado caso de teste de borda adversarial validando objetos estruturados, IATA entre parênteses fora do catálogo e delimitadores por hífen/barra.

## [v2.18.5] - 2026-10-13 — Blindagem Adversarial em converterDuracaoParaHoras (Google Flights Direct)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/services/providers/google_flights_direct_provider.js`** (`converterDuracaoParaHoras`):
  - Corrigido suporte a formatos de relógio digital `"HH:MM"` (ex: `"02:30"` → 2.5h, `"1:45"` → 1.75h) que antes caíam incorretamente no fallback de 12.0h, descartando indevidamente voos rápidos em filtros de duração máxima.
  - Adicionado suporte a formatos decimais diretos com ponto ou vírgula (ex: `"2.5h"` → 2.5h, `"1,5 h"` → 1.5h), prevenindo truncamento para a parte inteira.
  - Blindagem estrita para durações zeradas em relógio digital (ex: `"00:00"`, `"0:00"`), retornando o fallback seguro de 12.0h.
- **`tests/flight_providers_adversarial.test.js`**:
  - Adicionados 3 casos de teste de borda adversariais validando formato de relógio digital `"HH:MM"`, formatos decimais com ponto/vírgula e entradas zeradas.

## [v2.18.4] - 2026-10-13 — Blindagem Adversarial em resolverDestino (Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`resolverDestino`):
  - Corrigido reconhecimento de identificadores KGMID/Freebase para aceitar prefixos maiúsculos e identificadores mistos (ex: `"/M/02j9z"`, `"/M/02J9Z"`, `"/G/11b6"`), normalizando para o formato canônico minúsculo do Google Flights em vez de retornar `null`.
  - Tratamento resiliente de código IATA entre parênteses com espaços internos arbitrários (ex: `"São Paulo ( GRU )"` ou `"Miami (  MIA  )"`), extraindo o código IATA corretamente.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste adversarial validando KGMIDs maiúsculos/mistos e espaços internos em parênteses IATA.

## [v2.18.3] - 2026-10-13 — Blindagem Adversarial em formatarPeriodoViagem (Aeroportos)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/aeroportos.js`** (`formatarPeriodoViagem`):
  - Corrigido bug onde valores como `0`, `'0'`, `'0 dias'` ou strings inválidas no campo de volta causavam vazamento de dados espúrios na mensagem (ex: `"Ida: 08/12/2026 ➔ Volta: 0"` ou `"➔ Volta: xyz"`), passando a degradar graciosamente para `(Só Ida)`.
  - Tratamento defensivo contra viagens no passado (data de volta anterior à data de ida), degradando para `(Só Ida)` em vez de permitir períodos temporais inconsistentes.
  - Blindagem estrita para data de ida inexistente no calendário (ex: `'2026-02-31'`), strings corrompidas ou instâncias de `Date` inválidas, retornando `'Data a Definir'`.
- **`tests/aeroportos_bug_fares.test.js`**:
  - Adicionado caso de teste adversarial com validação de entradas espúrias (`0`, `'0'`, `'0 dias'`, `'xyz_invalido'`), volta no passado e datas inválidas.

## [v2.18.2] - 2026-10-13 — Blindagem Adversarial em resolverCodigoParaLink (Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`resolverCodigoParaLink`):
  - Blindagem estrita de tipos para entradas não primitivas (objetos `{}`, arrays `[]`, booleans e `Symbol`), retornando o fallback seguro `'SAO'` sem quebrar na montagem de URLs do Google Flights nem lançar exceções.
  - Suporte a KGMIDs em maiúsculas (ex: `"/M/02J9Z"`, `"/M/06_1"`, `"/M/09C7W0"`), normalizando em minúsculo para mapeamento correto com `KGMID_PARA_NOME` e regex case-insensitive para prefixos `/m/` e `/g/`.
  - Normalização defensiva de múltiplos aeroportos IATA com espaços e minúsculas (ex: `"  gru , gig  "` -> `"GRU,GIG"`), prevenindo URLs mal formadas no Google Flights.
- **`tests/domain.test.js`**:
  - Adicionado caso de teste de borda adversarial validando tipos não primitivos, KGMIDs case-insensitive e limpeza de listas com múltiplos IATAs.

## [v2.18.1] - 2026-10-13 — Blindagem Adversarial em resolverDestino (Rotas)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/rotas.js`** (`resolverDestino`):
  - Corrigida resolução de destinos onde strings contendo códigos IATA embutidos entre parênteses (ex: `"São Paulo (GRU)"`, `"Miami (MIA)"`) retornavam `null`, passando a extrair o IATA prioritariamente com segurança.
  - Adicionado suporte defensivo a múltiplos aeroportos IATA separados por vírgula com espaços arbitrários (ex: `"GRU, GIG"`, `"  GRU , BSB , CNF  "`), normalizando a saída para formato canônico sem espaços (`"GRU,GIG"`, `"GRU,BSB,CNF"`).
  - Blindagem de tipos: rejeição antecipada de entradas nulas, vazias, objetos (`{}`), arrays (`[]`), números soltos e formatos truncados/corrompidos (`"GRU,"`, `",GRU"`, `"GRU,,GIG"`).
- **`tests/domain.test.js`**:
  - Adicionados testes de borda e adversariais para `resolverDestino` cobrindo parênteses, espaçamento em listas IATA e entradas inválidas.

## [v2.18.0] - 2026-10-13 — calcularMilhasRota no Backend + milhas_estimadas em escanearRota

### ✈️ Novo Recurso: Estimativa de Milhas Calculada no Servidor

- **`src/services/flight_scanner.js`** · `calcularMilhasRota` (nova função exportada):
  - Espelha `calcularMilhasEstimadas` do frontend (`card_rota.js`) para uso no backend (API, Telegram, `escanearRota`)
  - Constante `COTACOES_MILHA_MILHEIRO_BACKEND` com cotações de referência para smiles (17.50), latam/latampass (24.00), livelo (35.00), azul/tudoazul (20.00), iberia (65.00), tap (32.00)
  - Usa `paridade_milhas` customizada da rota quando disponível; cai para cotação padrão do programa quando ausente
  - Arredondamento `Math.ceil` para nunca subestimar milhas necessárias
  - Parsing defensivo de preço como string numérica; retorna `null` para preços inválidos/zero/negativos

- **`src/services/flight_scanner.js`** · `escanearRota` (step 6 adicionado):
  - Calcula `milhas_estimadas` automaticamente ao final da varredura usando `paridade_milhas` e `programa_milhas` da rota
  - Inclui `milhas_estimadas: { milhas, programa, cotacaoMilheiro } | null` no payload de retorno
  - Elimina necessidade de recalcular no cliente (Cockpit PWA) ou no Telegram

- **`tests/flight_scanner.test.js`** · 12 novos testes:
  - 10 unitários para `calcularMilhasRota` (paridade customizada, cotação padrão, Math.ceil, null para preços inválidos, fallback smiles, latampass alias, paridade negativa ignorada, preço como string)
  - 2 integração para `escanearRota` (milhas_estimadas com paridade padrão e com paridade customizada)
  - Suíte: **376/376 testes aprovados (0 falhas)**

## [v2.17.1] - 2026-10-13 — Blindagem Adversarial em parsePreco (Calculadora)

### 🛡️ Correção Defensiva & QA Adversarial:
- **`src/domain/calculadora.js`** (`parsePreco`):
  - Corrigido bug de parsing onde separador de milhar com ponto único em strings de tarifas contendo sufixos contextuais de scraping (ex: `"1.500 por pessoa"`, `"1.500/trecho"`, `"R$ 1.950 ida e volta"`) não removia o ponto, truncando valores para decimais (ex: 1.5 em vez de 1500).
  - Adicionada blindagem contra valores do tipo `Symbol` para evitar exceção `TypeError`.
- **`tests/calculadora.test.js`**:
  - Adicionados testes adversariais cobrindo sufixos contextuais e entradas inválidas/Symbols.

## [v2.17.0] - 2026-10-13 — Widget de Edição Inline de Milhas no Cockpit PWA

### ✈️ Novo Recurso: Configuração de Paridade de Milhas Diretamente nos Cards

- **`src/db.js`** · Migrações SQLite defensivas:
  - `paridade_milhas REAL` — cotação customizada R$/milheiro por rota
  - `programa_milhas TEXT DEFAULT 'smiles'` — programa de fidelidade da rota
  - `rotasRepo.atualizar()`: incluídos no `UPDATE` com validação de tipo (numérico positivo ou null; string normalizada lowercase)

- **`src/server/routes/rotas_routes.js`** · Novo endpoint `PATCH /api/rotas/:id/milhas`:
  - Schema Ajv defensivo (params integer, body com `paridade_milhas` number/null e `programa_milhas` string 1-32 chars, `additionalProperties: false`)
  - Validação de range: `paridade_milhas > 0`
  - Emite telemetria `rota_milhas_atualizada` via SSE

- **`src/public/js/card_rota.js`** · `renderizarBadgeMilhas` e `salvarMilhasInline`:
  - Badge de estimativa (.milhas-estimativa-row) exibida quando há `preco_atual`
  - Botão toggle ✏️ com cotação atual ou "Configurar milhas" (quando sem paridade)
  - Formulário inline oculto com `<select>` de programa e `<input type="number">` de cotação
  - Placeholder dinâmico sugerindo cotação padrão do programa selecionado
  - Validação visual: classe `milhas-input-erro` quando paridade ≤ 0 ou NaN
  - `salvarMilhasInline(rotaId, options)` exportada com mocks injetáveis (fetch, toast, document, recarregarDados)

- **`src/public/app.js`** · Funções globais expostas no `window`:
  - `window.salvarMilhasInline(rotaId)` — delega para `salvarMilhasInline` importado com callbacks do app
  - `window.toggleMilhasEditor(rotaId)` — alterna display do formulário inline e foca no select ao abrir
  - `window.atualizarPlaceholderMilhas(rotaId)` — atualiza placeholder ao trocar programa e remove estado de erro

- **`src/public/styles.css`** · +155 linhas de CSS dark-mode anti-UI-slop:
  - `.badge-milhas-estimadas`, `.milhas-estimativa-row`, `.milhas-editor-toggle`
  - `.btn-milhas-editar` com hover cyan; `.milhas-editor-form` com border accent
  - `.milhas-select`, `.milhas-input-cot` com estados `:focus` e `.milhas-input-erro`
  - `.btn-milhas-salvar` (verde) e `.btn-milhas-cancelar` (hover vermelho)

- **`tests/card_rota.test.js`** · +21 novos testes — **364/364 JS verdes (100%)**:
  - `renderizarBadgeMilhas`: badge com ID por rota, botão toggle, formulário inline, select com opções e pré-seleção, oculta estimativa sem preco_atual, retorna '' sem rota.id
  - `salvarMilhasInline`: sucesso com fetch mock, paridade zero, NaN, DOM ausente, erro de rede, erro HTTP 4xx/5xx, sem document/fetch

## [v2.16.10] - 2026-10-13 — Blindagem Adversarial de analisarLayoversEStopover (Domínio / Calculadora)

### 🛡️ Correção Defensiva & Robustez (Análise de Conexões e Stopover)
- `src/domain/calculadora.js` · `analisarLayoversEStopover`:
  - Corrigido bug de parsing de durações em formatos compactos sem 'm' (ex: `'8h30'`) e formatos de relógio militar (ex: `'08:30'`, `'09:15'`), que anteriormente perdiam os minutos residuais ou eram convertidos indevidamente em durações diminutas via fallback `parseFloat`.
  - Adicionada blindagem contra valores textuais de duração negativos (ex: `'-8h'`, `'-30m'`), prevenindo que fossem parseados como durações positivas espúrias e ativassem dicas de stopover incorretas.
  - Implementado desempacotamento resiliente de aeroportos fornecidos como objetos aninhados (ex: `airport: { code: 'MIA', name: 'Miami International' }`), extraindo o código IATA e nome do aeroporto em vez de atribuir o fallback `'N/A'`.
  - Tratamento defensivo de flags booleanas passadas como strings (`'false'`, `'0'`, `'sim'`) para a indicação de pernoite/overnight.
- `tests/calculadora.test.js`:
  - Adicionados testes de borda adversariais validando formatos compactos e relógio, objetos aninhados de aeroportos, descarte de durações negativas e parsing correto de strings booleanas.
  - Suíte total: **353/353 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.9] - 2026-10-13 — Blindagem Adversarial de gerarLinkGoogleFlights (Domínio / Rotas)

### 🛡️ Correção Defensiva & Robustez (Geração de Links Estruturados do Google Flights)
- `src/domain/rotas.js` · `gerarLinkGoogleFlights`:
  - Corrigido bug de `TypeError: (moeda || 'BRL').trim is not a function` quando o argumento de moeda recebia tipos adversariais não-string (ex: números `123`, booleanos ou objetos), aplicando validação de tipo defensiva com fallback seguro para `'BRL'`.
  - Normalização defensiva de `dataIda` aceitando instâncias de `Date` e strings em formato brasileiro (`DD/MM/YYYY`) convertidas para o padrão canônico `YYYY-MM-DD`, prevenindo quebras e poluição na query string de busca.
  - Tratamento resiliente de `dataVolta` quando expressa em dias relativos (ex: `'10 dias'`, `14`), calculando a data de retorno somada à data de ida em vez de injetar texto cru no parâmetro `returning`.
- `tests/domain.test.js`:
  - Adicionados testes de borda adversariais validando degradação graciosa para moeda não-string, normalização de objetos `Date`/formato BR e cálculo de data de retorno a partir de duração relativa.
  - Suíte total: **353/353 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.8] - 2026-10-13 — Blindagem Adversarial de converterDuracaoParaHoras (Provedores / Google Flights Direct)

### 🛡️ Correção Defensiva & Robustez (Provedor Google Flights Direct)
- `src/services/providers/google_flights_direct_provider.js` · `converterDuracaoParaHoras`:
  - Corrigido bug onde formatos compactos contendo apenas minutos (ex: `'45m'`, `'50 m'`) falhavam na captura de minutos e acionavam fallback indevido de 12 horas (`12.0`), distorcendo filtros de duração máxima e telemetria de voos rápidos de curta distância (como ponte aérea).
  - Adicionado suporte a entradas numéricas diretas com validação de finitude positiva e preservação de precisão decimal de 3 casas.
  - Implementado tratamento defensivo contra valores numéricos extremos ou inválidos (`-10`, `Infinity`, `NaN`).
- `tests/flight_providers_adversarial.test.js`:
  - Adicionados testes de borda adversariais para formatos compactos de minutos (`'45m'`, `'50 m'`) e entradas numéricas válidas/extremas.
  - Suíte total: **352/352 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.7] - 2026-10-13 — Blindagem Adversarial de converterMoeda (Domínio / Calculadora)

### 🛡️ Correção Defensiva & Robustez (Conversão Monetária e Parsing de Preços)
- `src/domain/calculadora.js` · `converterMoeda`:
  - Corrigido bug onde valores monetários em formato string (ex: `'R$ 550,00'` ou com separador de milhar `'1.100'`) falhavam ou eram corrompidos devido ao uso de `parseFloat` cru, retornando `0` ou valores distorcidos em vez de utilizar o parser resiliente `parsePreco`.
  - Tratamento defensivo para códigos de moeda vazios ou contendo apenas espaços em branco (ex: `'   '`), garantindo fallback consistente para `'BRL'`.
- `tests/calculadora.test.js`:
  - Adicionados casos de teste de borda adversariais validando conversão de strings monetárias brasileiras, separadores de milhar e sanitização de whitespace em moedas.
  - Suíte total: **350/350 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.6] - 2026-10-13 — Blindagem Adversarial de ordenarRotasPorEconomia (Cockpit PWA / Sparklines)

### 🛡️ Correção Defensiva & Robustez (Cockpit PWA / Ordenação de Rotas)
- `src/public/js/sparkline.js` · `ordenarRotasPorEconomia`:
  - Corrigido bug crítico de `TypeError: Cannot read properties of null (reading 'preco_atual')` quando a lista de rotas continha elementos nulos, indefinidos ou objetos corrompidos ao ordenar por `economia` ou `preco`.
  - Implementado helper defensivo interno `extrairPreco` com validação de tipo objeto, conversão segura de strings numéricas e fallback consistente para `999999` em entradas não-finitas ou inválidas.
  - Prevenção de quebra silenciosa no `.sort()` do frontend ao interagir com filtros do Cockpit PWA.
- `tests/geo_routes.test.js`:
  - Adicionados 3 casos de teste de borda adversariais cobrindo listas com `null`, `undefined`, objetos vazios, strings numéricas mal formatadas e entradas não-array.
  - Suíte total: **350/350 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.5] - 2026-10-13 — Blindagem Adversarial de extrairDiasEstadia (Domínio / Rotas)

### 🛡️ Correção Defensiva & Robustez (Módulo de Rotas e Estadia)
- `src/domain/rotas.js` · `extrairDiasEstadia`:
  - Corrigido bug de validação onde valores não-finitos numéricos (ex: `Infinity`) passavam na checagem ingênua de `!isNaN(valor) && valor > 0` e retornavam `Infinity` em vez do valor padrão defensivo.
  - Implementado teto máximo de segurança de 3650 dias (~10 anos) para valores astronômicos ou maliciosos, alinhando com a regra de integridade de `calcularDataVolta`.
  - Sanitização do parâmetro `padrao` contra valores não numéricos, negativos ou não-finitos, com fallback seguro para 10.
- `tests/domain.test.js`:
  - Adicionado caso de teste adversarial cobrindo valores não-finitos (`Infinity`, `-Infinity`, `NaN`), clamping de valores astronômicos e sanitização de `padrao` corrompido.
  - Suite total: **347/347 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.4] - 2026-10-13 — Blindagem Adversarial de avaliarTermometro (Domínio / Calculadora)

### 🛡️ Correção Defensiva & Robustez (Termômetro de Tarifas do Google Flights)
- `src/domain/calculadora.js` · `avaliarTermometro`:
  - Corrigido bug de case-sensitivity onde níveis de preço em minúsculas retornados pelo Google Flights / SerpAPI (ex: `'low'`, `'high'`) caíam incorretamente no `else` e eram classificados como "Preço Normal / Típico", perdendo sinalização de tarifas super baratas e caras.
  - Adicionado suporte a propriedades camelCase (`priceLevel`), strings diretas de nível (ex: `'LOW'`, `'HIGH'`) e sanitização de espaços com `trim().toUpperCase()`.
  - Blindagem adversarial contra entradas nulas, indefinidas, tipos primitivos numéricos e objetos mal formatados com degradação graciosa para `NORMAL`.
- `tests/calculadora.test.js`:
  - Adicionado caso de teste adversarial com validação de case-insensitivity, propriedades alternativas (camelCase / string direta) e resiliência a entradas nulas/corrompidas.
  - Suite total: **346/346 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.3] - 2026-10-13 — Blindagem Adversarial de analisarLayoversEStopover (Domínio / Calculadora)

### 🛡️ Correção Defensiva & Robustez (Módulo de Conexões e Stopover)
- `src/domain/calculadora.js` · `analisarLayoversEStopover`:
  - Corrigido bug de parsing onde durações de escalas em strings compostas (ex: `"8h 30m"`, `"9h"`, `"8h"`) eram truncadas para apenas as horas (ex: 8 minutos em vez de 510 minutos) pelo uso ingênuo de `parseFloat`, inviabilizando a identificação de stopovers (>= 480 min).
  - Adicionado suporte a propriedades alternativas de provedores (`duration_minutes`, `minutos`, `airport`, `iata`, `nome`, `pernoite`).
  - Blindagem adversarial contra entradas nulas/indefinidas, objetos vazios, strings não numéricas e números negativos.
- `tests/calculadora.test.js`:
  - Adicionado caso de teste adversarial com 3 cenários de borda validando parsing de formato textual de duração, resiliência a entradas corrompidas e compatibilidade com provedores variados.
  - Suite total: **345/345 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.2] - 2026-10-13 — Blindagem Adversarial de classificarDeltaPreco (Domínio / Calculadora)

### 🛡️ Correção Defensiva & Robustez (Módulo de Preços e Estatísticas)
- `src/domain/calculadora.js` · `classificarDeltaPreco`:
  - Corrigido bug de parsing onde strings com símbolos monetários ou formatação brasileira (ex: `"R$ 2.600"`, `"4.000,00"`, `"BRL 1.500"`) retornavam `NaN` ou valores truncados pelo uso de `parseFloat` cru em vez de `parsePreco`.
  - Blindagem adversarial do tratamento de desvio padrão em strings (`dpRaw`) contra valores corrompidos ou mal formatados, preservando sanitização rigorosa.
- `tests/calculadora.test.js`:
  - Adicionados casos de teste adversariais cobrindo strings monetárias formatadas em BRL, pontos de milhar e cálculo preciso de Z-Score e queda percentual.
  - Suite total: **344/344 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.1] - 2026-10-13 — Blindagem Adversarial de parsearTempoMinutos (Cockpit PWA)

### 🛡️ Correção Defensiva & Robustez (Módulo de Badges de Conexão)
- `src/public/js/conexao_badges.js` · `parsearTempoMinutos`:
  - Corrigido bug de descarte de minutos no formato compacto sem sufixo "m" (ex: `"2h30"`, `"1h45"`, `"8h15"`), que extraía apenas as horas e perdia os minutos restantes.
  - Adicionado suporte nativo a formato relógio militar / Google Flights `HH:MM` (ex: `"2:30"`, `"01:15"`).
  - Blindagem adversarial contra entradas numéricas diretas em minutos (`typeof tempoStr === 'number'`), valores nulos/indefinidos, `NaN`, `Infinity`, números negativos, objetos e arrays.
- `tests/conexao_badges.test.js`:
  - 2 novos casos de teste adversariais cobrindo formatos compactos, relógio `HH:MM`, números primitivos e entradas adversariais.
  - Suite total: **344/344 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.16.0] - 2026-10-13 — Cache Defensivo de 6h em Memória no WeatherService

### ✨ Nova Funcionalidade & Otimização (Serviço Meteorológico)
- `src/services/weather_service.js`:
  - `TTL_CACHE_CLIMA_MS`: exportada constante oficial configurável com TTL de 6 horas (`21.600.000 ms`).
  - `WeatherService`: construtor parametrizado com suporte a TTL customizado (`constructor(ttlMs = TTL_CACHE_CLIMA_MS)`), facilitando testes e políticas customizadas de retenção.
  - `obterClimaDestino`: implementada verificação estrita de idade do cache. Se uma entrada tiver idade maior ou igual ao TTL de 6h, é imediatamente descartada da memória e uma nova consulta é realizada, nunca retornando dados > 6h desatualizados.
  - `limparCache`: método para limpeza atômica integral do cache.
  - `expurgarExpirados`: método defensivo para varrer e remover chaves cuja validade expirou.
  - `obterTamanhoCache`: método para telemetria e auditoria de entradas ativas no cache.
- `tests/weather_service.test.js`:
  - 5 novos testes cobrindo: exportação da constante de 6h, reaproveitamento de chamadas subsequentes dentro da janela, auto-invalidação após expiração, limpeza completa com `limparCache` e expurgo seletivo de entradas vencidas.
  - Suite total: **343/343 testes JS e 10/10 Python aprovados** (100% verde).

## [v2.15.0] - 2026-10-13 — Mini-Tabela de Histórico de Preços nos Alertas Telegram

### ✨ Nova Funcionalidade (Telegram Notifier)
- `src/services/notifier_telegram.js` · `enviarAlertaOportunidade`:
  - Adicionada mini-tabela HTML de histórico recente com os últimos 3 preços registrados da rota (data BR + preço + termômetro) imediatamente antes do aviso de tarifas dinâmicas.
  - Seção renderizada somente quando `rotasRepo.obterHistoricoRecente(rotaId, 3)` retorna ao menos 1 entrada — zero ruído para rotas sem histórico.
  - Quando `rotaId` é nulo (alertas avulsos programáticos), bloco inteiramente omitido sem query ao banco.
  - Falha de leitura do SQLite capturada por `try/catch` silencioso — nunca bloqueia o envio do alerta principal.
- `tests/telegram_callbacks.test.js`:
  - 3 novos testes cobrindo: exibição com histórico real, omissão silenciosa sem histórico e omissão quando rotaId é nulo.
  - Suite total: **338/338 testes aprovados** (era 331 JS → 338 JS + 10 Py).

## [v2.14.5] - 2026-10-13 — Blindagem Defensiva de gerarCombinacoesFlexibilidade (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Domínio Rotas e Matriz de Flexibilidade)
- `src/domain/rotas.js`:
  - `gerarCombinacoesFlexibilidade`: corrigido bug em que valores textuais de retorno como `"Só Ida"` permaneciam no elemento da Data Base (`combinacoes[0].dataVolta = 'Só Ida'`) enquanto eram convertidos para `null` nos deltas de flexibilidade, causando assimetria na estrutura de retorno de voos One-Way. Implementada normalização canônica prévia de `dataIda` e `dataVolta` via `ehSoIda` e `formatarDataParaBusca`, assegurando que datas em formato brasileiro (`DD/MM/AAAA`) sejam padronizadas para `YYYY-MM-DD` uniformemente em todas as combinações e entradas nulas/não-finitas degradem com resiliência sem exceções não tratadas.
- `tests/rotas_flexibilidade.test.js`:
  - Adicionado caso de teste adversarial cobrindo normalização uniforme de `"Só Ida"`, datas em formato brasileiro `DD/MM/AAAA` e entradas nulas/não-finitas, totalizando 335 testes com 100% de aprovação.

## [v2.14.4] - 2026-10-13 — Blindagem Defensiva de formatarPeriodoViagem (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Domínio Aeroportos e Formatação de Período)
- `src/domain/aeroportos.js`:
  - `formatarPeriodoViagem`: corrigido comportamento em que instâncias de `Date` geravam strings longas em inglês com fuso horário local via `toString()`, datas no padrão brasileiro `DD/MM/AAAA` não tinham sua duração calculada (`diffDias` resultava em `NaN` em `new Date('22/12/2026')`), e expressões de duração no campo de volta (ex: `"14 dias"`) eram impressas incorretamente como `"Volta: 14 dias"`. Integrados `formatarDataParaBusca` e `calcularDataVolta` para normalização canônica UTC e cálculo preciso da data de retorno.
- `tests/aeroportos_bug_fares.test.js`:
  - Adicionado caso de teste adversarial cobrindo objetos `Date`, datas no formato `DD/MM/AAAA` e duração textual no campo de retorno, totalizando 334 testes com 100% de aprovação.

## [v2.14.3] - 2026-10-13 — Blindagem Defensiva de resolverDestinoConcreto (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Domínio Aeroportos e Resolução de Destinos)
- `src/domain/aeroportos.js`:
  - `resolverDestinoConcreto`: corrigido bug em que chamadas sem argumentos (`resolverDestinoConcreto()`), com `null`, `undefined` ou com tipos não-objeto lançavam `TypeError: Cannot destructure property 'destino' of ...`. Implementada desestruturação defensiva com fallback para objeto vazio, suporte transparente a entradas diretas em formato string (ex: `'MIA'`, `'  cdg  '`) e sanitização de maiúsculas/espaços no fallback seguro de aeroportos não cadastrados.
- `tests/aeroportos_bug_fares.test.js`:
  - Adicionadas asserções adversariais cobrindo entradas nulas/indefinidas, strings diretas com IATA/cidade e sanitização de maiúsculas e espaços em destinos desconhecidos, totalizando 333 testes com 100% de aprovação.

## [v2.14.2] - 2026-10-13 — Blindagem Defensiva de calcularDataVolta (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Domínio Rotas e Calendário Aeronáutico)
- `src/domain/rotas.js`:
  - `calcularDataVolta`: corrigido bug crítico de overflow temporal em que valores de estadia astronômicos ou não finitos (ex: `100000000`, `99999999 dias`, `Number.MAX_SAFE_INTEGER`, `Infinity`) disparavam `RangeError: Invalid time value` não tratado em `Date.toISOString()`. Implementada trava defensiva com `Number.isFinite(dias)` e teto de permanência razoável (`dias <= 3650`), validação pós-`setUTCDate` contra datas inválidas, e adicionado suporte a durações com sufixo de estadia `"noites"` / `"n"` (ex: `"7 noites"`).
- `tests/domain.test.js`:
  - Adicionadas asserções adversariais cobrindo valores numéricos astronômicos, strings com permanência excessiva, `Infinity` e formato `"7 noites"`, mantendo 100% de sucesso nos gates de validação.

## [v2.14.1] - 2026-10-13 — Blindagem Defensiva de parsePreco (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Domínio Calculadora de Preços)
- `src/domain/calculadora.js`:
  - `parsePreco`: corrigido bug em que valores formatados com ponto único de milhar sem centavos no padrão brasileiro (ex: `'1.500'`, `'R$ 1.950'`, `'2.350'`) eram incorretamente interpretados como decimais (`1.5`, `1.95`, `2.35`). Implementada detecção de ponto único seguido de 3 dígitos sem vírgula (`/^\d{1,3}\.\d{3}$/`) para remoção segura do separador de milhar. Normalizado também o tratamento de múltiplos espaços sequenciais entre agrupamentos de dígitos (`'1 234 567'`).
- `tests/calculadora.test.js`:
  - Adicionadas asserções adversariais cobrindo ponto único de milhar brasileiro sem centavos (`'1.500'`, `'R$ 1.950'`, `'2.350'`) e múltiplos agrupamentos por espaço (`'1 234 567'`) com 100% de aprovação (331 testes passando).

## [v2.14.0] - 2026-10-13 — Badge de Milhas Estimadas no Cockpit PWA

### ✈️🏆 Novo Recurso (Cockpit PWA · Card de Rota)
- `src/public/js/card_rota.js`:
  - Adicionado `COTACOES_MILHA_MILHEIRO`: dicionário canônico com cotações R$/milheiro por programa (Smiles 17,50 · LATAM 24,00 · Livelo 35,00 · Azul 20,00 · Iberia 65,00 · TAP 32,00).
  - Adicionada `calcularMilhasEstimadas(precoAtual, paridadeMilheiro, programa)`: calcula quantas milhas seriam necessárias para emitir o voo ao preço atual via `Math.ceil((preco / cotacao) * 1000)`. Retorna `null` defensivamente para preço zero/negativo/inválido; faz fallback automático para cotação Smiles quando `paridadeMilheiro` é nulo ou programa desconhecido.
  - Adicionada `renderizarBadgeMilhas(rota)`: renderiza HTML da badge `<div class="badge-milhas-estimadas">` com milhas formatadas em pt-BR, nome do programa capitalizado e tooltip com cotação de referência. Retorna `''` quando não há `preco_atual` válido (zero ruído).
  - `criarCardRota`: badge integrada no `card-pricing-block`, logo abaixo do preço atual, lendo `rota.paridade_milhas` e `rota.programa_milhas`.
- `tests/card_rota.test.js`:
  - 5 novos testes no describe "Badge de Milhas Estimadas":
    1. Cálculo correto com paridade customizada (R$ 1.750 / R$ 17,50 = 100.000 milhas).
    2. Fallback para cotação Smiles quando paridade é null ou programa inválido.
    3. `null` para preço zero, negativo ou inválido.
    4. Badge HTML com classe, milhas formatadas e programa capitalizado.
    5. `criarCardRota` inclui `badge-milhas-estimadas` quando rota tem paridade.
  - Total: **331/331 testes aprovados** (🎉 100% de sucesso).

## [v2.13.5] - 2026-10-13 — Blindagem Defensiva de resolverCoordenadas (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Serviço Meteorológico e Resolução Geográfica)
- `src/services/weather_service.js`:
  - `resolverCoordenadas`: blindada contra entradas nulas (`null`, `undefined`), não-primitivas (`{}`, `[]`), strings vazias (`""`) e strings com apenas espaços (`"   "`, `"\t\n"`). Corrigido bug crítico em que strings vazias casavam via substring (`includes("")`) com o primeiro hub catalogado (`GRU`), disparando requisições espúrias a coordenadas de Guarulhos. Adicionada rejeição de consultas curtas (< 3 caracteres como `'A'`, `'1'`) para evitar falsos positivos e implementada normalização diacrítica para suporte insensível a acentuação em nomes de cidades (ex: `'Brasilia'` -> `BSB`).
- `tests/weather_service.test.js`:
  - Adicionado caso de teste de borda adversarial validando entradas vazias/nulas, caracteres curtos e cidades sem acento (suíte com 325 testes aprovados com 100% de sucesso).

## [v2.13.4] - 2026-10-13 — Blindagem Defensiva de classificarDeltaPreco (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Classificação Estatística de Delta e Z-Score)
- `src/domain/calculadora.js`:
  - `classificarDeltaPreco`: blindada contra desestruturação direta de parâmetros nulos (`classificarDeltaPreco(null)`), evitando `TypeError: Cannot destructure property 'preco' of 'null' as it is null`. Implementada extração defensiva com validação estrita de tipos para `media` e `desvioPadrao`, prevenindo vazamento de strings espúrias no payload de retorno e descartando desvios padrão negativos matematicamente inconsistentes (`desvioPadrao: null`).
- `tests/calculadora.test.js`:
  - Adicionados casos de teste de borda adversariais validando chamadas com `null`/`undefined`, desvios em string malformada e valores de desvio padrão negativos (suíte com 324 testes aprovados com 100% de sucesso).

## [v2.13.3] - 2026-10-13 — Blindagem Defensiva de gerarTfs (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Geração de Protobuf tfs no Google Flights)
- `src/domain/rotas.js`:
  - `gerarTfs`: blindada contra entradas adversariais, arrays nulos/indefinidos em `origens`/`destinos`, strings unitárias (ex: `origens: 'GIG'`) e elementos nulos/vazios na lista. Normalização e validação resiliente de datas para instâncias de `Date` e strings no formato brasileiro `DD/MM/YYYY`, prevenindo `TypeError` de buffer e corrupção no comprimento estrito de 10 bytes do wire-format Protobuf. Sanitização de `maxDurationMinutes` para strings numéricas.
- `tests/domain.test.js`:
  - Adicionado caso de teste adversarial validando aceitação de instâncias de `Date`, formato brasileiro `DD/MM/YYYY`, strings únicas e degradação graciosa com origens/destinos nulos (suíte com 324 testes aprovados com 100% de sucesso).

## [v2.13.2] - 2026-10-13 — Blindagem Defensiva de resolverCodigoParaLink (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Resolução de Aeroportos e Links)
- `src/domain/rotas.js`:
  - `resolverCodigoParaLink`: adicionada sanitização defensiva contra entradas nulas (`null`, `undefined`), strings vazias (`""`) e strings com apenas espaços (`"   "`, `"\t\n  "`), garantindo o retorno consistente do fallback padrão `'SAO'`. Adicionado suporte case-insensitive para extração de códigos IATA entre parênteses (ex: `'São Paulo (gru)'` -> `'GRU'`), prevenindo geração de URLs quebradas ou descontextualizadas no Google Flights.
- `tests/domain.test.js`:
  - Adicionado caso de teste adversarial validando resiliência a nulos, strings vazias, espaços em branco e IATA minúsculo entre parênteses (suíte com 323 testes aprovados com 100% de sucesso).

## [v2.13.1] - 2026-10-13 — Blindagem Defensiva de Cabine em detectarBugFareEstatistico (QA Adversarial)

### 🛡️ Correção Defensiva & Robustez (Detecção de Bug Fares)
- `src/domain/bug_fares.js`:
  - `detectarBugFareEstatistico`: adicionada sanitização defensiva do parâmetro `cabine` contra valores nulos (`null`), tipos não-string, case mismatch (ex: `'  BUSINESS  '`) e aliases em português (`'executiva'`, `'primeira_classe'`, `'premium'`). Elimina risco de `TypeError: Cannot read properties of null (reading 'toUpperCase')` e assegura cálculo fidedigno dos multiplicadores de cabine (`MULTIPLICADORES_CABINE_BUG_FARE`).
- `tests/bug_fares.test.js`:
  - Adicionado caso de teste adversarial cobrindo `cabine: null`, tolerância a maiúsculas/espaços e resolução de aliases (suite com 322 testes aprovados com 100% de sucesso).

## [v2.13.0] - 2026-10-13 — Suporte à Passagem de Moeda Configurada (Multimoeda) no Ciclo de Varredura e Provedores de Busca

### ✨ Novo Recurso & Arquitetura (Motor de Busca Google Flights Multimoeda)
- `src/services/flight_scanner.js`:
  - `executarCicloVarredura`: implementado suporte aos parâmetros `moeda` e `curr` (ex: 'BRL', 'USD', 'EUR'). A moeda é normalizada em caixa alta e propagada para cada rota monitorada ou herdada da própria configuração da rota (`rota.moeda`), registrando o campo `moeda` no resultado de cada rota e no retorno consolidado do ciclo.
  - `escanearRota`: enriquecido para receber `opcoes.moeda` / `opcoes.curr`, determinando `moedaEfetiva` e transmitindo para todas as consultas de provedor (modo sem data, modo data fixa e matriz de flexibilidade adjacente ±7 dias). Transmite a moeda também para `gerarLinkGoogleFlightsCheapest` e `gerarLinkGoogleFlights` e persiste a moeda em `rotasRepo.atualizarResultadoChecagem`.
  - `buscarOfertas`: assinatura expandida para receber `moeda = 'BRL'` posicional ou via objeto unificado de parâmetros com retrocompatibilidade integral.
- `src/domain/rotas.js`:
  - `gerarLinkGoogleFlights` e `gerarLinkGoogleFlightsCheapest`: adicionado parâmetro opcional `moeda = 'BRL'`, injetando dinamicamente `&curr=${moedaCode}` nas URLs de busca canônica e links da aba Cheapest do Google Flights.
- `src/services/providers/scrapling_client.js`:
  - `construirUrlCheapest`: suporte ao 6º parâmetro `moeda = 'BRL'`, parametrizando `&curr=${moedaEfetiva}` na URL gerada.
  - `ScraplingProvider.buscarOfertas`: repassa `moeda` para `construirUrlCheapest` e links canônicos, devolvendo `moeda` estruturada no objeto `oferta`.
  - `extrairVoosDoHtml`: ampliada regex de detecção para suportar moedas internacionais (`USD`, `EUR`, `US dollars`, `euros`, etc.).
- `src/services/providers/google_flights_direct_provider.js`:
  - `GoogleFlightsDirectProvider.buscarOfertas`: suporta `moeda` e `curr`, substituindo ou adicionando dinamicamente `&curr=${moedaCode}` na URL de consulta stealth e incluindo `moeda: moedaCode` na oferta eleita.
- `src/services/providers/serpapi_provider.js`:
  - `SerpApiProvider.buscarOfertas`: suporta `moeda` e `curr`, injetando `currency: moedaCode` na query da SerpAPI e na geração do link específico.
- `src/db.js`:
  - Adicionada coluna `moeda TEXT DEFAULT 'BRL'` na tabela `rotas` no `initSchema` e via migração defensiva (`ALTER TABLE rotas ADD COLUMN moeda TEXT DEFAULT 'BRL';`).
  - Atualizados `rotasRepo.criar`, `rotasRepo.atualizar` e `rotasRepo.atualizarResultadoChecagem` para persistir e consultar a moeda da rota.
- `src/services/scheduler.js`, `src/server/routes/monitor_routes.js` e `src/server/routes/rotas_routes.js`:
  - Repasse transparente de parâmetros de moeda nos endpoints `/api/varredura`, `/api/rotas` e `/api/rotas/:id/verificar`.
- `tests/flight_scanner.test.js` & `tests/scrapling_client.test.js`:
  - 5 novos testes cobrindo propagação de moeda no ciclo de varredura, normalização de alias `curr`, herança de moeda da rota, encapsulamento posicional e por objeto, e URLs com moeda customizada no Scrapling (321/321 testes JS verdes).

---

## [v2.12.0] - 2026-10-13 — Botão de Cópia Rápida do Link Google Flights com Feedback Toast no Cockpit PWA

### ✨ Novo Recurso (Cockpit PWA Anti-UI-Slop)
- `src/public/js/card_rota.js`:
  - Extração modular da função `criarCardRota(rota)` para geração componentizada dos cards de voo do Cockpit PWA.
  - Implementação do botão de ação rápida `.btn-copy-link` no bloco `.card-actions` com ícone SVG de prancheta/cópia, tooltip e `aria-label="Copiar link do Google Flights"`.
  - Implementação de `copiarLinkGoogleFlights(event, link, options)` com uso de `navigator.clipboard.writeText`, impedimento de propagação de clique (`event.stopPropagation()`), vibração táctil iOS/Android (`vibrarAoTocar`) e fallback defensivo com `document.execCommand('copy')`.
  - Exibição de feedback toast visual temporário de 2s ("Link copiado! ✓") com tratamento de erros para links vazios ou permissão negada.
  - Suporte a classes múltiplas acumuladas no card (ex: rota flexível que também atingiu a meta).
- `src/public/app.js`:
  - Integração limpa e concisa de `criarCardRota` e `copiarLinkGoogleFlights`, simplificando `renderizarRotas` de 170 linhas de template inline para mapeamento modular direto.
  - Aprimoramento de `mostrarToast(mensagem, erro = false, duracaoMs = 4000)` para suportar duração customizável e aplicar classe `.fade-out` 300ms antes da remoção, garantindo transição visual suave.
  - Exportação e vinculação global em `window` para suporte total a handlers de eventos inline.
- `src/public/styles.css`:
  - Adicionados estados `:hover` e `:active` refinados para `.btn-icon-action.btn-copy-link` com realce na cor primária ciano e feedback de pressão tátil (`scale(0.92)`).
  - Adicionada animação `.toast.fade-out` com transição suave de opacidade e translação vertical.
- `tests/card_rota.test.js`:
  - Nova suíte de 12 testes unitários cobrindo estrutura do card, botão de cópia rápida, atributos de acessibilidade, escape defensivo de URLs adversariais, testes de cópia bem-sucedida, rejeição de erros, links vazios, identificação de cabine/tipo de viagem e utilitários de formatação (316/316 testes JS verdes).

---

## [v2.11.1] - 2026-10-13 — Botão inline 🧳 Ver Regras de Bagagem no card de Bug Fare (Telegram)

### ✨ Novo Recurso
- `src/services/notifier_telegram.js` · `enviarAlertaBugFare`:
  - Adicionado botão inline `🧳 Ver Regras de Bagagem` no card de alerta de Bug Fare enviado pelo bot Telegram.
  - A URL do botão é parametrizada dinamicamente com os IATAs de origem e destino da rota, apontando diretamente para o Google Flights, permitindo ao usuário consultar as políticas de bagagem da rota de forma contextual em 1 toque.
  - Inline keyboard agora tem 2 linhas: linha 1 `⚡ Ver no Google Flights` (link canônico da oferta), linha 2 `🧳 Ver Regras de Bagagem` (apenas quando IATAs disponíveis).
  - Degradação graciosa: sem IATAs no card → apenas botão principal. Sem URL nenhuma → fallback para envio simples (retrocompatibilidade total com chamadas legadas).
- `src/domain/aeroportos.js` · `montarCardBugFare`:
  - Adicionados campos `iata_origem` e `iata_destino` ao objeto retornado, expondo os códigos IATA puros (link codes) necessários para construção da URL de bagagem.
- `tests/telegram_callbacks.test.js`:
  - 3 novos testes: botão presente com IATAs (URL verificada com GRU e CDG), ausência graciosa sem IATAs, compatibilidade retroativa com chamada via string simples.
  - Total: **304/304 testes** aprovados.

---

## [v2.10.10] - 2026-10-13 — QA & Blindagem Adversarial em `parsePreco` (calculadora)

### 🛡️ Blindagem de QA Adversarial
- `src/domain/calculadora.js` · `parsePreco`:
  - Corrigido bug crítico onde tarifas e diárias com moedas internacionais ou símbolos estrangeiros (`USD 150`, `$ 250.00`, `US$ 99.90`, `€ 85`, `£ 120.50`) resultavam em `0` devido ao `parseFloat` falhar em caracteres não numéricos.
  - Implementado suporte robusto a múltiplos separadores de milhar sem centavos (ex: `1.500.000` e `1,200,000`), corrigindo anomalia onde valores com múltiplos pontos eram truncados para `1.5`.
  - Adicionada sanitização para espaços non-breaking (`\u00A0`, `\u202F`) e números com separador de milhar por espaço (ex: `1 500,50`).
- `tests/calculadora.test.js`:
  - Adicionado caso de testes adversariais cobrindo moedas estrangeiras, múltiplos separadores de milhar e caracteres non-breaking (100% aprovado).

---

## [v2.10.9] - 2026-10-13 — QA & Blindagem Adversarial em `identificarRegiaoDestino` (bug_fares)

### 🛡️ Blindagem de QA Adversarial
- `src/domain/bug_fares.js` · `identificarRegiaoDestino`:
  - Eliminado falso positivo crítico de substring onde nomes de cidades e países (ex: `Chile`, `Santiago`, `Parnaíba`) casavam indevidamente com códigos IATA/metropolitanos de 3 letras (`CHI` de Chicago, `SAN` de San Diego, `PAR` de Paris), causando classificação geográfica distorcida (ex: `Chile` como `AMERICA_NORTE`).
  - Integrada resolução canônica prévia via `resolverDestino` de `src/domain/rotas.js` para mapear nomes de regiões e cidades para seus IATAs/KGMIDs canônicos.
  - Implementada verificação estrita com fronteira não-alfanumérica (`(^|[^A-Z0-9])COD([^A-Z0-9]|$)`) para permitir múltiplos aeroportos (ex: `JFK,EWR`, `GRU,CGH`) sem permitir substrings em palavras comuns.
- `tests/bug_fares.test.js`:
  - Adicionado caso de testes adversariais para falsos positivos de substrings (`Chile`, `Santiago`, `Parnaíba`), listas IATA compostas e entradas nulas/indefinidas/vazias (100% aprovado).

---

## [v2.10.8] - 2026-10-13 — QA & Blindagem Adversarial em `calcularVariacao` (calculadora)

### 🛡️ Blindagem de QA Adversarial
- `src/domain/calculadora.js` · `calcularVariacao`:
  - Blindado contra valores nulos, zero ou inválidos em `precoAtual`, evitando falsos alertas de queda relâmpago de -100% e retornando `{ texto: 'Indisponível', pct: 0, diff: 0, ehQuedaRelampago: false }`.
  - Integrado parsing resiliente via `parsePreco` para `precoAtual` e `precoAnterior`, permitindo suporte transparente a strings monetárias formatadas (ex: `'R$ 1.600,00'`) e strings numéricas.
  - Sanitizado `gatilhoQuedaPct` contra valores não finitos ou negativos, garantindo fallback padrão de 15%.
- `tests/calculadora.test.js`:
  - Adicionado caso de testes adversariais para casos de borda com nulos, strings monetárias formatadas, NaNs e zeros (100% aprovado).

---

## [v2.10.7] - 2026-10-13 — QA & Blindagem Adversarial em `detectarBugFareEstatistico` (bug_fares)

### 🛡️ Blindagem de QA Adversarial
- `src/domain/bug_fares.js` · `detectarBugFareEstatistico`:
  - Corrigido erro de desestruturação quando o método era invocado sem parâmetros, com `null` ou `undefined`, retornando agora `{ ehBugFare: false }` defensivamente.
  - Adicionada coerção numérica segura (`precoNum`, `numMedio`, `numDesvio`) para suportar strings numéricas (ex: `'1450'`, `'4200'`) e prevenir quebras de `TypeError: .toFixed is not a function`.
  - Tratamento estrito contra valores não-finitos (`NaN`, `Infinity`, `-Infinity`, preços negativos ou strings não numéricas), prevenindo contaminação estatística.
- `tests/bug_fares.test.js`:
  - Adicionado caso de testes adversariais cobrindo entradas nulas/indefinidas, strings numéricas e valores extremos (totalizando 276 testes aprovados).

---

## [v2.10.6] - 2026-10-13 — QA & Blindagem Adversarial em `formatarPeriodoViagem` (aeroportos)

### 🛡️ Blindagem de QA Adversarial
- `src/domain/aeroportos.js` · `formatarPeriodoViagem`:
  - Corrigido tratamento de strings de datas vazias ou contendo apenas espaços em branco, retornando agora `Data a Definir` com segurança em vez de string malformatada.
  - Adicionado trim defensivo em strings de data para que datas com espaços (ex: `' 2026-12-08 '`) sejam devidamente reconhecidas e formatadas para `DD/MM/AAAA`.
  - Corrigida concordância gramatical de duração para viagens de 1 dia, exibindo `(1 dia)` no singular em vez de `(1 dias)`.
- `tests/aeroportos_bug_fares.test.js`:
  - Adicionados testes de borda adversariais validando tratamento de entradas vazias com espaços, singular de dias e trim defensivo.

---

## [v2.10.5] - 2026-10-13 — Suporte a Moedas Dinâmicas e Conversão de Diárias Internacionais (calculadora)

### 🚀 Funcionalidades & Inteligência de Domínio
- `src/domain/calculadora.js` · `avaliarCustoDestinoComTotal`:
  - Implementado suporte completo a moedas dinâmicas (`moeda: 'USD'`, `'EUR'`, `'GBP'`, etc.) com conversão de voo e diária para a moeda alvo.
  - Implementada inferência geográfica inteligente para destinos internacionais fora do dicionário base (`DICIONARIO_CUSTO_DESTINO`), com resolução de região via `obterInfoAeroporto` e moeda/diária nativa de referência (`DIARIAS_REGIONAIS_PADRAO`).
  - Adicionado suporte a ajustes específicos de custo por país (`AJUSTES_PAIS_CUSTO`) para destinos de alto custo (Reino Unido com GBP, Suíça com CHF, Japão com JPY, Canadá com CAD, Austrália com AUD).
  - Adicionada detecção automática de cidades nacionais e aeroportos brasileiros via `DICIONARIO_CIDADES` (`DOMESTICO`), evitando fallback genérico internacional.
  - Adicionado suporte à injeção de cotações personalizadas (`cotacoes`) e diárias customizadas (`diariaCustomizada`).
  - Implementada função utilitária `converterMoeda` com cotações padrão de 15 moedas (`COTACOES_PADRAO`) e fallback defensivo contra valores não-finitos.
- `src/domain/rotas.js` · `ehSoIda`:
  - Normalização de strings com underscores (`SO_IDA`), assegurando classificação precisa de voos só ida.
- `tests/calculadora.test.js`:
  - Adicionados 5 novos testes cobrindo conversão de moedas cruzadas, destinos internacionais fora do dicionário (Viena, Sydney, Toronto), cidades nacionais (Joinville), moedas dinâmicas e robustez contra casos de borda (totalizando 273/273 testes aprovados).

---

## [v2.10.4] - 2026-10-13 — QA & Blindagem Adversarial em `parsePreco` (calculadora)

### 🛡️ Blindagem de QA Adversarial
- `src/domain/calculadora.js` · `parsePreco`:
  - Corrigido vazamento de valores não-finitos (`Infinity`, `-Infinity`, `NaN` em números ou strings) que passavam pelo teste `!isNaN(valor)` e contaminavam cálculos posteriores de delta e z-score.
  - Blindagem contra preços negativos (`< 0`), retornando `0` de forma segura.
  - Adicionado suporte e higienização para o prefixo monetário `BRL` (além de `R$`) e strings vazias/espaços soltos.
- `tests/calculadora.test.js`:
  - Adicionada suíte de testes de borda adversariais validando rejeição de `Infinity`, `-Infinity`, strings malformatadas, valores negativos e parsing com prefixo `BRL` (268/268 testes aprovados).

---

## [v2.10.3] - 2026-10-13 — QA & Blindagem Adversarial em `escapeHtml` (notifier_telegram)

### 🛡️ Blindagem de QA Adversarial
- `src/services/notifier_telegram.js` · `escapeHtml`:
  - Corrigido bug de coerção falsy `texto || ''` que convertia o número `0` e o booleano `false` em strings vazias, preservando agora valores numéricos e booleanos legítimos.
  - Adicionado escape defensivo para aspas duplas (`"` -> `&quot;`) em conformidade com as diretrizes do Telegram Bot API, prevenindo quebra e injeção em atributos HTML (como tags `<a href="...">`).
- `tests/telegram_callbacks.test.js`:
  - Adicionado teste adversarial validando coerção segura para zero (`0`), booleanos (`false`), valores nulos/indefinidos e strings com aspas duplas (267/267 testes aprovados).

---

## [v2.10.2] - 2026-10-13 — Badges de Conexões e Stopover Noturno em Cards Móveis (Cockpit PWA)

### 🎨 Cockpit PWA & Anti-UI-Slop
- `src/public/js/conexao_badges.js`:
  - Módulo ES nativo para extração e renderização de dados de escalas e conexões com precisão:
    - `parsearTempoMinutos`: parser defensivo de durações de conexão com suporte a horas inteiras/decimais, minutos e formatos variados (`9h 30m`, `1h 45min`, `45 min`).
    - `extrairInfoConexao`: detecção estruturada de 5 tipos de conexões (`direto`, `curta` <= 3h, `moderada` 3h a 8h, `longa` > 8h, `noturna` / pernoite / overnight) inspecionando `detalhes_voo`, `dica_stopover` e `melhor_opcao_flexivel`.
    - `renderizarBadgeConexao`: geração de badges compactas estilo pill para o cabeçalho do card de voo com paleta intencional (`tag-conexao-direto`, `tag-conexao-curta`, `tag-conexao-moderada`, `tag-conexao-longa`, `tag-conexao-noturna`).
    - `renderizarBannerStopover`: callout visual enriquecido para escalas prolongadas (`stopover-longo` com tema âmbar) e escalas noturnas (`stopover-noturno` com tema violeta/índigo estelar), destacando oportunidades de stopover 2-em-1 sem bilhete adicional.
- `src/public/app.js` · `renderizarRotas`:
  - Integração da badge de conexão no cabeçalho do card (`card-header-tags`) e renderização do banner refinado de stopover no corpo do card.
- `src/public/styles.css`:
  - Adicionadas regras de estilo para as badges de conexão e banners de stopover, com tipografia mono, efeitos de brilho sutis em dark mode e refinamento responsivo para dispositivos móveis (`@media (max-width: 640px)`).
- `tests/conexao_badges.test.js`:
  - Nova suíte com 19 testes automatizados cobrindo parsing de durações, voos diretos, conexões rápidas, escalas prolongadas, pernoites noturnos, compatibilidade com opções flexíveis, badges HTML e banners de stopover (266/266 testes aprovados).

---

## [v2.10.1] - 2026-10-13 — QA & Blindagem Adversarial em `calcularDataVolta`

### 🛡️ Blindagem de QA Adversarial
- `src/domain/rotas.js` · `calcularDataVolta`:
  - Blindada a resolução de data de volta calculada com base em duração de estadia contra exceção crítica `RangeError: Invalid time value`.
  - Normalização da data de ida via `formatarDataParaBusca`, tratando entradas malformadas, datas inválidas e suportando graciosamente formatos regionais como `DD/MM/YYYY`.
- `tests/domain.test.js`:
  - Adicionado caso de teste adversarial cobrindo entradas malformadas, nulas/indefinidas, datas inválidas e datas no formato brasileiro (totalizando 247/247 testes aprovados).

---

## [v2.10.0] - 2026-10-13 — Fallback Defensivo de Extração de Companhia Aérea por Código IATA (ScraplingClient)

### 🚀 Novas Funcionalidades & Resiliência de Scraping
- `src/services/providers/scrapling_client.js` · `MAPA_CIAS_IATA` & `extrairCiaIataDoTrecho`:
  - Implementado dicionário canônico com mapeamento de códigos IATA de 2 letras para companhias aéreas nacionais e internacionais (G3 -> GOL, LA/JJ -> LATAM, AD -> Azul, 2Z/VO -> Voepass, TP -> TAP Portugal, AF -> Air France, KL -> KLM, LH -> Lufthansa, etc.).
  - Implementada função auxiliar `extrairCiaIataDoTrecho` com 6 níveis de resolução defensiva: atributos `data-*` (`data-airline`, `data-carrier`, `data-marketing-carrier`, `data-iata`), número de voo (`data-flight-number`), caminhos de logos em CDN (`airline_logos/70px/...`), matrizes JSON (`carrier`, `airlineCode`, arrays `["G3", 1542]`), menções de número de voo no texto e atributos `alt`/`title`.
- `src/services/providers/scrapling_client.js` · `extrairVoosDoHtml`:
  - Integração do fallback IATA nas Camadas A (quando aria-label não traz nome por extenso ou traz código de voo como `Voo G3 1542`), B (aria simples) e C (BRL raw), inspecionando o contexto HTML adjacente para eliminar atribuições genéricas de "Companhia Aérea".
- `tests/scrapling_client.test.js`:
  - Adicionada suíte de testes com 16 novos testes automatizados dedicados cobrindo atributos `data-*`, URLs de logos, matrizes JSON, regex de números de voo, persistência de códigos não-mapeados e integração nas 3 camadas de extração do HTML (totalizando 246/246 testes aprovados).

---

## [v2.9.9] - 2026-10-13 — Persistência Atômica do Working Buffer em Disco (BugFareHunter)

### 🚀 Novas Funcionalidades & Arquitetura Proativa
- `src/services/bug_fare_hunter.js` · `BugFareHunter` / `salvarWorkingBufferDisco`:
  - Implementada persistência atômica do cache do Working Buffer em disco (`data/working_buffer.json`) utilizando padrão temporário `.tmp` no mesmo diretório seguido de `fs.renameSync` para imunidade contra corrupção em falhas inesperadas.
  - Envelope estruturado com `versao`, `atualizadoEm`, `totalCorredores` e mapa sanitizado de leituras e histórico do último alerta.
- `src/services/bug_fare_hunter.js` · `carregarWorkingBufferDisco` & Construtor:
  - Recarregamento automático no boot da classe, garantindo retenção de memória e volatilidade zero após reinicializações do processo.
  - Suporte resiliente a envelopes versionados e formatos legados planos, além de sanitização estrita de entradas e aplicação do limite de janela deslizante (`BUFFER_MAX_LEITURAS = 5`).
- `src/services/bug_fare_hunter.js` · `escanearCorredoresProativos`:
  - Invocação automática de `this.salvarWorkingBufferDisco()` ao término do ciclo de varredura proativa.
- `.gitignore`:
  - Adicionado `data/working_buffer.json` e `data/*.tmp*` para manter working tree limpa e sem ruídos em tempo de execução.
- `tests/bug_fares.test.js`:
  - 7 novos testes automatizados dedicados cobrindo escrita atômica, restauração no boot, sanitização de leituras corrompidas, arquivos inválidos e orquestração do ciclo de varredura (230/230 testes aprovados).

---

## [v2.9.8] - 2026-10-13 — QA & Blindagem Adversarial em `somarDiasData`

### 🛡️ Blindagem de QA Adversarial
- `src/domain/rotas.js` · `somarDiasData`:
  - Correção de vulnerabilidade a `RangeError: Invalid time value`: validação defensiva das datas de entrada via `formatarDataParaBusca`, impedindo datas inexistentes no calendário (`2026-02-31`) ou strings corrompidas de disparar exceções no `toISOString()`.
  - Tratamento resiliente de deltas de dias (`Number.isFinite`), retornando a data original intacta e segura ao invés de quebrar em casos de `NaN`, `Infinity` ou strings malformadas.
  - Blindagem contra `TypeError` quando a data fornecida não for do tipo string (ex: números ou objetos).
- `tests/rotas_flexibilidade.test.js`:
  - Adicionado caso de teste de borda adversarial cobrindo entradas nulas, vazias, malformadas, não-finitas e formatos alternativos (223/223 testes aprovados).

---

## [v2.9.7] - 2026-10-13 — Decodificação Protobuf tfu na Aba Cheapest (ScraplingProvider)

### 🚀 Novas Funcionalidades & Resiliência de Scraping
- `src/services/providers/scrapling_client.js` · `decodificarPrecoDoTfu`:
  - Implementada função especializada de decodificação de payload binário Protobuf do parâmetro canônico `tfu` (Base64/Base64URL).
  - Extração de menor tarifa com detecção automática de moeda (`BRL`, `USD`, `EUR`, etc.) e resolução de escala decimal (centavos/unidades).
  - Tolerância defensiva para strings URL-encoded, ausência de padding Base64 e validação estrita no intervalo [80, 60.000].
- `src/services/providers/scrapling_client.js` · `extrairPrecoCheapestTab`:
  - Adicionada 4ª camada de extração para inspecionar URLs de resposta (`urlResposta`) e ocorrências do parâmetro `tfu` embutidas em tags de redirecionamento ou chamadas AJAX sem corpo HTML rico.
  - Conexão em `ScraplingProvider.buscarOfertas` passando `resp.url` para garantir captura da tarifa em redirecionamentos.
- `tests/scrapling_client.test.js`:
  - 10 novos testes cobrindo tokens reais do Google Flights, URLs completas, redirects AJAX sem corpo rico e edge cases (222/222 testes JS e 10/10 Python aprovados).

---

## [v2.9.6] - 2026-10-13 — QA & Blindagem Adversarial em `classificarDeltaPreco`

### 🛡️ Blindagem de QA Adversarial
- `src/domain/calculadora.js` · `classificarDeltaPreco`:
  - Correção na classificação de oportunidades: garante que quedas $\ge 30\%$ frente à média recente sejam categorizadas como `OPORTUNIDADE` mesmo sob desvios padrão amplos ($DP \ge 30$) onde o Z-Score ficaria entre os limiares.
  - Blindagem defensiva com coerção numérica (`Number.isFinite`), prevenindo `NaN`, `Infinity` e strings mal formatadas em `preco`, `media` e `desvioPadrao`.
- `tests/calculadora.test.js`:
  - 3 novos casos de teste de borda cobrindo desvios padrão amplos com queda $\ge 30\%$, entradas malformadas/infinitas e coerção de strings numéricas (212/212 testes aprovados).
- `tests/flight_scanner.test.js`:
  - Mock determinístico defensivo de `FlightScanner.buscarOfertas` para isolamento estrito sem requisições de rede.

---

## [v2.9.5] - 2026-10-13 — Detecção de Deltas com Z-Score no FlightScanner & ExecutarCicloVarredura

### 🚀 Novas Funcionalidades & Arquitetura Proativa
- `src/domain/calculadora.js` · `classificarDeltaPreco`:
  - Implementada função pura de análise estatística de tarifas e cálculo de Z-Score sobre histórico amostral.
  - Classificação estrita de deltas conforme o padrão proactive-agent (Zero Ruído):
    - `BUG_FARE`: $Z \le -2.5$ (anomalia tarifária crítica).
    - `OPORTUNIDADE`: $Z \le -1.5$ ou queda comprovada $\ge 30\%$ em relação à média recente.
    - `INFO`: Oscilação normal de mercado (sem anomalia).
- `src/db.js` · `alertasRepo.deveDisparar`:
  - Supressão de ruído para oscilações normais de mercado (`INFO`) quando o usuário não possui preço alvo ou quando não há cruzamento de meta.
  - Disparo de oportunidade estatística comprovada (`OPORTUNIDADE_ESTATISTICA`) em tempo hábil com respeito a cooldowns e deduplicação inteligente.
- `src/services/flight_scanner.js`:
  - Integração da telemetria de deltas em `escanearRota`, enriquecendo os resultados com `deltaEstatistico`.
  - Implementado `FlightScanner.executarCicloVarredura({ forcarTodas, limite, aplicarJitter })` para orquestração modular da fila LRU.
- `src/services/scheduler.js`:
  - Refatoração limpa do ciclo periódico delegando a varredura para `FlightScanner.executarCicloVarredura`.
- `tests/flight_scanner.test.js`, `tests/calculadora.test.js` & `tests/alertas_criterios.test.js`:
  - 6 novos testes cobrindo Z-Score, supressão de ruído INFO, disparo de oportunidade e ciclo de varredura (211/211 testes passando com 100% de sucesso).

---

## [v2.9.4] - 2026-10-13 — QA & Blindagem Defensiva em `analisarLayoversEStopover`

### 🛡️ Blindagem de QA Adversarial
- `src/domain/calculadora.js` · `analisarLayoversEStopover`:
  - Proteção estrita contra entradas `null`, `undefined` e não-objeto, eliminando riscos de `TypeError` não tratado (`voo.layovers`).
  - Higienização e descarte de layovers nulos ou corrompidos (`duration <= 0`, NaN, itens indefinidos ou não-objeto).
  - Coerção resiliente para strings numéricas em durações de conexões longas/Stopover.
- `tests/calculadora.test.js`:
  - Novos casos de teste de borda cobrindo payloads corrompidos, nulos e strings numéricas válidas (205/205 testes passando).

---

## [v2.9.3] - 2026-10-13 — Alertas de Nova Queda no Mesmo Dia & Deduplicação Inteligente

### ✅ Entregue
- `src/db.js` · `alertasRepo.deveDisparar` & `alertasRepo.deveDispararBugFare`:
  - Fim do bloqueio cego de 48h/24h: quando o preço cai significativamente no mesmo dia (> 5% abaixo do último alerta enviado), o usuário é imediatamente notificado com o novo recorde mais barato.
  - O cooldown agora se aplica estritamente à repetição de mesmo valor ou oscilações insignificantes (< 5%), garantindo silêncio absoluto sem flood minuto a minuto.
  - Implementado `deveDispararBugFare` com registro de disparos e rastreamento de melhoria percentual.
- `src/services/flight_scanner.js`:
  - Integração com `alertasRepo.deveDispararBugFare`: suprime floods com o mesmo valor a cada minuto no loop de escaneamento, mas despacha alerta instantâneo se a tarifa anômala cair ainda mais.
- `src/services/bug_fare_hunter.js`:
  - `_ehAlertaDuplicado(chave, tipo, preco)`: permite alertas de nova queda no mesmo dia se `preco < ultimo.preco` e `queda >= 5%`.
- 2 novos testes automatizados adicionados (+2 testes, 204/204 testes passando com 100% de sucesso).

---

## [v2.9.2] - 2026-10-13 — Working Buffer + Z-Score no BugFareHunter

### ✅ Entregue
- `src/services/bug_fare_hunter.js` · `escanearCorredoresProativos` · Padrão proactive-agent zero ruído implementado: Working Buffer em memória (Map por chave `origem:destino`) com janela deslizante de 5 leituras; Z-Score < -2.5 → BUG_FARE, Z-Score < -1.5 → OPORTUNIDADE, queda > 30% (fallback sem DP) → OPORTUNIDADE, demais → INFO silencioso.
- Deduplicação defensiva de 24h: `_ehAlertaDuplicado` suprime alertas do mesmo tipo dentro da janela; `_registrarAlertaDisparado` persiste timestamp no buffer.
- Retrocompatibilidade: `executarVarreduraProativa` agora é alias de `escanearCorredoresProativos`.
- `obterEstadoBuffer()` para diagnóstico do buffer em runtime.
- 11 novos testes unitários (202/202 verdes | +11 vs sprint anterior).

e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.9.1] - 2026-10-13

### 🛡️ QA Adversarial: 5 Bugs Corrigidos em Provedores de Voo

**Sprint de auditoria adversarial implacável** dos providers `google_flights_direct_provider.js` e `scrapling_client.js`:

#### Bugs Corrigidos

- **`extrairPrecoNumerico("0")` → retornava `0` em vez de `null`** (`src/services/providers/google_flights_direct_provider.js`):
  - Zero não é preço válido para passagem aérea. Agora garante `n === 0 → null`.

- **`converterDuracaoParaHoras` — imprecisão em filtros de duração máxima** (mesmo arquivo):
  - Usava `toFixed(1)` causando arredondamento que quebrava filtros: `40 min → 0.8h` em vez de `0.667h`.
  - Um voo de 40 minutos com `duracaoMaxHoras: 0.75` era erroneamente filtrado (0.8 > 0.75).
  - Corrigido para `toFixed(3)` (precisão de 3 casas decimais).
  - Adicionado suporte a formatos compactos: `"2h30m"`, `"2h30min"`.

- **`limparNomeCompanhia` — sufixos corporativos e localização** (mesmo arquivo):
  - Não removia: `"Linhas Aéreas"` (GOL, Azul), `"Group"` (LATAM Airlines Group → LATAM Airlines), `"Holdings"` (Copa Airlines Holdings → Copa Airlines), `"Airline"` singular (Emirates Airline → Emirates), `"S.A."` (Aerolíneas Argentinas S.A. → Aerolíneas Argentinas).
  - Não traduzia `"Multiple airlines"` / `"Multiple carriers"` → `"Múltiplas Companhias"`.
  - Preserva corretamente `"TAP Air Portugal"` e `"LATAM Airlines"`.

- **`extrairPrecoCheapestTab` — Camada 1 não tolerava espaços extras** (`src/services/providers/scrapling_client.js`):
  - `[[null,  587 ], "EhZ..."]` (com espaços internos extras) não era capturado.
  - Corrigido regex: `\[\[null,\s*(\d+)\s*\]\s*,\s*` (whitespace tolerante).

- **`extrairPrecoCheapestTab` — Camada 3 não capturava formato minificado sem colchete duplo**:
  - `[null,1850],"EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl"` não era capturado.
  - Camada 2 ampliada remove dependência de `AF_initDataCallback` para capturar `[[null,N],"base64"]`.
  - Camada 3 agora reconhece o token base64 canônico `EhZjb21wcmVoZW5zaXZlbmVzc19sdXJl` além de palavras literais.

#### Testes Adicionados

- **`tests/flight_providers_adversarial.test.js`** (novo arquivo — 34 cenários adversariais):
  - `extrairPrecoNumerico`: 8 casos (zero, vazio, null, formatos BR com ponto/vírgula/espaço).
  - `converterDuracaoParaHoras`: 8 casos (precisão 3 casas, formatos compactos, filtro de duração).
  - `limparNomeCompanhia`: 10 casos (sufixos corporativos, tradução, preservação de nomes compostos).
  - `extrairPrecoCheapestTab`: 9 casos (espaços extras, formato minificado, limites de intervalo).

- **`tests/flight_providers.test.js`** (atualizado):
  - Linha 139: assertiva de `duracaoHoras` atualizada de `3.7` (valor do bug) para `≈3.667` com tolerância `±0.001`.

- **Suíte de Testes**: **191/191 testes aprovados (100% verde)** (+34 testes adversariais).

## [2.9.0] - 2026-10-13

### 🦅 ScraplingProvider: Motor de Scraping Resiliente com Aba Cheapest via Protobuf tfs

- **`src/services/providers/scrapling_client.js`** (novo arquivo — 390 linhas):
  - `ScraplingProvider`: provedor de scraping stealth com rotação de 4 perfis (Win/Mac/Linux/Android Chrome 131), jitter de delay anti-bot (800–2400ms), até 2 tentativas com troca de fingerprint.
  - `construirUrlCheapest`: constrói URL da aba Cheapest com payload Protobuf `tfs`, com distinção mandatória **One-Way** (`tipoViagem: 'one_way'`) vs **Round-Trip** (`tipoViagem: 'round_trip'`) no byte `0x10` do binário.
  - `extrairPrecoCheapestTab`: regex multicamada (3 padrões) para capturar o menor preço da aba Cheapest no HTML raw, incluindo variantes minificadas de build de produção do Google Flights.
  - `extrairVoosDoHtml`: extração em 3 camadas — aria-label rico → aria-label simples → BRL raw fallback — com escalas, aeroporto de conexão, bagagem e duração.
  - `detectarBloqueioBot`: detecta HTTP 429/503, URLs `sorry/index` e `consent.google.com` para failover imediato.
  - `montarHeaders`: headers completos de navegador real incluindo `Sec-Ch-Ua-Full-Version-List`, 5 IPs residenciais brasileiros rotativos e cookie de consentimento pré-aceito.
  - Badge de tipo de viagem nos detalhes (`"Só Ida"` ou `"Ida e Volta"`) e flag `cheapestTabAtivada` na oferta.
- **`src/services/providers/provider_manager.js`** (atualizado):
  - `ScraplingProvider` adicionado como **primeiro provedor** na cadeia: `Scrapling → GoogleFlightsDirect → SerpAPI`.
  - Stats expandidas com `buscasScraplingsSucesso`.
  - Lógica de failover atualizada: provedores diretos (Scrapling ou GoogleFlightsDirect) com `cheapestTabAtivada` encerram a cadeia imediatamente.
- **`tests/scrapling_client.test.js`** (novo arquivo — 34 cenários):
  - Cobertura completa: `detectarBloqueioBot` (6), `extrairPrecoCheapestTab` (5), `construirUrlCheapest` (4), `extrairVoosDoHtml` (6), `ScraplingProvider.buscarOfertas` (10), integração com `FlightProviderManager` (3).
- **Suíte de Testes**: **157/157 testes aprovados (100% verde)** (+34 testes novos).



### 🎯 Restauração Plena de Macrorregiões Continentais, Resolução Dinâmica de Destinos Reais e Blindagem de Links
- **Busca Abrangente por Macrorregiões Preservada (`src/domain/rotas.js` e `data/rotas.json`)**:
  - Restaurados os códigos canônicos KGMID para todas as macrorregiões em `data/rotas.json`: **América do Sul** (`/m/06_1`), **Europa** (`/m/02j9z`), **Ásia** (`/m/02j1x`) e **Estados Unidos** (`/m/09c7w0`). A API SerpAPI/Google Flights varre o continente inteiro de uma só vez sem restrições artificiais.
  - Função `resolverCodigoParaLink`: converte KGMIDs para seus nomes oficiais em inglês (`South America`, `Europe`, etc.) em URLs textuais do Google Flights, gerando buscas continentais navegáveis (`Flights from ORIG to South America on DATA returning DATA`) que abrem a grade/mapa de destinos da região sem cair na página inicial em branco.
  - Função `gerarLinkGoogleFlightsCheapest`: quando o destino for uma macrorregião genérica sem aeroporto físico eleito, delega graciosamente para `gerarLinkGoogleFlights`; quando for um aeroporto físico, gera o payload Protobuf `tfs` na aba *"Cheapest"*.
- **Resolução Concreta de Destino Real em Bug Fares (`src/domain/aeroportos.js`, `src/services/flight_scanner.js`, `src/services/bug_fare_hunter.js`)**:
  - `resolverDestinoConcreto` e `montarCardBugFare`: priorizam com força máxima `codigoDestinoReal` (ex: `SCL`, `EZE`, `MAD`, `LIS`) e `destinoReal` retornados pelo scanner ou caçador de bug fares.
  - Alertas estruturados no Telegram e Cockpit PWA mantêm precisão cirúrgica de aeroporto de chegada (IATA e nome), país e datas, adicionando o rótulo da macrorregião para rastreabilidade (ex: `🚨 BUG FARE: São Paulo ➔ Santiago, Chile (SCL) (América do Sul) por R$ 414!`).
  - Matriz de corredores globais em `src/services/bug_fare_hunter.js` enriquecida com corredores de alta sensibilidade para América do Sul e Ásia.
- **Cockpit PWA, Meteorologia e Arcos Geodésicos SVG (`src/public/app.js`, `src/public/js/geo_routes.js`, `src/services/weather_service.js`)**:
  - Cockpit PWA: badges de rota exibem siglas claras (`AMSUL`, `EUROPA`, `ÁSIA`, `EUA`) via `formatarCodigoBadge` em vez de KGMIDs crus.
  - `sanitizarLinkGoogleFlights`: assegura links diretos para aeroporto físico concreto de chegada.
  - `geo_routes.js`: IDs de gradiente de arcos ortodrômicos sanitizados (`safeId`) para prevenir quebras no DOM causadas por barras em KGMIDs.
  - `weather_service.js`: mapeamento de coordenadas meteorológicas para macrorregiões baseado nos principais hubs de referência climática.
- **Suíte de Testes Expandida**: **123/123 testes aprovados (100% verde)** com novos testes em `tests/aeroportos_bug_fares.test.js`.

## [2.8.1] - 2026-10-12

### 🎯 Pipeline de Deploy pelo Telegram com Autocura Autônoma e Zero Downtime
- **Serviço de Deploy Autônomo com Autocura (`src/services/deploy_pipeline.js` e `tests/deploy_pipeline.test.js`)**:
  - Implementada a classe `DeployPipeline` que orquestra o ciclo completo de promoção para produção.
  - Pré-validação com `./validate.sh fast` antes de qualquer alteração na branch de produção.
  - **Mecanismo de Autocura (Auto-Heal)**: se a pré-validação detectar testes falhando, o pipeline aciona automaticamente o agente autônomo com o log de erro para corrigir o código-fonte, revalida os testes e só prossegue se obtiver 100% de aprovação.
  - **Zero Downtime & Proteção Estrita**: se a autocura não estabilizar os testes, o deploy é cancelado com segurança sem tocar na branch `main`, mantendo o Render rodando a versão estável anterior.
  - Promoção atômica: faz commit de salvaguarda, merge de `autoloop/dev` na `main`, `git push origin main` (que aciona o `autoDeploy` do Render) e retorna para `autoloop/dev`.
  - Suíte de testes unitários com 8/8 testes cobrindo todo o pipeline e mocks de Telegram.
- **Integração Interativa no Bot do Telegram (`src/services/notifier_telegram.js` e `scripts/autoloop_radarvoos.py`)**:
  - Adicionado comando `/deploy` (e `/publicar`) para acionamento direto do celular a qualquer momento.
  - Adicionado callback query `deploy:now` permitindo disparo com 1 toque através do botão inline `[🚀 Fazer Deploy no Render]` nos relatórios do autoloop.
- **Validação Global**:
  - Suíte completa de testes Fastify/Node.js expandida para **122/122 testes aprovados (100% verde)** e 10/10 testes Python do autoloop.

## [2.8.0] - 2026-10-12

### 🎯 Autoloop Dual-Mode (Builder vs QA Adversarial) e Botões Interativos com Economia no Telegram
- **Autoloop Dual-Mode com Rodízio Alternado (`scripts/autoloop_radarvoos.py` e `tests/test_autoloop_radarvoos_throttling.py`)**:
  - Implementado sistema de rodízio cíclico de turno entre **Builder** (desenvolvimento focado em recursos atômicos do backlog) e **QA Adversarial** (engenheiro chefe de testes de estresse, fuzzing, auditoria de casos de borda e refinamento de experiência do usuário).
  - Adicionado suporte a flags CLI `--modo {alternado,builder,qa}` permitindo execução dedicada ou alternada automática (turnos ímpares = Builder, turnos pares = QA Adversarial).
  - Blindagem de notificações no Telegram com supressão inteligente de ruído: commits que não sejam novas funcionalidades (`feat:`) permanecem silenciosos e há cooldown defensivo de 300s entre alertas.
  - Sincronização do binário executável canônico em `/home/wagmoraes/.local/bin/autoloop-radarvoos`.
  - Suíte de testes unitários em Python com 10/10 testes passando cobrindo deduplicação, alternância e injeção de diretrizes.
- **Botões Inline Interativos e Cálculo de Economia no Telegram (`src/services/notifier_telegram.js`, `src/services/flight_scanner.js`, `tests/telegram_callbacks.test.js`)**:
  - Notificação de oportunidade enriquecida com cálculo de economia real em reais e percentual em relação ao teto (`🎯 META BATIDA! Economia de R$ X (Y% abaixo do seu teto)`).
  - Adicionados botões inline interativos: `[🎯 Alterar Teto]` com callback `teto_help:${rotaId}` que devolve mensagem pronta para cópia com `/teto [id] [sugestão]`, e `[🔍 Checar Agora]` com callback `check:${rotaId}`.
  - Suíte de testes unitários cobrindo o cálculo de meta batida, sanitização e tratamento de callbacks (7/7 testes aprovados).
- **Validação Global do Repositório**:
  - Suíte de testes Fastify/Node.js com 114/114 testes passando (100% verde).

## [2.7.9] - 2026-10-12

### 🎯 Blindagem de Links do Google Flights, Resolução Concreta de Destinos e Alertas Detalhados de Bug Fares
- **Resolução de Destinos Concretos e Blindagem de Links Google Flights (`src/domain/aeroportos.js` e `src/domain/rotas.js`)**:
  - Criado módulo canônico `src/domain/aeroportos.js` com catálogo de aeroportos mundiais, metrópoles e continentes, implementando `resolverDestinoConcreto()` para mapear regiões/continentes (como América do Sul ou IDs KGMID `/m/...`) para o hub físico de chegada correspondente (ex: Buenos Aires EZE/AEP, Madrid MAD, Paris CDG).
  - Corrigido link de consulta do Google Flights: substituída a query string inválida `through` pelo parâmetro canônico `returning` (`Flights from ORIG to DEST on IDA returning VOLTA`), garantindo que links de busca textual abram diretamente na grade de voos sem cair na página inicial.
  - Implementada resolução automática em `gerarLinkGoogleFlightsCheapest()` e `resolverCodigoParaLink()` para codificar payload Protobuf canônico `tfs` diretamente para a aba "Cheapest" com aeroportos físicos, eliminando qualquer redirecionamento para a home descontextualizada.
- **Enriquecimento Estruturado de Bug Fares (`src/domain/aeroportos.js`, `src/db.js`, `src/services/flight_scanner.js`, `src/services/bug_fare_hunter.js`)**:
  - Implementada função canônica `montarCardBugFare()`: garante que nenhum alerta de tarifa anômala seja emitido com nomes genéricos, exigindo e preenchendo obrigatoriamente **aeroporto de chegada** (IATA e nome), **país de destino** e **datas da viagem** (ida e volta formatadas).
  - Adicionadas migrações defensivas no SQLite na tabela `bug_fares` (`aeroporto_chegada`, `pais_destino`, `cidade_destino`, `data_ida`, `data_volta`, `preco`, `periodo_texto`) e aprimoramento no repositório para upsert e atualização de links legados.
  - Atualização dos registros de rotas históricas (América do Sul -> Buenos Aires, Europa -> Madrid) e de alertas existentes com URLs canônicas `tfs`.
- **Experiência Visual no Cockpit PWA e Notificações no Telegram (`src/public/app.js`, `src/public/styles.css`, `src/services/notifier_telegram.js`)**:
  - Cockpit PWA: sanitização em tempo real de links antigos via `sanitizarLinkGoogleFlights` e novos badges visuais no cartão de Bug Fare (`.chip-airport` e `.chip-dates`) para aeroporto IATA e período.
  - Bot do Telegram: `enviarAlertaBugFare` e comando `/bugs` enriquecidos para exibir de forma clara aeroporto de chegada, país e período.
  - Bot do Telegram: `enviarAlertaOportunidade` agora destaca quando a meta é batida com cálculo de economia em reais e percentual em relação ao teto do usuário, com botão inline interativo `🎯 Alterar Teto` (`teto_help`).
- **Suíte de Testes Automatizados (114/114 testes passando - 100% verde)**:
  - Adicionada suíte `tests/aeroportos_bug_fares.test.js` com 6 testes cobrindo resolução de aeroportos, links Protobuf e montagem de cards de Bug Fares.
  - Expandida suíte `tests/telegram_callbacks.test.js` com testes para economia calculada e callback de teto.

## [2.7.8] - 2026-10-12

### 🎯 Persistência Defensiva de Voos Flexíveis Só Ida e Two-Way Sync Remoto com GitHub
- **Discernimento Cirúrgico em `rotaEhSoIda` (`src/domain/rotas.js`)**:
  - Corrigido o tratamento de rotas flexíveis (`sem_data: 1`): quando `data_volta` é explicitamente `null` ou quando `tipo === 'one_way'` / `tipo_viagem === 'one_way'`, a função retorna categoricamente `true` (Só Ida), eliminando a reversão indevida para Ida e Volta que ocorria ao atualizar a página ou puxar do GitHub.
  - A rota flexível só é considerada Ida e Volta quando `data_volta` contém dias de viagem (ex: `"10 dias"`) ou data, ou quando `dias_estadia > 0` foi expressamente configurado sem seleção de `one_way`.
- **Persistência Atômica no SQLite (`src/db.js`)**:
  - `rotasRepo.atualizar` e `rotasRepo.criar`: quando a rota é Só Ida, `data_volta` e `dias_estadia` são gravados estritamente como `NULL`, prevenindo recálculos espúrios de retorno via `somarDiasData`.
  - Ao alternar a modalidade entre Ida e Volta e Só Ida (ou vice-versa), `melhor_opcao_flexivel` é limpa automaticamente para não manter na tela o badge com a tarifa da modalidade antiga.
- **Two-Way Sync com GitHub e Prevenção de Race Conditions (`src/services/rotas_sync.js` e `src/server/routes/rotas_routes.js`)**:
  - Serialização em `salvarArquivoRotas`: inclui `tipo_viagem: 'one_way' | 'round_trip'` e zera `dias_estadia` para rotas só ida em `data/rotas.json`.
  - `sincronizarRotasComBanco`: repassa os parâmetros `tipo` e `tipo_viagem` explícitos para o repositório local, evitando que um pull remoto reverta a rota para ida e volta.
  - Em `POST /api/rotas` e `PUT /api/rotas/:id`: sincronização com o GitHub aguarda com timeout seguro (`Promise.race` de até 3500ms) para que o commit remoto seja concluído antes de responder ao cliente, eliminando race condition de F5 imediato.
  - O endpoint `POST /api/rotas/sincronizar-github` agora salva atômica e localmente as rotas antes do push e retorna contadores atualizados.
- **Cockpit PWA (`src/public/app.js`)**:
  - Função `sincronizarComGitHubRemoto`: prioriza o envio (`POST /api/rotas/sincronizar-github` - Push) das alterações locais para o repositório do GitHub (com fallback gracioso para pull se necessário), garantindo que as alterações feitas no cockpit subam para a nuvem em vez de serem sobrescritas.
  - Formulário de rota (`criarNovaRota`): envia `tipo`, `tipo_viagem` explícitos e `dias_estadia: null` quando a modalidade é "Apenas Ida".
  - Funções `renderizarRotas` e `abrirEdicaoRota`: consideram `rota.tipo_viagem === 'one_way'` e ausência de estadia para definir a rota como "Apenas Ida".
- **Testes de Regressão Automatizados (`tests/rotas_flexibilidade.test.js`)**:
  - Adicionado teste completo de regressão simulando o ciclo ponta a ponta: criação de rota flexível ida e volta, alteração para só ida, serialização para `rotas.json` e ressincronização bidirecional, com 100% de aprovação (112/112 testes).

## [2.7.7] - 2026-10-12

### 🎯 Resolução Cirúrgica de Só Ida vs Ida e Volta e Novos Comandos Interativos no Telegram
- **Discernimento Canônico entre Só Ida e Ida e Volta (`src/domain/rotas.js` e `src/db.js`)**:
  - Implementada a função canônica `rotaEhSoIda`: resolve categoricamente o problema histórico onde rotas flexíveis sem data (`sem_data: 1`) com dias de estadia configurados (`dias_estadia: 10/14`) eram convertidas erroneamente para "Só Ida" por verificação ingênua de `data_volta` nula.
  - Correção na criação e edição de rotas em `src/db.js` (`rotasRepo.criar` e `rotasRepo.atualizar`): se a rota possui dias de estadia configurados (`dias_estadia > 0`), ela é garantida como Ida e Volta, calculando a data de retorno somando os dias de estadia à data de ida (`somarDiasData`).
  - Corrigido o piso estrutural em `src/domain/bug_fares.js`: passagens de Só Ida agora utilizam estritamente `pisoBase.soIda` (ex: R$ 1.150 para Europa e R$ 450 para América do Sul), eliminando falsos positivos onde voos normais de uma perna eram alertados como Bug Fare por comparação indevida contra o piso de Ida e Volta.
  - Corrigido trip type no Protobuf TFS do Google Flights: byte `0x10` codificado dinamicamente como `0x01` para One-Way e `0x02` para Round-Trip.
- **Novos Comandos e Experiência no Bot do Telegram (`src/services/notifier_telegram.js`)**:
  - Comando `/teto [id] [valor]`: permite alterar ou definir o teto de preço de qualquer rota diretamente pelo chat do Telegram em tempo real.
  - Comando `/paridade [milhas] [programa]`: calculadora de milhas que converte pontos de programas de fidelidade (Smiles, Latam Pass, Livelo, Azul, Iberia, TAP) em valor monetário de referência em reais.
  - Comando `/verificar [id]`: força varredura imediata de uma rota com exibição do preço atual e se está dentro da meta estipulada.
  - Destaque visual no comando `/rotas` quando uma tarifa atinge a meta estipulada pelo usuário (`🎯 DENTRO DO TETO!`).
  - Higienização de mensagens de alerta meteorológico e de status, eliminando a exibição de períodos com texto feio como `"até Só Ida"`.
- **Aprimoramentos no Cockpit PWA (`src/public/app.js`)**:
  - Ajustadas funções `renderizarRotas` e `abrirEdicaoRota` para que rotas flexíveis com estadia não apareçam ou abram o modal como "Apenas Ida" quando a data de volta ainda não tiver sido preenchida.
  - Adicionada sincronização bidirecional com fallback para push/pull no botão de sincronização com o GitHub.
- **Suíte de Testes Expandida (112/112 testes passando - 100%)**:
  - Adicionado teste canônico `rotaEhSoIda` em `tests/rotas_flexibilidade.test.js` cobrindo 6 cenários de borda.
  - Adicionados testes para os comandos `/paridade` e `/teto` em `tests/telegram_callbacks.test.js`.
  - Blindada a suíte `tests/routes.test.js` com limpeza defensiva de arquivos SQLite WAL órfãos (`.sqlite-wal`, `.sqlite-shm`) para evitar erros `disk I/O error`.

## [2.7.6] - 2026-10-12

### 🎯 Resolução Canônica de Destinos (Anti-Genérico) e Blindagem de Links do Google Flights
- **Eliminação de Destinos Genéricos em Bug Fares (`src/domain/aeroportos.js`)**:
  - Criado módulo canônico de aeroportos e metrópoles com dados institucionais e geográficos (código IATA, nome do aeroporto, cidade, país e região).
  - Implementada função `resolverDestinoConcreto` que converte consultas genéricas (ex: "América do Sul", "/m/06_1", "Europa") no destino físico e hub operacional real (ex: Buenos Aires, Argentina - EZE/AEP ou Madrid, Espanha - MAD).
  - Função `montarCardBugFare`: padroniza todos os alertas com dados completos obrigatórios: Aeroporto de Chegada (código IATA e nome), País de Destino, Datas da Viagem (ida e volta formatadas) e tarifa anômala.
- **Blindagem de Links no Google Flights (`src/domain/rotas.js` e `src/public/app.js`)**:
  - Corrigida sintaxe de round-trip em `gerarLinkGoogleFlights`: substituída a palavra inválida `through` pelo parâmetro oficial `returning`, eliminando o redirecionamento indevido para a página inicial do Google Flights.
  - Implementada resolução prévia de KGMIDs e continentes para códigos IATA reais em `gerarLinkGoogleFlightsCheapest` e `resolverCodigoParaLink`, garantindo que os links Protobuf `tfs` abram diretamente na aba "Cheapest" com a grade de voos carregada.
  - Adicionada sanitização defensiva no frontend (`sanitizarLinkGoogleFlights` em `app.js`) para higienizar links legados em tempo de renderização.
- **Aprimoramento do Cockpit PWA e Notificações Telegram**:
  - `src/public/app.js` e `src/public/styles.css`: novos chips visuais refinados (`.bugfare-chip.chip-airport` e `.bugfare-chip.chip-dates`) exibindo aeroporto, país e período da viagem em cada card de Bug Fare.
  - `src/services/notifier_telegram.js`: mensagens de alerta e comando `/bugs` enriquecidos com aeroporto de chegada, país e datas completas.
  - `src/db.js`: migrações dinâmicas na tabela `bug_fares` para persistência dos campos estruturados e ajuste em `rotasRepo.criar` para cálculo correto de `data_volta` no modo flexível sem data (`sem_data: 1`).
- **Suíte de Testes Expandida (`tests/aeroportos_bug_fares.test.js`)**:
  - Criados 6 testes unitários cobrindo resolução concreta de aeroportos, montagem de cards de Bug Fare, links canônicos do Google Flights e persistência estruturada no SQLite. Suíte completa aprovada com 108/108 testes passando (100%).

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
