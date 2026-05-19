"""
backend/accounts/parser/run_parser.py

Запускает ozon_parser.py как отдельный процесс.
Gunicorn не блокируется — парсер живёт в своём процессе.
"""

import subprocess
import json
import sys
import os
import logging

logger = logging.getLogger(__name__)

# Путь к парсеру относительно этого файла
PARSER_SCRIPT = os.path.join(os.path.dirname(__file__), "ozon_parser.py")

# Максимальное время ожидания в секундах
PARSER_TIMEOUT = 60


def run_ozon_parser(url: str) -> dict:
    try:
        proc = subprocess.run(
            [sys.executable, PARSER_SCRIPT, url],
            capture_output=True,
            text=True,
            timeout=PARSER_TIMEOUT,
        )

        # Всё логируем — видно в Render Logs
        logger.warning("=== PARSER STDERR ===\n%s", proc.stderr[:2000] if proc.stderr else "(пусто)")
        logger.warning("=== PARSER STDOUT ===\n%s", proc.stdout[:2000] if proc.stdout else "(пусто)")
        logger.warning("=== PARSER RETURNCODE === %s", proc.returncode)

        stdout = (proc.stdout or "").strip()

        if not stdout:
            return {
                "error": f"Парсер не вернул данные. stderr: {(proc.stderr or '')[:300]}"
            }

        lines = stdout.strip().split("\n")
        last_line = lines[-1]

        try:
            return json.loads(last_line)
        except json.JSONDecodeError:
            return {
                "error": f"Не удалось разобрать ответ: {last_line[:200]}"
            }

    except subprocess.TimeoutExpired:
        return {"error": f"Парсер завис (лимит {PARSER_TIMEOUT} сек). Попробуйте ещё раз."}

    except FileNotFoundError:
        return {"error": f"Скрипт не найден: {PARSER_SCRIPT}"}

    except Exception as e:
        return {"error": f"Ошибка запуска: {str(e)}"}