from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import AuthContext, get_org_auth
from app.database import get_db
from app.models import Branch, Role
from app.schemas.users import (
    BranchOut,
    MessageOut,
    OrgUserCreate,
    OrgUserListResponse,
    OrgUserOut,
    OrgUserUpdate,
    RoleOut,
)
from app.services import org_users as service

router = APIRouter(prefix="/organizations/{organization_id}", tags=["organization-users"])

PERM_READ = "users:read"
PERM_MANAGE = "users:manage"


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
) -> list[Role]:
    auth.require_permission(PERM_READ)
    return list(db.scalars(select(Role).order_by(Role.name.asc())).all())


@router.get("/branches", response_model=list[BranchOut])
def list_branches(
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
) -> list[Branch]:
    auth.require_permission(PERM_READ)
    assert auth.membership is not None
    return list(
        db.scalars(
            select(Branch)
            .where(
                Branch.organization_id == auth.membership.organization_id,
                Branch.is_active.is_(True),
            )
            .order_by(Branch.name.asc())
        ).all()
    )


@router.get("/users", response_model=OrgUserListResponse)
def list_users(
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    role_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = Query(None, pattern="^(active|inactive)$"),
    sort_by: str = Query("full_name", pattern="^(full_name|email|joined_at)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
) -> OrgUserListResponse:
    auth.require_permission(PERM_READ)
    assert auth.membership is not None
    items, total = service.list_org_users(
        db,
        auth.membership.organization_id,
        page=page,
        page_size=page_size,
        search=search,
        role_id=role_id,
        branch_id=branch_id,
        status=status,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return OrgUserListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if total else 0,
    )


@router.get("/users/{user_id}", response_model=OrgUserOut)
def get_user(
    user_id: UUID,
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
) -> OrgUserOut:
    auth.require_permission(PERM_READ)
    assert auth.membership is not None
    return service.get_org_user(db, auth.membership.organization_id, user_id)


@router.post("/users", response_model=OrgUserOut, status_code=201)
def create_user(
    payload: OrgUserCreate,
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
) -> OrgUserOut:
    auth.require_permission(PERM_MANAGE)
    assert auth.membership is not None
    return service.add_org_user(db, auth.membership.organization_id, payload)


@router.patch("/users/{user_id}", response_model=OrgUserOut)
def update_user(
    user_id: UUID,
    payload: OrgUserUpdate,
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
) -> OrgUserOut:
    auth.require_permission(PERM_MANAGE)
    assert auth.membership is not None
    return service.update_org_user(
        db,
        auth.membership.organization_id,
        user_id,
        payload,
        actor_user_id=auth.user.id,
    )


@router.delete("/users/{user_id}", response_model=MessageOut)
def delete_user(
    user_id: UUID,
    auth: AuthContext = Depends(get_org_auth),
    db: Session = Depends(get_db),
) -> MessageOut:
    auth.require_permission(PERM_MANAGE)
    assert auth.membership is not None
    service.remove_org_user(
        db,
        auth.membership.organization_id,
        user_id,
        actor_user_id=auth.user.id,
    )
    return MessageOut(detail="User removed from organization")
