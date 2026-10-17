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

const ehAmbienteTeste =
  process.env.NODE_ENV === 'test' ||
  process.env.TEST === 'true' ||
  (Array.isArray(process.argv) && process.argv.some(arg => typeof arg === 'string' && (arg.includes('.test.') || arg.includes('/tests/')))) ||
  (Array.isArray(process.execArgv) && process.execArgv.some(arg => typeof arg === 'string' && arg.startsWith('--test')));

const resolverDbPath = () => {
  if (ehAmbienteTeste) {
    // Em teste, nunca permitir o banco de produção radar_voos.sqlite vindo do .env
    const dbTestEnv = process.env.TEST_DB_PATH || process.env.DB_PATH;
    if (dbTestEnv && dbTestEnv.includes('test')) {
      return dbTestEnv;
    }
    return './data/radar_voos_test.sqlite';
  }
  return process.env.DB_PATH || './data/radar_voos.sqlite';
};

export const config = {
  env: process.env.NODE_ENV || (ehAmbienteTeste ? 'test' : 'development'),
  port: parseInt(process.env.PORT || '3333', 10),
  host: process.env.HOST || '0.0.0.0',
  dbPath: path.resolve(__dirname, '..', resolverDbPath()),
  
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
    scanIntervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '8', 10)
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || 'wagmms/radar-voos',
    branch: process.env.GITHUB_BRANCH || 'main'
  }
};
