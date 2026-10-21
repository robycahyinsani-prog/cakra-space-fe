from __future__ import annotations

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.clock import clock
from app.core.config import Settings
from app.core.errors import Conflict, Invalid, NotFound, Unauthorized
from app.db.json_store import JsonStore
from app.db.tables import Tables
from app.integrations.documents import InvoicePdf, rupiah
from app.integrations.mailer import Mailer
from app.integrations.payment_gateway import SandboxGateway
from app.models.account import User
from app.models.billing import Invoice, InvoiceCounter, Payment, PaymentEvent, Refund
from app.models.booking import Booking
from app.models.enums import (
    BookingStatus,
    InvoiceStatus,
    PaymentMethod,
    PaymentPurpose,
    PaymentStatus,
    RefundStatus,
    SubscriptionStatus,
)
from app.models.location import Building
from app.services.access_control import AccessControl
from app.services.audit import AuditLogger
from app.services.finance import SettingService

class InvoiceService:
    """Invoice bernomor per gedung (BE-24) dan pengiriman lewat email (BE-25)."""

    def __init__(self, store: JsonStore, acl: AccessControl, mailer: Mailer, settings: Settings):
        self.store = store
        self.acl = acl
        self.mailer = mailer
        self.settings = settings
        self.pdf = InvoicePdf()

    @staticmethod
    def next_number(tx: Tables, building_code: str, at: datetime | None = None) -> str:
        periode = (at or clock.now()).strftime("%Y%m")
        key = f"{building_code}-{periode}"
        counter = tx.invoice_counters.first(key=key) or tx.invoice_counters.add(InvoiceCounter(key=key))
        counter = tx.invoice_counters.update(counter.id, last_seq=counter.last_seq + 1)
        return f"INV/{building_code}/{periode}/{counter.last_seq:04d}"

    def ensure(self, tx: Tables, payment: Payment, building: Building | None, description: str,
               subtotal: int, discount: int, tax: int) -> Invoice:
        """Satu invoice per transaksi. Invoice belum lunas dipakai ulang kalau member mengganti metode bayar."""
        lama = tx.invoices.first(lambda i: i.status == InvoiceStatus.UNPAID, purpose=payment.purpose,
                                 reference_id=payment.reference_id)
        if lama:
            return tx.invoices.update(lama.id, payment_id=payment.id)
        return tx.invoices.add(Invoice(
            number=self.next_number(tx, building.code if building else "CS"),
            building_id=building.id if building else None, user_id=payment.user_id, payment_id=payment.id,
            purpose=payment.purpose, reference_id=payment.reference_id, description=description,
            subtotal=subtotal, discount=discount, tax=tax, total=payment.amount,
        ))

    def mark_paid(self, tx: Tables, payment: Payment) -> Invoice | None:
        inv = tx.invoices.first(payment_id=payment.id)
        if inv is None:
            return None
        inv = tx.invoices.update(inv.id, status=InvoiceStatus.PAID, paid_at=payment.paid_at, emailed_at=clock.now())
        user = tx.users.require(inv.user_id)
        self.mailer.send(tx, user.email, f"Invoice {inv.number}",
                         f"Terima kasih, pembayaran {rupiah(inv.total)} sudah kami terima. Unduh invoice PDF di "
                         f"{self.settings.frontend_url}/invoices/{inv.id}", "invoice", user.id)
        return inv

    def list_mine(self, user: User) -> list[dict]:
        with self.store.read() as tx:
            items = sorted(tx.invoices.where(lambda i: i.status != InvoiceStatus.VOID, user_id=user.id),
                           key=lambda i: i.id, reverse=True)
            hasil = []
            for inv in items:
                # tagihan yang belum lunas punya tombol Bayar Sekarang (AC K5-US-008.3)
                hasil.append({**inv.model_dump(), "can_pay": inv.status == InvoiceStatus.UNPAID,
                              "pay": {"purpose": inv.purpose, "reference_id": inv.reference_id}})
            return hasil

    def render(self, user: User, invoice_id: int) -> tuple[bytes, str]:
        with self.store.read() as tx:
            inv = tx.invoices.require(invoice_id)
            if inv.user_id != user.id:
                if not user.is_staff or inv.building_id is None:
                    raise NotFound("Invoice tidak ditemukan")
                self.acl.require_building(tx, user, "reports.view", inv.building_id)
            pemilik = tx.users.require(inv.user_id)
            building = tx.buildings.get(inv.building_id)
            tarif = SettingService.tax_rate(tx)
        data = {
            "number": inv.number, "status": inv.status, "description": inv.description,
            "issued_at": inv.created_at.astimezone(ZoneInfo(self.settings.timezone)).strftime("%d-%m-%Y %H:%M"),
            "customer_name": pemilik.name, "customer_email": pemilik.email,
            "building_name": building.name if building else None,
            "subtotal": inv.subtotal, "discount": inv.discount, "tax": inv.tax, "total": inv.total, "tax_rate": tarif,
        }
        return self.pdf.build(data), inv.number.replace("/", "-") + ".pdf"

class RefundService:
    """Refund booking yang dibatalkan sesuai aturan gedung (BE-26, BE-27)."""

    def __init__(self, store: JsonStore, acl: AccessControl, audit: AuditLogger, mailer: Mailer,
                 gateway: SandboxGateway):
        self.store = store
        self.acl = acl
        self.audit = audit
        self.mailer = mailer
        self.gateway = gateway

    @staticmethod
    def percent_for(building: Building, booking: Booking, at: datetime) -> int:
        jam = (booking.start_at - at).total_seconds() / 3600
        if jam >= building.refund_full_hours:
            return 100
        if jam >= building.refund_partial_hours:
            return building.refund_partial_percent
        return 0

    def request(self, tx: Tables, booking: Booking, payment: Payment, building: Building) -> Refund:
        persen = self.percent_for(building, booking, clock.now())
        refund = tx.refunds.add(Refund(
            booking_id=booking.id, payment_id=payment.id, user_id=booking.user_id, building_id=building.id,
            amount=payment.amount * persen // 100, percent=persen,
            status=RefundStatus.REQUESTED if persen else RefundStatus.REJECTED,
            reason="Booking dibatalkan member",
            note=None if persen else "Pembatalan melewati batas refund gedung",
        ))
        return refund

    def auto_refund(self, tx: Tables, booking: Booking, payment: Payment) -> Refund:
        """Pembayaran yang datang setelah booking kedaluwarsa dikembalikan penuh."""
        ref = self.gateway.refund(payment.gateway_ref, payment.amount)
        tx.payments.update(payment.id, status=PaymentStatus.REFUNDED)
        return tx.refunds.add(Refund(
            booking_id=booking.id, payment_id=payment.id, user_id=booking.user_id, building_id=booking.building_id,
            amount=payment.amount, percent=100, status=RefundStatus.PROCESSED, reason="Pembayaran terlambat",
            decided_at=clock.now(), gateway_refund_ref=ref,
        ))

    def list(self, actor: User, building_id: int | None, status: RefundStatus | None) -> list[dict]:
        with self.store.read() as tx:
            self.acl.require(tx, actor, "refunds.manage")
            gedung = self.acl.filter_buildings(tx, actor, building_id)
            items = tx.refunds.where(lambda r: (gedung is None or r.building_id in gedung)
                                     and (status is None or r.status == status))
            hasil = []
            for r in sorted(items, key=lambda r: r.id, reverse=True):
                booking = tx.bookings.get(r.booking_id)
                member = tx.users.get(r.user_id)
                hasil.append({**r.model_dump(), "booking_code": booking.code if booking else None,
                              "member_name": member.name if member else None})
            return hasil

    def approve(self, actor: User, refund_id: int) -> Refund:
        with self.store.write() as tx:
            refund = self._pending(tx, actor, refund_id)
            payment = tx.payments.require(refund.payment_id)
            ref = self.gateway.refund(payment.gateway_ref, refund.amount)
            refund = tx.refunds.update(refund.id, status=RefundStatus.PROCESSED, decided_by=actor.id,
                                       decided_at=clock.now(), gateway_refund_ref=ref)
            if refund.amount >= payment.amount:
                tx.payments.update(payment.id, status=PaymentStatus.REFUNDED)
                inv = tx.invoices.first(payment_id=payment.id)
                if inv:
                    tx.invoices.update(inv.id, status=InvoiceStatus.REFUNDED)
            member = tx.users.require(refund.user_id)
            self.mailer.send(tx, member.email, "Refund diproses",
                             f"Refund {rupiah(refund.amount)} ({refund.percent}%) sudah diproses ke metode "
                             "pembayaran awal.", "refund_processed", member.id)
            self.audit.record(tx, actor.id, "refund.approve", "refund", refund.id, amount=refund.amount)
            return refund

    def reject(self, actor: User, refund_id: int, note: str) -> Refund:
        with self.store.write() as tx:
            refund = self._pending(tx, actor, refund_id)
            refund = tx.refunds.update(refund.id, status=RefundStatus.REJECTED, decided_by=actor.id,
                                       decided_at=clock.now(), note=note)
            member = tx.users.require(refund.user_id)
            self.mailer.send(tx, member.email, "Refund ditolak", f"Permintaan refund ditolak: {note}",
                             "refund_rejected", member.id)
            self.audit.record(tx, actor.id, "refund.reject", "refund", refund.id, note=note)
            return refund

    def _pending(self, tx: Tables, actor: User, refund_id: int) -> Refund:
        refund = tx.refunds.require(refund_id)
        self.acl.require_building(tx, actor, "refunds.manage", refund.building_id)
        if refund.status != RefundStatus.REQUESTED:
            raise Conflict("Refund ini sudah diputuskan")
        return refund

class PaymentService:
    """Pembayaran lewat payment gateway (BE-22) dan webhook status (BE-23)."""

    def __init__(self, store: JsonStore, settings: Settings, gateway: SandboxGateway, invoices: InvoiceService,
                 refunds: RefundService, bookings, membership, audit: AuditLogger):
        self.store = store
        self.settings = settings
        self.gateway = gateway
        self.invoices = invoices
        self.refunds = refunds
        self.bookings = bookings
        self.membership = membership
        self.audit = audit

    def create(self, user: User, purpose: PaymentPurpose, reference_id: int, method: PaymentMethod,
               plan_id: int | None = None) -> dict:
        if purpose == PaymentPurpose.RENEWAL:
            sub, plan = self.membership.renewal_quote(user)
            reference_id, meta = sub.id, {"plan_id": plan.id}
            tagihan = (plan.price, f"Perpanjangan membership {plan.name}", None, plan.price, 0, 0)
        elif purpose == PaymentPurpose.PLAN_CHANGE:
            if plan_id is None:
                raise Invalid("Pilih paket tujuan")
            hasil = self.membership.change_plan(user, plan_id)
            if hasil["kind"] == "downgrade":
                return {"payment": None, "change": hasil}
            sub = hasil["subscription"]
            reference_id, meta = sub.id, {"plan_id": plan_id}
            if hasil["prorata_amount"] == 0:
                with self.store.write() as tx:
                    self.membership.apply_upgrade(tx, tx.subscriptions.require(sub.id), plan_id)
                return {"payment": None, "change": hasil}
            tagihan = (hasil["prorata_amount"], f"Upgrade ke paket {hasil['plan'].name} (prorata)", None,
                       hasil["prorata_amount"], 0, 0)
        else:
            meta = {}
            tagihan = None

        with self.store.write() as tx:
            if tagihan is None:
                tagihan = self._bill(tx, user, purpose, reference_id)
            amount, description, building, subtotal, discount, tax = tagihan
            if amount <= 0:
                raise Invalid("Tidak ada yang perlu dibayar")
            expires_at = self._expiry(tx, purpose, reference_id)
            # pembayaran tertunda sebelumnya dibatalkan supaya hanya satu tagihan yang berlaku
            for lama in tx.payments.where(purpose=purpose, reference_id=reference_id, status=PaymentStatus.PENDING):
                tx.payments.update(lama.id, status=PaymentStatus.EXPIRED)
            charge = self.gateway.create_charge(method, amount, expires_at)
            payment = tx.payments.add(Payment(purpose=purpose, reference_id=reference_id, user_id=user.id,
                                              method=method, amount=amount, expires_at=expires_at, meta=meta,
                                              **charge))
            inv = self.invoices.ensure(tx, payment, building, description, subtotal, discount, tax)
            return {"payment": self.view(payment), "invoice": {"id": inv.id, "number": inv.number}}

    def get(self, user: User, payment_id: int) -> dict:
        with self.store.read() as tx:
            payment = tx.payments.get(payment_id)
            if payment is None or payment.user_id != user.id:
                raise NotFound("Pembayaran tidak ditemukan")
            data = self.view(payment)
            if payment.status == PaymentStatus.PENDING and payment.expires_at <= clock.now():
                data["status"] = PaymentStatus.EXPIRED
            return data

    @staticmethod
    def view(payment: Payment) -> dict:
        return payment.model_dump(exclude={"meta"})

    # webhook (BE-23)

    def handle_webhook(self, raw: bytes, signature: str | None) -> dict:
        try:
            body = json.loads(raw)
            event_id, ref, status, amount = body["event_id"], body["gateway_ref"], body["status"], int(body["amount"])
        except (ValueError, KeyError, TypeError) as exc:
            raise Invalid("Payload webhook tidak valid") from exc
        if not self.gateway.verify(raw, signature):
            # percobaan dengan signature palsu tetap tercatat di log transaksi
            with self.store.write() as tx:
                tx.payment_events.add(PaymentEvent(event_id=event_id, status=status, payload=body,
                                                   signature_valid=False, result="invalid_signature"))
            raise Unauthorized("Signature webhook tidak valid")

        with self.store.write() as tx:
            # webhook yang dikirim ulang tidak memproses pembayaran dua kali
            if tx.payment_events.exists(lambda e: e.signature_valid, event_id=event_id):
                return {"received": True, "duplicate": True}
            payment = tx.payments.first(gateway_ref=ref)
            hasil = self._apply(tx, payment, status, amount)
            tx.payment_events.add(PaymentEvent(payment_id=payment.id if payment else None, event_id=event_id,
                                               status=status, payload=body, signature_valid=True, result=hasil))
            return {"received": True, "duplicate": False, "result": hasil}

    def _apply(self, tx: Tables, payment: Payment | None, status: str, amount: int) -> str:
        if payment is None:
            return "unknown_payment"
        if payment.status != PaymentStatus.PENDING:
            return "ignored"
        if amount != payment.amount:
            return "amount_mismatch"
        if status == "success":
            payment = tx.payments.update(payment.id, status=PaymentStatus.SUCCESS, paid_at=clock.now())
            hasil = self._fulfil(tx, payment)
            self.invoices.mark_paid(tx, payment)
            return hasil
        if status in ("failed", "expired"):
            tx.payments.update(payment.id, status=PaymentStatus.FAILED if status == "failed" else PaymentStatus.EXPIRED)
            return status
        return "unknown_status"

    def _fulfil(self, tx: Tables, payment: Payment) -> str:
        if payment.purpose == PaymentPurpose.BOOKING:
            booking = tx.bookings.require(payment.reference_id)
            masih_hold = booking.status == BookingStatus.PENDING_PAYMENT and (
                booking.hold_expires_at is None or booking.hold_expires_at > clock.now())
            if not masih_hold:
                self.refunds.auto_refund(tx, booking, payment)
                return "late_payment_refunded"
            # booking berstatus Terkonfirmasi hanya setelah pembayaran sukses (AC K5-US-005.1)
            self.bookings.confirm(tx, booking)
            return "booking_confirmed"
        sub = tx.subscriptions.require(payment.reference_id)
        if payment.purpose == PaymentPurpose.SUBSCRIPTION:
            self.membership.activate(tx, sub)
            return "subscription_activated"
        if payment.purpose == PaymentPurpose.RENEWAL:
            self.membership.apply_renewal(tx, sub)
            return "subscription_renewed"
        self.membership.apply_upgrade(tx, sub, payment.meta["plan_id"])
        return "subscription_upgraded"

    # sandbox: meniru member membayar di halaman gateway lalu gateway memanggil webhook

    def sandbox_pay(self, gateway_ref: str, outcome: str) -> dict:
        with self.store.read() as tx:
            payment = tx.payments.first(gateway_ref=gateway_ref)
        if payment is None:
            raise NotFound("Kode pembayaran sandbox tidak ditemukan")
        raw, signature = self.gateway.build_webhook(gateway_ref, outcome, payment.amount)
        return self.handle_webhook(raw, signature)

    def expire_stale(self, tx: Tables) -> int:
        jumlah = 0
        for p in tx.payments.where(lambda p: p.expires_at <= clock.now(), status=PaymentStatus.PENDING):
            tx.payments.update(p.id, status=PaymentStatus.EXPIRED)
            jumlah += 1
        return jumlah

    # pembantu

    def _bill(self, tx: Tables, user: User, purpose: PaymentPurpose, reference_id: int) -> tuple:
        if purpose == PaymentPurpose.BOOKING:
            booking = tx.bookings.get(reference_id)
            if booking is None or booking.user_id != user.id:
                raise NotFound("Booking tidak ditemukan")
            if booking.status != BookingStatus.PENDING_PAYMENT or (
                    booking.hold_expires_at and booking.hold_expires_at <= clock.now()):
                raise Conflict("Booking ini tidak menunggu pembayaran")
            area = tx.areas.require(booking.area_id)
            building = tx.buildings.require(booking.building_id)
            diskon = booking.benefit_discount + booking.voucher_discount
            return (booking.total, f"Booking {booking.code} - {area.name}", building, booking.subtotal, diskon,
                    booking.tax)
        sub = tx.subscriptions.get(reference_id)
        if sub is None or sub.user_id != user.id:
            raise NotFound("Langganan tidak ditemukan")
        if sub.status != SubscriptionStatus.PENDING_PAYMENT:
            raise Conflict("Langganan ini tidak menunggu pembayaran")
        plan = tx.plans.require(sub.plan_id)
        return plan.price, f"Membership {plan.name} ({plan.duration_days} hari)", None, plan.price, 0, 0

    def _expiry(self, tx: Tables, purpose: PaymentPurpose, reference_id: int) -> datetime:
        if purpose == PaymentPurpose.BOOKING:
            return tx.bookings.require(reference_id).hold_expires_at
        return clock.now() + timedelta(hours=1)
