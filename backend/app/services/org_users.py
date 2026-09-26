from math import ceil
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.auth.security import hash_password
from app.models import Branch, OrganizationMembership, Role, User
from app.schemas.users import OrgUserCreate, OrgUserOut, OrgUserUpdate


SORTABLE = {
    "full_name": User.full_name,
    "email": User.email,
    "joined_at": OrganizationMembership.joined_at,
}


def _membership_to_out(m: OrganizationMembership) -> OrgUserOut:
    return OrgUserOut(
        id=m.user.id,
        email=m.user.email,
        full_name=m.user.full_name,
        phone=m.user.phone,
        is_active=m.user.is_active and m.is_active,
        role=m.role,
        branch=m.branch,
        membership_id=m.id,
        joined_at=m.joined_at,
        updated_at=m.updated_at,
    )


def _base_query(organization_id: UUID) -> Select:
    return (
        select(OrganizationMembership)
        .join(OrganizationMembership.user)
        .join(OrganizationMembership.role)
        .outerjoin(OrganizationMembership.branch)
        .options(
            joinedload(OrganizationMembership.user),
            joinedload(OrganizationMembership.role),
            joinedload(OrganizationMembership.branch),
        )
        .where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.is_active.is_(True),
        )
    )


def list_org_users(
    db: Session,
    organization_id: UUID,
    *,
    page: int,
    page_size: int,
    search: str | None,
    role_id: UUID | None,
    branch_id: UUID | None,
    status: str | None,
    sort_by: str,
    sort_dir: str,
) -> tuple[list[OrgUserOut], int]:
    query = _base_query(organization_id)

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
            )
        )

    if role_id:
        query = query.where(OrganizationMembership.role_id == role_id)

    if branch_id:
        query = query.where(OrganizationMembership.branch_id == branch_id)

    if status == "active":
        query = query.where(User.is_active.is_(True))
    elif status == "inactive":
        query = query.where(User.is_active.is_(False))

    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0

    sort_col = SORTABLE.get(sort_by, User.full_name)
    order = sort_col.desc() if sort_dir.lower() == "desc" else sort_col.asc()
    rows = db.scalars(
        query.order_by(order).offset((page - 1) * page_size).limit(page_size)
    ).unique().all()

    return [_membership_to_out(m) for m in rows], total


def get_org_user(db: Session, organization_id: UUID, user_id: UUID) -> OrgUserOut:
    membership = db.scalar(
        _base_query(organization_id).where(OrganizationMembership.user_id == user_id)
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in organization")
    return _membership_to_out(membership)


def _validate_role(db: Session, role_id: UUID) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role_id")
    return role


def _validate_branch(db: Session, organization_id: UUID, branch_id: UUID | None) -> Branch | None:
    if branch_id is None:
        return None
    branch = db.get(Branch, branch_id)
    if branch is None or branch.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branch does not belong to this organization",
        )
    if not branch.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Branch is inactive")
    return branch


def add_org_user(db: Session, organization_id: UUID, payload: OrgUserCreate) -> OrgUserOut:
    _validate_role(db, payload.role_id)
    _validate_branch(db, organization_id, payload.branch_id)

    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None:
        if not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="password is required when creating a new user",
            )
        user = User(
            email=payload.email.lower(),
            full_name=payload.full_name.strip(),
            phone=(payload.phone or None),
            password_hash=hash_password(payload.password),
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        if payload.phone and not user.phone:
            user.phone = payload.phone
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account is inactive")

    existing = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == organization_id,
        )
    )
    if existing is not None:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this organization",
            )
        # Re-activate previously removed membership
        existing.is_active = True
        existing.role_id = payload.role_id
        existing.branch_id = payload.branch_id
        db.commit()
        return get_org_user(db, organization_id, user.id)

    membership = OrganizationMembership(
        user_id=user.id,
        organization_id=organization_id,
        role_id=payload.role_id,
        branch_id=payload.branch_id,
        is_active=True,
    )
    db.add(membership)
    db.commit()
    return get_org_user(db, organization_id, user.id)


def update_org_user(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
    payload: OrgUserUpdate,
    *,
    actor_user_id: UUID,
) -> OrgUserOut:
    membership = db.scalar(
        select(OrganizationMembership)
        .options(
            joinedload(OrganizationMembership.user),
            joinedload(OrganizationMembership.role),
            joinedload(OrganizationMembership.branch),
        )
        .where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.is_active.is_(True),
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in organization")

    if payload.full_name is not None:
        membership.user.full_name = payload.full_name.strip()
        if not membership.user.full_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="full_name cannot be empty")

    if payload.phone is not None:
        membership.user.phone = payload.phone.strip() or None

    if payload.is_active is not None and payload.is_active != membership.user.is_active:
        if user_id == actor_user_id and payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account",
            )
        if payload.is_active is False:
            # User.is_active is global — refuse if account is used in other orgs
            other_orgs = db.scalar(
                select(func.count())
                .select_from(OrganizationMembership)
                .where(
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.is_active.is_(True),
                    OrganizationMembership.organization_id != organization_id,
                )
            )
            if other_orgs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "This user belongs to other organizations; "
                        "account deactivation is global. Remove them from this organization instead."
                    ),
                )
            if membership.role.code == "admin":
                _ensure_another_admin(db, organization_id, exclude_user_id=user_id)
        membership.user.is_active = payload.is_active

    if payload.role_id is not None:
        new_role = _validate_role(db, payload.role_id)
        # Prevent demoting the last active admin
        if membership.role.code == "admin" and new_role.code != "admin":
            _ensure_another_admin(db, organization_id, exclude_user_id=user_id)
        membership.role_id = payload.role_id

    if payload.clear_branch:
        membership.branch_id = None
    elif payload.branch_id is not None:
        _validate_branch(db, organization_id, payload.branch_id)
        membership.branch_id = payload.branch_id

    db.commit()
    return get_org_user(db, organization_id, user_id)


def remove_org_user(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
    *,
    actor_user_id: UUID,
) -> None:
    if user_id == actor_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself from the organization",
        )

    membership = db.scalar(
        select(OrganizationMembership)
        .options(joinedload(OrganizationMembership.role))
        .where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.is_active.is_(True),
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in organization")

    if membership.role.code == "admin":
        _ensure_another_admin(db, organization_id, exclude_user_id=user_id)

    membership.is_active = False
    membership.branch_id = None
    db.commit()


def _ensure_another_admin(db: Session, organization_id: UUID, exclude_user_id: UUID) -> None:
    """Require at least one other admin with an active account and active membership."""
    admin_role = db.scalar(select(Role).where(Role.code == "admin"))
    if admin_role is None:
        return
    count = db.scalar(
        select(func.count())
        .select_from(OrganizationMembership)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.role_id == admin_role.id,
            OrganizationMembership.is_active.is_(True),
            User.is_active.is_(True),
            OrganizationMembership.user_id != exclude_user_id,
        )
    )
    if not count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove or demote the last organization admin",
        )


def pages_count(total: int, page_size: int) -> int:
    return ceil(total / page_size) if total else 0
