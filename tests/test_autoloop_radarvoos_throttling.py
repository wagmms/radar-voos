#!/usr/bin/env python3
"""
Testes automatizados para validação de throttling, deduplicação e blindagem
de notificações do autoloop-radarvoos.
"""

import sys
import os
import json
import time
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock

# Adiciona o diretório scripts ao path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import autoloop_radarvoos as autoloop

class TestAutoloopRadarVoosThrottling(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.state_file = Path(self.temp_dir.name) / "autoloop_telegram_state.json"
        self.orig_state_file = autoloop.STATE_TELEGRAM_FILE
        autoloop.STATE_TELEGRAM_FILE = self.state_file

    def tearDown(self):
        autoloop.STATE_TELEGRAM_FILE = self.orig_state_file
        self.temp_dir.cleanup()

    def test_salvar_e_carregar_estado_notificacao(self):
        autoloop.salvar_estado_notificacao("abc1234", ts=1000.0)
        estado = autoloop.carregar_estado_notificacao()
        self.assertEqual(estado.get("last_notified_commit"), "abc1234")
        self.assertEqual(estado.get("last_notified_ts"), 1000.0)

    @patch("autoloop_radarvoos.enviar_notificacao_telegram")
    @patch("subprocess.run")
    def test_suprime_notificacao_para_mesmo_commit(self, mock_subproc, mock_enviar_tg):
        mock_enviar_tg.return_value = True

        # Simula git log retornando commit abc1234
        res_hash = MagicMock()
        res_hash.stdout = "abc1234\n"
        res_msg = MagicMock()
        res_msg.stdout = "feat: teste\n"
        mock_subproc.side_effect = [res_hash, res_msg]

        # Salva que abc1234 já foi notificado
        autoloop.salvar_estado_notificacao("abc1234", ts=time.time() - 1000)

        # Tentativa de reenviar para o mesmo commit sem forçar
        enviou = autoloop.enviar_relatorio_ciclo_telegram(token="token", chat_id="chat", forcar=False)
        self.assertFalse(enviou)
        mock_enviar_tg.assert_not_called()

    @patch("autoloop_radarvoos.enviar_notificacao_telegram")
    @patch("subprocess.run")
    def test_suprime_notificacao_durante_cooldown_300s(self, mock_subproc, mock_enviar_tg):
        mock_enviar_tg.return_value = True

        res_hash = MagicMock()
        res_hash.stdout = "def5678\n"
        res_msg = MagicMock()
        res_msg.stdout = "feat: novo commit\n"
        mock_subproc.side_effect = [res_hash, res_msg]

        # Notificado há apenas 60 segundos (cooldown de 300s ativo)
        autoloop.salvar_estado_notificacao("abc1234", ts=time.time() - 60)

        enviou = autoloop.enviar_relatorio_ciclo_telegram(token="token", chat_id="chat", forcar=False)
        self.assertFalse(enviou)
        mock_enviar_tg.assert_not_called()

    @patch("autoloop_radarvoos.enviar_notificacao_telegram")
    @patch("subprocess.run")
    def test_permite_notificacao_apos_cooldown_com_novo_commit(self, mock_subproc, mock_enviar_tg):
        mock_enviar_tg.return_value = True

        res_hash = MagicMock()
        res_hash.stdout = "def5678\n"
        res_msg = MagicMock()
        res_msg.stdout = "feat: novo commit aprovado\n"
        mock_subproc.side_effect = [res_hash, res_msg]

        # Notificado há 400 segundos (cooldown de 300s expirou)
        autoloop.salvar_estado_notificacao("abc1234", ts=time.time() - 400)

        enviou = autoloop.enviar_relatorio_ciclo_telegram(token="token", chat_id="chat", forcar=False)
        self.assertTrue(enviou)
        mock_enviar_tg.assert_called_once()

        # Verifica se atualizou estado
        estado = autoloop.carregar_estado_notificacao()
        self.assertEqual(estado.get("last_notified_commit"), "def5678")

    @patch("autoloop_radarvoos.enviar_notificacao_telegram")
    @patch("subprocess.run")
    def test_suprime_notificacao_se_nao_for_feat(self, mock_subproc, mock_enviar_tg):
        mock_enviar_tg.return_value = True

        res_hash = MagicMock()
        res_hash.stdout = "ghi9012\n"
        res_msg = MagicMock()
        res_msg.stdout = "fix(scanner): corrigir seletor quebrado\n"
        mock_subproc.side_effect = [res_hash, res_msg]

        # Mesmo sem cooldown ativo, commits que não começam com feat: devem ser silenciados
        autoloop.salvar_estado_notificacao("abc1234", ts=time.time() - 1000)

        enviou = autoloop.enviar_relatorio_ciclo_telegram(token="token", chat_id="chat", forcar=False)
        self.assertFalse(enviou)
        mock_enviar_tg.assert_not_called()

    def test_limpar_travas_residuais(self):
        git_dir = Path(self.temp_dir.name) / ".git"
        git_dir.mkdir(parents=True, exist_ok=True)
        lock_file = git_dir / "index.lock"
        lock_file.write_text("dummy lock")
        self.assertTrue(lock_file.exists())

        autoloop.limpar_travas_residuais(repo_dir=self.temp_dir.name)
        self.assertFalse(lock_file.exists())

    def test_carregar_diretrizes_agents(self):
        agents_file = Path(self.temp_dir.name) / "AGENTS.md"
        agents_file.write_text("# Diretrizes Radar de Voos Teste", encoding="utf-8")

        conteudo = autoloop.carregar_diretrizes_agents(repo_dir=self.temp_dir.name)
        self.assertIn("Diretrizes Radar de Voos Teste", conteudo)

    @patch("autoloop_radarvoos.enviar_notificacao_telegram")
    @patch("subprocess.run")
    def test_rejeita_commit_na(self, mock_subproc, mock_enviar_tg):
        mock_subproc.side_effect = Exception("Git indisponível")
        enviou = autoloop.enviar_relatorio_ciclo_telegram(token="token", chat_id="chat", forcar=False)
        self.assertFalse(enviou)
        mock_enviar_tg.assert_not_called()

if __name__ == "__main__":
    unittest.main()
