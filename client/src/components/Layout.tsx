import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useEmergencyStore } from "../store/emergencyStore";
import { useSocket } from "../hooks/useSocket";

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isEvacuating = useEmergencyStore((s) => s.isEvacuating);
  const navigate = useNavigate();

  // Initialize WebSocket connection
  useSocket();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Emergency Banner */}
      {isEvacuating && (
        <div className="animate-alert-blink bg-danger-500 px-4 py-2 text-center font-bold text-white">
          EMERGENCY EVACUATION IN PROGRESS - FOLLOW THE INDICATED ROUTES
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold">
            UE
          </div>
          <h1 className="text-lg font-semibold text-white">University Evacuation System</h1>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {user?.name} ({user?.role})
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-600"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
}
