from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.security import decode_access_token
from app.database import get_db
from app.models import OrganizationMembership, Role, User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    membership: OrganizationMembership | None = None

    @property
    def permissions(self) -> set[str]:
        if not self.membership:
            return set()
        return {p.code for p in self.membership.role.permissions}

    def require_permission(self, code: str) -> None:
        if code not in self.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {code}",
            )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or not found",
        )
    return user


def get_org_auth(
    organization_id: UUID = Path(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthContext:
    """
    Tenant gate: caller must be an active member of the organization in the path.
    Returns 404 (not 403) for foreign orgs to avoid leaking existence.
    """
    membership = db.scalar(
        select(OrganizationMembership)
        .options(
            joinedload(OrganizationMembership.role).joinedload(Role.permissions),
            joinedload(OrganizationMembership.branch),
            joinedload(OrganizationMembership.organization),
        )
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.is_active.is_(True),
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    return AuthContext(user=user, membership=membership)
