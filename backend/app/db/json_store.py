import copy
import json
import os
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path

try:  # kunci antarproses hanya tersedia di macOS/Linux
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None

from app.db.tables import Tables

class JsonStore:
    """Database berbentuk satu berkas JSON.

    Setiap operasi tulis berjalan di bawah satu kunci: data dimuat ulang, disalin, diubah, lalu
    ditulis atomik (berkas sementara + rename). Kalau terjadi error, salinan dibuang sehingga
    perubahan setengah jadi tidak pernah tersimpan.
    """

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._data: dict | None = None
        self._mtime: float | None = None

    @contextmanager
    def read(self):
        with self._lock:
            data = self._load()
        yield Tables(data, writable=False)

    @contextmanager
    def write(self):
        with self._lock, self._file_lock():
            data = copy.deepcopy(self._load())
            tables = Tables(data, writable=True)
            yield tables
            if tables.dirty:
                self._save(data)

    def reset(self) -> None:
        with self._lock:
            self._save({})

    def _load(self) -> dict:
        mtime = self.path.stat().st_mtime if self.path.exists() else None
        if self._data is None or mtime != self._mtime:
            self._data = json.loads(self.path.read_text("utf-8")) if mtime else {}
            self._mtime = mtime
        return self._data

    def _save(self, data: dict) -> None:
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".tmp-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1, default=str)
        os.replace(tmp, self.path)
        self._data = data
        self._mtime = self.path.stat().st_mtime

    @contextmanager
    def _file_lock(self):
        if fcntl is None:
            yield
            return
        with open(self.path.with_suffix(".lock"), "w") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)
