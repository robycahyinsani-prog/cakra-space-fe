from __future__ import annotations

from datetime import date

from app.core.clock import clock
from app.core.errors import Conflict, Invalid
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.models.account import User
from app.models.billing import Arrear, Deposit, Voucher
from app.models.enums import ArrearStatus, DepositStatus, DiscountType, Role
from app.services.access_control import AccessControl
from app.services.audit import AuditLogger

class SettingService:
    """Pengaturan global, saat ini tarif pajak (AC K5-US-005.6)."""

    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger):
        self.store = store
        self.acl = acl
        self.audit = audit

    @staticmethod
    def tax_rate(tx: Tables) -> int:
        row = tx.settings.first(key="tax_rate_percent")
        return int(row.value) if row else 11

    def get(self) -> dict:
        with self.store.read() as tx:
            return {"tax_rate_percent": self.tax_rate(tx)}

    def set_tax_rate(self, actor: User, rate: int) -> dict:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "settings.manage")
            row = tx.settings.first(key="tax_rate_percent")
            tx.settings.update(row.id, value=str(rate))
            self.audit.record(tx, actor.id, "settings.tax_rate", "setting", row.id, value=rate)
            return {"tax_rate_percent": rate}

class VoucherService:
    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger):
        self.store = store
        self.acl = acl
        self.audit = audit

    def list(self, actor: User) -> list[Voucher]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "vouchers.manage")
            return sorted(tx.vouchers.all(), key=lambda v: v.code)

    def create(self, actor: User, data: dict) -> Voucher:
        self._check(data)
        with self.store.write() as tx:
            self.acl.require(tx, actor, "vouchers.manage")
            data["code"] = data["code"].upper()
            if tx.vouchers.exists(code=data["code"]):
                raise Conflict("Kode voucher sudah dipakai")
            for bid in data.get("building_ids", []):
                tx.buildings.require(bid)
            voucher = tx.vouchers.add(Voucher(**data))
            self.audit.record(tx, actor.id, "voucher.create", "voucher", voucher.id)
            return voucher

    def update(self, actor: User, voucher_id: int, changes: dict) -> Voucher:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "vouchers.manage")
            lama = tx.vouchers.require(voucher_id)
            gabung = {**lama.model_dump(), **changes}
            self._check(gabung)
            if changes.get("quota") is not None and changes["quota"] < lama.used_count:
                raise Invalid("Kuota tidak boleh lebih kecil dari jumlah voucher yang sudah dipakai")
            return tx.vouchers.update(voucher_id, **changes)

    def delete(self, actor: User, voucher_id: int) -> None:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "vouchers.manage")
            voucher = tx.vouchers.require(voucher_id)
            if voucher.used_count:
                raise Conflict("Voucher sudah pernah dipakai, nonaktifkan saja")
            tx.vouchers.delete(voucher_id)

    # dipakai PricingService di dalam transaksi booking

    @staticmethod
    def validate(tx: Tables, code: str, building_id: int, day: date) -> Voucher:
        voucher = tx.vouchers.first(code=code.strip().upper())
        if voucher is None or not voucher.is_active:
            raise Invalid("Kode voucher tidak ditemukan")
        if day < voucher.valid_from or day > voucher.valid_until:
            raise Invalid("Voucher sudah kedaluwarsa atau belum berlaku")
        if voucher.used_count >= voucher.quota:
            raise Invalid("Kuota voucher sudah habis")
        if voucher.building_ids and building_id not in voucher.building_ids:
            raise Invalid("Voucher tidak berlaku di gedung ini")
        return voucher

    @staticmethod
    def discount(voucher: Voucher, amount: int) -> int:
        if voucher.discount_type == DiscountType.PERCENT:
            nilai = amount * voucher.discount_value // 100
            if voucher.max_discount:
                nilai = min(nilai, voucher.max_discount)
        else:
            nilai = voucher.discount_value
        return min(nilai, amount)

    @staticmethod
    def reserve(tx: Tables, voucher_id: int) -> None:
        v = tx.vouchers.require(voucher_id)
        tx.vouchers.update(voucher_id, used_count=v.used_count + 1)

    @staticmethod
    def release(tx: Tables, voucher_id: int | None) -> None:
        if voucher_id is None:
            return
        v = tx.vouchers.get(voucher_id)
        if v and v.used_count > 0:
            tx.vouchers.update(voucher_id, used_count=v.used_count - 1)

    @staticmethod
    def _check(data: dict) -> None:
        if data["valid_until"] < data["valid_from"]:
            raise Invalid("Tanggal berakhir voucher harus setelah tanggal mulai")
        if data["discount_type"] == DiscountType.PERCENT and not 0 < data["discount_value"] <= 100:
            raise Invalid("Diskon persen harus di antara 1 dan 100")

class FinanceService:
    """Deposit dan tunggakan member (BE-28)."""

    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger, tz: str):
        self.store = store
        self.acl = acl
        self.audit = audit
        self.tz = tz

    @staticmethod
    def has_overdue(tx: Tables, user_id: int, today: date) -> bool:
        return tx.arrears.exists(lambda a: a.is_overdue(today), user_id=user_id)

    def list_deposits(self, actor: User, building_id: int | None, status: DepositStatus | None) -> list[Deposit]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "finance.manage")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            items = tx.deposits.where(lambda d: gedung is None or d.building_id in gedung)
        return [d for d in items if status is None or d.status == status]

    def add_deposit(self, actor: User, data: dict) -> Deposit:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "finance.manage", data["building_id"])
            self._member(tx, data["user_id"])
            deposit = tx.deposits.add(Deposit(**data, recorded_by=actor.id))
            self.audit.record(tx, actor.id, "deposit.create", "deposit", deposit.id, amount=deposit.amount)
            return deposit

    def return_deposit(self, actor: User, deposit_id: int) -> Deposit:
        with self.store.write() as tx:
            deposit = tx.deposits.require(deposit_id)
            self.acl.require_building(tx, actor, "finance.manage", deposit.building_id)
            if deposit.status == DepositStatus.RETURNED:
                raise Conflict("Deposit sudah dikembalikan")
            self.audit.record(tx, actor.id, "deposit.return", "deposit", deposit_id)
            return tx.deposits.update(deposit_id, status=DepositStatus.RETURNED, returned_at=clock.now())

    def list_arrears(self, actor: User, building_id: int | None, overdue_only: bool) -> list[dict]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "finance.manage")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            items = tx.arrears.where(lambda a: gedung is None or a.building_id in gedung)
            today = clock.local_today(self.tz)
            hasil = []
            for a in items:
                if overdue_only and not a.is_overdue(today):
                    continue
                user = tx.users.get(a.user_id)
                hasil.append({**a.model_dump(), "is_overdue": a.is_overdue(today),
                              "member_name": user.name if user else None})
            return sorted(hasil, key=lambda a: a["due_date"])

    def add_arrear(self, actor: User, data: dict) -> Arrear:
        with self.store.write() as tx:
            self.acl.require_building(tx, actor, "finance.manage", data["building_id"])
            self._member(tx, data["user_id"])
            arrear = tx.arrears.add(Arrear(**data))
            self.audit.record(tx, actor.id, "arrear.create", "arrear", arrear.id, amount=arrear.amount)
            return arrear

    def settle_arrear(self, actor: User, arrear_id: int) -> Arrear:
        with self.store.write() as tx:
            arrear = tx.arrears.require(arrear_id)
            self.acl.require_building(tx, actor, "finance.manage", arrear.building_id)
            if arrear.status == ArrearStatus.PAID:
                raise Conflict("Tunggakan sudah lunas")
            self.audit.record(tx, actor.id, "arrear.paid", "arrear", arrear_id)
            return tx.arrears.update(arrear_id, status=ArrearStatus.PAID, paid_at=clock.now())

    @staticmethod
    def _member(tx: Tables, user_id: int) -> User:
        user = tx.users.require(user_id, "Member tidak ditemukan")
        if user.role != Role.MEMBER:
            raise Invalid("Deposit dan tunggakan hanya untuk akun member")
        return user
