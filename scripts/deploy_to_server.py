"""
Синхронизация локального CRM на сервер по SSH/SFTP и пересборка Docker.

Пароль не хранится в файле. Перед запуском:
  Windows PowerShell:
    $env:CRM_DEPLOY_PASSWORD = "ваш-пароль"
    python scripts/deploy_to_server.py
"""

from __future__ import annotations

import os
import pathlib
import posixpath
import stat
import sys

import paramiko

HOST = "62.181.53.36"
PORT = 22
USERNAME = "root"
REMOTE_ROOT = "/root/CRM"
LOCAL_ROOT = pathlib.Path(__file__).resolve().parents[1]

# Не заливаем секреты и мусор сборки
SKIP_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".next",
        "__pycache__",
        ".git",
        ".venv",
        "venv",
        ".mypy_cache",
        ".pytest_cache",
        "postgres_data",
        "redis_data",
    }
)


def getenv_password() -> str:
    p = os.environ.get("CRM_DEPLOY_PASSWORD", "").strip()
    if not p:
        print("Задайте переменную окружения CRM_DEPLOY_PASSWORD", file=sys.stderr)
        sys.exit(1)
    return p


def should_skip_file(rel: pathlib.Path) -> bool:
    parts = rel.parts
    for name in parts:
        if name in SKIP_DIR_NAMES:
            return True
    name = rel.name
    if name == ".env" or name.startswith(".env."):
        return True
    return False


def mkdir_p(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    remote_path = remote_path.rstrip("/")
    if not remote_path:
        return
    parts = remote_path.split("/")
    cur = ""
    for p in parts:
        if not p:
            continue
        cur = f"{cur}/{p}" if cur else f"/{p}"
        try:
            sftp.stat(cur)
        except OSError:
            sftp.mkdir(cur)


def upload_tree(sftp: paramiko.SFTPClient, local_dir: pathlib.Path, remote_dir: str) -> int:
    count = 0
    local_dir = local_dir.resolve()
    for path in local_dir.rglob("*"):
        try:
            rel = path.relative_to(local_dir)
        except ValueError:
            continue
        if should_skip_file(rel):
            continue
        remote_path = posixpath.join(remote_dir, *rel.as_posix().split("/"))
        if path.is_dir():
            try:
                sftp.stat(remote_path)
            except OSError:
                mkdir_p(sftp, remote_path)
            continue
        if not path.is_file():
            continue
        parent = posixpath.dirname(remote_path)
        mkdir_p(sftp, parent)
        sftp.put(str(path), remote_path)
        count += 1
    return count


def put_file(sftp: paramiko.SFTPClient, local: pathlib.Path, remote: str) -> None:
    mkdir_p(sftp, posixpath.dirname(remote))
    sftp.put(str(local), remote)


def run(ssh: paramiko.SSHClient, cmd: str) -> None:
    print(f"\n$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    enc = sys.stdout.encoding or "utf-8"
    if out.strip():
        print(out.encode(enc, errors="replace").decode(enc, errors="replace"))
    if err.strip():
        print(err.encode(enc, errors="replace").decode(enc, errors="replace"))
    if code != 0:
        raise RuntimeError(f"Exit {code}: {cmd}")


def main() -> None:
    password = getenv_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting {USERNAME}@{HOST}:{PORT}...")
    ssh.connect(
        hostname=HOST,
        port=PORT,
        username=USERNAME,
        password=password,
        timeout=30,
        auth_timeout=30,
        banner_timeout=30,
    )
    try:
        sftp = ssh.open_sftp()
        mkdir_p(sftp, REMOTE_ROOT)

        pairs = [
            (LOCAL_ROOT / "frontend" / "site", f"{REMOTE_ROOT}/frontend/site"),
            (LOCAL_ROOT / "backend", f"{REMOTE_ROOT}/backend"),
            (LOCAL_ROOT / "bot", f"{REMOTE_ROOT}/bot"),
            (LOCAL_ROOT / "nginx", f"{REMOTE_ROOT}/nginx"),
        ]
        for local, remote in pairs:
            if not local.is_dir():
                print(f"Skip missing: {local}")
                continue
            n = upload_tree(sftp, local, remote)
            print(f"Uploaded {n} files -> {remote}")

        compose = LOCAL_ROOT / "docker-compose.yml"
        if compose.is_file():
            put_file(sftp, compose, f"{REMOTE_ROOT}/docker-compose.yml")
            print(f"Uploaded docker-compose.yml")

        sftp.close()

        run(
            ssh,
            "cd /root/CRM && docker compose build --no-cache frontend backend celery_worker bot",
        )
        run(
            ssh,
            "cd /root/CRM && docker compose up -d --force-recreate frontend backend celery_worker bot nginx",
        )
        run(ssh, "cd /root/CRM && docker compose ps")
        print("\nDeploy finished.")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
