from enum import StrEnum

class Role(StrEnum):
    MEMBER = "member"
    CENTRAL_MANAGER = "central_manager"
    LOCATION_MANAGER = "location_manager"
    RECEPTIONIST = "receptionist"

class TokenPurpose(StrEnum):
    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"
    CHANGE_EMAIL = "change_email"

class BuildingStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"

class FacilityScope(StrEnum):
    BUILDING = "building"
    AREA = "area"

class AreaType(StrEnum):
    HOT_DESK = "hot_desk"
    DEDICATED_DESK = "dedicated_desk"
    MEETING_ROOM = "meeting_room"

class AreaStatus(StrEnum):
    AVAILABLE = "available"
    MAINTENANCE = "maintenance"
    INACTIVE = "inactive"

class BookingStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class PaymentPurpose(StrEnum):
    BOOKING = "booking"
    SUBSCRIPTION = "subscription"
    RENEWAL = "subscription_renewal"
    PLAN_CHANGE = "subscription_change"

class PaymentMethod(StrEnum):
    VIRTUAL_ACCOUNT = "virtual_account"
    E_WALLET = "e_wallet"
    CREDIT_CARD = "credit_card"

class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    EXPIRED = "expired"
    REFUNDED = "refunded"

class InvoiceStatus(StrEnum):
    UNPAID = "unpaid"
    PAID = "paid"
    REFUNDED = "refunded"
    VOID = "void"

class RefundStatus(StrEnum):
    REQUESTED = "requested"
    PROCESSED = "processed"
    REJECTED = "rejected"

class DepositStatus(StrEnum):
    HELD = "held"
    RETURNED = "returned"

class ArrearStatus(StrEnum):
    OPEN = "open"
    PAID = "paid"

class DiscountType(StrEnum):
    PERCENT = "percent"
    AMOUNT = "amount"

class Credential(StrEnum):
    MEMBER_QR = "member_qr"
    GUEST_QR = "guest_qr"

class AccessResult(StrEnum):
    GRANTED = "granted"
    DENIED = "denied"

class SubscriptionStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    FROZEN = "frozen"
    INACTIVE = "inactive"
    CANCELLED = "cancelled"

class BenefitType(StrEnum):
    MEETING_ROOM_HOURS = "meeting_room_hours"

class DeviceType(StrEnum):
    QR_READER = "qr_reader"
    DOOR_LOCK = "door_lock"

class CommandType(StrEnum):
    UNLOCK = "unlock"
    RESTART = "restart"

class CommandStatus(StrEnum):
    PENDING = "pending"
    DELIVERED = "delivered"
    DONE = "done"
    FAILED = "failed"

class ExportStatus(StrEnum):
    QUEUED = "queued"
    DONE = "done"
    FAILED = "failed"

class ReportKind(StrEnum):
    REVENUE = "revenue"
    MEMBERS = "members"
    BOOKINGS = "bookings"
    ACCESS_LOGS = "access_logs"

class ExportFormat(StrEnum):
    XLSX = "xlsx"
    PDF = "pdf"
