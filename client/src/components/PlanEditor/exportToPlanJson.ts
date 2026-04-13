import type { PlanJSON } from "../../api/floors.api";

export interface CanvasWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CanvasExit {
  id: string;
  name: string;
  x: number;
  y: number;
  type: "door" | "staircase" | "elevator" | "emergency";
}

export interface CanvasWaypoint {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

export interface CanvasRoom {
  id: string;
  name: string;
  polygon: Array<{ x: number; y: number }>;
  type: string;
}

/**
 * Convert canvas editor objects to the plan_json format expected by the backend.
 * Scales canvas pixel coordinates to meter-based floor coordinates.
 */
export function exportToPlanJson(
  walls: CanvasWall[],
  exits: CanvasExit[],
  rooms: CanvasRoom[],
  scale: number
): PlanJSON {
  return {
    walls: walls.map((w) => ({
      x1: w.x1 / scale,
      y1: w.y1 / scale,
      x2: w.x2 / scale,
      y2: w.y2 / scale,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      polygon: r.polygon.map((p) => ({ x: p.x / scale, y: p.y / scale })),
      type: r.type,
    })),
    exits: exits.map((e) => ({
      id: e.id,
      name: e.name,
      x: e.x / scale,
      y: e.y / scale,
      type: e.type,
    })),
  };
}

/**
 * Import plan_json data back into canvas coordinate arrays.
 */
export function importFromPlanJson(
  plan: PlanJSON,
  scale: number
): { walls: CanvasWall[]; exits: CanvasExit[]; rooms: CanvasRoom[] } {
  return {
    walls: plan.walls.map((w, i) => ({
      id: `wall-${i}`,
      x1: w.x1 * scale,
      y1: w.y1 * scale,
      x2: w.x2 * scale,
      y2: w.y2 * scale,
    })),
    exits: plan.exits.map((e) => ({
      id: e.id,
      name: e.name,
      x: e.x * scale,
      y: e.y * scale,
      type: e.type,
    })),
    rooms: plan.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      polygon: r.polygon.map((p) => ({ x: p.x * scale, y: p.y * scale })),
      type: r.type,
    })),
  };
}
