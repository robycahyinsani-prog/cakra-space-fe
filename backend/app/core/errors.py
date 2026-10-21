class AppError(Exception):
    """Error domain yang dipetakan ke respons HTTP oleh handler di main.py."""

    status_code = 400

    def __init__(self, message: str, **extra):
        super().__init__(message)
        self.message = message
        self.extra = extra

class Unauthorized(AppError):
    status_code = 401

class Forbidden(AppError):
    status_code = 403

class NotFound(AppError):
    status_code = 404

class Conflict(AppError):
    status_code = 409

class Invalid(AppError):
    status_code = 422

class Locked(AppError):
    status_code = 423
