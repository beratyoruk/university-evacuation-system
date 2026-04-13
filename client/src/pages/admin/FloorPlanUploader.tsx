import { useState, useEffect, useCallback } from "react";
import { buildingsApi, type Building } from "../../api/buildings.api";
import { floorsApi, type Floor } from "../../api/floors.api";
import CanvasEditor from "../../components/PlanEditor/CanvasEditor";
import {
  exportToPlanJson,
  importFromPlanJson,
  type CanvasWall,
  type CanvasExit,
  type CanvasWaypoint,
  type CanvasRoom,
} from "../../components/PlanEditor/exportToPlanJson";

const SCALE = 10; // px per meter

export default function FloorPlanUploader() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [selectedFloor, setSelectedFloor] = useState<string>("");
  const [floorData, setFloorData] = useState<Floor | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Canvas state
  const [walls, setWalls] = useState<CanvasWall[]>([]);
  const [exits, setExits] = useState<CanvasExit[]>([]);
  const [waypoints, setWaypoints] = useState<CanvasWaypoint[]>([]);
  const [rooms, setRooms] = useState<CanvasRoom[]>([]);

  useEffect(() => {
    buildingsApi.list().then((res) => setBuildings(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!selectedBuilding) {
      setFloors([]);
      return;
    }
    floorsApi.listByBuilding(selectedBuilding).then((res) => setFloors(res.data.data || []));
  }, [selectedBuilding]);

  useEffect(() => {
    if (!selectedFloor) {
      setFloorData(null);
      return;
    }
    const f = floors.find((fl) => fl.id === selectedFloor);
    setFloorData(f || null);

    // Load existing plan
    floorsApi.getPlan(selectedFloor).then((res) => {
      const plan = res.data.data?.planJson;
      if (plan) {
        const imported = importFromPlanJson(plan, SCALE);
        setWalls(imported.walls);
        setExits(imported.exits);
        setRooms(imported.rooms);
      } else {
        setWalls([]);
        setExits([]);
        setRooms([]);
      }
      setWaypoints([]);
    }).catch(() => {
      setWalls([]);
      setExits([]);
      setWaypoints([]);
      setRooms([]);
    });
  }, [selectedFloor, floors]);

  const handleFileUpload = useCallback((file: File) => {
    setMessage(null);

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const plan = JSON.parse(e.target?.result as string);
          const imported = importFromPlanJson(plan, SCALE);
          setWalls(imported.walls);
          setExits(imported.exits);
          setRooms(imported.rooms);
          setMessage({ type: "success", text: "JSON plan imported" });
        } catch {
          setMessage({ type: "error", text: "Invalid JSON file" });
        }
      };
      reader.readAsText(file);
    } else if (file.type.startsWith("image/") || file.name.endsWith(".svg")) {
      const url = URL.createObjectURL(file);
      setBgImage(url);
      setMessage({ type: "success", text: "Background image loaded" });

      // Also upload to server if a floor is selected
      if (selectedFloor) {
        floorsApi.uploadImage(selectedFloor, file).catch(() => {});
      }
    } else {
      setMessage({ type: "error", text: "Unsupported file type. Use PNG, JPG, SVG, or JSON." });
    }
  }, [selectedFloor]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleSave = async () => {
    if (!selectedFloor) return;
    setSaving(true);
    setMessage(null);
    try {
      const planJson = exportToPlanJson(walls, exits, rooms, SCALE);
      await floorsApi.savePlan(selectedFloor, planJson);
      setMessage({ type: "success", text: "Floor plan saved" });
    } catch {
      setMessage({ type: "error", text: "Failed to save floor plan" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    const planJson = exportToPlanJson(walls, exits, rooms, SCALE);
    const blob = new Blob([JSON.stringify(planJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floor-plan-${selectedFloor || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Floor Plan Editor</h1>
        <p className="mt-0.5 text-sm text-gray-500">Upload and edit floor plans with walls, exits, and waypoints</p>
      </div>

      {/* Selectors */}
      <div className="mb-5 flex flex-wrap gap-3">
        <select
          value={selectedBuilding}
          onChange={(e) => {
            setSelectedBuilding(e.target.value);
            setSelectedFloor("");
          }}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Select Building</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={selectedFloor}
          onChange={(e) => setSelectedFloor(e.target.value)}
          disabled={!selectedBuilding}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select Floor</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>{f.name} (Floor {f.floorNumber})</option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={handleExportJson}
          disabled={walls.length === 0 && exits.length === 0 && rooms.length === 0}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 disabled:opacity-40"
        >
          Export JSON
        </button>

        <button
          onClick={handleSave}
          disabled={!selectedFloor || saving}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Plan"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === "success"
              ? "bg-emerald-900/30 text-emerald-400"
              : "bg-red-900/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Drop Zone or Editor */}
      {!selectedFloor ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-20 text-center">
          <p className="text-gray-500">Select a building and floor to start editing</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Drag & drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
              dragOver
                ? "border-emerald-500 bg-emerald-900/10"
                : "border-gray-700 hover:border-gray-600"
            }`}
          >
            <p className="text-sm text-gray-400">
              Drag & drop a floor plan image (PNG/JPG/SVG) or JSON file
            </p>
            <label className="mt-2 inline-block cursor-pointer text-sm text-emerald-400 hover:text-emerald-300">
              or click to browse
              <input
                type="file"
                accept="image/*,.svg,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>

          {/* Canvas editor */}
          <CanvasEditor
            width={floorData?.width || 50}
            height={floorData?.height || 50}
            backgroundImage={bgImage}
            walls={walls}
            exits={exits}
            waypoints={waypoints}
            rooms={rooms}
            onWallsChange={setWalls}
            onExitsChange={setExits}
            onWaypointsChange={setWaypoints}
            onRoomsChange={setRooms}
          />
        </div>
      )}
    </div>
  );
}
