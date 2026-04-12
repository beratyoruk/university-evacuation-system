import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../utils/api";
import { useEmergencyStore } from "../store/emergencyStore";
import FloorPlanViewer from "../components/FloorPlanViewer";

interface Building {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
}

interface Floor {
  id: string;
  floorNumber: number;
  name: string;
  width: number;
  height: number;
}

export default function BuildingViewPage() {
  const { id } = useParams<{ id: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);

  const isEvacuating = useEmergencyStore((s) => s.isEvacuating);
  const routes = useEmergencyStore((s) => s.routes);

  useEffect(() => {
    async function fetchData() {
      try {
        const [buildingRes, floorsRes] = await Promise.all([
          api.get(`/buildings/${id}`),
          api.get(`/buildings/${id}/floors`),
        ]);
        setBuilding(buildingRes.data.data);
        const floorList = floorsRes.data.data || [];
        setFloors(floorList);
        if (floorList.length > 0) setSelectedFloor(floorList[0]);
      } catch {
        console.error("Failed to fetch building data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const floorRoutes = selectedFloor
    ? routes.filter((r) => r.floorId === selectedFloor.id)
    : [];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!building) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Building not found</p>
        <Link to="/" className="text-primary-400 hover:text-primary-300">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Building Header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800/50 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white">
            &larr; Back
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-white">{building.name}</h2>
            <p className="text-xs text-gray-400">{building.address}</p>
          </div>
        </div>

        {/* Floor Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Floor:</span>
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => setSelectedFloor(floor)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selectedFloor?.id === floor.id
                  ? "bg-primary-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1">
        {selectedFloor ? (
          <FloorPlanViewer
            nodes={[]}
            routes={floorRoutes}
            isEmergency={isEvacuating}
            width={selectedFloor.width}
            height={selectedFloor.height}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-400">No floors available for this building</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-gray-700 bg-gray-800/50 px-6 py-2 text-xs text-gray-400">
        <span>
          {selectedFloor
            ? `${selectedFloor.name} - ${selectedFloor.width}m x ${selectedFloor.height}m`
            : "No floor selected"}
        </span>
        <span>
          {isEvacuating
            ? `${floorRoutes.length} evacuation route(s) active`
            : "No active emergencies"}
        </span>
      </div>
    </div>
  );
}
