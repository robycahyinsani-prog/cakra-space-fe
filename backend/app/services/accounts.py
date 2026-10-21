from __future__ import annotations

from app.core.errors import Conflict, Invalid
from app.core.security import PasswordHasher
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.models.account import User, UserBuilding
from app.models.enums import Role
from app.services.access_control import ROLE_NAMES, AccessControl
from app.services.audit import AuditLogger


class StaffService:
    """Akun staf dibuat pengelola pusat dengan password sementara (BE-07), member tidak bisa daftar sebagai staf."""

    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger, hasher: PasswordHasher):
        self.store = store
        self.acl = acl
        self.audit = audit
        self.hasher = hasher

    def view(self, tx: Tables, user: User) -> dict:
        gedung = [ub.building_id for ub in tx.user_buildings.where(user_id=user.id)]
        return {
            **user.model_dump(exclude={"password_hash", "token_version", "failed_logins"}),
            "building_ids": gedung,
            "role_name": ROLE_NAMES[user.role],
            "permissions": sorted(self.acl.permissions_of(tx, user.role)),
        }

    def create(self, actor: User, name: str, email: str, role: Role, building_ids: list[int]) -> dict:
        if role == Role.MEMBER:
            raise Invalid("Gunakan registrasi biasa untuk akun member")
        email = email.strip().lower()
        with self.store.write() as tx:
            self.acl.require(tx, actor, "staff.manage")
            if tx.users.exists(email=email):
                raise Conflict("Email sudah terdaftar")
            self._check_buildings(tx, role, building_ids)
            sementara = self.hasher.temporary()
            user = tx.users.add(
                User(
                    email=email,
                    name=name,
                    role=role,
                    is_verified=True,
                    must_change_password=True,
                    password_hash=self.hasher.hash(sementara),
                )
            )
            tx.user_buildings.add_many(UserBuilding(user_id=user.id, building_id=b) for b in set(building_ids))
            self.audit.record(tx, actor.id, "staff.create", "user", user.id, role=role)
            # password sementara hanya ditampilkan sekali, login pertama wajib menggantinya
            return {**self.view(tx, user), "temporary_password": sementara}

    def list(self, actor: User, role: Role | None) -> list[dict]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "staff.manage")
            items = tx.users.where(lambda u: u.is_staff and (role is None or u.role == role))
            return [self.view(tx, u) for u in sorted(items, key=lambda u: u.name)]

    def update(
        self, actor: User, user_id: int, name: str | None, role: Role | None, building_ids: list[int] | None
    ) -> dict:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "staff.manage")
            user = tx.users.require(user_id)
            if not user.is_staff:
                raise Invalid("Akun ini bukan akun staf")
            if role == Role.MEMBER:
                raise Invalid("Peran staf tidak bisa diubah menjadi member")
            peran = role or user.role
            gedung = (
                building_ids
                if building_ids is not None
                else [ub.building_id for ub in tx.user_buildings.where(user_id=user_id)]
            )
            self._check_buildings(tx, peran, gedung)
            ubah = {k: v for k, v in {"name": name, "role": role}.items() if v is not None}
            if role and role != user.role:
                ubah["token_version"] = user.token_version + 1  # sesi lama berakhir saat peran berubah
            if ubah:
                user = tx.users.update(user_id, **ubah)
            if building_ids is not None:
                tx.user_buildings.delete_where(user_id=user_id)
                tx.user_buildings.add_many(UserBuilding(user_id=user_id, building_id=b) for b in set(building_ids))
            self.audit.record(tx, actor.id, "staff.update", "user", user_id, role=peran, buildings=gedung)
            return self.view(tx, user)

    def reset_password(self, actor: User, user_id: int) -> dict:
        with self.store.write() as tx:
            self.acl.require(tx, actor, "staff.manage")
            user = tx.users.require(user_id)
            if not user.is_staff:
                raise Invalid("Member mengganti password lewat lupa password")
            sementara = self.hasher.temporary()
            user = tx.users.update(
                user_id,
                password_hash=self.hasher.hash(sementara),
                must_change_password=True,
                token_version=user.token_version + 1,
                failed_logins=0,
                locked_until=None,
            )
            self.audit.record(tx, actor.id, "staff.reset_password", "user", user_id)
            return {**self.view(tx, user), "temporary_password": sementara}

    def roles(self, actor: User) -> list[dict]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "staff.manage")
            return [
                {"code": r.code, "name": r.name, "permissions": sorted(self.acl.permissions_of(tx, r.code))}
                for r in tx.roles.all()
            ]

    def members(self, actor: User, q: str | None) -> list[dict]:
        with self.store.read() as tx:
            if not (self.acl.has(tx, actor, "finance.manage") or self.acl.has(tx, actor, "reports.view")):
                self.acl.require(tx, actor, "finance.manage")
            items = tx.users.where(role=Role.MEMBER)
        if q:
            kata = q.lower()
            items = [u for u in items if kata in u.name.lower() or kata in u.email]
        return [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "company": u.company,
                "is_verified": u.is_verified,
            }
            for u in sorted(items, key=lambda u: u.name)
        ][:100]

    @staticmethod
    def _check_buildings(tx: Tables, role: Role, building_ids: list[int]) -> None:
        for b in building_ids:
            tx.buildings.require(b)
        if role in (Role.LOCATION_MANAGER, Role.RECEPTIONIST) and not building_ids:
            raise Invalid("Pengelola lokasi dan resepsionis wajib memegang minimal satu gedung")


class ProfileService:
    """Ubah profil member (BE-43). Email diubah lewat AuthService karena perlu verifikasi ulang."""

    def __init__(self, store: JsonStore, staff: StaffService):
        self.store = store
        self.staff = staff

    def me(self, user: User) -> dict:
        with self.store.read() as tx:
            return self.staff.view(tx, tx.users.require(user.id))

    def update(self, user: User, changes: dict) -> dict:
        with self.store.write() as tx:
            return self.staff.view(tx, tx.users.update(user.id, **changes))
