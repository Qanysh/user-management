from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_active: bool


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str


class MembershipOrgOut(BaseModel):
    organization: OrganizationOut
    role: RoleOut
    branch: BranchOut | None
    permissions: list[str]


class MeResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    memberships: list[MembershipOrgOut]


class OrgUserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str | None = None
    is_active: bool
    role: RoleOut
    branch: BranchOut | None
    membership_id: UUID
    joined_at: datetime
    updated_at: datetime | None = None


class OrgUserListResponse(BaseModel):
    items: list[OrgUserOut]
    total: int
    page: int
    page_size: int
    pages: int


class OrgUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role_id: UUID
    branch_id: UUID | None = None
    send_invite: bool = False


class OrgUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    role_id: UUID | None = None
    branch_id: UUID | None = None
    clear_branch: bool = False
    is_active: bool | None = None


class MessageOut(BaseModel):
    detail: str
