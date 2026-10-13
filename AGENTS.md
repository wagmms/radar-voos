# Diretrizes Técnicas e Regras de Engenharia · Radar de Voos (RadarVoos)

> Este documento canônico estabelece os padrões arquiteturais, regras de engenharia e diretrizes de execução para qualquer agente de IA ou desenvolvedor atuando no repositório **Radar de Voos**.

---

## 1. 🏗️ Arquitetura e Backend (Fastify 4 & SQLite Nativo)

- **Fastify 4 de Alta Performance**:
  - Modularização estrita via plugins com registro assíncrono limpo (`fastify.register`).
  - Validação contratual de entrada e saída por schema (`Ajv` / JSON Schema defensivo).
  - Prevenção de memory leaks em rotas persistentes e SSE; encerramento gracioso de conexões.
- **SQLite Nativo do Node.js 22 (Zero Dependências Externas Pesadas)**:
  - Operação obrigatória em **WAL Mode** (`PRAGMA journal_mode = WAL;`).
  - Pragmas de produção: `PRAGMA busy_timeout = 5000;`, `PRAGMA synchronous = NORMAL;`, `PRAGMA foreign_keys = ON;`.
  - Transações com `BEGIN IMMEDIATE` para escrita com o objetivo de evitar deadlocks e `SQLITE_BUSY`.
  - Índices parciais para consultas frequentes de rotas ativas e menor preço histórico.

---

## 2. 🦅 Motor de Scraping Resiliente & Inteligência de Busca

- **Scraping Anti-Bloqueio (`scrapling`)**:
  - Utilizar padrões da skill `scrapling` para cabeçalhos HTTP realistas, rotação de User-Agents e evasão de anti-bots (Cloudflare/Akamai) em consultas de companhias aéreas e OTAs.
- **Motor Google Flights (Direto & Protobuf `tfs`)**:
  - Extração de tarifas canônicas e da aba especial "Mais Baratos / Cheapest" via carga útil binária (`tfs`).
  - Distinção mandatória entre **Só Ida (One-Way)** e **Ida e Volta (Round-Trip)** em todos os seletores e armazenamentos.
  - Flexibilidade de datas com matriz (±0 a ±7 dias) e suporte a buscas por faixas de preço e continentes.
  - Telemetria de voos: registro estruturado de escalas (conexões), tempos de parada e regras de bagagem despachada/bordo.

---

## 3. 🎯 Caçador Proativo de Bug Fares (`proactive-agent`)

- **Princípio do Trabalho por Exceção (Zero Ruído)**:
  - O monitor atua em silêncio absoluto. É proibido notificar quando nada mudou ou quando os preços estão dentro da média esperada.
- **Working Buffer & Deduplicação Defensiva**:
  - Memória de curto prazo para as últimas leituras de cada rota.
  - Supressão de alertas idênticos para a mesma rota e data dentro de uma janela de 24 horas.
- **Detecção Estatística de Anomalias**:
  - Cálculo de Z-Score sobre a série histórica de tarifas para o par origem/destino.
  - Classificação estrita de eventos:
    - `INFO`: Oscilação normal de mercado (sem alerta).
    - `OPORTUNIDADE`: Queda comprovada > 30% em relação à média móvel recente.
    - `BUG_FARE`: Tarifa anômala confirmada (Z-score < -2.5 ou erro crasso de tarifa por continente).

---

## 4. 🎨 Cockpit PWA & Interface Anti-UI-Slop

- **Design Minimalista e Mobile-First**:
  - Dark mode refinado por padrão, paleta com contraste acessível e tipografia intencional.
  - Proibição de bibliotecas pesadas de componentes ou charts de centenas de kilobytes.
- **Visualização Cartográfica e Gráfica Ultraleve**:
  - **`smart-charts`**: Sparklines e histogramas de frequência tarifária construídos em SVG puro leve.
  - **`remotion-maps`**: Projeção cartográfica e arcos geodésicos ortodrômicos (Great Circle) desenhados em SVG puro entre coordenadas de aeroportos IATA.
- **PWA Confiável**:
  - Service Worker resiliente com estratégia `Stale-While-Revalidate` para assets estáticos e `Network-First` para dados de voos.
  - Manifest válido e operação offline graciosa.

---

## 5. 🤖 Notificações e Bot Telegram (`telegram-compose`)

- **Mensagens Ricas e Seguras**:
  - Utilizar `parse_mode: 'HTML'` com escape defensivo de caracteres especiais.
  - Cartões de tarifas padronizados: emoji de status, par de aeroportos, datas, valor em destaque e link canônico.
  - Inline Keyboards interativos com paginação defensiva e tratamento de callbacks.
- **Resiliência a Rate Limits**:
  - Tratamento estrito de erros HTTP 429 (`retry_after`) para evitar banimento da API do Telegram.

---

## 6. 📋 Governança de Progresso e Autoloop

- **PROGRESS.md Sempre Enxuto (~5 a 10 KB)**:
  - O arquivo é a memória ativa de curto prazo do projeto.
  - Mantém apenas: Status Atual, Diretriz Prioritária, Última Tarefa Concluída (resumida), Próxima Tarefa em Andamento e Backlog Prioritário Imediato.
  - Histórico detalhado deve ser arquivado em `CHANGELOG.md`.
  - Ideias futuras devem ser arquivadas em `docs/SUGESTOES_FUTURAS.md` (mantendo no máximo 5 como buffer no `PROGRESS.md`).
- **Redação Cirúrgica de Tarefas**:
  - Especificação em 3 partes obrigatórias:
    1. **Arquivo/Módulo Alvo**: Caminho relativo exato.
    2. **Função/Componente/Seletor**: Identificador exato.
    3. **Comportamento Esperado / Critério de Aceite**: Resultado objetivo e verificável.
- **Blindagens do Autoloop**:
  - **Janela Visível**: O autoloop roda OBRIGATORIAMENTE em janela visível de terminal (nunca em background/headless).
  - **Notificações Calibradas no Telegram**: O autoloop só envia notificação de ciclo quando um novo commit de funcionalidade real com prefixo `feat:` for aprovado (commits de `fix:`, `chore:`, `test:` permanecem silenciosos), respeitando o cooldown protetor mínimo de 5 minutos (300s).
  - **Timeout Estrito de 15 Minutos**: Cada turno de agente tem timeout rígido de 900s, com encerramento de grupo de processos e auto-rollback imediato se houver travamento.
  - **Limpeza de Travas**: Remoção defensiva de `.git/index.lock` e travas residuais antes de cada ciclo.
  - **Validação Contínua**: Execução de `./validate.sh fast` a cada ciclo com 100% de aprovação nos testes automatizados.
