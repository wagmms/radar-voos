# Multi-stage Dockerfile otimizado para produção Node.js 24 Alpine
FROM node:24-alpine AS base
WORKDIR /app

# Instalar dependências necessárias para compilação (se houver)
RUN apk add --no-cache tzdata curl

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

FROM base AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS runner
WORKDIR /app

# Usuário de sistema seguro (não-root)
USER node

# Copiar dependências e código fonte
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

# Diretório de persistência do banco SQLite
RUN mkdir -p /app/data

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3333/api/health || exit 1

CMD ["node", "src/index.js"]
