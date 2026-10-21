from datetime import date

from fastapi import APIRouter, Depends

from app.container import Container
from app.core.deps import current_user, get_container, member_user, staff_user
from app.models.account import User
from app.models.enums import AreaType
from app.schemas.commerce import BookingIn, CancelIn, GuestsIn, RescheduleIn
from app.services.booking import BookingRequest

router = APIRouter(prefix="/api/v1", tags=["bookings"])


@router.post("/bookings/quote", summary="Ringkasan harga termasuk diskon dan pajak sebelum konfirmasi")
def quote(body: BookingIn, user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.bookings.quote(user, BookingRequest(**body.model_dump())).as_dict()


@router.post("/bookings", status_code=201, summary="Pesan meja atau ruang rapat, ditahan 15 menit (BE-16, BE-18)")
def create_booking(body: BookingIn, user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.bookings.create(user, BookingRequest(**body.model_dump()))


@router.get("/bookings/{booking_id}", summary="Detail booking beserta pembayaran, invoice, refund dan tamu")
def booking_detail(booking_id: int, user: User = Depends(current_user), c: Container = Depends(get_container)):
    return c.bookings.detail(user, booking_id)


@router.post("/bookings/{booking_id}/cancel", summary="Batalkan booking sesuai batas waktu gedung (BE-19)")
def cancel_booking(
    booking_id: int, body: CancelIn, user: User = Depends(member_user), c: Container = Depends(get_container)
):
    return c.bookings.cancel(user, booking_id, body.reason)


@router.post("/bookings/{booking_id}/reschedule", summary="Pindah jadwal booking (BE-19)")
def reschedule_booking(
    booking_id: int, body: RescheduleIn, user: User = Depends(member_user), c: Container = Depends(get_container)
):
    return c.bookings.reschedule(user, booking_id, body.date, body.start_time, body.end_time)


@router.post(
    "/bookings/{booking_id}/guests", status_code=201, summary="Undang tamu rapat dengan QR sekali pakai (BE-31)"
)
def invite_guests(
    booking_id: int, body: GuestsIn, user: User = Depends(member_user), c: Container = Depends(get_container)
):
    return c.access.invite(user, booking_id, [g.model_dump() for g in body.guests])


@router.get("/bookings/{booking_id}/guests", summary="Daftar tamu yang sudah diundang")
def list_guests(booking_id: int, user: User = Depends(member_user), c: Container = Depends(get_container)):
    return c.access.guests(user, booking_id)


@router.get("/manage/bookings", summary="Kalender booking gedung untuk pengelola (BE-21)")
def calendar(
    building_id: int,
    date_from: date,
    date_to: date,
    floor_id: int | None = None,
    type: AreaType | None = None,
    actor: User = Depends(staff_user),
    c: Container = Depends(get_container),
):
    return c.bookings.calendar(actor, building_id, date_from, date_to, floor_id, type)


@router.get("/manage/bookings/today", summary="Booking hari ini untuk resepsionis")
def today(building_id: int, actor: User = Depends(staff_user), c: Container = Depends(get_container)):
    return c.bookings.today(actor, building_id)
