import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BuildingViewPage from "./pages/BuildingViewPage";
import Layout from "./components/Layout";
import Login from "./pages/auth/Login";
import ProtectedRoute from "./pages/auth/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import BuildingManager from "./pages/admin/BuildingManager";
import FloorPlanUploader from "./pages/admin/FloorPlanUploader";
import ExitEditor from "./pages/admin/ExitEditor";
import WaypointEditor from "./pages/admin/WaypointEditor";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<Login />} />

      {/* Student/Staff routes */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="building/:id" element={<BuildingViewPage />} />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/buildings" replace />} />
        <Route path="buildings" element={<BuildingManager />} />
        <Route path="floors" element={<FloorPlanUploader />} />
        <Route path="exits" element={<ExitEditor />} />
        <Route path="waypoints" element={<WaypointEditor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
