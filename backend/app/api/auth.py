from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, verify_password
from app.database import get_db
from app.models import OrganizationMembership, Role, User
from app.schemas.users import LoginRequest, MeResponse, MembershipOrgOut, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    memberships = db.scalars(
        select(OrganizationMembership)
        .options(
            joinedload(OrganizationMembership.organization),
            joinedload(OrganizationMembership.role).joinedload(Role.permissions),
            joinedload(OrganizationMembership.branch),
        )
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.is_active.is_(True),
        )
        .order_by(OrganizationMembership.joined_at.asc())
    ).unique().all()

    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        memberships=[
            MembershipOrgOut(
                organization=m.organization,
                role=m.role,
                branch=m.branch,
                permissions=[p.code for p in m.role.permissions],
            )
            for m in memberships
        ],
    )
