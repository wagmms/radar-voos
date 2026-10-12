import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Normalização do pool de chaves SerpAPI
const rawKeys = process.env.SERPAPI_KEYS || '';
const parsedKeys = rawKeys
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3333', 10),
  host: process.env.HOST || '0.0.0.0',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './data/radar_voos.sqlite'),
  
  serpApi: {
    keys: parsedKeys.length > 0 ? parsedKeys : [
      "bdccc37b6d43ed0c19e06e3c3e92c92e9b835b71bc77e1e2f619d954ed50738a",
      "4f4ffd751c772dfe2e02fd65aebf8fc937d95bafadcdc51f2fb8d4a55b3e9df0",
      "07ed92b59e2ec9051fb9b75cacffd4613bbc6d2aeec228f52b6381d8947eac03",
      "3d993feb889b11b1e999a750e17db71081da27fc1f88abf45fd69fd5f6180db3"
    ],
    limiteDiarioPorChave: parseInt(process.env.LIMITE_DIARIO_POR_CHAVE || '8', 10),
    limiteMensalPorChave: parseInt(process.env.LIMITE_MENSAL_POR_CHAVE || '250', 10)
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8648806451:AAFkb3YGCsYNvfARtm6Sb6OMx2vU2O_-GfM',
    chatId: process.env.TELEGRAM_CHAT_ID || '1771571035',
    polling: process.env.TELEGRAM_POLLING === 'true' || true
  },

  radar: {
    gatilhoQuedaRelampagoPct: parseFloat(process.env.GATILHO_QUEDA_RELAMPAGO_PCT || '15'),
    scanIntervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '60', 10)
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || 'wagmms/radar-voos',
    branch: process.env.GITHUB_BRANCH || 'main'
  }
};
