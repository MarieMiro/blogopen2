"""
backend/accounts/parser/run_parser.py

Запускает ozon_parser.py как отдельный процесс.
Gunicorn не блокируется — парсер живёт в своём процессе.
"""

import subprocess
import json
import sys
import os

# Путь к парсеру относительно этого файла
PARSER_SCRIPT = os.path.join(os.path.dirname(__file__), "ozon_parser.py")

# Максимальное время ожидания в секундах
PARSER_TIMEOUT = 60


def run_ozon_parser(url: str) -> dict:
    """
    Запускает парсер как subprocess и возвращает результат.
    Если парсер завис или упал — возвращает {"error": "..."}.
    """
    try:
        proc = subprocess.run(
            [sys.executable, PARSER_SCRIPT, url],
            capture_output=True,
            text=True,
            timeout=PARSER_TIMEOUT,
        )

        stdout = (proc.stdout or "").strip()
        stderr = (proc.stderr or "").strip()

        if not stdout:
            return {
                "error": f"Парсер не вернул данные. stderr: {stderr[:300]}"
            }

        
        last_line = stdout.strip().split("\n")[-1]

        try:
            return json.loads(last_line)
        except json.JSONDecodeError:
            return {
                "error": f"Не удалось разобрать ответ парсера: {last_line[:200]}"
            }

    except subprocess.TimeoutExpired:
        return {"error": f"Парсер превысил лимит времени ({PARSER_TIMEOUT} сек). Попробуйте ещё раз."}

    except FileNotFoundError:
        return {"error": "Скрипт парсера не найден. Проверьте путь к ozon_parser.py"}

    except Exception as e:
        return {"error": f"Ошибка запуска парсера: {str(e)}"}