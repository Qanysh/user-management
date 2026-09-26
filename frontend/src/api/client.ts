import type {
  Branch,
  CreateUserPayload,
  Me,
  OrgUser,
  OrgUserList,
  Role,
  UpdateUserPayload,
  UserListParams,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("access_token", token);
  } else {
    localStorage.removeItem("access_token");
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail = "Ошибка запроса";
    try {
      const body = (await response.json()) as { detail?: string | { msg: string }[] };
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        detail = body.detail[0].msg;
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data.access_token;
}

export async function fetchMe(): Promise<Me> {
  return request<Me>("/auth/me");
}

export async function fetchRoles(organizationId: string): Promise<Role[]> {
  return request<Role[]>(`/organizations/${organizationId}/roles`);
}

export async function fetchBranches(organizationId: string): Promise<Branch[]> {
  return request<Branch[]>(`/organizations/${organizationId}/branches`);
}

export async function fetchOrgUsers(
  organizationId: string,
  params: UserListParams,
): Promise<OrgUserList> {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    sort_by: params.sortBy,
    sort_dir: params.sortDir,
  });
  if (params.search.trim()) qs.set("search", params.search.trim());
  if (params.roleId) qs.set("role_id", params.roleId);
  if (params.branchId) qs.set("branch_id", params.branchId);
  if (params.status) qs.set("status", params.status);
  return request<OrgUserList>(`/organizations/${organizationId}/users?${qs}`);
}

export async function fetchOrgUser(organizationId: string, userId: string): Promise<OrgUser> {
  return request<OrgUser>(`/organizations/${organizationId}/users/${userId}`);
}

export async function createOrgUser(
  organizationId: string,
  payload: CreateUserPayload,
): Promise<OrgUser> {
  return request<OrgUser>(`/organizations/${organizationId}/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrgUser(
  organizationId: string,
  userId: string,
  payload: UpdateUserPayload,
): Promise<OrgUser> {
  return request<OrgUser>(`/organizations/${organizationId}/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteOrgUser(organizationId: string, userId: string): Promise<void> {
  await request<{ detail: string }>(`/organizations/${organizationId}/users/${userId}`, {
    method: "DELETE",
  });
}
