import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import { useEmergencyStore } from "../store/emergencyStore";

interface Building {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
}

export default function DashboardPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const isEvacuating = useEmergencyStore((s) => s.isEvacuating);
  const activeEmergency = useEmergencyStore((s) => s.activeEmergency);

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const res = await api.get("/buildings");
        setBuildings(res.data.data || []);
      } catch {
        console.error("Failed to fetch buildings");
      } finally {
        setLoading(false);
      }
    }
    fetchBuildings();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Buildings</h2>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
              isEvacuating ? "animate-pulse-fast bg-danger-500 text-white" : "bg-safe-700 text-safe-100"
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${isEvacuating ? "bg-white" : "bg-safe-300"}`} />
            {isEvacuating ? "EMERGENCY ACTIVE" : "All Clear"}
          </div>
        </div>
      </div>

      {/* Emergency Details */}
      {activeEmergency && (
        <div className="mb-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
          <h3 className="mb-2 font-semibold text-danger-300">
            Active Emergency: {activeEmergency.type.toUpperCase()}
          </h3>
          <p className="text-sm text-gray-300">{activeEmergency.description}</p>
          <p className="mt-1 text-xs text-gray-400">
            Severity: {activeEmergency.severity} | Started: {new Date(activeEmergency.startedAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Buildings Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : buildings.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-12 text-center">
          <p className="text-gray-400">No buildings registered yet.</p>
          <p className="mt-1 text-sm text-gray-500">An admin can add buildings through the API.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((building) => (
            <Link
              key={building.id}
              to={`/building/${building.id}`}
              className="group rounded-xl border border-gray-700 bg-gray-800 p-5 transition hover:border-primary-500/50 hover:bg-gray-750"
            >
              <h3 className="text-lg font-semibold text-white group-hover:text-primary-400">
                {building.name}
              </h3>
              <p className="mt-1 text-sm text-gray-400">{building.address}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <span>{building.totalFloors} floors</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
