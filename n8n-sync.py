#!/usr/bin/env python3

import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import threading
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

from huggingface_hub import HfApi, snapshot_download, upload_folder
from huggingface_hub.errors import RepositoryNotFoundError

N8N_HOME = Path(os.environ.get("N8N_USER_FOLDER", "/home/node/.n8n"))
STATUS_FILE = Path("/tmp/hugging8n-sync-status.json")
INTERVAL = int(os.environ.get("SYNC_INTERVAL", "180"))
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
HF_USERNAME = (
    os.environ.get("HF_USERNAME", "").strip()
    or os.environ.get("SPACE_AUTHOR_NAME", "").strip()
)
BACKUP_DATASET_NAME = os.environ.get("BACKUP_DATASET_NAME", "hugging8n-backup").strip()
HF_API = HfApi(token=HF_TOKEN) if HF_TOKEN else None
STOP_EVENT = threading.Event()


def write_status(status: str, message: str) -> None:
    payload = {
        "status": status,
        "message": message,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    STATUS_FILE.write_text(json.dumps(payload), encoding="utf-8")


def dataset_repo_id() -> str:
    if not HF_USERNAME:
        raise RuntimeError("HF_USERNAME or SPACE_AUTHOR_NAME is required for backup repo naming")
    return f"{HF_USERNAME}/{BACKUP_DATASET_NAME}"


def ensure_repo_exists() -> str:
    repo_id = dataset_repo_id()
    try:
        HF_API.repo_info(repo_id=repo_id, repo_type="dataset")
    except RepositoryNotFoundError:
        HF_API.create_repo(repo_id=repo_id, repo_type="dataset", private=True)
    return repo_id


def fingerprint_dir(root: Path) -> str:
    hasher = hashlib.sha256()
    if not root.exists():
        return hasher.hexdigest()

    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(root).as_posix()
        if rel.startswith(".cache/"):
            continue
        hasher.update(rel.encode("utf-8"))
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                hasher.update(chunk)
    return hasher.hexdigest()


def create_snapshot_dir(source_root: Path) -> Path:
    staging_root = Path(tempfile.mkdtemp(prefix="hugging8n-sync-"))
    database_path = source_root / "database.sqlite"

    for path in sorted(source_root.rglob("*")):
        rel = path.relative_to(source_root)
        rel_posix = rel.as_posix()
        if rel_posix.startswith(".cache/"):
            continue
        target = staging_root / rel
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        if rel_posix in {"database.sqlite", "database.sqlite-shm", "database.sqlite-wal"}:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)

    if database_path.exists():
        target_db = staging_root / "database.sqlite"
        target_db.parent.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(
                ["sqlite3", str(database_path), f".backup {target_db}"],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            shutil.copy2(database_path, target_db)
            for suffix in ("-wal", "-shm"):
                sidecar = source_root / f"database.sqlite{suffix}"
                if sidecar.exists():
                    shutil.copy2(sidecar, staging_root / sidecar.name)

    return staging_root


def restore() -> bool:
    if not HF_TOKEN:
        write_status("disabled", "HF_TOKEN is not configured.")
        return False

    repo_id = dataset_repo_id()
    write_status("restoring", f"Restoring state from {repo_id}")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            snapshot_download(
                repo_id=repo_id,
                repo_type="dataset",
                token=HF_TOKEN,
                local_dir=tmpdir,
            )

            tmp_path = Path(tmpdir)
            if not any(tmp_path.iterdir()):
                write_status("fresh", "Backup dataset is empty. Starting fresh.")
                return True

            N8N_HOME.mkdir(parents=True, exist_ok=True)
            for child in N8N_HOME.iterdir():
                if child.name == ".cache":
                    continue
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                else:
                    child.unlink(missing_ok=True)

            for child in tmp_path.iterdir():
                if child.name == ".cache":
                    continue
                destination = N8N_HOME / child.name
                if child.is_dir():
                    shutil.copytree(child, destination)
                else:
                    shutil.copy2(child, destination)

        write_status("restored", f"Restored state from {repo_id}")
        return True
    except RepositoryNotFoundError:
        write_status("fresh", f"Backup dataset {repo_id} does not exist yet.")
        return True
    except Exception as exc:
        write_status("error", f"Restore failed: {exc}")
        print(f"Restore failed: {exc}", file=sys.stderr)
        return False


def sync_once(last_fingerprint: str | None = None) -> str:
    if not HF_TOKEN:
        write_status("disabled", "HF_TOKEN is not configured.")
        return last_fingerprint or ""

    repo_id = ensure_repo_exists()
    current_fingerprint = fingerprint_dir(N8N_HOME)
    if last_fingerprint is not None and current_fingerprint == last_fingerprint:
        write_status("synced", "No state changes detected.")
        return last_fingerprint

    write_status("syncing", f"Uploading state to {repo_id}")
    snapshot_dir = create_snapshot_dir(N8N_HOME)
    try:
        upload_folder(
            folder_path=str(snapshot_dir),
            repo_id=repo_id,
            repo_type="dataset",
            token=HF_TOKEN,
            commit_message=f"Hugging8n sync {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
            ignore_patterns=[".cache/*"],
        )
    finally:
        shutil.rmtree(snapshot_dir, ignore_errors=True)
    write_status("success", f"Uploaded state to {repo_id}")
    return current_fingerprint


def handle_signal(_sig, _frame) -> None:
    STOP_EVENT.set()


def loop() -> int:
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    last_fingerprint = fingerprint_dir(N8N_HOME)
    write_status("configured", f"Backup loop active with {INTERVAL}s interval.")

    while not STOP_EVENT.is_set():
        try:
            last_fingerprint = sync_once(last_fingerprint)
        except Exception as exc:
            write_status("error", f"Sync failed: {exc}")
            print(f"Sync failed: {exc}", file=sys.stderr)
        
        if STOP_EVENT.wait(INTERVAL):
            break

    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: n8n-sync.py [restore|sync-once|loop]", file=sys.stderr)
        return 1

    command = sys.argv[1]
    if command == "restore":
        return 0 if restore() else 1
    if command == "sync-once":
        sync_once(None)
        return 0
    if command == "loop":
        return loop()

    print(f"Unknown command: {command}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
