# ✈️ Radar de Voos • Travel Hacking Engine v2.0

> Sistema autônomo de inteligência aérea, monitoramento contínuo de passagens, caçador de Bug Fares e Cockpit PWA em tempo real. Desacoplado do projeto Rotina e 100% livre de Google Apps Script.

---

## 🌟 O que mudou na Versão 2.0 (Elevação de Nível)

Construído com base nas melhores práticas de engenharia de software e arquitetura limpa:

1. **Totalmente Autônomo e Desacoplado**:
   - Zero dependência de Google Sheets, Google Apps Script ou limites de 6 minutos de runtime.
   - Backend moderno **Node.js 24+** com **Fastify**, executando com latência de milissegundos.
   - Banco de dados embutido **SQLite nativo (`node:sqlite`)** com persistência relacional, foreign keys e WAL mode.

2. **Cockpit PWA Moderno (Aero Dark Mode)**:
   - Interface de controle estilo FlightRadar / Bloomberg de viagens em Glassmorphism sóbrio.
   - PWA instalável no desktop e mobile, com Service Worker e cache offline.
   - Visualização em cards de voo vivos: badges IATA, termômetro visual de preços, cálculo de **Custo Total da Viagem (Voo + Diária x Dias)** e identificação de **Stopover 2-em-1 (conexões longas >= 8h)**.

3. **Pool Multi-Chaves SerpAPI com Balanceamento Round-Robin**:
   - Rotação atômica entre 4 contas SerpAPI (1.000 buscas gratuitas/mês).
   - Fila justa anti-inanição (LRU) para rotas que estão há mais tempo sem checagem.
   - Cooldown automático de 30 minutos em caso de HTTP 429 (Rate Limit).

4. **Detector Implacável de Bug Fares (Erros de Tarifa)**:
   - Scanner de RSS do Melhores Destinos com **filtro implacável contra publiposts, afiliados, pacotes, cruzeiros, resorts, cartões e milhas**.
   - Identifica exclusivamente erros genuínos de precificação e emite alertas prioritários.

5. **Notificações e Comandos Interativos no Telegram**:
   - Alertas formatados em HTML com botões inline diretos para reserva no Google Flights.
   - **Modo Silencioso Noturno**: envia com `disable_notification: true` entre 22h e 08h.
   - Bot interativo com polling: responda com `/start`, `/rotas`, `/status`, `/bugs`, `/ping`.

6. **Containerização de Produção**:
   - Multi-stage Dockerfile enxuto baseado em `node:24-alpine` com usuário não-root.
   - `docker-compose.yml` pronto para deploy local, VPS, Railway ou Render.

---

## 🚀 Como Executar

### 1. Execução Local Direta (Node.js 24+)

```bash
cd "/home/wagmoraes/Projetos IA/RadarVoos"

# Instalar dependências
npm install

# Rodar a suíte completa de testes
npm test

# Iniciar servidor em desenvolvimento com auto-reload
npm run dev

# Ou iniciar em produção
npm start
```

Acesse o Cockpit PWA em: **http://localhost:3333**

---

---

### 2. Execução com Docker

```bash
# Construir e subir container em background
docker compose up -d --build

# Ver logs em tempo real
docker compose logs -f
```

---

### 3. Deploy no Render (render.com)

O repositório já inclui o arquivo [`render.yaml`](render.yaml) configurado para deploy com 1 clique:

- **Opção 1 (Blueprint Automático - Recomendado)**:
  1. No painel do [Render Dashboard](https://dashboard.render.com/), clique em **New +** ➔ **Blueprint**.
  2. Conecte seu repositório `wagmms/radar-voos`.
  3. O Render detectará automaticamente o `render.yaml`, preencherá as variáveis de ambiente, portas e health check (`/api/health`).
  4. Clique em **Apply** e o deploy iniciará imediatamente com Auto-Deploy a cada commit na branch `main`.

- **Opção 2 (Web Service Tradicional)**:
  1. Clique em **New +** ➔ **Web Service** e selecione o repositório.
  2. Defina **Runtime**: `Node` (versão 22.12.0+ via `NODE_VERSION`) ou `Docker`.
  3. **Build Command**: `npm install` | **Start Command**: `npm start`.
  4. **Health Check Path**: `/api/health`.

---

## 📡 Endpoints da API REST

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/health` | Healthcheck do serviço |
| `GET` | `/api/status` | Relatório de saúde do pool, cotas e agendador |
| `GET` | `/api/rotas` | Lista todas as rotas monitoradas |
| `POST` | `/api/rotas` | Cadastra nova rota para monitoramento |
| `GET` | `/api/rotas/:id` | Detalhes e histórico de preços de uma rota |
| `DELETE` | `/api/rotas/:id` | Remove rota do monitoramento |
| `POST` | `/api/rotas/:id/verificar` | Força verificação imediata da rota |
| `POST` | `/api/varredura` | Dispara ciclo de varredura na fila justa |
| `GET` | `/api/bug-fares` | Lista erros de tarifa e megapromoções |
| `POST` | `/api/bug-fares/escanear` | Força leitura imediata do feed RSS |
| `POST` | `/api/reset-hoje` | Zera os contadores de buscas de hoje |
| `POST` | `/api/notificacao/teste` | Dispara mensagem de teste no Telegram |

---

## 🤖 Comandos do Bot no Telegram

Envie para o bot configurado:
- `/start` ou `/ajuda`: Menu de comandos e atalhos.
- `/rotas`: Exibe as rotas monitoradas e os preços mais recentes.
- `/status`: Mostra cotas do dia/mês consumidas por chave SerpAPI.
- `/bugs`: Lista os últimos Bug Fares detectados no feed.
- `/ping`: Verifica a saúde e conectividade do robô.

---

## 🧪 Suíte de Testes Automatizados

O projeto conta com suíte de testes 100% nativa em Node.js (`node:test`):

```bash
npm test
```
Cobertura:
- Resolução metropolitana e IATA (SAO, RIO, NYC, LON, KGMID).
- Validação de períodos (ida/volta, só ida, dias de estadia).
- Inteligência financeira (Custo Total da Viagem e Variações %).
- Detecção de conexões longas e Stopover 2-em-1.
- Filtro anti-marketing e captura de Bug Fares.
- Pool de chaves SerpAPI com cooldown e round-robin.
- Endpoints REST Fastify com injeção de requisições.
