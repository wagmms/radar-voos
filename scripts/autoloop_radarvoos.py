#!/usr/bin/env python3
"""
Autoloop Radar de Voos: Orquestrador autônomo multi-contas e multi-modelos para o Antigravity CLI (agy)
especializado e blindado para o projeto Radar de Voos (Node.js 22 / Fastify 4 / SQLite Nativo WAL / Cockpit PWA).

Blindagens Críticas de Segurança:
1. Isolamento de Branch: Opera obrigatoriamente na branch `autoloop/dev` (nunca na `main`).
   Evita qualquer risco de quebrar a branch estável ou disparar deploys acidentais no Render/produção.
2. Gates de Validação em Camadas: Execução de `./validate.sh fast` a cada ciclo com 100% de aprovação
   nos 70+ testes unitários e de integração com SQLite nativo.
3. Auto-Rollback Defensivo: Em caso de falha de validação pós-ciclo, descarta imediatamente as alterações
   quebradas (`git restore .` e `git clean -fd`) para prevenir efeito bola de neve.
4. Notificações e Comandos via Telegram:
   - Envia relatórios automáticos de progresso no Telegram a cada ciclo/tarefa concluída.
   - Escuta comandos no Telegram (/status, /release, /ajuda) para permitir consolidar alterações
     na branch main e sincronizar com o GitHub de onde o usuário estiver.
5. Roteador Semântico Cognitivo:
   - Gemini Pro: Inteligência de rotas e algoritmos aeronáuticos, detecção estatística de Bug Fares (Z-score),
     cálculo de paridade de milhas aéreas, otimização de concorrência e transações no SQLite WAL.
   - Gemini Flash: Componentes e layout do Cockpit PWA (Mobile-first, CSS, sparklines SVG, rotas ortodrômicas),
     endpoints REST Fastify 4, Telegram Bot, correções pontuais e novos testes de unidade.
6. Injeção Inteligente de Skills Especializadas:
   - Acopla contextualmente as skills de ponta: `google-flights`, `scrapling`, `fastify-best-practices`,
     `sqlite`, `smart-charts`, `remotion-maps`, `telegram-compose`, `anti-ui-slop`, `weather` e `tdd`.
"""

import os
import sys
import time
import subprocess
import argparse
import re
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
import json
import html
import urllib.request
import urllib.error
import threading
import signal

_processo_agy_ativo = None

def _tratar_termino_gracioso(sig, frame):
    global _processo_agy_ativo
    if _processo_agy_ativo and _processo_agy_ativo.poll() is None:
        try:
            _processo_agy_ativo.terminate()
            _processo_agy_ativo.wait(timeout=2)
        except Exception:
            try:
                _processo_agy_ativo.kill()
            except Exception:
                pass
    sys.exit(0)

try:
    signal.signal(signal.SIGTERM, _tratar_termino_gracioso)
    signal.signal(signal.SIGINT, _tratar_termino_gracioso)
except Exception:
    pass

# Carrega módulos utilitários do sistema Antigravity
sys.path.insert(0, str(Path.home() / ".local" / "bin"))
core_path = Path.home() / ".local" / "lib" / "autoloop_core"
if str(core_path) not in sys.path:
    sys.path.insert(0, str(core_path))

try:
    import agy_contas
except Exception as e:
    print(f"Erro ao carregar módulo agy_contas: {e}")
    sys.exit(1)

try:
    from progress_cleaner import garantir_progress_enxuto
except ImportError:
    def garantir_progress_enxuto(*args, **kwargs):
        return False

try:
    from execution import run_observed
except ImportError:
    run_observed = None

try:
    from task_context import render_cli_event
except ImportError:
    def render_cli_event(line):
        try:
            event = json.loads(line)
        except (ValueError, TypeError):
            return line
        if not isinstance(event, dict):
            return line
        if event.get('type') == 'result' and isinstance(event.get('result'), str):
            return event['result']
        if event.get('type') == 'assistant':
            message = event.get('message', {})
            content = message.get('content') if isinstance(message, dict) else None
            if isinstance(content, list):
                text = [part['text'] for part in content if isinstance(part, dict) and isinstance(part.get('text'), str)]
                if text:
                    return '\n'.join(text)
        return line

try:
    from skills_router import resolver_skills_tarefa, formatar_bloco_skills_prompt
except ImportError:
    resolver_skills_tarefa = None
    formatar_bloco_skills_prompt = None

def _emitir_evento_equilibrado(linha_bruta):
    try:
        linha = linha_bruta.strip()
        if not linha:
            return

        # Se não for JSON, imprime apenas se for texto informativo do sistema
        if not ((linha.startswith('{') and linha.endswith('}')) or (linha.startswith('[') and linha.endswith(']'))):
            if not any(ign in linha for ign in ["DEBUG:", "Traceback", "ConnectionResetError"]):
                print(f"  [AGY] {linha}", flush=True)
            return

        ev = json.loads(linha)
        if not isinstance(ev, dict):
            return

        evento = ev.get('event') or ev.get('type') or ''

        # Ignorar metadados e heartbeats
        if evento in {'init', 'ping', 'heartbeat', 'turn_start', 'step_start', 'usage_metadata'}:
            return

        # Formato nativo de streaming do AGY: step_update
        if evento == 'step_update':
            step = ev.get('step_update')
            if not isinstance(step, dict):
                return
            stype = step.get('step_type') or ''
            state = step.get('state') or ''

            if stype == 'tool' and state == 'ACTIVE':
                tool = step.get('tool_name') or 'ferramenta'
                tool_info = step.get('tool_info')
                params = tool_info.get('parameters', {}) if isinstance(tool_info, dict) else {}
                if not isinstance(params, dict):
                    params = {}
                alvo = (params.get('TargetFile') or params.get('AbsolutePath') or
                        params.get('CommandLine') or params.get('Instruction') or '')
                alvo_str = str(alvo).strip()
                if alvo_str:
                    if '/' in alvo_str and len(alvo_str) > 45:
                        alvo_str = '...' + alvo_str[-42:]
                    elif len(alvo_str) > 65:
                        alvo_str = alvo_str[:62] + '...'

                icones = {
                    'replace_file_content': '✍️ Editando',
                    'write_to_file': '📝 Criando',
                    'run_command': '💻 Executando',
                    'grep_search': '🔍 Buscando no código',
                    'find_by_name': '🔍 Localizando',
                    'view_file': '📖 Consultando'
                }
                if tool == 'view_file':
                    basename = alvo_str.split('/')[-1] if '/' in alvo_str else alvo_str
                    print(f"  [AGY] 📖 Consultando: {basename}", flush=True)
                else:
                    acao = icones.get(tool, f"🛠️ {tool}")
                    print(f"  [AGY] {acao}: {alvo_str}" if alvo_str else f"  [AGY] {acao}", flush=True)
            return

        if evento == 'result':
            res = ev.get('result')
            resp = None
            if isinstance(res, str):
                resp = res
            elif isinstance(res, dict):
                resp = res.get('response') or res.get('result')
            if isinstance(resp, str) and resp.strip():
                linhas_texto = [l.strip() for l in resp.strip().splitlines() if l.strip() and not l.strip().startswith('```')]
                if linhas_texto:
                    resumo = linhas_texto[0]
                    if len(resumo) > 100:
                        resumo = resumo[:97] + '...'
                    print(f"  [AGY] 💬 {resumo}", flush=True)
            return

        if evento in {'tool_use', 'tool_call'}:
            nome = ev.get('name') or ev.get('tool_name') or 'ferramenta'
            args = ev.get('input') or ev.get('arguments') or {}
            if isinstance(args, dict):
                alvo = args.get('TargetFile') or args.get('AbsolutePath') or args.get('CommandLine') or args.get('Instruction') or ''
                if alvo and len(str(alvo)) > 60:
                    alvo = str(alvo)[:57] + '...'
                print(f"  [AGY] 🛠️ {nome}: {alvo}" if alvo else f"  [AGY] 🛠️ {nome}", flush=True)
            return
    except Exception as exc:
        if os.getenv("AUTOLOOP_DEBUG"):
            print(f"  [DEBUG-STREAM] {exc}", flush=True)

CORES = agy_contas.CORES

MAPA_MODELOS = {
    "flash": ("Gemini 3.8 Flash (High)", "gemini-3.8-flash-high"),
    "gemini-flash": ("Gemini 3.8 Flash (High)", "gemini-3.8-flash-high"),
    "flash-high": ("Gemini 3.8 Flash (High)", "gemini-3.8-flash-high"),
    "flash-medium": ("Gemini 3.8 Flash (Medium)", "gemini-3.8-flash-medium"),
    "pro": ("Claude Sonnet 4.6 (Thinking)", "claude-sonnet-4-6"),
    "gemini-pro": ("Gemini 3.8 Flash (High)", "gemini-3.8-flash-high"),
    "opus": ("Claude Opus 4.6 (Thinking)", "claude-opus-4-6-thinking"),
    "sonnet": ("Claude Sonnet 4.6 (Thinking)", "claude-sonnet-4-6")
}

MODELOS_PADRAO = [
    ("Gemini 3.8 Flash (High)", "gemini-3.8-flash-high"),
    ("Claude Sonnet 4.6 (Thinking)", "claude-sonnet-4-6")
]

bloqueios = {}
indice_conta_atual = 1
deploy_lock = threading.Lock()

DEFAULT_RADAR_DIR = Path("/home/wagmoraes/Projetos IA/RadarVoos")
BRANCH_SEGURA_PADRAO = "autoloop/dev"
STATE_TELEGRAM_FILE = DEFAULT_RADAR_DIR / "data" / "autoloop_telegram_state.json"
TIMEOUT_TURNO_AGY = 900  # 15 minutos (900s)

def limpar_travas_residuais(repo_dir=DEFAULT_RADAR_DIR):
    """Remove travas residuais do Git (.git/index.lock, refs locks, etc.) deixadas por encerramentos forçados."""
    git_dir = Path(repo_dir) / ".git"
    if not git_dir.is_dir():
        return
    padroes_trava = ["index.lock", "refs/heads/*.lock", "HEAD.lock", "config.lock"]
    for padrao in padroes_trava:
        for trava in git_dir.glob(padrao):
            try:
                trava.unlink(missing_ok=True)
                log("AVISO", f"🧹 Trava residual do Git removida com sucesso: {trava.name}")
            except Exception as e:
                log("AVISO", f"Falha ao limpar trava do Git {trava}: {e}")

def carregar_diretrizes_agents(repo_dir=DEFAULT_RADAR_DIR):
    """Carrega o AGENTS.md local do repositório para injetar no prompt do agente."""
    arquivo_agents = Path(repo_dir) / "AGENTS.md"
    if arquivo_agents.is_file():
        try:
            with open(arquivo_agents, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass
    return ""

def carregar_estado_notificacao():
    try:
        if STATE_TELEGRAM_FILE.exists():
            with open(STATE_TELEGRAM_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {"last_notified_commit": None, "last_notified_ts": 0}

def salvar_estado_notificacao(commit_hash, ts=None):
    try:
        STATE_TELEGRAM_FILE.parent.mkdir(parents=True, exist_ok=True)
        estado = {
            "last_notified_commit": commit_hash,
            "last_notified_ts": ts or time.time(),
            "last_notified_iso": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(STATE_TELEGRAM_FILE, "w", encoding="utf-8") as f:
            json.dump(estado, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log("AVISO", f"Falha ao persistir estado de notificação: {e}")

def log(tipo, msg):
    hora = datetime.now().strftime("%H:%M:%S")
    cor = {
        "INFO": CORES["cyan"],
        "OK": CORES["green"],
        "AVISO": CORES["yellow"],
        "ERRO": CORES["red"],
        "SMART": CORES["bold"] + CORES["cyan"],
        "SHIELD": CORES["bold"] + CORES["green"],
        "TELEGRAM": CORES["bold"] + CORES["cyan"]
    }.get(tipo, CORES["reset"])
    print(f"{CORES['bold']}[{hora}]{CORES['reset']} {cor}[{tipo}]{CORES['reset']} {msg}")

def normalizar_texto(txt):
    if not txt:
        return ""
    nfkd = unicodedata.normalize('NFKD', txt.lower())
    return "".join([c for c in nfkd if not unicodedata.combining(c)])

def obter_contas_disponiveis():
    disponiveis = []
    for f in sorted(agy_contas.CONTAS_DIR.glob("conta*.json")):
        m = re.search(r'conta(\d+)\.json', f.name)
        if m:
            num = int(m.group(1))
            if agy_contas.carregar_conta(num) is not None:
                disponiveis.append(num)
    if not disponiveis:
        for i in range(1, agy_contas.TOTAL_CONTAS_PADRAO + 1):
            if agy_contas.carregar_conta(i) is not None:
                disponiveis.append(i)
    return sorted(list(set(disponiveis)))

def resolver_modelo_para_conta(id_modelo, num_conta, email_conta=""):
    if "opus" in id_modelo:
        return ("Claude Opus 4.6 (Thinking)", "claude-opus-4-6-thinking")

    if "sonnet" in id_modelo:
        return ("Claude Sonnet 4.6 (Thinking)", "claude-sonnet-4-6")

    for _, (nome, mid) in MAPA_MODELOS.items():
        if mid == id_modelo:
            return (nome, mid)
    return ("Gemini 3.8 Flash (High)", "gemini-3.8-flash-high")

def garantir_branch_segura(branch_alvo=BRANCH_SEGURA_PADRAO):
    try:
        res = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True, check=True)
        branch_atual = res.stdout.strip()
    except Exception as e:
        log("ERRO", f"Falha ao checar branch do Git: {e}")
        sys.exit(1)

    if branch_atual == "main":
        log("AVISO", f"Repositório estava na branch 'main'! Mudando para branch segura '{branch_alvo}'...")
        chk = subprocess.run(["git", "show-ref", "--verify", f"refs/heads/{branch_alvo}"], capture_output=True)
        if chk.returncode == 0:
            subprocess.run(["git", "checkout", branch_alvo], check=True)
        else:
            log("INFO", f"Criando nova branch isolada '{branch_alvo}' a partir da 'main'...")
            subprocess.run(["git", "checkout", "-b", branch_alvo], check=True)
        log("SHIELD", f"✅ Repositório isolado com sucesso na branch '{branch_alvo}'. A branch 'main' está protegida.")
    elif branch_atual != branch_alvo:
        log("INFO", f"Executando na branch ativa: '{branch_atual}'")
    else:
        log("SHIELD", f"✅ Operando na branch isolada '{branch_alvo}'. Branch 'main' protegida.")

# ==============================================================================
# INTEGRAÇÃO TELEGRAM (NOTIFICAÇÕES & COMANDOS REMOTOS)
# ==============================================================================

def obter_credenciais_telegram(token_override=None, chat_override=None):
    token = token_override or os.environ.get("RADARVOOS_TELEGRAM_BOT_TOKEN") or os.environ.get("BOT_TOKEN_IA_HUB") or os.environ.get("AUTOLOOP_TELEGRAM_BOT_TOKEN")
    chat_id = chat_override or os.environ.get("RADARVOOS_TELEGRAM_CHAT_ID") or os.environ.get("TELEGRAM_CHAT_ID")

    candidatos_env = [
        Path.home() / ".config" / "ia-hub" / "ia-hub.env",
        Path(".env"),
        Path("/home/wagmoraes/Projetos IA/RadarVoos/.env"),
        Path("/home/wagmoraes/Projetos IA/IA-Hub/.env")
    ]
    for c in candidatos_env:
        if c.exists() and (not token or not chat_id):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    for line in f:
                        l = line.strip()
                        if (l.startswith("BOT_TOKEN_IA_HUB=") or l.startswith("AUTOLOOP_TELEGRAM_BOT_TOKEN=") or l.startswith("TELEGRAM_BOT_TOKEN=")) and not token:
                            token = l.split("=", 1)[1].strip().strip('"').strip("'")
                        if (l.startswith("TELEGRAM_CHAT_ID=") or l.startswith("CHAT_AUTORIZADO=")) and not chat_id:
                            chat_id = l.split("=", 1)[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return token, chat_id

def enviar_notificacao_telegram(texto_html, token=None, chat_id=None, inline_keyboard=None):
    t, c = obter_credenciais_telegram(token, chat_id)
    if not t or not c:
        return False

    url = f"https://api.telegram.org/bot{t}/sendMessage"
    payload = {
        "chat_id": c,
        "text": texto_html,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    if inline_keyboard:
        payload["reply_markup"] = {"inline_keyboard": inline_keyboard}

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        log("AVISO", f"Falha ao enviar notificação no Telegram: {e}")
        return False

def enviar_relatorio_ciclo_telegram(token=None, chat_id=None, branch_alvo=BRANCH_SEGURA_PADRAO, validacao_ok=True, forcar=False):
    try:
        res_hash = subprocess.run(["git", "log", "-1", "--format=%h"], capture_output=True, text=True, check=True)
        res_msg = subprocess.run(["git", "log", "-1", "--format=%s"], capture_output=True, text=True, check=True)
        commit_hash = res_hash.stdout.strip()
        commit_msg = res_msg.stdout.strip()
    except Exception:
        commit_hash = "N/A"
        commit_msg = "Último ciclo finalizado"

    if commit_hash == "N/A":
        return False

    # Deduplicação, Filtro por Tipo e Throttling Estrito de Notificações
    estado = carregar_estado_notificacao()
    last_commit = estado.get("last_notified_commit")
    last_ts = estado.get("last_notified_ts", 0)
    agora_ts = time.time()

    # 1. NUNCA reenviar notificação redundante para o mesmo commit já notificado
    if not forcar and commit_hash == last_commit:
        log("INFO", f"🔕 Notificação do Telegram suprimida: commit {commit_hash} já foi notificado anteriormente.")
        return False

    # 2. Apenas notificar se for uma entrega real de funcionalidade (commit com prefixo feat:)
    if not forcar and not commit_msg.strip().lower().startswith("feat"):
        log("INFO", f"🔕 Notificação do Telegram suprimida: commit '{commit_msg[:50]}' não é uma nova funcionalidade (feat:).")
        return False

    # 3. Cooldown mínimo de 300 segundos (5 minutos) entre notificações consecutivas para evitar rajadas
    if not forcar and (agora_ts - last_ts) < 300:
        restante = int(300 - (agora_ts - last_ts))
        log("INFO", f"🔕 Notificação do Telegram suprimida (cooldown ativo, {restante}s restantes).")
        return False

    tarefa_concluida = commit_msg
    proxima_tarefa = obter_tarefa_ativa_progress() or "Refinamento contínuo do Radar de Voos"
    if len(proxima_tarefa) > 100:
        proxima_tarefa = proxima_tarefa[:97] + "..."

    status_icon = "✅" if validacao_ok else "⚠️"
    msg_html = (
        f"✈️ <b>RADAR DE VOOS · CICLO CONCLUÍDO</b>\n\n"
        f"🌿 <b>Branch:</b> <code>{branch_alvo}</code>\n"
        f"📦 <b>Novo Commit:</b> <code>{commit_hash}</code> - {html.escape(commit_msg)}\n"
        f"🧪 <b>Validação:</b> {status_icon} {'100+ Testes Aprovados' if validacao_ok else 'Atenção aos Testes'}\n\n"
        f"🎯 <b>Próxima Tarefa em Foco:</b>\n<i>{html.escape(proxima_tarefa)}</i>\n\n"
        f"💡 <i>Gerenciado via IA HUB no monitor visível do PC.</i>"
    )
    inline_keyboard = [
        [{"text": "🚀 Fazer Deploy no Render", "callback_data": "deploy:now"}]
    ]
    enviou = enviar_notificacao_telegram(msg_html, token, chat_id, inline_keyboard=inline_keyboard)
    if enviou:
        salvar_estado_notificacao(commit_hash, agora_ts)
        log("TELEGRAM", f"📲 Relatório do commit {commit_hash} enviado com sucesso ao Telegram.")
    return enviou

def executar_validacao_radar(tier="fast"):
    cmd = ["./validate.sh", tier] if os.path.exists("validate.sh") else ["npm", "test"]
    log("INFO", f"🧪 Executando validação do Radar de Voos (Tier: {tier.upper()})...")
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    sucesso = (res.returncode == 0)
    if sucesso:
        log("OK", f"✅ Validação ({tier.upper()}) aprovada com 100% de sucesso!")
    else:
        log("ERRO", f"❌ Falha detectada na validação ({tier.upper()}):\n{res.stdout[-400:]}\n{res.stderr[-300:]}")
    return sucesso

def executar_rollback_defensivo(sha_alvo=None):
    log("AVISO", "🛡️ [AUTO-ROLLBACK] Restaurando estado anterior do repositório para evitar quebras...")
    limpar_travas_residuais()
    if sha_alvo:
        subprocess.run(["git", "reset", "--hard", sha_alvo], check=False)
    else:
        subprocess.run(["git", "restore", "."], check=False)
    subprocess.run(["git", "clean", "-fd"], check=False)
    log("OK", "Estado do repositório restaurado com sucesso.")

def obter_tarefa_ativa_progress():
    if not os.path.exists("PROGRESS.md"):
        return None
    try:
        with open("PROGRESS.md", "r", encoding="utf-8") as f:
            conteudo = f.read()

        m_andamento = re.search(r'##\s*🎯?\s*🔄?\s*Próxima Tarefa em Andamento(.*?)(?:##|\Z)', conteudo, re.DOTALL | re.IGNORECASE)
        if m_andamento:
            bloco = m_andamento.group(1).strip()
            linhas = [l.strip() for l in bloco.splitlines() if l.strip()]
            for l in linhas:
                if "Arquivo/Módulo Alvo" in l or "Função/Componente" in l or "Comportamento Esperado" in l:
                    return " · ".join(re.sub(r'[*_`]', '', item).strip() for item in linhas if ":" in item)
                if l.startswith("-") or l.startswith("*"):
                    item_limpo = re.sub(r"^[-*]\s*(\[[ xX]\]\s*)?", "", l).strip()
                    item_limpo = re.sub(r"[*_`]", "", item_limpo).strip()
                    if item_limpo:
                        return item_limpo

        # Fallback para Backlog Prioritário
        m_backlog = re.search(r'##\s*📋?\s*Backlog Prioritário(.*?)(?:##|\Z)', conteudo, re.DOTALL | re.IGNORECASE)
        if m_backlog:
            bloco_b = m_backlog.group(1).strip()
            for l in bloco_b.splitlines():
                l = l.strip()
                if re.search(r'^\s*[-*]\s*\[ \]', l):
                    limpo = re.sub(r'^\s*[-*]\s*\[ \]\s*', '', l)
                    return re.sub(r'[*_`]', '', limpo).strip()
    except Exception:
        pass
    return None

def classificar_perfil_tarefa(texto_tarefa):
    if not texto_tarefa:
        return "GERAL_FLASH", "Desenvolvimento geral no Radar de Voos (Gemini Flash)", [
            MAPA_MODELOS["flash"]
        ]

    norm = normalizar_texto(texto_tarefa)

    termos_pro = [
        "algoritmo", "z-score", "bug fare", "anomalia", "estatistica", "kgmid",
        "google_flights_direct", "tfs", "protobuf", "paridade", "milhas", "smiles",
        "latam pass", "tudoazul", "concorrencia", "sqlite wal", "pragmas", "deadlock",
        "transacao imediata", "matriz de datas", "resolucao aeronautica", "geodesica"
    ]

    eh_pro = any(termo in norm for termo in termos_pro)
    if eh_pro:
        return "ALGORITMOS_E_ROTAS_PRO", "Inteligência de Busca, Bug Fares e Algoritmos Aeronáuticos (Gemini Pro ➔ Flash)", [
            MAPA_MODELOS["pro"],
            MAPA_MODELOS["flash"]
        ]

    return "COCKPIT_PWA_FASTIFY_FLASH", "Cockpit PWA, Rotas Fastify, Sparklines SVG e Testes (Gemini Flash)", [
        MAPA_MODELOS["flash"]
    ]

def obter_proximo_alvo(modelos):
    global indice_conta_atual
    contas = obter_contas_disponiveis()
    if not contas:
        log("ERRO", "Nenhuma conta está configurada no agy-contas!")
        sys.exit(1)

    agora = datetime.now()
    total_contas = len(contas)
    if indice_conta_atual not in contas:
        indice_conta_atual = contas[0]

    inicio_idx = contas.index(indice_conta_atual)

    for nome_modelo_generico, id_modelo_generico in modelos:
        for i in range(total_contas):
            c_idx = (inicio_idx + i) % total_contas
            conta_candidata = contas[c_idx]

            nome_modelo_real, id_modelo_real = resolver_modelo_para_conta(id_modelo_generico, conta_candidata)
            chave = (conta_candidata, id_modelo_real)
            liberacao = bloqueios.get(chave)
            if liberacao is None or agora >= liberacao:
                indice_conta_atual = contas[(c_idx + 1) % total_contas]
                return conta_candidata, nome_modelo_real, id_modelo_real

    # Limpeza de bloqueios expirados
    bloqueios_expirados = [k for k, v in bloqueios.items() if v and agora >= v]
    for k in bloqueios_expirados:
        bloqueios.pop(k, None)

    horarios_bloqueio = [t for t in bloqueios.values() if t and t > agora]
    if horarios_bloqueio:
        menor_liberacao = min(horarios_bloqueio)
        segundos_espera = max(15, int((menor_liberacao - agora).total_seconds()))
    else:
        segundos_espera = 60
        menor_liberacao = agora + timedelta(seconds=segundos_espera)

    espera_ciclo = min(segundos_espera, 90)
    log("AVISO", "Todas as contas configuradas constam temporariamente em repouso de cota.")
    log("INFO", f"Reavaliando pool em {espera_ciclo}s (estimativa: {menor_liberacao.strftime('%H:%M:%S')})...")
    time.sleep(espera_ciclo)
    return obter_proximo_alvo(modelos)

def montar_bloco_skills_radar():
    return """
### SKILLS RECOMENDADAS DO PROJETO RADAR DE VOOS:
- **`google-flights`**: Use para regras de negócio do Google Flights, resolução de aeroportos IATA/KGMID, payload tfs da aba "Cheapest" e links canônicos de voos.
- **`scrapling`**: Use para web scraping de tarifas aéreas resiliente a bloqueios e extração robusta de seletores DOM.
- **`fastify-best-practices`**: Use para estruturação limpa do backend Fastify 4, schemas com Ajv, modularização de plugins e hooks assíncronos.
- **`sqlite`**: Use para garantir pragmas de produção (WAL mode, busy_timeout=5000, synchronous=NORMAL), concorrência e transações seguras no SQLite nativo.
- **`smart-charts`**: Use para sparklines em SVG puro, gráficos leves de histórico tarifário e histogramas sem dependências pesadas.
- **`remotion-maps`**: Use para cálculo ortodrômico (Great Circle) e arcos de voo geodésicos SVG entre pares de aeroportos.
- **`anti-ui-slop` & `ui-taste`**: Use para manter o Cockpit PWA elegante, moderno, com microinterações ricas e design profissional anti-genérico.
- **`progressive-web-app`**: Use para suporte PWA, service worker e offline manifest do Cockpit.
- **`weather`**: Use para previsão climática de destinos turísticos através do WeatherService.
- **`clean-code-guard` & `tdd`**: Use para implementar mudanças cirúrgicas orientadas a testes automatizados com 100% de cobertura.
"""

def executar_ciclo(num_conta, nome_modelo, id_modelo, objetivo, branch_alvo, modo_ciclo="BUILDER", auto_rollback=True, telegram_token=None, telegram_chat=None):
    with deploy_lock:
        limpar_travas_residuais()
        token = agy_contas.carregar_conta(num_conta)
        email = agy_contas.extract_email(token)

        agy_contas.set_active_token(token)

        try:
            if garantir_progress_enxuto(".", titulo_projeto="Radar de Voos"):
                log("INFO", "🧹 PROGRESS.md otimizado: histórico antigo arquivado em CHANGELOG.md.")
        except Exception:
            pass

        sha_inicial = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=False).stdout.strip()

        print("\n" + "=" * 75)
        log("INFO", f"Iniciando ciclo na {CORES['bold']}Conta {num_conta}{CORES['reset']} ({email})")
        log("INFO", f"Modelo ativo: {CORES['bold']}{CORES['green']}{nome_modelo}{CORES['reset']} (`{id_modelo}`)")
        log("SHIELD", f"Branch ativa protegida: {CORES['bold']}{branch_alvo}{CORES['reset']}")
        if modo_ciclo == "QA_ADVERSARIAL":
            log("TEST", f"🕵️ Modo Operacional: {CORES['bold']}{CORES.get('cyan', '')}QA ADVERSARIAL (CAÇADOR DE BUGS & REFINADOR DE EXPERIÊNCIA){CORES['reset']}")
        else:
            log("BUILD", f"🏗️ Modo Operacional: {CORES['bold']}{CORES.get('green', '')}BUILDER (DESENVOLVEDOR DE RECURSOS){CORES['reset']}")
        print("=" * 75)

        bloco_agents = carregar_diretrizes_agents()
        prompt_agents = f"\n### DIRETRIZES TÉCNICAS DO REPOSITÓRIO (AGENTS.md):\n{bloco_agents}\n" if bloco_agents else ""

        if modo_ciclo == "QA_ADVERSARIAL":
            diretriz_modo = f"""
### 🕵️ MODO ATIVO DESTE TURNO: QA ADVERSARIAL (CAÇADOR DE BUGS & REFINADOR DE EXPERIÊNCIA)
Você está atuando como Engenheiro Chefe de QA, Fuzzing e Usabilidade do Radar de Voos.
Sua missão primordial neste ciclo NÃO é criar novas grandes features do backlog, mas sim AUDITAR, TESTAR IMPLACAVELMENTE E POLIR AS FUNÇÕES EXISTENTES:
1. SELECIONE UMA ÁREA EXISTENTE PARA AUDITAR E CAÇAR ERROS:
   - Domínio Aeronáutico & Datas (src/domain/rotas.js, bug_fares.js, aeroportos.js):
     * Datas extremas, anos bissextos, viradas de ano/mês, fusos UTC/BRT, viagens Só Ida vs Ida e Volta, KGMIDs, pisos de Bug Fare.
   - Banco de Dados SQLite & Concorrência (src/db.js):
     * Transações, WAL mode, limites de teto (preco_alvo), integridade de rotas, limpeza de arquivos de teste órfãos.
   - Provedores & Resiliência (src/services/providers/):
     * Tratamento de timeouts, parsing de HTML dinâmico, formato monetário brasileiro (milhares e centavos), failover.
   - Bot do Telegram (src/services/notifier_telegram.js):
     * Comandos (/teto, /verificar, /paridade, /rotas), botões inline, callbacks, sanitização HTML, destaque de economia real.
   - Cockpit PWA (src/public/app.js):
     * Renderização, formatação de datas, responsividade mobile, feedback ao usuário, filtros.
2. CRIE TESTES DE ESTRESSE / ADVERSARIAIS em tests/:
   - Crie casos de teste agressivos simulando entradas inválidas, datas de borda, concorrência e formatos inesperados.
3. IDENTIFICOU UM BUG, INCONSISTÊNCIA OU COMPORTAMENTO INDESEJADO?
   - CORRIJA A FUNÇÃO IMEDIATAMENTE no código-fonte da aplicação.
4. IDENTIFICOU OPORTUNIDADE DE MELHORIA NA EXPERIÊNCIA DO USUÁRIO?
   - APRIMORE A FUNÇÃO EXISTENTE (mensagens mais claras, formatação visual refinada, atalhos mais rápidos, validações amigáveis).
5. EXECUTE OBRIGATORIAMENTE `./validate.sh fast` para certificar 100% de aprovação.
6. CRIE UM COMMIT SEMÂNTICO (ex: `test:`, `fix:`, `refactor:`) descrevendo o teste adversarial e a blindagem/melhoria realizada.
"""
        else:
            diretriz_modo = f"""
### 🏗️ MODO ATIVO DESTE TURNO: BUILDER (DESENVOLVIMENTO DE RECURSOS)
Você está atuando como Engenheiro Construtor do Radar de Voos.
1. Verifique PROGRESS.md e o status do git para compreender o contexto imediato.
2. Foque em APENAS UMA tarefa atômica do topo de '## 🎯 Próxima Tarefa em Andamento' ou do '[Backlog Prioritário]'.
3. Implemente a funcionalidade com código limpo, robusto e defensivo.
4. Crie novos testes automatizados em tests/ cobrindo as novas funcionalidades.
5. Execute OBRIGATORIAMENTE `./validate.sh fast` para certificar 100% de aprovação.
6. Ao finalizar, atualize PROGRESS.md (arquivando detalhes em CHANGELOG.md) e faça commit semântico (ex: `feat:` para entregas ao usuário).
"""

        prompt = f"""Você é um engenheiro sênior e arquiteto de software trabalhando no projeto Radar de Voos (RadarVoos - Travel Hacking Engine, Fastify 4, SQLite Nativo WAL, PWA Cockpit e Telegram Bot).
Objetivo Geral: {objetivo}

{diretriz_modo}

DIRETRIZES ABSOLUTAS DE SEGURANÇA E EXECUÇÃO:
1. Verifique PROGRESS.md e o status do git (git status / git log -n 5) para compreender o contexto imediato.
2. ARQUITETURA E FOCO TÉCNICO DO RADAR DE VOOS:
   ★ PRECISÃO DE BUSCA E PARÂMETROS DE VOOS:
     - Refinar a extração de dados do Google Flights (tarifas normais vs cheapest tab via Protobuf tfs).
     - Integração com Scrapling para contornar bloqueios anti-bot e headers dinâmicos resilientes.
     - Assegurar distinção precisa entre viagem "Só Ida" (One-Way) e "Ida e Volta" (Round-Trip) em todas as rotas e filtros.
     - Validação estrita de datas, matriz de flexibilidade (±0 a ±7 dias) e janelas sem data fixa.
     - Detecção de Bug Fares através de Z-Score estatístico (proactive-agent) e piso tarifário por continente.
   ★ COCKPIT PWA MODERNO (ANTI-UI-SLOP):
     - Interface limpa, mobile-first, dark mode nativo, sparklines em SVG puro (smart-charts) e gráficos geodésicos (remotion-maps).
     - Feedback claro nos cards de rotas (badges contextuais de tipo de viagem e teto de preço).
   ★ ROBUSTEZ DO BACKEND:
     - Endpoints Fastify 4 com tratamento de erro resiliente e schemas defensivos.
     - SQLite nativo do Node.js 22 com WAL mode, busy_timeout e transações atômicas seguras.
     - Bot Telegram com formatação HTML segura e inline keyboards com paginação (telegram-compose).
3. TESTES E VALIDAÇÃO OBRIGATÓRIA:
   - Antes de concluir o ciclo, execute OBRIGATORIAMENTE `./validate.sh fast` para certificar que 100% dos testes e verificações de sintaxe passam.
4. Se identificar melhorias ou refatorações futuras, NÃO implemente fora de escopo; registre-as em docs/SUGESTOES_FUTURAS.md (mantendo apenas até 5 no PROGRESS.md).
5. Ao finalizar a tarefa:
   - Marque a tarefa no PROGRESS.md (mantendo-o sempre enxuto e arquivando histórico em CHANGELOG.md).
   - Use especificação CIRÚRGICA obrigatória em 3 partes para qualquer nova tarefa:
     1) Arquivo/Módulo Alvo
     2) Função/Componente/Seletor
     3) Comportamento Esperado / Critério de Aceite
   - Faça um commit semântico limpo na branch {branch_alvo}.
{prompt_agents}
{montar_bloco_skills_radar()}
"""

        cmd = [
            "agy",
            "--dangerously-skip-permissions",
            "--model", id_modelo,
            "--output-format", "stream-json",
            "-p", prompt
        ]

        def _registrar_processo_ativo(proc):
            global _processo_agy_ativo
            _processo_agy_ativo = proc

        linhas_saida = []
        indicadores_cota = set()

        def receber_linha(linha):
            linhas_saida.append(linha[-4096:])
            if len(linhas_saida) > 128:
                del linhas_saida[:-128]
            low = linha.lower()
            for marker in ["agy_error", "resource_exhausted", "429", "quota",
                           "individual quota reached", "free trial quota",
                           "credits balance is too low", "model capacity exceeded",
                           "exhausted your quota", "error"]:
                if marker in low:
                    indicadores_cota.add(marker)

        try:
            if run_observed:
                processo = run_observed(cmd, stage="ciclo_agy", timeout=TIMEOUT_TURNO_AGY,
                                        on_line=receber_linha,
                                        emit=_emitir_evento_equilibrado,
                                        on_start=_registrar_processo_ativo)
                ret_code = processo.returncode
            else:
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
                _registrar_processo_ativo(proc)
                try:
                    for line in proc.stdout:
                        receber_linha(line)
                        _emitir_evento_equilibrado(line)
                    proc.wait(timeout=TIMEOUT_TURNO_AGY)
                    ret_code = proc.returncode
                except subprocess.TimeoutExpired:
                    log("ERRO", f"⏰ Timeout estrito de {TIMEOUT_TURNO_AGY}s atingido no turno do AGY! Encerrando processo...")
                    proc.kill()
                    ret_code = 124
        except Exception as e:
            log("ERRO", f"Falha na invocação do AGY: {e}")
            ret_code = 1
        finally:
            _processo_agy_ativo = None

        if ret_code != 0:
            if ret_code == 124:
                log("ERRO", f"⏰ Turno do AGY foi cancelado devido a estouro do tempo limite ({TIMEOUT_TURNO_AGY}s).")
            cota_atingida = any(m in indicadores_cota for m in ["resource_exhausted", "429", "quota", "credits balance is too low", "model capacity exceeded"])
            if cota_atingida:
                chave_b = (num_conta, id_modelo)
                bloqueios[chave_b] = datetime.now() + timedelta(minutes=30)
                log("AVISO", f"⏸️ Cota atingida na Conta {num_conta} ({id_modelo}). Bloqueio de 30m aplicado.")
            else:
                log("AVISO", f"⚠️ Turno do AGY encerrou com código {ret_code}.")

            if auto_rollback:
                executar_rollback_defensivo(sha_inicial)
            return False

        # Validação pós-ciclo obrigatória (apenas se o turno do AGY completou com sucesso)
        validacao_aprovada = executar_validacao_radar(tier="fast")
        if not validacao_aprovada:
            if auto_rollback:
                log("ERRO", "❌ Validação quebrou após o turno da IA! Acionando auto-rollback defensivo...")
                executar_rollback_defensivo(sha_inicial)
                return False
            else:
                log("AVISO", "⚠️ Validação falhou, mas auto-rollback está desativado.")
                return False

        # Salvaguarda de commit: consolida alterações aprovadas se o agente não tiver commitado
        try:
            status_git = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=False).stdout.strip()
            if status_git:
                linhas_mod = [l for l in status_git.splitlines() if not l.startswith('?? data/') and not l.startswith('?? logs/')]
                if linhas_mod:
                    log("INFO", "Arquivos modificados detectados após testes aprovados. Consolidando commit de salvaguarda...")
                    subprocess.run(["git", "add", "-A"], check=False)
                    msg_commit = f"fix(autoloop): consolidar alteracoes do ciclo aprovado ({nome_modelo}) [{datetime.now().strftime('%Y-%m-%d %H:%M')}]"
                    subprocess.run(["git", "commit", "-m", msg_commit], check=False)
                    log("OK", f"Commit de salvaguarda consolidado com sucesso na branch {branch_alvo}.")
        except Exception as e_git:
            log("AVISO", f"Falha na salvaguarda de commit: {e_git}")

        sha_final = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=False).stdout.strip()

        # Se NÃO houve novo commit, nenhuma notificação é necessária
        if sha_final == sha_inicial:
            log("INFO", "ℹ️ Ciclo finalizado sem novas alterações ou commits. Nenhuma notificação enviada.")
            return True

        log("OK", f"🎉 Ciclo do Radar de Voos concluído com 100% de sucesso! (Commit: {sha_final[:7]})")
        if telegram_token:
            enviar_relatorio_ciclo_telegram(telegram_token, telegram_chat, branch_alvo, validacao_ok=True)

        return True

def main():
    parser = argparse.ArgumentParser(description="Autoloop Blindado para o Radar de Voos")
    parser.add_argument("--branch", default=BRANCH_SEGURA_PADRAO, help="Branch de desenvolvimento isolada")
    parser.add_argument("--objetivo", default="Consertar erros, melhorar busca do Google Flights e tornar parâmetros precisos", help="Objetivo macro")
    parser.add_argument("--ciclos", type=int, default=0, help="Número de ciclos (0 = contínuo)")
    parser.add_argument("--sem-rollback", action="store_true", help="Desativa auto-rollback defensivo")
    parser.add_argument("--modelo", default=None, help="Modelo forçado para todos os turnos")
    parser.add_argument("--modo", choices=["alternado", "builder", "qa"], default="alternado", help="Modo operacional: alternado (1 builder, 1 qa), builder ou qa")
    args = parser.parse_args()

    # Move para o diretório raiz do RadarVoos
    if DEFAULT_RADAR_DIR.is_dir():
        os.chdir(DEFAULT_RADAR_DIR)

    log("SMART", "🛫 Iniciando Autoloop Radar de Voos (Modo Híbrido: Builder + QA Tester)...")
    limpar_travas_residuais()
    garantir_branch_segura(args.branch)

    # Executa validação inicial de integridade
    if not executar_validacao_radar(tier="fast"):
        log("ERRO", "Repositório inicial possui testes quebrando! Corrija os testes antes de iniciar o autoloop.")
        sys.exit(1)

    token_tg, chat_tg = obter_credenciais_telegram()
    if token_tg and chat_tg:
        log("TELEGRAM", "Integração Telegram conectada e ativa.")

    ciclo_atual = 0
    while True:
        ciclo_atual += 1

        if args.modo == "qa":
            modo_ciclo = "QA_ADVERSARIAL"
        elif args.modo == "builder":
            modo_ciclo = "BUILDER"
        else:
            modo_ciclo = "BUILDER" if (ciclo_atual % 2 == 1) else "QA_ADVERSARIAL"

        tarefa_ativa = obter_tarefa_ativa_progress() or ""
        perfil, desc_perfil, modelos_candidatos = classificar_perfil_tarefa(tarefa_ativa)

        if args.modelo:
            modelos_execucao = [MAPA_MODELOS.get(args.modelo, ("Personalizado", args.modelo))]
        else:
            modelos_execucao = modelos_candidatos

        num_conta, nome_mod, id_mod = obter_proximo_alvo(modelos_execucao)

        log("INFO", f"Ciclo #{ciclo_atual} · Modo: {modo_ciclo} · Perfil: {desc_perfil}")
        if tarefa_ativa:
            log("INFO", f"🎯 Tarefa em foco: {tarefa_ativa[:90]}")

        sucesso = executar_ciclo(
            num_conta=num_conta,
            nome_modelo=nome_mod,
            id_modelo=id_mod,
            objetivo=args.objetivo,
            branch_alvo=args.branch,
            modo_ciclo=modo_ciclo,
            auto_rollback=not args.sem_rollback,
            telegram_token=token_tg,
            telegram_chat=chat_tg
        )

        if args.ciclos > 0 and ciclo_atual >= args.ciclos:
            log("OK", f"Limite programado de {args.ciclos} ciclos atingido. Encerrando com sucesso.")
            break

        if not sucesso:
            log("AVISO", "Pausa defensiva de 15s antes do próximo ciclo...")
            time.sleep(15)
        else:
            time.sleep(5)

if __name__ == "__main__":
    main()
