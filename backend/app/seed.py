"""
Idempotent demo seed for local / Docker startup.

Password for all demo accounts: password123

Primary login:
  ivan@example.com — Admin in Alpha Soft, Manager in Company B, Operator in Company C
"""

from __future__ import annotations

from sqlalchemy import func, select

from app.auth.security import hash_password
from app.database import SessionLocal
from app.models import (
    Branch,
    Organization,
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
    User,
)

PERMISSIONS = [
    ("users:read", "View organization users"),
    ("users:manage", "Add, update, and remove organization users"),
]

ROLES = [
    ("admin", "Администратор", "Full control within the organization", ["users:read", "users:manage"]),
    ("manager", "Менеджер", "Can view and manage users", ["users:read", "users:manage"]),
    ("employee", "Оператор", "Read-only access to users list", ["users:read"]),
]

# ~40 demo users. role_code / org_keys / branch_key are applied on first create.
# org_keys: "a" | "b" | "c"  branch_key: a_hq | a_spb | b_hq | c_hq | None
DEMO_USERS: list[dict] = [
    {
        "email": "ivan@example.com",
        "full_name": "Иван Петров",
        "phone": "+7 701 111 22 33",
        "memberships": [
            ("a", "admin", "a_hq"),
            ("b", "manager", "b_hq"),
            ("c", "employee", "c_hq"),
        ],
    },
    {
        "email": "anna@example.com",
        "full_name": "Анна Смирнова",
        "phone": "+7 702 222 33 44",
        "memberships": [("b", "admin", "b_hq")],
    },
    {
        "email": "petr@example.com",
        "full_name": "Пётр Иванов",
        "phone": "+7 705 555 66 77",
        "is_active": False,
        "memberships": [("a", "employee", "a_spb")],
    },
    {
        "email": "olga@example.com",
        "full_name": "Ольга Кузнецова",
        "phone": "+7 707 777 88 99",
        "memberships": [("a", "manager", "a_spb"), ("b", "employee", None)],
    },
    {
        "email": "sergey@example.com",
        "full_name": "Сергей Волков",
        "phone": "+7 700 000 11 22",
        "memberships": [("c", "admin", "c_hq")],
    },
]

_EXTRA_NAMES = [
    ("Айгерим Нурланова", "aigerim.nurlanova"),
    ("Данияр Садыков", "daniyar.sadykov"),
    ("Мария Ковалёва", "maria.kovaleva"),
    ("Тимур Абдрахманов", "timur.abdrakhmanov"),
    ("Елена Васильева", "elena.vasileva"),
    ("Нурлан Бекмуханбетов", "nurlan.bek"),
    ("Камила Есенова", "kamila.esenova"),
    ("Алексей Морозов", "alexey.morozov"),
    ("Жанна Токтарова", "zhanna.toktarova"),
    ("Руслан Ибраев", "ruslan.ibraev"),
    ("Виктория Орлова", "victoria.orlova"),
    ("Асхат Жумабаев", "askhat.zhumabaev"),
    ("Диана Серикова", "diana.serikova"),
    ("Максим Лебедев", "maxim.lebedev"),
    ("Сауле Касымова", "saule.kasymova"),
    ("Игорь Соколов", "igor.sokolov"),
    ("Алина Мухамедова", "alina.mukhamedova"),
    ("Ерлан Тулегенов", "erlan.tulegenov"),
    ("Наталья Григорьева", "natalya.grigorieva"),
    ("Бауржан Оспанов", "baurzhan.ospanov"),
    ("Ксения Павлова", "ksenia.pavlova"),
    ("Арман Сейтжанов", "arman.seitzhanov"),
    ("Ирина Фёдорова", "irina.fedorova"),
    ("Даулет Каримов", "daulet.karimov"),
    ("Полина Андреева", "polina.andreeva"),
    ("Меруерт Алиева", "meruert.alieva"),
    ("Никита Егоров", "nikita.egorov"),
    ("Айдана Бекова", "aidana.bekova"),
    ("Владимир Новиков", "vladimir.novikov"),
    ("Гульмира Сатова", "gulmira.satova"),
    ("Артём Крылов", "artem.krylov"),
    ("Зарина Мусина", "zarina.musina"),
    ("Кирилл Борисов", "kirill.borisov"),
    ("Ляззат Омарова", "lyazzat.omarova"),
    ("Павел Дмитриев", "pavel.dmitriev"),
]

_ROLE_CYCLE = ["employee", "employee", "manager", "employee", "employee", "manager", "admin", "employee"]
_BRANCH_CYCLE_A = ["a_hq", "a_spb", "a_hq", "a_spb", None]
_ORG_CYCLE = ["a", "a", "a", "b", "a", "c", "a", "b"]


def _build_extra_users() -> list[dict]:
    extras: list[dict] = []
    for idx, (full_name, local) in enumerate(_EXTRA_NAMES):
        role = _ROLE_CYCLE[idx % len(_ROLE_CYCLE)]
        org = _ORG_CYCLE[idx % len(_ORG_CYCLE)]
        if org == "a":
            branch = _BRANCH_CYCLE_A[idx % len(_BRANCH_CYCLE_A)]
        elif org == "b":
            branch = "b_hq"
        else:
            branch = "c_hq"
        memberships = [(org, role, branch)]
        # Extra orgs only when distinct from the primary (unique user+org constraint)
        if idx % 5 == 0 and org != "b":
            memberships.append(("b", "employee", "b_hq" if idx % 2 == 0 else None))
        if idx % 7 == 0 and org != "c":
            memberships.append(("c", "employee", "c_hq"))
        extras.append(
            {
                "email": f"{local}@example.com",
                "full_name": full_name,
                "phone": f"+7 7{(idx % 9) + 1}0 {100 + idx:03d} {10 + idx:02d} {20 + idx:02d}",
                "is_active": idx not in {4, 11, 22},
                "memberships": memberships,
            }
        )
    return extras


ALL_DEMO_USERS = DEMO_USERS + _build_extra_users()


def _get_or_create_roles(db) -> dict[str, Role]:
    role_map: dict[str, Role] = {}
    existing = {r.code: r for r in db.scalars(select(Role)).all()}
    if existing:
        for code, name, _, _ in ROLES:
            role = existing[code]
            role.name = name
            role_map[code] = role
        return role_map

    perm_map: dict[str, Permission] = {}
    for code, description in PERMISSIONS:
        perm = Permission(code=code, description=description)
        db.add(perm)
        perm_map[code] = perm
    db.flush()

    for code, name, description, perm_codes in ROLES:
        role = Role(code=code, name=name, description=description)
        db.add(role)
        db.flush()
        for pc in perm_codes:
            db.add(RolePermission(role_id=role.id, permission_id=perm_map[pc].id))
        role_map[code] = role
    return role_map


def _get_or_create_orgs(db) -> dict[str, Organization]:
    wanted = {
        "a": ("ТОО Alpha Soft", "company-a"),
        "b": ("Company B", "company-b"),
        "c": ("Company C", "company-c"),
    }
    orgs: dict[str, Organization] = {}
    for key, (name, slug) in wanted.items():
        org = db.scalar(select(Organization).where(Organization.slug == slug))
        if org is None:
            org = Organization(name=name, slug=slug)
            db.add(org)
            db.flush()
        else:
            org.name = name
        orgs[key] = org
    return orgs


def _get_or_create_branches(db, orgs: dict[str, Organization]) -> dict[str, Branch]:
    wanted = {
        "a_hq": (orgs["a"], "Алматы HQ"),
        "a_spb": (orgs["a"], "Астана"),
        "b_hq": (orgs["b"], "HQ Kazan"),
        "c_hq": (orgs["c"], "HQ Novosibirsk"),
    }
    branches: dict[str, Branch] = {}
    for key, (org, name) in wanted.items():
        branch = db.scalar(
            select(Branch).where(Branch.organization_id == org.id, Branch.name == name)
        )
        if branch is None:
            # migrate old names if present
            legacy = {
                "a_hq": "HQ Moscow",
                "a_spb": "Branch Spb",
            }
            if key in legacy:
                branch = db.scalar(
                    select(Branch).where(
                        Branch.organization_id == org.id,
                        Branch.name == legacy[key],
                    )
                )
                if branch is not None:
                    branch.name = name
            if branch is None:
                branch = Branch(organization_id=org.id, name=name)
                db.add(branch)
                db.flush()
        branches[key] = branch
    return branches


def _ensure_user_and_memberships(
    db,
    *,
    password_hash: str,
    spec: dict,
    orgs: dict[str, Organization],
    branches: dict[str, Branch],
    roles: dict[str, Role],
) -> User:
    user = db.scalar(select(User).where(User.email == spec["email"]))
    if user is None:
        user = User(
            email=spec["email"],
            full_name=spec["full_name"],
            phone=spec.get("phone"),
            password_hash=password_hash,
            is_active=spec.get("is_active", True),
        )
        db.add(user)
        db.flush()
    else:
        user.full_name = spec["full_name"]
        if spec.get("phone") and not user.phone:
            user.phone = spec["phone"]
        if "is_active" in spec:
            user.is_active = spec["is_active"]

    seen_orgs: set = set()
    for org_key, role_code, branch_key in spec["memberships"]:
        if org_key in seen_orgs:
            continue
        seen_orgs.add(org_key)
        org = orgs[org_key]
        role = roles[role_code]
        branch_id = branches[branch_key].id if branch_key else None
        membership = db.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.organization_id == org.id,
            )
        )
        if membership is None:
            db.add(
                OrganizationMembership(
                    user_id=user.id,
                    organization_id=org.id,
                    role_id=role.id,
                    branch_id=branch_id,
                    is_active=True,
                )
            )
            db.flush()
        else:
            membership.is_active = True
            membership.role_id = role.id
            membership.branch_id = branch_id
    return user


def seed() -> None:
    db = SessionLocal()
    try:
        roles = _get_or_create_roles(db)
        orgs = _get_or_create_orgs(db)
        branches = _get_or_create_branches(db, orgs)
        password_hash = hash_password("password123")

        for spec in ALL_DEMO_USERS:
            _ensure_user_and_memberships(
                db,
                password_hash=password_hash,
                spec=spec,
                orgs=orgs,
                branches=branches,
                roles=roles,
            )

        db.commit()
        total_users = db.scalar(select(func.count()).select_from(User)) or 0
        total_memberships = db.scalar(select(func.count()).select_from(OrganizationMembership)) or 0
        print(f"Seed completed: {total_users} users, {total_memberships} memberships")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
