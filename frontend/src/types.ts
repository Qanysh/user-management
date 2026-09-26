export type Role = {
  id: string;
  code: string;
  name: string;
};

export type Branch = {
  id: string;
  name: string;
  is_active: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type Membership = {
  organization: Organization;
  role: Role;
  branch: Branch | null;
  permissions: string[];
};

export type Me = {
  id: string;
  email: string;
  full_name: string;
  memberships: Membership[];
};

export type OrgUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  role: Role;
  branch: Branch | null;
  membership_id: string;
  joined_at: string;
  updated_at?: string | null;
};

export type OrgUserList = {
  items: OrgUser[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type UserListParams = {
  page: number;
  pageSize: number;
  search: string;
  roleId: string;
  branchId: string;
  status: string;
  sortBy: "full_name" | "email" | "joined_at";
  sortDir: "asc" | "desc";
};

export type CreateUserPayload = {
  email: string;
  full_name: string;
  phone?: string | null;
  password?: string;
  role_id: string;
  branch_id?: string | null;
  send_invite?: boolean;
};

export type UpdateUserPayload = {
  full_name?: string;
  phone?: string | null;
  role_id?: string;
  branch_id?: string | null;
  clear_branch?: boolean;
  is_active?: boolean;
};
