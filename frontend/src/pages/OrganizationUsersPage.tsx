import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineArrowPath,
  HiOutlineEllipsisVertical,
  HiOutlineFolderOpen,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlineXMark,
} from "react-icons/hi2";

import {
  ApiError,
  createOrgUser,
  deleteOrgUser,
  fetchBranches,
  fetchOrgUsers,
  fetchRoles,
  updateOrgUser,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SelectField } from "../components/SelectField";
import type { Branch, CreateUserPayload, OrgUser, Role, UpdateUserPayload } from "../types";
import { btnGhost, btnPrimary, card, field, iconBtn, rolePill } from "../ui";

type ModalMode = "create" | "edit" | "view" | null;
type ViewTab = "main" | "activity";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function usernameFromEmail(email: string): string {
  return `@${email.split("@")[0] ?? "user"}`;
}

function formatDate(iso: string, lang: string): string {
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-GB" : "ru-RU";
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function OrganizationUsersPage() {
  const { t, i18n } = useTranslation();
  const { me, activeOrgId, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<OrgUser | null>(null);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canManage = hasPermission("users:manage");
  const canRead = hasPermission("users:read");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, roleId, branchId, status, activeOrgId, pageSize]);

  useEffect(() => {
    function onDocClick() {
      setMenuUserId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const rolesQuery = useQuery({
    queryKey: ["roles", activeOrgId],
    queryFn: () => fetchRoles(activeOrgId!),
    enabled: Boolean(activeOrgId) && canRead,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", activeOrgId],
    queryFn: () => fetchBranches(activeOrgId!),
    enabled: Boolean(activeOrgId) && canRead,
  });

  const usersQuery = useQuery({
    queryKey: ["users", activeOrgId, page, pageSize, debouncedSearch, roleId, branchId, status],
    queryFn: () =>
      fetchOrgUsers(activeOrgId!, {
        page,
        pageSize,
        search: debouncedSearch,
        roleId,
        branchId,
        status,
        sortBy: "full_name",
        sortDir: "asc",
      }),
    enabled: Boolean(activeOrgId) && canRead,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteOrgUser(activeOrgId!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users", activeOrgId] });
    },
  });

  const roles = rolesQuery.data ?? [];
  const branches = branchesQuery.data ?? [];
  const list = usersQuery.data;

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setRoleId("");
    setBranchId("");
    setStatus("");
    setPage(1);
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setFormError(null);
    setFormBusy(false);
  }

  async function onDelete(user: OrgUser) {
    if (!window.confirm(t("usersPage.confirmRemove", { name: user.full_name }))) return;
    try {
      await deleteMutation.mutateAsync(user.id);
      setMenuUserId(null);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : t("usersPage.removeFailed"));
    }
  }

  async function handleCreate(payload: CreateUserPayload) {
    setFormBusy(true);
    setFormError(null);
    try {
      await createOrgUser(activeOrgId!, payload);
      await queryClient.invalidateQueries({ queryKey: ["users", activeOrgId] });
      closeModal();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("usersPage.saveFailed"));
      setFormBusy(false);
    }
  }

  async function handleUpdate(userId: string, payload: UpdateUserPayload) {
    setFormBusy(true);
    setFormError(null);
    try {
      await updateOrgUser(activeOrgId!, userId, payload);
      await queryClient.invalidateQueries({ queryKey: ["users", activeOrgId] });
      closeModal();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("usersPage.saveFailed"));
      setFormBusy(false);
    }
  }

  const allChecked = Boolean(list?.items.length) && list!.items.every((u) => selectedIds.has(u.id));
  const rangeFrom = list && list.total ? (list.page - 1) * list.page_size + 1 : 0;
  const rangeTo = list ? Math.min(list.page * list.page_size, list.total) : 0;

  if (!me) {
    return null;
  }

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:gap-4 md:mb-5 md:flex-row md:items-start">
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-bold tracking-tight sm:text-2xl md:text-[1.65rem]">
            {t("usersPage.title")}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-gray-500 md:text-[0.95rem]">
            {t("usersPage.subtitle")}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className={`${btnPrimary} w-full shrink-0 whitespace-nowrap sm:w-auto`}
            onClick={() => {
              setSelected(null);
              setModal("create");
            }}
          >
            {t("usersPage.add")}
          </button>
        )}
      </div>

      {!canRead ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:text-base">
          {t("usersPage.noPermission")}
        </div>
      ) : (
        <>
          <section
            className={`${card} mb-4 grid grid-cols-1 items-stretch gap-3 p-3 sm:grid-cols-2 sm:gap-3.5 sm:p-4 lg:grid-cols-[minmax(200px,1.6fr)_repeat(3,minmax(140px,0.85fr))_auto]`}
          >
            <div className="relative flex min-w-0 items-center sm:col-span-2 lg:col-span-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <HiOutlineMagnifyingGlass size={18} />
              </span>
              <input
                className={`${field} pl-10`}
                placeholder={t("usersPage.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <SelectField value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">{t("usersPage.allRoles")}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
            <SelectField value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t("usersPage.allBranches")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
            <SelectField value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("usersPage.allStatuses")}</option>
              <option value="active">{t("usersPage.statusActive")}</option>
              <option value="inactive">{t("usersPage.statusInactive")}</option>
            </SelectField>
            <button
              type="button"
              className={`${btnGhost} w-full whitespace-nowrap sm:col-span-2 lg:col-span-1 lg:w-auto`}
              onClick={resetFilters}
            >
              <HiOutlineArrowPath size={16} aria-hidden />
              {t("usersPage.reset")}
            </button>
          </section>

          {usersQuery.isLoading && (
            <div className={`${card} grid justify-items-center gap-2 px-4 py-10 text-center sm:px-6 sm:py-12`}>
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-100 border-t-primary" />
              <h3 className="m-0 mt-1.5 text-base font-semibold sm:text-lg">{t("usersPage.loading")}</h3>
              <p className="m-0 text-sm text-gray-500">{t("usersPage.pleaseWait")}</p>
            </div>
          )}

          {usersQuery.isError && (
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong>{t("usersPage.loadFailed")}</strong>
                <p className="m-0 mt-1 text-sm text-red-700">
                  {usersQuery.error instanceof ApiError
                    ? usersQuery.error.message
                    : t("usersPage.loadFailedHint")}
                </p>
              </div>
              <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={() => void usersQuery.refetch()}>
                {t("usersPage.retry")}
              </button>
            </div>
          )}

          {list && list.items.length === 0 && !usersQuery.isLoading && (
            <div className={`${card} grid justify-items-center gap-2 px-4 py-10 text-center sm:px-6 sm:py-12`}>
              <div className="text-gray-400">
                <HiOutlineFolderOpen size={40} />
              </div>
              <h3 className="m-0 mt-1 text-base font-semibold sm:text-lg">{t("usersPage.emptyTitle")}</h3>
              <p className="m-0 text-sm text-gray-500">{t("usersPage.emptyHint")}</p>
              {canManage && (
                <button
                  type="button"
                  className={`${btnPrimary} mt-2 w-full sm:w-auto`}
                  onClick={() => {
                    setSelected(null);
                    setModal("create");
                  }}
                >
                  {t("usersPage.add")}
                </button>
              )}
            </div>
          )}

          {list && list.items.length > 0 && (
            <div className={`${card} overflow-visible`}>
              {/* Mobile cards */}
              <div className="grid gap-3 p-3 md:hidden">
                {list.items.map((user) => (
                  <article
                    key={user.id}
                    className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 border-none bg-transparent p-0 text-left"
                        onClick={() => {
                          setSelected(user);
                          setModal("view");
                        }}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {initials(user.full_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{user.full_name}</span>
                          <span className="block truncate text-sm text-gray-500">{user.email}</span>
                        </span>
                      </button>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-lg text-gray-600 hover:bg-gray-100"
                          aria-label={t("usersPage.actions")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuUserId((id) => (id === user.id ? null : user.id));
                          }}
                        >
                          <HiOutlineEllipsisVertical size={18} />
                        </button>
                        {menuUserId === user.id && (
                          <div
                            className="absolute right-0 top-[calc(100%+4px)] z-40 grid min-w-[160px] rounded-[10px] border border-gray-200 bg-white p-1.5 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="rounded-lg px-3 py-2 text-left hover:bg-gray-100"
                              onClick={() => {
                                setSelected(user);
                                setModal("view");
                                setMenuUserId(null);
                              }}
                            >
                              {t("usersPage.open")}
                            </button>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  className="rounded-lg px-3 py-2 text-left hover:bg-gray-100"
                                  onClick={() => {
                                    setSelected(user);
                                    setModal("edit");
                                    setMenuUserId(null);
                                  }}
                                >
                                  {t("usersPage.edit")}
                                </button>
                                {user.id !== me.id && (
                                  <button
                                    type="button"
                                    className="rounded-lg px-3 py-2 text-left text-red-600 hover:bg-gray-100"
                                    onClick={() => void onDelete(user)}
                                  >
                                    {t("usersPage.remove")}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-400">{t("usersPage.colRole")}</div>
                        <span className={rolePill(user.role.code)}>{user.role.name}</span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">{t("usersPage.colStatus")}</div>
                        <span className="inline-flex items-center gap-2">
                          <i
                            className={`block h-2 w-2 rounded-full ${
                              user.is_active ? "bg-green-600" : "bg-red-600"
                            }`}
                          />
                          {user.is_active ? t("usersPage.statusActive") : t("usersPage.statusInactive")}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400">{t("usersPage.colBranch")}</div>
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <HiOutlineMapPin size={14} className="text-gray-400" />
                          {user.branch?.name ?? t("usersPage.noBranch")}
                        </span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-500">
                        {t("usersPage.colJoined")}: {formatDate(user.joined_at, i18n.language)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-t-xl md:block">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="w-11 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(list.items.map((u) => u.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          aria-label={t("usersPage.selectAll")}
                        />
                      </th>
                      {[
                        t("usersPage.colUser"),
                        t("usersPage.colEmailPhone"),
                        t("usersPage.colRole"),
                        t("usersPage.colBranch"),
                        t("usersPage.colStatus"),
                        t("usersPage.colJoined"),
                        "",
                      ].map((label) => (
                        <th
                          key={label || "actions"}
                          className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((user) => (
                      <tr key={user.id} className="border-t border-gray-100 hover:bg-blue-50/30">
                        <td className="px-4 py-3.5 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(user.id);
                              else next.delete(user.id);
                              setSelectedIds(next);
                            }}
                            aria-label={t("usersPage.selectUser", { name: user.full_name })}
                          />
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <button
                            type="button"
                            className="flex items-center gap-2.5 border-none bg-transparent p-0 text-left"
                            onClick={() => {
                              setSelected(user);
                              setModal("view");
                            }}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {initials(user.full_name)}
                            </span>
                            <span>
                              <span className="block font-semibold">{user.full_name}</span>
                              <span className="block text-sm text-gray-500">
                                {usernameFromEmail(user.email)}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="grid gap-0.5">
                            <span>{user.email}</span>
                            <span className="text-sm text-gray-500">
                              {user.phone || t("usersPage.noBranch")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <span className={rolePill(user.role.code)}>{user.role.name}</span>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <span className="inline-flex items-center gap-1.5 text-gray-700">
                            <HiOutlineMapPin size={14} className="text-gray-400" aria-hidden />
                            {user.branch?.name ?? t("usersPage.noBranch")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <span className="inline-flex items-center gap-2 text-sm">
                            <i
                              className={`block h-2 w-2 rounded-full ${
                                user.is_active ? "bg-green-600" : "bg-red-600"
                              }`}
                            />
                            {user.is_active
                              ? t("usersPage.statusActive")
                              : t("usersPage.statusInactive")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                          {formatDate(user.joined_at, i18n.language)}
                        </td>
                        <td className="relative z-[1] w-12 overflow-visible px-4 py-3.5 align-middle">
                          <div className="relative">
                            <button
                              type="button"
                              className="grid h-8 w-8 place-items-center rounded-lg border-none bg-transparent text-gray-600 hover:bg-gray-100"
                              aria-label={t("usersPage.actions")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuUserId((id) => (id === user.id ? null : user.id));
                              }}
                            >
                              <HiOutlineEllipsisVertical size={18} />
                            </button>
                            {menuUserId === user.id && (
                              <div
                                className="absolute bottom-[calc(100%+6px)] right-0 z-40 grid min-w-[180px] rounded-[10px] border border-gray-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.14)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="rounded-lg border-none bg-transparent px-3 py-2 text-left hover:bg-gray-100"
                                  onClick={() => {
                                    setSelected(user);
                                    setModal("view");
                                    setMenuUserId(null);
                                  }}
                                >
                                  {t("usersPage.open")}
                                </button>
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      className="rounded-lg border-none bg-transparent px-3 py-2 text-left hover:bg-gray-100"
                                      onClick={() => {
                                        setSelected(user);
                                        setModal("edit");
                                        setMenuUserId(null);
                                      }}
                                    >
                                      {t("usersPage.edit")}
                                    </button>
                                    {user.id !== me.id && (
                                      <button
                                        type="button"
                                        className="rounded-lg border-none bg-transparent px-3 py-2 text-left text-red-600 hover:bg-gray-100"
                                        onClick={() => void onDelete(user)}
                                      >
                                        {t("usersPage.remove")}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-200 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3.5">
                <span className="text-center text-sm text-gray-500 sm:text-left">
                  {t("usersPage.showing", { from: rangeFrom, to: rangeTo, total: list.total })}
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
                  <button
                    type="button"
                    className={`${btnGhost} h-9 min-w-9 px-2`}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ‹
                  </button>
                  {Array.from({ length: list.pages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === list.pages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p} className="inline-flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-gray-400">…</span>
                        )}
                        <button
                          type="button"
                          className={`h-[34px] min-w-[34px] rounded-lg border ${
                            p === page
                              ? "border-primary bg-primary text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    type="button"
                    className={`${btnGhost} h-9 min-w-9 px-2`}
                    disabled={page >= list.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    ›
                  </button>
                  <select
                    className="ml-0 h-[34px] w-full rounded-lg border border-gray-200 bg-white px-2 sm:ml-1.5 sm:w-auto"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={10}>{t("usersPage.perPage", { count: 10 })}</option>
                    <option value={20}>{t("usersPage.perPage", { count: 20 })}</option>
                    <option value={50}>{t("usersPage.perPage", { count: 50 })}</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <UserDrawer
          mode={modal}
          user={selected}
          roles={roles}
          branches={branches}
          error={formError}
          busy={formBusy}
          isSelf={Boolean(selected && me && selected.id === me.id)}
          onClose={closeModal}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}    </>
  );
}

type DrawerProps = {
  mode: Exclude<ModalMode, null>;
  user: OrgUser | null;
  roles: Role[];
  branches: Branch[];
  error: string | null;
  busy: boolean;
  isSelf: boolean;
  onClose: () => void;
  onCreate: (payload: CreateUserPayload) => Promise<void>;
  onUpdate: (userId: string, payload: UpdateUserPayload) => Promise<void>;
};

function UserDrawer({
  mode,
  user,
  roles,
  branches,
  error,
  busy,
  isSelf,
  onClose,
  onCreate,
  onUpdate,
}: DrawerProps) {
  const { t, i18n } = useTranslation();
  const defaultRole = roles[0]?.id ?? "";
  const [tab, setTab] = useState<ViewTab>("main");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [roleValue, setRoleValue] = useState(user?.role.id ?? defaultRole);
  const [branchValue, setBranchValue] = useState(user?.branch?.id ?? "");
  const [sendInvite, setSendInvite] = useState(true);
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  useEffect(() => {
    setTab("main");
    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
    setPassword("");
    setRoleValue(user?.role.id ?? defaultRole);
    setBranchValue(user?.branch?.id ?? "");
    setSendInvite(true);
    setIsActive(user?.is_active ?? true);
  }, [user, defaultRole, mode]);

  const title = useMemo(() => {
    if (mode === "create") return t("drawer.addTitle");
    if (mode === "edit") return t("drawer.editTitle");
    return t("drawer.viewTitle");
  }, [mode, t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "view") return;
    if (mode === "create") {
      await onCreate({
        email,
        full_name: fullName,
        phone: phone || null,
        password: password || undefined,
        role_id: roleValue,
        branch_id: branchValue || null,
        send_invite: sendInvite,
      });
      return;
    }
    if (user) {
      await onUpdate(user.id, {
        full_name: fullName,
        phone: phone || null,
        role_id: roleValue,
        clear_branch: !branchValue,
        branch_id: branchValue || null,
        ...(isSelf ? {} : { is_active: isActive }),
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 p-0 sm:p-0"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex h-full w-full max-w-none flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.12)] sm:max-w-[440px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="drawer-title" className="m-0 text-lg font-semibold">
            {title}
          </h2>
          <button type="button" className={iconBtn} onClick={onClose} aria-label={t("drawer.close")}>
            <HiOutlineXMark size={18} />
          </button>
        </div>

        {mode === "view" && user && (
          <div className="grid gap-4 overflow-auto p-5">
            <div className="flex items-center gap-3.5">
              <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                {initials(user.full_name)}
              </span>
              <div>
                <div className="font-semibold">{user.full_name}</div>
                <div className="text-sm text-gray-500">{usernameFromEmail(user.email)}</div>
              </div>
            </div>
            <div className="flex gap-1 border-b border-gray-200">
              <button
                type="button"
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${
                  tab === "main"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500"
                }`}
                onClick={() => setTab("main")}
              >
                {t("drawer.tabMain")}
              </button>
              <button
                type="button"
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${
                  tab === "activity"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500"
                }`}
                onClick={() => setTab("activity")}
              >
                {t("drawer.tabActivity")}
              </button>
            </div>
            {tab === "main" ? (
              <dl className="m-0 grid gap-3.5">
                {(
                  [
                    ["email", user.email],
                    ["phone", user.phone || t("usersPage.noBranch")],
                    ["role", null],
                    ["branch", user.branch?.name ?? t("usersPage.noBranch")],
                    ["joined", formatDate(user.joined_at, i18n.language)],
                    ["status", null],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="grid gap-0.5">
                    <dt className="text-xs text-gray-500">
                      {key === "email"
                        ? t("drawer.email")
                        : key === "phone"
                          ? t("drawer.phone")
                          : key === "role"
                            ? t("drawer.role")
                            : key === "branch"
                              ? t("drawer.branch")
                              : key === "joined"
                                ? t("drawer.joined")
                                : t("drawer.status")}
                    </dt>
                    <dd className="m-0 font-medium">
                      {key === "role" ? (
                        <span className={rolePill(user.role.code)}>{user.role.name}</span>
                      ) : key === "status" ? (
                        <span className="inline-flex items-center gap-2 text-sm">
                          <i
                            className={`block h-2 w-2 rounded-full ${
                              user.is_active ? "bg-green-600" : "bg-red-600"
                            }`}
                          />
                          {user.is_active ? t("usersPage.statusActive") : t("usersPage.statusInactive")}
                        </span>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">{t("drawer.activitySoon")}</p>
            )}
          </div>
        )}

        {mode !== "view" && (
          <form className="grid gap-3.5 overflow-auto p-5" onSubmit={(e) => void onSubmit(e)}>
            {mode === "edit" && user && (
              <div className="mb-1 flex items-center gap-3.5">
                <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                  {initials(user.full_name)}
                </span>
                <div>
                  <div className="font-semibold">{user.full_name}</div>
                  <div className="text-sm text-gray-500">{usernameFromEmail(user.email)}</div>
                </div>
              </div>
            )}

            <label className="grid gap-1.5 text-sm font-semibold">
              {t("drawer.fullName")}
              <input
                className={field}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              {t("drawer.email")}
              <input
                className={field}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={mode === "edit"}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              {t("drawer.phone")}
              <input
                className={field}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("drawer.phonePlaceholder")}
              />
            </label>
            {mode === "create" && (
              <label className="grid gap-1.5 text-sm font-semibold">
                {t("drawer.password")}
                <input
                  className={field}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder={t("drawer.passwordHint")}
                />
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-semibold">
              {t("drawer.role")}
              <SelectField
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value)}
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              {t("drawer.branch")}
              <SelectField
                value={branchValue}
                onChange={(e) => setBranchValue(e.target.value)}
              >
                <option value="">{t("drawer.noBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectField>
            </label>
            {mode === "edit" && (
              <label className="grid gap-1.5 text-sm font-semibold">
                {t("drawer.status")}
                <SelectField
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                  disabled={isSelf}
                  title={isSelf ? t("drawer.cannotDeactivateSelf") : undefined}
                >
                  <option value="active">{t("usersPage.statusActive")}</option>
                  <option value="inactive">{t("usersPage.statusInactive")}</option>
                </SelectField>
              </label>
            )}
            {mode === "create" && (
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                {t("drawer.sendInvite")}
              </label>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mt-1 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={onClose}>
                {t("drawer.cancel")}
              </button>
              <button type="submit" className={btnPrimary} disabled={busy}>
                {busy ? t("drawer.saving") : mode === "create" ? t("drawer.add") : t("drawer.save")}
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
