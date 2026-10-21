from collections.abc import Callable, Iterable

from pydantic import BaseModel

from app.core.clock import clock
from app.core.errors import NotFound

class ReadOnlyError(RuntimeError):
    pass

class Repository[M: BaseModel]:
    """CRUD satu koleksi JSON. Data disimpan sebagai dict, dikembalikan sebagai model Pydantic."""

    label = "Data"

    def __init__(self, tables, name: str, model: type[M], label: str | None = None):
        self._tables = tables
        self.name = name
        self.model = model
        self.label = label or self.label

    @property
    def _rows(self) -> list[dict]:
        return self._tables.collection(self.name)

    # baca

    def all(self) -> list[M]:
        return [self.model.model_validate(r) for r in self._rows]

    def where(self, predicate: Callable[[M], bool] | None = None, **eq) -> list[M]:
        hasil = []
        for row in self._rows:
            if any(row.get(k) != v for k, v in eq.items()):
                continue
            item = self.model.model_validate(row)
            if predicate is None or predicate(item):
                hasil.append(item)
        return hasil

    def first(self, predicate: Callable[[M], bool] | None = None, **eq) -> M | None:
        for row in self._rows:
            if any(row.get(k) != v for k, v in eq.items()):
                continue
            item = self.model.model_validate(row)
            if predicate is None or predicate(item):
                return item
        return None

    def get(self, id_: int | None) -> M | None:
        if id_ is None:
            return None
        row = self._find(id_)
        return self.model.model_validate(row) if row else None

    def require(self, id_: int | None, message: str | None = None) -> M:
        item = self.get(id_)
        if item is None:
            raise NotFound(message or f"{self.label} tidak ditemukan")
        return item

    def count(self, predicate: Callable[[M], bool] | None = None, **eq) -> int:
        return len(self.where(predicate, **eq))

    def exists(self, predicate: Callable[[M], bool] | None = None, **eq) -> bool:
        return self.first(predicate, **eq) is not None

    # tulis

    def add(self, item: M) -> M:
        self._guard()
        now = clock.now()
        data = item.model_dump(mode="json")
        data["id"] = self._tables.next_id(self.name)
        if "created_at" in self.model.model_fields and data.get("created_at") is None:
            data["created_at"] = now.isoformat()
        if "updated_at" in self.model.model_fields:
            data["updated_at"] = now.isoformat()
        self._rows.append(data)
        self._tables.dirty = True
        return self.model.model_validate(data)

    def add_many(self, items: Iterable[M]) -> list[M]:
        return [self.add(i) for i in items]

    def update(self, id_: int, **changes) -> M:
        self._guard()
        row = self._find(id_)
        if row is None:
            raise NotFound(f"{self.label} tidak ditemukan")
        item = self.model.model_validate({**row, **changes})
        data = item.model_dump(mode="json")
        if "updated_at" in self.model.model_fields:
            data["updated_at"] = clock.now().isoformat()
        row.clear()
        row.update(data)
        self._tables.dirty = True
        return self.model.model_validate(row)

    def delete(self, id_: int) -> None:
        self._guard()
        rows = self._rows
        sisa = [r for r in rows if r.get("id") != id_]
        if len(sisa) == len(rows):
            raise NotFound(f"{self.label} tidak ditemukan")
        rows[:] = sisa
        self._tables.dirty = True

    def delete_where(self, **eq) -> int:
        self._guard()
        rows = self._rows
        sisa = [r for r in rows if any(r.get(k) != v for k, v in eq.items())]
        terhapus = len(rows) - len(sisa)
        rows[:] = sisa
        if terhapus:
            self._tables.dirty = True
        return terhapus

    def _find(self, id_: int) -> dict | None:
        return next((r for r in self._rows if r.get("id") == id_), None)

    def _guard(self) -> None:
        if not self._tables.writable:
            raise ReadOnlyError(f"koleksi {self.name} dibuka hanya baca")

class AppendOnlyRepository[M: BaseModel](Repository[M]):
    """Koleksi log yang hanya bisa ditambah, sesuai AC log akses tidak bisa diubah atau dihapus."""

    def update(self, id_: int, **changes) -> M:
        raise ReadOnlyError(f"{self.name} hanya bisa ditambah")

    def delete(self, id_: int) -> None:
        raise ReadOnlyError(f"{self.name} hanya bisa ditambah")

    def delete_where(self, **eq) -> int:
        raise ReadOnlyError(f"{self.name} hanya bisa ditambah")
