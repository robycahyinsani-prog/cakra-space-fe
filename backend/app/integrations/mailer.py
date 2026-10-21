import logging

from app.db.tables import Tables
from app.models.operations import Notification

log = logging.getLogger("cakraspace.mail")


class Mailer:
    """Email simulasi: pesan disimpan di koleksi notifications dan dicetak ke log server.

    Disimpan di transaksi yang sama dengan operasinya, jadi email tidak terkirim kalau operasinya gagal.
    """

    def send(
        self, tx: Tables, to_email: str, subject: str, body: str, kind: str, user_id: int | None = None
    ) -> Notification:
        pesan = tx.notifications.add(
            Notification(user_id=user_id, to_email=to_email, subject=subject, body=body, kind=kind)
        )
        log.info("email %s ke %s: %s", kind, to_email, subject)
        return pesan
