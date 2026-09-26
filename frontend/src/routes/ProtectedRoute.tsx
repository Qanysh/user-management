import { useTranslation } from "react-i18next";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute() {
  const { t } = useTranslation();
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-gray-500">
        {t("app.loadingSession")}
      </div>
    );
  }

  if (!me) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
