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
    keys: parsedKeys.length > 0 ? parsedKeys : [],
    limiteDiarioPorChave: parseInt(process.env.LIMITE_DIARIO_POR_CHAVE || '8', 10),
    limiteMensalPorChave: parseInt(process.env.LIMITE_MENSAL_POR_CHAVE || '250', 10)
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    polling: process.env.TELEGRAM_POLLING === 'true'
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
