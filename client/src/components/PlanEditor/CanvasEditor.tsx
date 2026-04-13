import { useRef, useEffect, useState, useCallback } from "react";
import ToolBar, { type EditorTool } from "./ToolBar";
import type { CanvasWall, CanvasExit, CanvasWaypoint, CanvasRoom } from "./exportToPlanJson";

interface CanvasEditorProps {
  width: number;
  height: number;
  backgroundImage: string | null;
  walls: CanvasWall[];
  exits: CanvasExit[];
  waypoints: CanvasWaypoint[];
  rooms: CanvasRoom[];
  onWallsChange: (walls: CanvasWall[]) => void;
  onExitsChange: (exits: CanvasExit[]) => void;
  onWaypointsChange: (waypoints: CanvasWaypoint[]) => void;
  onRoomsChange: (rooms: CanvasRoom[]) => void;
}

const SCALE = 10; // pixels per meter
const SNAP_GRID = 10; // snap to 10px grid
const EXIT_RADIUS = 8;
const WAYPOINT_RADIUS = 5;

const EXIT_COLORS: Record<string, string> = {
  emergency: "#22c55e",
  door: "#3b82f6",
  staircase: "#f59e0b",
  elevator: "#8b5cf6",
};

function snap(v: number): number {
  return Math.round(v / SNAP_GRID) * SNAP_GRID;
}

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export default function CanvasEditor({
  width,
  height,
  backgroundImage,
  walls,
  exits,
  waypoints,
  rooms,
  onWallsChange,
  onExitsChange,
  onWaypointsChange,
  onRoomsChange,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [roomPoints, setRoomPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [connectingWaypoint, setConnectingWaypoint] = useState<string | null>(null);

  const canvasW = width * SCALE;
  const canvasH = height * SCALE;

  // Load background image
  useEffect(() => {
    if (!backgroundImage) {
      bgImageRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      bgImageRef.current = img;
      draw();
    };
    img.src = backgroundImage;
  }, [backgroundImage]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Background image
    if (bgImageRef.current) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(bgImageRef.current, 0, 0, canvasW, canvasH);
      ctx.globalAlpha = 1;
    }

    // Grid
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvasW; x += SNAP_GRID) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }
    for (let y = 0; y <= canvasH; y += SNAP_GRID) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    // Rooms
    rooms.forEach((room) => {
      if (room.polygon.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(room.polygon[0].x, room.polygon[0].y);
      for (let i = 1; i < room.polygon.length; i++) {
        ctx.lineTo(room.polygon[i].x, room.polygon[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.fill();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Room label
      const cx = room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length;
      const cy = room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length;
      ctx.fillStyle = "#93c5fd";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(room.name, cx, cy);
    });

    // Room drawing in progress
    if (tool === "room" && roomPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(roomPoints[0].x, roomPoints[0].y);
      for (let i = 1; i < roomPoints.length; i++) {
        ctx.lineTo(roomPoints[i].x, roomPoints[i].y);
      }
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      roomPoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#60a5fa";
        ctx.fill();
      });
    }

    // Walls
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 3;
    walls.forEach((wall) => {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    });

    // Wall being drawn
    if (tool === "wall" && drawing && drawStart) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(snap(mousePos.x), snap(mousePos.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Waypoint connections
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
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

    // Waypoints
    waypoints.forEach((wp) => {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, WAYPOINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = connectingWaypoint === wp.id ? "#fbbf24" : "#9ca3af";
      ctx.fill();
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Exits
    exits.forEach((exit) => {
      const color = EXIT_COLORS[exit.type] || EXIT_COLORS.door;
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, EXIT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(exit.name, exit.x, exit.y + EXIT_RADIUS + 12);
    });

    // Crosshair
    if (tool !== "select") {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, canvasH);
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(canvasW, mousePos.y);
      ctx.stroke();
    }
  }, [canvasW, canvasH, walls, exits, waypoints, rooms, tool, drawing, drawStart, mousePos, roomPoints, connectingWaypoint]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return; // right click handled in onContextMenu
    setContextMenu(null);
    const pos = getCanvasPos(e);

    if (tool === "wall") {
      setDrawing(true);
      setDrawStart({ x: snap(pos.x), y: snap(pos.y) });
    } else if (tool === "waypoint") {
      // Check if clicking existing waypoint for connection
      const hit = waypoints.find(
        (wp) => Math.hypot(wp.x - pos.x, wp.y - pos.y) < WAYPOINT_RADIUS * 2
      );
      if (hit) {
        if (connectingWaypoint && connectingWaypoint !== hit.id) {
          // Create connection
          const updated = waypoints.map((wp) => {
            if (wp.id === connectingWaypoint && !wp.connections.includes(hit.id)) {
              return { ...wp, connections: [...wp.connections, hit.id] };
            }
            if (wp.id === hit.id && !wp.connections.includes(connectingWaypoint)) {
              return { ...wp, connections: [...wp.connections, connectingWaypoint] };
            }
            return wp;
          });
          onWaypointsChange(updated);
          setConnectingWaypoint(null);
        } else {
          setConnectingWaypoint(hit.id);
        }
      } else {
        const wp: CanvasWaypoint = {
          id: genId("wp"),
          x: snap(pos.x),
          y: snap(pos.y),
          connections: [],
        };
        onWaypointsChange([...waypoints, wp]);
        setConnectingWaypoint(null);
      }
    } else if (tool === "room") {
      const snapped = { x: snap(pos.x), y: snap(pos.y) };
      // Close polygon if clicking near start
      if (roomPoints.length >= 3) {
        const first = roomPoints[0];
        if (Math.hypot(snapped.x - first.x, snapped.y - first.y) < 15) {
          const name = prompt("Room name:", "Room") || "Room";
          const type = prompt("Room type (classroom/office/lab/corridor/bathroom/storage):", "classroom") || "classroom";
          const room: CanvasRoom = {
            id: genId("room"),
            name,
            polygon: [...roomPoints],
            type,
          };
          onRoomsChange([...rooms, room]);
          setRoomPoints([]);
          return;
        }
      }
      setRoomPoints([...roomPoints, snapped]);
    } else if (tool === "eraser") {
      // Delete nearest object
      const threshold = 15;

      // Check exits
      const exitIdx = exits.findIndex((ex) => Math.hypot(ex.x - pos.x, ex.y - pos.y) < threshold);
      if (exitIdx >= 0) {
        onExitsChange(exits.filter((_, i) => i !== exitIdx));
        return;
      }

      // Check waypoints
      const wpIdx = waypoints.findIndex((wp) => Math.hypot(wp.x - pos.x, wp.y - pos.y) < threshold);
      if (wpIdx >= 0) {
        const removedId = waypoints[wpIdx].id;
        const updated = waypoints
          .filter((_, i) => i !== wpIdx)
          .map((wp) => ({
            ...wp,
            connections: wp.connections.filter((c) => c !== removedId),
          }));
        onWaypointsChange(updated);
        return;
      }

      // Check walls (point-to-segment distance)
      const wallIdx = walls.findIndex((w) => {
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(pos.x - w.x1, pos.y - w.y1) < threshold;
        let t = ((pos.x - w.x1) * dx + (pos.y - w.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const projX = w.x1 + t * dx;
        const projY = w.y1 + t * dy;
        return Math.hypot(pos.x - projX, pos.y - projY) < threshold;
      });
      if (wallIdx >= 0) {
        onWallsChange(walls.filter((_, i) => i !== wallIdx));
        return;
      }

      // Check rooms (point in polygon)
      const roomIdx = rooms.findIndex((r) => {
        let inside = false;
        const poly = r.polygon;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          if (
            poly[i].y > pos.y !== poly[j].y > pos.y &&
            pos.x < ((poly[j].x - poly[i].x) * (pos.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x
          ) {
            inside = !inside;
          }
        }
        return inside;
      });
      if (roomIdx >= 0) {
        onRoomsChange(rooms.filter((_, i) => i !== roomIdx));
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (tool === "wall" && drawing && drawStart) {
      const pos = getCanvasPos(e);
      const end = { x: snap(pos.x), y: snap(pos.y) };
      if (Math.hypot(end.x - drawStart.x, end.y - drawStart.y) > 5) {
        const wall: CanvasWall = {
          id: genId("wall"),
          x1: drawStart.x,
          y1: drawStart.y,
          x2: end.x,
          y2: end.y,
        };
        onWallsChange([...walls, wall]);
      }
    }
    setDrawing(false);
    setDrawStart(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    setMousePos(pos);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX: snap(pos.x), canvasY: snap(pos.y) });
  };

  const addExit = (type: "door" | "staircase" | "elevator" | "emergency") => {
    if (!contextMenu) return;
    const name = prompt("Exit name:", `${type} exit`) || `${type} exit`;
    const exit: CanvasExit = {
      id: genId("exit"),
      name,
      x: contextMenu.canvasX,
      y: contextMenu.canvasY,
      type,
    };
    onExitsChange([...exits, exit]);
    setContextMenu(null);
  };

  const handleClear = () => {
    if (confirm("Clear all drawings? This cannot be undone.")) {
      onWallsChange([]);
      onExitsChange([]);
      onWaypointsChange([]);
      onRoomsChange([]);
      setRoomPoints([]);
      setConnectingWaypoint(null);
    }
  };

  const handleAutoGrid = () => {
    const spacing = 40; // 4 meters
    const newWaypoints: CanvasWaypoint[] = [];
    const grid: string[][] = [];

    const cols = Math.floor(canvasW / spacing);
    const rows = Math.floor(canvasH / spacing);

    for (let r = 1; r < rows; r++) {
      grid[r] = [];
      for (let c = 1; c < cols; c++) {
        const wp: CanvasWaypoint = {
          id: genId("wp"),
          x: c * spacing,
          y: r * spacing,
          connections: [],
        };
        newWaypoints.push(wp);
        grid[r][c] = wp.id;
      }
    }

    // Connect to neighbors
    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        const idx = newWaypoints.findIndex((w) => w.id === grid[r][c]);
        if (idx < 0) continue;
        if (c + 1 < cols && grid[r][c + 1]) {
          newWaypoints[idx].connections.push(grid[r][c + 1]);
        }
        if (r + 1 < rows && grid[r + 1]?.[c]) {
          newWaypoints[idx].connections.push(grid[r + 1][c]);
        }
        if (c - 1 >= 1 && grid[r][c - 1]) {
          newWaypoints[idx].connections.push(grid[r][c - 1]);
        }
        if (r - 1 >= 1 && grid[r - 1]?.[c]) {
          newWaypoints[idx].connections.push(grid[r - 1][c]);
        }
      }
    }

    onWaypointsChange([...waypoints, ...newWaypoints]);
  };

  return (
    <div className="flex flex-col gap-3">
      <ToolBar activeTool={tool} onToolChange={setTool} onClear={handleClear} onAutoGrid={handleAutoGrid} />

      <div className="relative overflow-auto rounded-lg border border-gray-700">
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          className="cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onContextMenu={handleContextMenu}
        />

        {/* Context menu for exit placement */}
        {contextMenu && (
          <div
            className="fixed z-50 rounded-lg border border-gray-600 bg-gray-800 py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-400">Place Exit</div>
            {(["emergency", "door", "staircase", "elevator"] as const).map((type) => (
              <button
                key={type}
                onClick={() => addExit(type)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: EXIT_COLORS[type] }}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
            <div className="my-1 border-t border-gray-700" />
            <button
              onClick={() => setContextMenu(null)}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span>Walls: {walls.length}</span>
        <span>Rooms: {rooms.length}</span>
        <span>Exits: {exits.length}</span>
        <span>Waypoints: {waypoints.length}</span>
        {tool === "room" && roomPoints.length > 0 && (
          <span className="text-blue-400">
            Room points: {roomPoints.length} (click near start to close)
          </span>
        )}
        {connectingWaypoint && (
          <span className="text-yellow-400">Click another waypoint to connect</span>
        )}
      </div>
    </div>
  );
}
