import os
import subprocess
import sys

os.chdir("backend")

print("collectstatic...", flush=True)
subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"])

print("migrate...", flush=True)
subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"])

print("starting gunicorn...", flush=True)
os.execv(sys.executable, [
    sys.executable, "-m", "gunicorn", "config.wsgi:application",
    "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120",
])
