from dataclasses import asdict, dataclass
from datetime import date, datetime

from app.db.tables import Tables
from app.models.account import User
from app.models.enums import AreaType
from app.models.location import Area, Building
from app.services.finance import SettingService, VoucherService
from app.services.membership import MembershipService

@dataclass
class Quote:
    area_id: int
    start_at: datetime
    end_at: datetime
    minutes: int
    subtotal: int
    benefit_minutes: int
    benefit_discount: int
    voucher_id: int | None
    voucher_code: str | None
    voucher_discount: int
    tax_rate_percent: int
    tax: int
    total: int
    subscription_id: int | None

    def as_dict(self) -> dict:
        return asdict(self)

class PricingService:
    """Ringkasan harga booking: harga dasar, benefit membership, voucher, lalu pajak.

    Urutannya sesuai AC K5-US-005.6, pajak dihitung setelah diskon dengan tarif dari pengaturan.
    """

    def __init__(self, membership: MembershipService):
        self.membership = membership

    @staticmethod
    def base_price(area: Area, minutes: int) -> int:
        per_jam = area.price_per_hour * minutes // 60
        # tarif harian menjadi batas atas supaya pemakaian seharian tidak lebih mahal dari paket harian
        return min(per_jam, area.price_per_day)

    def quote(self, tx: Tables, user: User, area: Area, building: Building, start: datetime, end: datetime,
              hari: date, voucher_code: str | None, use_benefit: bool) -> Quote:
        menit = int((end - start).total_seconds() // 60)
        subtotal = self.base_price(area, menit)

        benefit_menit, benefit_potong, sub_id = 0, 0, None
        if use_benefit and area.type == AreaType.MEETING_ROOM:
            temuan = self.membership.meeting_room_benefit(tx, user.id, building.id, hari)
            if temuan:
                sub, sisa = temuan
                benefit_menit = min(sisa, menit)
                benefit_potong = subtotal * benefit_menit // menit
                sub_id = sub.id

        voucher_id, voucher_potong, kode = None, 0, None
        if voucher_code:
            voucher = VoucherService.validate(tx, voucher_code, building.id, hari)
            voucher_id, kode = voucher.id, voucher.code
            voucher_potong = VoucherService.discount(voucher, subtotal - benefit_potong)

        tarif = SettingService.tax_rate(tx)
        dasar_pajak = subtotal - benefit_potong - voucher_potong
        pajak = dasar_pajak * tarif // 100
        return Quote(
            area_id=area.id, start_at=start, end_at=end, minutes=menit, subtotal=subtotal,
            benefit_minutes=benefit_menit, benefit_discount=benefit_potong, voucher_id=voucher_id,
            voucher_code=kode, voucher_discount=voucher_potong, tax_rate_percent=tarif, tax=pajak,
            total=dasar_pajak + pajak, subscription_id=sub_id,
        )
