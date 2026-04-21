import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../utils/api";
import { useAppStore } from "../store/useAppStore";
import { useEmergencyStore } from "../store/emergencyStore";
import { useFloorPlan } from "../hooks/useFloorPlan";
import { useLocation } from "../hooks/useLocation";
import { useRoute } from "../hooks/useRoute";
import FloorViewer from "../components/FloorViewer/FloorViewer";
import FloorSelector from "../components/FloorViewer/FloorSelector";
import { computePlanBounds } from "../utils/planBounds";
import type { BuildingOrigin } from "../utils/coordinates";

interface Building {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalFloors: number;
}

interface Floor {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  width: number;
  height: number;
}

export default function BuildingViewPage() {
  const { id } = useParams<{ id: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);

  const floors = useAppStore((s) => s.floors);
  const currentFloor = useAppStore((s) => s.currentFloor);
  const userLocation = useAppStore((s) => s.userLocation);
  const evacuationRoute = useAppStore((s) => s.evacuationRoute);
  const emergencyMode = useAppStore((s) => s.emergencyMode);
  const setFloors = useAppStore((s) => s.setFloors);
  const setCurrentFloor = useAppStore((s) => s.setCurrentFloor);
  const setCurrentBuilding = useAppStore((s) => s.setCurrentBuilding);
  const setEmergencyMode = useAppStore((s) => s.setEmergencyMode);

  const isEvacuating = useEmergencyStore((s) => s.isEvacuating);

  // Sync emergency store → app store
  useEffect(() => {
    setEmergencyMode(isEvacuating);
  }, [isEvacuating, setEmergencyMode]);

  // Fetch building and floors
  useEffect(() => {
    async function fetchData() {
      try {
        const [buildingRes, floorsRes] = await Promise.all([
          api.get(`/buildings/${id}`),
          api.get(`/buildings/${id}/floors`),
        ]);
        const b = buildingRes.data.data as Building;
        const floorList = (floorsRes.data.data || []) as Floor[];

        setBuilding(b);
        setCurrentBuilding({
          id: b.id,
          name: b.name,
          address: b.address,
          latitude: b.latitude,
          longitude: b.longitude,
          totalFloors: b.totalFloors,
        });
        setFloors(
          floorList.map((f) => ({
            id: f.id,
            buildingId: f.buildingId,
            floorNumber: f.floorNumber,
            name: f.name,
            width: f.width,
            height: f.height,
          }))
        );
        if (floorList.length > 0) {
          setCurrentFloor(floorList[0]);
        }
      } catch {
        console.error("Failed to fetch building data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, setCurrentBuilding, setFloors, setCurrentFloor]);

  // Floor plan data
  const { planData, loading: planLoading } = useFloorPlan(
    currentFloor?.id ?? null
  );

  // Building origin for GPS conversion
  const buildingOrigin: BuildingOrigin | null = building
    ? { latitude: building.latitude, longitude: building.longitude, rotation: 0 }
    : null;

  // Effective floor dimensions (fall back to plan bounds when missing)
  const floorDims = (() => {
    const w = currentFloor?.width;
    const h = currentFloor?.height;
    if (Number.isFinite(w) && w! > 0 && Number.isFinite(h) && h! > 0) {
      return { width: w!, height: h! };
    }
    const b = computePlanBounds(planData);
    if (b.width > 0 && b.height > 0) return { width: b.width, height: b.height };
    return { width: 60, height: 30 };
  })();

  // Location tracking
  useLocation(buildingOrigin, currentFloor?.id ?? null, floorDims);

  // Route calculation
  useRoute(building?.id ?? null);

  // Auto-select user's floor when location updates
  useEffect(() => {
    if (!userLocation) return;
    const userFloor = floors.find((f) => f.id === userLocation.floorId);
    if (userFloor && userFloor.id !== currentFloor?.id) {
      setCurrentFloor(userFloor);
    }
  }, [userLocation?.floorId, floors, currentFloor?.id, setCurrentFloor]);

  const handleSelectFloor = (floorId: string) => {
    const floor = floors.find((f) => f.id === floorId);
    if (floor) setCurrentFloor(floor);
  };

  const userPos =
    userLocation && currentFloor && userLocation.floorId === currentFloor.id
      ? { x: userLocation.x, y: userLocation.y }
      : null;

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

        {emergencyMode && (
          <div className="flex items-center gap-2 rounded-lg bg-red-900/60 px-4 py-1.5 text-sm font-semibold text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            EMERGENCY ACTIVE
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Floor Selector (side panel) */}
        <FloorSelector
          floors={floors}
          selectedFloorId={currentFloor?.id ?? null}
          onSelectFloor={handleSelectFloor}
        />

        {/* 3D Viewer */}
        <div className="relative flex-1">
          {currentFloor ? (
            <>
              {planLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/70">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                </div>
              )}
              <FloorViewer
                planData={planData}
                route={evacuationRoute}
                userPosition={userPos}
                emergencyMode={emergencyMode}
                width={floorDims.width}
                height={floorDims.height}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-400">No floors available for this building</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-gray-700 bg-gray-800/50 px-6 py-2 text-xs text-gray-400">
        <span>
          {currentFloor
            ? `${currentFloor.name} - ${floorDims.width.toFixed(0)}m x ${floorDims.height.toFixed(0)}m`
            : "No floor selected"}
        </span>
        <div className="flex items-center gap-4">
          {userPos && (
            <span>
              Position: ({userPos.x.toFixed(1)}, {userPos.y.toFixed(1)})
            </span>
          )}
          <span>
            {emergencyMode
              ? "EVACUATION IN PROGRESS"
              : "No active emergencies"}
          </span>
        </div>
      </div>
    </div>
  );
}
