from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.enums import Role


class PasswordRules(BaseModel):
    @staticmethod
    def check(value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password minimal 8 karakter")
        if len(value.encode()) > 72:
            raise ValueError("Password maksimal 72 byte")
        return value


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str
    password_confirmation: str
    phone: str | None = Field(default=None, max_length=20)

    _pw = field_validator("password")(PasswordRules.check)

    @model_validator(mode="after")
    def _confirm(self):
        if self.password != self.password_confirmation:
            raise ValueError("Konfirmasi password tidak cocok")
        return self


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class EmailIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    new_password: str
    password_confirmation: str

    _pw = field_validator("new_password")(PasswordRules.check)

    @model_validator(mode="after")
    def _confirm(self):
        if self.new_password != self.password_confirmation:
            raise ValueError("Konfirmasi password tidak cocok")
        return self


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str
    password_confirmation: str

    _pw = field_validator("new_password")(PasswordRules.check)

    @model_validator(mode="after")
    def _confirm(self):
        if self.new_password != self.password_confirmation:
            raise ValueError("Konfirmasi password tidak cocok")
        return self


class EmailChangeIn(BaseModel):
    new_email: EmailStr
    password: str


class ProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    company: str | None = Field(default=None, max_length=100)
    photo_url: str | None = Field(default=None, max_length=500)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    phone: str | None = None
    company: str | None = None
    photo_url: str | None = None
    role: Role
    role_name: str
    is_verified: bool
    must_change_password: bool
    building_ids: list[int] = []
    permissions: list[str] = []


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    must_change_password: bool
    landing: str
    user: UserOut


class StaffCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: Role
    building_ids: list[int] = []


class StaffUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    role: Role | None = None
    building_ids: list[int] | None = None


class MessageOut(BaseModel):
    message: str
