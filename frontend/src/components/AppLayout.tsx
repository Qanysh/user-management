import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBell,
  HiOutlineCog6Tooth,
  HiOutlineCube,
  HiOutlineHome,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineUsers,
} from "react-icons/hi2";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "../i18n/LanguageSwitcher";
import { iconBtn } from "../ui";
import { SelectField } from "./SelectField";

const NOTIFICATION_IDS = ["1", "2", "3", "4"] as const;

const NAV_ITEMS = [
  { to: "/home", titleKey: "app.home", icon: HiOutlineHome },
  { to: "/organizations", titleKey: "app.organizations", icon: HiOutlineSquares2X2 },
  { to: "/users", titleKey: "app.users", icon: HiOutlineUsers },
  { to: "/branches", titleKey: "app.branches", icon: HiOutlineMapPin },
  { to: "/roles", titleKey: "app.rolesRights", icon: HiOutlineShieldCheck },
  { to: "/settings", titleKey: "app.settings", icon: HiOutlineCog6Tooth },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const navItem =
  "grid h-10 w-10 place-items-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 sm:h-11 sm:w-11";
const navActive = "bg-blue-50 text-primary hover:bg-blue-50 hover:text-primary";

function navClassName({ isActive }: { isActive: boolean }) {
  return `${navItem}${isActive ? ` ${navActive}` : ""}`;
}

export function AppLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { me, logout, activeOrgId, activeMembership, setActiveOrgId } = useAuth();

  const currentNav =
    NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ??
    NAV_ITEMS.find((item) => item.to === "/users")!;

  const navLinks = (
    <>
      {NAV_ITEMS.map(({ to, titleKey, icon: Icon }) => (
        <NavLink key={to} to={to} className={navClassName} title={t(titleKey)} end>
          <Icon size={20} />
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[72px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-20 hidden h-dvh flex-col items-center gap-5 border-r border-gray-200 bg-white py-4 md:flex">
        <div className="grid h-10 w-10 place-items-center">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <HiOutlineCube size={18} />
          </span>
        </div>
        <nav className="flex w-full flex-col items-center gap-1" aria-label={t("app.name")}>
          {navLinks}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex flex-col gap-2 px-3 py-2.5 sm:px-4 md:h-16 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-0">
            <div className="flex min-w-0 items-center justify-between gap-3 md:justify-start">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white md:hidden">
                  <HiOutlineCube size={16} />
                </span>
                <div className="flex min-w-0 items-center gap-1 text-xs text-gray-500 sm:gap-1.5 sm:text-sm">
                  <span className="truncate">{t("app.organizations")}</span>
                  <span className="text-gray-300">›</span>
                  <strong className="truncate text-gray-800">{t(currentNav.titleKey)}</strong>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 md:hidden">
                <NotificationsMenu />
                <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {initials(me?.full_name ?? "?")}
                </div>
                <button
                  type="button"
                  className={`${iconBtn} h-9 w-9 text-red-500 hover:bg-red-50 hover:text-red-600`}
                  onClick={logout}
                  aria-label={t("app.signOut")}
                  title={t("app.signOut")}
                >
                  <HiOutlineArrowRightOnRectangle size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end md:gap-3">
              <div className="min-w-0 flex-1 md:w-[200px] md:flex-none lg:w-[220px]">
                <SelectField
                  className="h-9 text-sm font-medium"
                  value={activeOrgId ?? ""}
                  onChange={(e) => setActiveOrgId(e.target.value)}
                  aria-label={t("app.organizations")}
                >
                  {me?.memberships.map((m) => (
                    <option key={m.organization.id} value={m.organization.id}>
                      {m.organization.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <LanguageSwitcher className="shrink-0" />

              <div className="hidden items-center gap-2.5 md:flex">
                <NotificationsMenu />
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {initials(me?.full_name ?? "?")}
                </div>
                <div className="hidden leading-tight lg:block">
                  <div className="text-sm font-semibold">{me?.full_name}</div>
                  <div className="text-xs text-gray-500">{activeMembership?.role.name ?? "—"}</div>
                </div>
                <button
                  type="button"
                  className={`${iconBtn} h-10 w-10 text-red-500 hover:bg-red-50 hover:text-red-600`}
                  onClick={logout}
                  aria-label={t("app.signOut")}
                  title={t("app.signOut")}
                >
                  <HiOutlineArrowRightOnRectangle size={20} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-gray-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden"
        aria-label={t("app.name")}
      >
        {navLinks}
      </nav>
    </div>
  );
}

function NotificationsMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<Record<string, boolean>>({
    "1": true,
    "2": true,
    "3": true,
    "4": false,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const unreadCount = Object.values(unread).filter(Boolean).length;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function markAllRead() {
    setUnread({ "1": false, "2": false, "3": false, "4": false });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`${iconBtn} h-9 w-9 sm:h-10 sm:w-10${open ? " border-amber-400 bg-amber-50" : ""}`}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <HiOutlineBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[min(70dvh,480px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_16px_40px_rgba(16,24,40,0.14)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[min(360px,calc(100vw-2rem))]"
          role="dialog"
          aria-label={t("notifications.title")}
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3.5">
            <div>
              <strong className="block text-sm">{t("notifications.title")}</strong>
              {unreadCount > 0 && (
                <span className="mt-0.5 inline-block text-xs font-semibold text-primary">
                  {t("notifications.newCount", { count: unreadCount })}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button type="button" className="text-sm text-primary hover:underline" onClick={markAllRead}>
                {t("notifications.markAll")}
              </button>
            )}
          </div>
          <ul className="m-0 max-h-[min(50dvh,340px)] list-none overflow-auto p-0">
            {NOTIFICATION_IDS.map((id) => (
              <li
                key={id}
                className={`grid grid-cols-[10px_1fr] gap-3 border-b border-gray-100 px-4 py-3.5 last:border-b-0 ${
                  unread[id] ? "bg-blue-50/40" : ""
                }`}
              >
                <div
                  className={`mt-1.5 h-2 w-2 rounded-full ${unread[id] ? "bg-primary" : "bg-transparent"}`}
                  aria-hidden
                />
                <div>
                  <div className="text-sm font-bold">{t(`notifications.items.${id}.title`)}</div>
                  <div className="mt-0.5 text-sm leading-snug text-gray-600">
                    {t(`notifications.items.${id}.body`)}
                  </div>
                  <div className="mt-1.5 text-xs text-gray-400">
                    {t(`notifications.items.${id}.time`)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="text-xs text-gray-500">{t("notifications.demoFooter")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
