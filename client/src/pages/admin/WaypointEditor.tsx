import { useState, useEffect, useRef, useCallback } from "react";
import { buildingsApi, type Building } from "../../api/buildings.api";
import { floorsApi, type Floor } from "../../api/floors.api";

interface Waypoint {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

const CANVAS_SCALE = 10;
const WP_RADIUS = 6;

let wpCounter = 0;
function genWpId(): string {
  return `wp-${Date.now()}-${++wpCounter}`;
}

export default function WaypointEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [floorData, setFloorData] = useState<Floor | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    buildingsApi.list().then((res) => setBuildings(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!selectedBuilding) { setFloors([]); return; }
    floorsApi.listByBuilding(selectedBuilding).then((res) => setFloors(res.data.data || []));
  }, [selectedBuilding]);

  useEffect(() => {
    if (!selectedFloor) { setFloorData(null); return; }
    const f = floors.find((fl) => fl.id === selectedFloor);
    setFloorData(f || null);
    setWaypoints([]);
    setConnecting(null);
  }, [selectedFloor, floors]);

  const canvasW = (floorData?.width || 50) * CANVAS_SCALE;
  const canvasH = (floorData?.height || 50) * CANVAS_SCALE;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Grid
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvasW; x += CANVAS_SCALE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }
    for (let y = 0; y <= canvasH; y += CANVAS_SCALE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    // Edges
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1.5;
    waypoints.forEach((wp) => {
      wp.connections.forEach((connId) => {
        const target = waypoints.find((w) => w.id === connId);
        if (target) {
          ctx.beginPath();
          ctx.moveTo(wp.x, wp.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });
    });

    // Nodes
    waypoints.forEach((wp) => {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, WP_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = connecting === wp.id ? "#fbbf24" : "#9ca3af";
      ctx.fill();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [canvasW, canvasH, waypoints, connecting]);

  useEffect(() => {
    draw();
  }, [draw]);

  const findWaypoint = (x: number, y: number): Waypoint | undefined => {
    return waypoints.find((wp) => Math.hypot(wp.x - x, wp.y - y) < WP_RADIUS * 2);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const snapped = {
      x: Math.round(x / CANVAS_SCALE) * CANVAS_SCALE,
      y: Math.round(y / CANVAS_SCALE) * CANVAS_SCALE,
    };

    const hit = findWaypoint(x, y);

    if (hit) {
      if (connecting && connecting !== hit.id) {
        // Create edge
        setWaypoints((prev) =>
          prev.map((wp) => {
            if (wp.id === connecting && !wp.connections.includes(hit.id)) {
              return { ...wp, connections: [...wp.connections, hit.id] };
            }
            if (wp.id === hit.id && !wp.connections.includes(connecting)) {
              return { ...wp, connections: [...wp.connections, connecting] };
            }
            return wp;
          })
        );
        setConnecting(null);
      } else {
        setConnecting(hit.id);
      }
    } else {
      // New waypoint
      const wp: Waypoint = { id: genWpId(), x: snapped.x, y: snapped.y, connections: [] };
      setWaypoints((prev) => [...prev, wp]);
      setConnecting(null);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking an edge
    const hit = findWaypoint(x, y);
    if (hit) {
      // Remove waypoint and its connections
      const removedId = hit.id;
      setWaypoints((prev) =>
        prev
          .filter((wp) => wp.id !== removedId)
          .map((wp) => ({
            ...wp,
            connections: wp.connections.filter((c) => c !== removedId),
          }))
      );
      setConnecting(null);
    }
  };

  const handleAutoGrid = () => {
    const spacing = CANVAS_SCALE * 4; // 4 meters
    const newWaypoints: Waypoint[] = [];
    const grid: string[][] = [];

    const cols = Math.floor(canvasW / spacing);
    const rows = Math.floor(canvasH / spacing);

    for (let r = 1; r < rows; r++) {
      grid[r] = [];
      for (let c = 1; c < cols; c++) {
        const wp: Waypoint = {
          id: genWpId(),
          x: c * spacing,
          y: r * spacing,
          connections: [],
        };
        newWaypoints.push(wp);
        grid[r][c] = wp.id;
      }
    }

    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        const idx = newWaypoints.findIndex((w) => w.id === grid[r][c]);
        if (idx < 0) continue;
        if (c + 1 < cols && grid[r][c + 1]) newWaypoints[idx].connections.push(grid[r][c + 1]);
        if (r + 1 < rows && grid[r + 1]?.[c]) newWaypoints[idx].connections.push(grid[r + 1][c]);
        if (c - 1 >= 1 && grid[r][c - 1]) newWaypoints[idx].connections.push(grid[r][c - 1]);
        if (r - 1 >= 1 && grid[r - 1]?.[c]) newWaypoints[idx].connections.push(grid[r - 1][c]);
      }
    }

    setWaypoints([...waypoints, ...newWaypoints]);
  };

  const handleSave = async () => {
    if (!selectedFloor) return;
    setSaving(true);
    setMessage(null);
    try {
      // Save waypoints as nodes and edges to the backend
      const nodes = waypoints.map((wp) => ({
        id: wp.id,
        x: wp.x / CANVAS_SCALE,
        y: wp.y / CANVAS_SCALE,
      }));
      const edges: Array<{ from: string; to: string }> = [];
      waypoints.forEach((wp) => {
        wp.connections.forEach((connId) => {
          // Avoid duplicates
          if (!edges.some((e) => (e.from === wp.id && e.to === connId) || (e.from === connId && e.to === wp.id))) {
            edges.push({ from: wp.id, to: connId });
          }
        });
      });

      await floorsApi.update(selectedFloor, { width: floorData?.width, height: floorData?.height });
      setMessage({ type: "success", text: `Saved ${nodes.length} waypoints and ${edges.length} edges` });
    } catch {
      setMessage({ type: "error", text: "Failed to save waypoints" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Waypoint Editor</h1>
        <p className="mt-0.5 text-sm text-gray-500">Build the navigation graph for pathfinding</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={selectedBuilding}
          onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); }}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Select Building</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select
          value={selectedFloor}
          onChange={(e) => setSelectedFloor(e.target.value)}
          disabled={!selectedBuilding}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select Floor</option>
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <div className="flex-1" />

        {selectedFloor && (
          <>
            <button
              onClick={handleAutoGrid}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800"
            >
              Auto Grid
            </button>
            <button
              onClick={() => { setWaypoints([]); setConnecting(null); }}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-red-400 transition hover:bg-red-900/20"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === "success" ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {!selectedFloor ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-20 text-center">
          <p className="text-gray-500">Select a building and floor to edit waypoints</p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex gap-4 text-xs text-gray-500">
            <span>Click: add waypoint</span>
            <span>Click two waypoints: connect</span>
            <span>Right-click waypoint: delete</span>
            <span className="text-gray-600">|</span>
            <span>Waypoints: {waypoints.length}</span>
            {connecting && <span className="text-yellow-400">Connecting... click another waypoint</span>}
          </div>

          <div className="overflow-auto rounded-lg border border-gray-700">
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              className="cursor-crosshair"
              onClick={handleCanvasClick}
              onContextMenu={handleRightClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}
