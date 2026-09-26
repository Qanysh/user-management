import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "../i18n/LanguageSwitcher";
import { btnPrimary, field } from "../ui";

export function LoginPage() {
  const { t } = useTranslation();
  const { me, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && me) {
    return <Navigate to="/users" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.12),transparent_40%),#f3f5f9] p-4 sm:p-6">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
        <form
          className="grid w-full gap-3.5 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)] sm:p-7"
          onSubmit={(e) => void onSubmit(e)}
        >
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-primary">{t("app.name")}</p>
          <h1 className="m-0 text-2xl font-bold tracking-tight">{t("login.title")}</h1>
          <p className="m-0 text-sm text-gray-500">{t("login.subtitle")}</p>

          <label className="grid gap-1.5 text-sm font-semibold">
            {t("login.email")}
            <input
              className={field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            {t("login.password")}
            <input
              className={field}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <LanguageSwitcher />
      </div>
    </div>
  );
}
