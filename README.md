# Organization Users Module

Multi-tenant B2B module for managing organization users: list, search, filter, add, update role/branch, remove.

## Quick start (only this)

**Requirement:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
docker compose up --build
```

Then open **http://localhost:8080**

That single command:

1. builds backend + frontend images (all Python/Node dependencies inside),
2. starts PostgreSQL,
3. runs migrations,
4. seeds ~40 demo users,
5. serves the app via nginx on port **8080**.

No local Python, Node, npm, or Postgres install is needed. No `.env` file to create.

### Demo login

| Email | Password | Notes |
|-------|----------|--------|
| `ivan@example.com` | `password123` | Main account — Admin / Manager / Operator across 3 orgs |
| `anna@example.com` | `password123` | Admin in Company B |
| `olga@example.com` | `password123` | Manager + Operator |
| `sergey@example.com` | `password123` | Admin in Company C |
| `petr@example.com` | `password123` | Inactive — login must fail |

Stop: `Ctrl+C`, or in another terminal `docker compose down`.  
Reset DB + re-seed: `docker compose down -v && docker compose up --build`

---

## Stack

| Layer | Choice |
|-------|--------|
| API | FastAPI + SQLAlchemy 2 + Alembic |
| Auth | JWT (Bearer) + org-scoped RBAC |
| DB | PostgreSQL 16 |
| UI | React 18 + TypeScript + Vite + TanStack Query |
| Runtime | Docker Compose + nginx |

**Why FastAPI (not Django):** this assignment is an API-first module with explicit authorization boundaries. FastAPI keeps the surface small, generates OpenAPI docs, and makes dependency-based tenant/permission checks easy to reason about.

## Architecture

### Multi-tenancy

Shared database, row-level isolation via `organization_memberships`.

- Global `User` account (one login for many orgs).
- Role is **not** global — it lives on the membership (`User ↔ Organization`).
- Every `/organizations/{organizationId}/...` route goes through `get_org_auth`:
  - caller must be an **active member** of that org;
  - missing membership → **404** (no existence leak);
  - permission check → **403** when member lacks the required permission.

### RBAC

| Permission | Admin | Manager | Employee |
|------------|-------|---------|----------|
| `users:read` | yes | yes | yes |
| `users:manage` | yes | yes | no |

Checks run in FastAPI dependencies + service layer (last-admin protection, self-removal block, branch belongs to org).

### Data model (essentials)

```
User ──< OrganizationMembership >── Organization
                 │                       │
                 ├── Role (+ Permissions)│
                 └── Branch (optional) ──┘
```

Constraints:

- `UNIQUE(user_id, organization_id)` on memberships
- `UNIQUE(organization_id, name)` on branches
- FK: membership.role → `RESTRICT`, membership.branch → `SET NULL`, org/user deletes cascade memberships

## API

| Method | Path | Permission |
|--------|------|------------|
| POST | `/auth/login` | public |
| GET | `/auth/me` | authenticated |
| GET | `/organizations/{id}/users` | `users:read` |
| POST | `/organizations/{id}/users` | `users:manage` |
| PATCH | `/organizations/{id}/users/{userId}` | `users:manage` |
| DELETE | `/organizations/{id}/users/{userId}` | `users:manage` |
| GET | `/organizations/{id}/roles` | `users:read` |
| GET | `/organizations/{id}/branches` | `users:read` |

List query params: `page`, `page_size`, `search`, `role_id`, `branch_id`, `sort_by`, `sort_dir`, `status`.

Via nginx: `http://localhost:8080/api/...`

## Services after `docker compose up`

| Service | URL |
|---------|-----|
| App (nginx → UI + API) | http://localhost:8080 |
| API (proxied) | http://localhost:8080/api/… |
| Postgres | internal only (`db:5432`, not published to host) |

Nginx proxies `/` → Vite frontend and `/api/` → FastAPI.

> On Windows, host port **80** is often reserved by IIS. This project uses **8080** on purpose.

## Documentation (DOCX)

- `docs/01_Architecture_and_Technical_Overview.docx`
- `docs/02_User_Guide_and_Test_Credentials.docx`

## Local development (optional, not required for review)

Only if you want to run apps outside Docker:

1. `docker compose up db` (Postgres). Temporarily add `"5432:5432"` under `db.ports` if you need host access.
2. Backend: venv + `pip install -r requirements.txt` + alembic + seed + uvicorn.
3. Frontend: `npm install` + `npm run dev` with `VITE_API_URL=http://localhost:8000`.

## Business rules worth noting

- Adding a user by email attaches an existing account or creates a new one (password required only for new accounts).
- Soft-remove: membership `is_active=false` (account remains for other orgs).
- Cannot remove yourself from an organization.
- Cannot demote/remove/deactivate the last remaining admin.
- Cannot deactivate your own account.
- Account deactivation is global — blocked if the user still belongs to other organizations (use remove from org instead).
- Branch must belong to the same organization.
