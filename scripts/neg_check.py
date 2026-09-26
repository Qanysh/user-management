import json
import urllib.error
import urllib.request
import uuid

BASE = "http://localhost:8080/api"


def req(method, path, body=None, token=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            raw = resp.read().decode() or "{}"
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"raw": raw}
        return exc.code, payload


def expect(label, expected, got, body=None):
    ok = "OK" if expected == got else "FAIL"
    detail = ""
    if isinstance(body, dict) and "detail" in body:
        detail = f" | {body['detail']}"
    print(f"{ok} {label}: expected {expected}, got {got}{detail}")


def main() -> None:
    c, b = req("POST", "/auth/login", {"email": "ivan@example.com", "password": "wrong"})
    expect("bad login", 401, c, b)
    c, b = req("POST", "/auth/login", {"email": "petr@example.com", "password": "password123"})
    expect("inactive login", 401, c, b)
    c, b = req("GET", "/auth/me")
    expect("no token", 401, c, b)
    c, b = req("GET", "/auth/me", token="bad.token")
    expect("bad token", 401, c, b)

    c, login = req("POST", "/auth/login", {"email": "ivan@example.com", "password": "password123"})
    assert c == 200, login
    token = login["access_token"]
    c, me = req("GET", "/auth/me", token=token)
    assert c == 200
    orgs = {m["organization"]["slug"]: m["organization"]["id"] for m in me["memberships"]}
    org_a, org_b, org_c = orgs["company-a"], orgs["company-b"], orgs["company-c"]

    c, roles = req("GET", f"/organizations/{org_a}/roles", token=token)
    emp = next(r["id"] for r in roles if r["code"] == "employee")
    c, branches_b = req("GET", f"/organizations/{org_b}/branches", token=token)
    branch_b = branches_b[0]["id"]
    c, users = req("GET", f"/organizations/{org_a}/users?search=olga@example.com", token=token)
    olga = next(u for u in users["items"] if u["email"] == "olga@example.com")

    c, b = req("GET", "/organizations/00000000-0000-0000-0000-000000000099/users", token=token)
    expect("foreign org", 404, c, b)
    c, b = req(
        "POST",
        f"/organizations/{org_c}/users",
        {"email": "hole@test.com", "full_name": "H", "password": "password123", "role_id": emp},
        token=token,
    )
    expect("employee create", 403, c, b)
    c, b = req("DELETE", f"/organizations/{org_a}/users/{me['id']}", token=token)
    expect("self delete", 400, c, b)
    c, b = req("PATCH", f"/organizations/{org_a}/users/{me['id']}", {"is_active": False}, token=token)
    expect("self deactivate", 400, c, b)
    c, b = req("PATCH", f"/organizations/{org_a}/users/{olga['id']}", {"is_active": False}, token=token)
    expect("multi-org deactivate", 400, c, b)
    c, b = req("PATCH", f"/organizations/{org_a}/users/{olga['id']}", {"branch_id": branch_b}, token=token)
    expect("foreign branch", 400, c, b)
    c, b = req(
        "POST",
        f"/organizations/{org_a}/users",
        {"email": f"brandnew{uuid.uuid4().hex[:8]}@example.com", "full_name": "N", "role_id": emp},
        token=token,
    )
    expect("create no password", 400, c, b)
    c, b = req(
        "POST",
        f"/organizations/{org_a}/users",
        {"email": "ivan@example.com", "full_name": "I", "role_id": emp},
        token=token,
    )
    expect("dup member", 409, c, b)
    c, b = req("GET", f"/organizations/{org_c}/users", token=token)
    expect("employee list", 200, c, b)

    c, slogin = req("POST", "/auth/login", {"email": "sergey@example.com", "password": "password123"})
    st = slogin["access_token"]
    c, sme = req("GET", "/auth/me", token=st)
    sorg = next(m["organization"]["id"] for m in sme["memberships"] if m["organization"]["slug"] == "company-c")
    c, croles = req("GET", f"/organizations/{sorg}/roles", token=st)
    cemp = next(r["id"] for r in croles if r["code"] == "employee")
    c, b = req("PATCH", f"/organizations/{sorg}/users/{sme['id']}", {"role_id": cemp}, token=st)
    expect("last admin demote", 400, c, b)
    c, b = req("PATCH", f"/organizations/{sorg}/users/{sme['id']}", {"is_active": False}, token=st)
    expect("last admin deactivate", 400, c, b)
    print("done")


if __name__ == "__main__":
    main()
