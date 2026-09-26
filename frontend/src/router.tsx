import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { OrganizationUsersPage } from "./pages/OrganizationUsersPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/users" replace />} />
          <Route path="home" element={<PlaceholderPage titleKey="app.home" />} />
          <Route
            path="organizations"
            element={<PlaceholderPage titleKey="app.organizations" />}
          />
          <Route path="users" element={<OrganizationUsersPage />} />
          <Route path="branches" element={<PlaceholderPage titleKey="app.branches" />} />
          <Route path="roles" element={<PlaceholderPage titleKey="app.rolesRights" />} />
          <Route path="settings" element={<PlaceholderPage titleKey="app.settings" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/users" replace />} />
    </Routes>
  );
}
