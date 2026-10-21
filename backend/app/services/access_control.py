from app.core.errors import Forbidden
from app.db.tables import Tables
from app.models.account import Permission, RoleDef, RolePermission, User
from app.models.billing import Setting
from app.models.enums import Role

ROLE_NAMES = {
    Role.MEMBER: "Member",
    Role.CENTRAL_MANAGER: "Pengelola Pusat",
    Role.LOCATION_MANAGER: "Pengelola Lokasi",
    Role.RECEPTIONIST: "Resepsionis",
}

PERMISSIONS = {
    "buildings.manage": "Membuat, mengaktifkan, menonaktifkan dan menghapus gedung",
    "buildings.edit": "Mengubah data, jam buka, hari libur, lantai dan fasilitas gedung",
    "areas.manage": "Mengelola meja, ruang rapat, status area dan denah",
    "bookings.calendar": "Melihat semua booking gedung",
    "bookings.today": "Melihat booking hari ini",
    "access.scan": "Memindai QR member dan tamu",
    "access.logs": "Melihat dan mengekspor log akses",
    "refunds.manage": "Menyetujui atau menolak refund",
    "finance.manage": "Mencatat deposit dan tunggakan",
    "vouchers.manage": "Mengelola voucher",
    "settings.manage": "Mengubah pengaturan pajak",
    "staff.manage": "Membuat akun staf dan memberi peran",
    "plans.manage": "Mengelola paket membership",
    "announcements.manage": "Membuat pengumuman gedung",
    "reports.view": "Melihat dashboard dan laporan",
    "devices.manage": "Mendaftarkan perangkat dan mencatat maintenance",
    "devices.command": "Mengirim perintah jarak jauh ke perangkat",
    "audit.view": "Melihat audit log",
}

_LOKASI = [
    "buildings.edit", "areas.manage", "bookings.calendar", "bookings.today", "access.scan",
    "access.logs", "refunds.manage", "finance.manage", "announcements.manage", "reports.view",
    "devices.manage", "devices.command",
]

DEFAULT_MATRIX = {
    Role.MEMBER: [],
    # perintah jarak jauh khusus pengelola lokasi gedung tersebut (AC K5-US-010.3)
    Role.CENTRAL_MANAGER: [p for p in PERMISSIONS if p != "devices.command"],
    Role.LOCATION_MANAGER: _LOKASI,
    Role.RECEPTIONIST: ["bookings.today", "access.scan"],
}

DEFAULT_SETTINGS = {"tax_rate_percent": "11"}

class AccessControl:
    """Middleware otorisasi berbasis tabel roles, permissions dan user_buildings (BE-33)."""

    def ensure_defaults(self, tx: Tables) -> None:
        for role, nama in ROLE_NAMES.items():
            if not tx.roles.exists(code=role):
                tx.roles.add(RoleDef(code=role, name=nama))
        for kode, ket in PERMISSIONS.items():
            if not tx.permissions.exists(code=kode):
                tx.permissions.add(Permission(code=kode, description=ket))
        if not tx.role_permissions.all():
            for role, daftar in DEFAULT_MATRIX.items():
                tx.role_permissions.add_many(RolePermission(role=role, permission=p) for p in daftar)
        for key, value in DEFAULT_SETTINGS.items():
            if not tx.settings.exists(key=key):
                tx.settings.add(Setting(key=key, value=value))

    def permissions_of(self, tx: Tables, role: Role) -> set[str]:
        return {rp.permission for rp in tx.role_permissions.where(role=role)}

    def has(self, tx: Tables, user: User, permission: str) -> bool:
        return permission in self.permissions_of(tx, user.role)

    def require(self, tx: Tables, user: User, permission: str) -> None:
        if not self.has(tx, user, permission):
            raise Forbidden("Anda tidak punya hak akses untuk tindakan ini")

    def scope(self, tx: Tables, user: User) -> set[int] | None:
        """Gedung yang boleh diakses staf. None berarti semua gedung (pengelola pusat)."""
        if user.role == Role.CENTRAL_MANAGER:
            return None
        return {ub.building_id for ub in tx.user_buildings.where(user_id=user.id)}

    def require_building(self, tx: Tables, user: User, permission: str, building_id: int) -> None:
        self.require(tx, user, permission)
        cakupan = self.scope(tx, user)
        if cakupan is not None and building_id not in cakupan:
            raise Forbidden("Anda hanya bisa mengakses data gedung yang Anda pegang")

    def filter_buildings(self, tx: Tables, user: User, building_id: int | None) -> set[int] | None:
        """Gedung yang dipakai sebagai filter laporan atau daftar untuk staf ini."""
        cakupan = self.scope(tx, user)
        if building_id is not None:
            if cakupan is not None and building_id not in cakupan:
                raise Forbidden("Anda hanya bisa mengakses data gedung yang Anda pegang")
            return {building_id}
        return cakupan
