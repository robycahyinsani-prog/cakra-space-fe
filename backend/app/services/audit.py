from app.db.tables import Tables
from app.models.operations import AuditLog

class AuditLogger:
    def record(self, tx: Tables, actor_id: int | None, action: str, entity: str,
               entity_id: int | None = None, **detail) -> AuditLog:
        return tx.audit_logs.add(
            AuditLog(actor_id=actor_id, action=action, entity=entity, entity_id=entity_id, detail=detail)
        )
