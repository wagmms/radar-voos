import { spawn } from 'node:child_process';

let primpDisponivelCache = null;

/**
 * Verifica de forma síncrona/em cache se o interpretador Python e a biblioteca primp estão instalados.
 * @returns {Promise<boolean>}
 */
export async function verificarPrimpDisponivel() {
  if (primpDisponivelCache !== null) return primpDisponivelCache;

  return new Promise((resolve) => {
    const proc = spawn('python3', ['-c', 'import primp'], {
      stdio: 'ignore'
    });

    proc.on('close', (code) => {
      primpDisponivelCache = code === 0;
      resolve(primpDisponivelCache);
    });

    proc.on('error', () => {
      primpDisponivelCache = false;
      resolve(false);
    });
  });
}

/**
 * Executa requisição HTTP com impersonação de TLS de navegador real (JA3/JA4) via primp (Chrome 145).
 * Espelha exatamente o padrão arquitetural do fast-flights (AWeirdDev/flights).
 *
 * @param {string} url - URL canônica do Google Flights
 * @param {Object} [opcoes]
 * @param {string} [opcoes.impersonate='chrome_145'] - Perfil de navegador para impersonar
 * @param {string} [opcoes.impersonateOs='macos'] - OS simulado
 * @param {number} [opcoes.timeoutMs=15000] - Timeout da requisição
 * @returns {Promise<{ ok: boolean, status: number, text: string, erro?: string }>}
 */
export async function fetchComPrimpTls(url, opcoes = {}) {
  const disponivel = await verificarPrimpDisponivel();
  if (!disponivel) {
    return {
      ok: false,
      status: 0,
      text: '',
      erro: 'primp não está disponível no ambiente Python do sistema'
    };
  }

  const {
    impersonate = 'chrome_145',
    impersonateOs = 'macos',
    timeoutMs = 15000
  } = opcoes;

  const scriptPy = `
import sys
from primp import Client

url = sys.argv[1]
impersonate = sys.argv[2]
impersonate_os = sys.argv[3]
timeout = float(sys.argv[4]) / 1000.0

try:
    client = Client(
        impersonate=impersonate,
        impersonate_os=impersonate_os,
        headers={"Accept-Language": "pt-BR,pt;q=0.9"},
        referer=True,
        cookie_store=True,
        timeout=timeout
    )
    res = client.get(url)
    sys.stdout.write(f"__STATUS_CODE__{res.status_code}__STATUS_CODE__")
    sys.stdout.write(res.text)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;

  return new Promise((resolve) => {
    const proc = spawn('python3', [
      '-c',
      scriptPy,
      url,
      impersonate,
      impersonateOs,
      String(timeoutMs)
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk; });
    proc.stderr.on('data', chunk => { stderr += chunk; });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({
        ok: false,
        status: 408,
        text: '',
        erro: `Timeout de TLS Impersonation após ${timeoutMs}ms`
      });
    }, timeoutMs + 1000);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) {
        const matchStatus = stdout.match(/^__STATUS_CODE__(\d+)__STATUS_CODE__/);
        const status = matchStatus ? parseInt(matchStatus[1], 10) : 200;
        const bodyText = matchStatus ? stdout.slice(matchStatus[0].length) : stdout;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: bodyText
        });
      } else {
        resolve({
          ok: false,
          status: 500,
          text: '',
          erro: stderr.trim() || `Falha do processo primp (código ${code})`
        });
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      resolve({
        ok: false,
        status: 500,
        text: '',
        erro: err.message
      });
    });
  });
}
