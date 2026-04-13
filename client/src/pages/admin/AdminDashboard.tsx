import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { buildingsApi } from "../../api/buildings.api";

interface Stats {
  buildings: number;
  floors: number;
  exits: number;
}

const NAV_ITEMS = [
  { to: "/admin/buildings", label: "Buildings", icon: BuildingIcon },
  { to: "/admin/floors", label: "Floor Plans", icon: FloorIcon },
  { to: "/admin/exits", label: "Exits", icon: ExitIcon },
];

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ buildings: 0, floors: 0, exits: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await buildingsApi.list();
        const buildings = res.data.data || [];
        setStats({
          buildings: buildings.length,
          floors: buildings.reduce((sum, b) => sum + b.totalFloors, 0),
          exits: 0,
        });
      } catch {
        // Stats are non-critical
      }
    }
    fetchStats();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-gray-800 bg-gray-900">
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
            UE
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Admin Panel</div>
            <div className="text-[10px] text-gray-500">Evacuation System</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px border-b border-gray-800 bg-gray-800">
          {[
            { label: "Buildings", value: stats.buildings },
            { label: "Floors", value: stats.floors },
            { label: "Exits", value: stats.exits },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 px-3 py-3 text-center">
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-[10px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-600/10 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="mb-2 text-xs text-gray-500">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-gray-800 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-700 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

/* ── Icon Components ── */

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      <path d="M9 9h1M9 13h1M9 17h1" />
    </svg>
  );
}

function FloorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}
