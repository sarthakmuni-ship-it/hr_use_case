from typing import Literal

from pydantic import BaseModel, EmailStr

class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Literal["admin", "user"] = "user"


class UserUpdateRequest(BaseModel):
    role: Literal["admin", "user"] | None = None
    is_active: bool | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    is_active: bool
    role: str

    model_config = {
        "from_attributes": True,
    }