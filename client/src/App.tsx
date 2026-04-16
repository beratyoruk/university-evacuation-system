import { Routes, Route, Navigate } from "react-router-dom";
import EvacuationView from "./pages/user/EvacuationView";
import LoginPage from "./pages/LoginPage";
import Login from "./pages/auth/Login";
import ProtectedRoute from "./pages/auth/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import BuildingManager from "./pages/admin/BuildingManager";
import FloorPlanUploader from "./pages/admin/FloorPlanUploader";
import ExitEditor from "./pages/admin/ExitEditor";
import WaypointEditor from "./pages/admin/WaypointEditor";
import WidgetBuilder from "./pages/admin/WidgetBuilder";

/**
 * App router.
 *
 * Public user path:
 *   /                        → EvacuationView (no login required)
 *   /?building=xxx&floor=yyy → deep-linked building/floor
 *
 * Auth paths:
 *   /login        → legacy student/staff login (optional)
 *   /admin/login  → admin login
 *
 * Admin paths (guarded):
 *   /admin              → redirect to /admin/buildings
 *   /admin/buildings    → BuildingManager
 *   /admin/floors       → FloorPlanUploader
 *   /admin/exits        → ExitEditor
 *   /admin/waypoints    → WaypointEditor
 */
export default function App() {
  return (
    <Routes>
      {/* Public evacuation view — default route, no auth required */}
      <Route path="/" element={<EvacuationView />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<Login />} />

      {/* Admin */}
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
        <Route path="widget" element={<WidgetBuilder />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
