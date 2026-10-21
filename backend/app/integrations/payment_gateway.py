import json
import secrets
from datetime import datetime

from app.core.clock import clock
from app.core.security import Signer
from app.models.enums import PaymentMethod


class SandboxGateway:
    """Payment gateway simulasi.

    Bentuk datanya mengikuti gateway umum (kode referensi, nomor VA, URL bayar, webhook bertanda
    tangan HMAC), jadi mengganti ke Midtrans atau Xendit cukup di kelas ini. Data kartu tidak pernah
    melewati server Cakra Space karena pembayaran kartu dilakukan di halaman gateway.
    """

    def __init__(self, webhook_secret: str, frontend_url: str):
        self.signer = Signer(webhook_secret)
        self.frontend_url = frontend_url

    def create_charge(self, method: PaymentMethod, amount: int, expires_at: datetime) -> dict:
        ref = "SBX-" + secrets.token_hex(6).upper()
        hasil = {"gateway_ref": ref, "va_number": None, "payment_url": None}
        if method == PaymentMethod.VIRTUAL_ACCOUNT:
            hasil["va_number"] = "8808" + "".join(secrets.choice("0123456789") for _ in range(10))
        else:
            hasil["payment_url"] = f"{self.frontend_url}/sandbox-pay/{ref}"
        return hasil

    def refund(self, gateway_ref: str, amount: int) -> str:
        return f"RFD-{gateway_ref}-{secrets.token_hex(3).upper()}"

    def build_webhook(self, gateway_ref: str, status: str, amount: int) -> tuple[bytes, str]:
        payload = {
            "event_id": "EVT-" + secrets.token_hex(8),
            "gateway_ref": gateway_ref,
            "status": status,
            "amount": amount,
            "occurred_at": clock.now().isoformat(),
        }
        raw = json.dumps(payload, separators=(",", ":")).encode()
        return raw, self.signer.sign(raw)

    def verify(self, raw: bytes, signature: str | None) -> bool:
        return self.signer.verify(raw, signature or "")
