import type { PlanJSON } from "../components/FloorViewer/FloorViewer";

export interface PlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const EMPTY: PlanBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

export function computePlanBounds(plan: PlanJSON | null): PlanBounds {
  if (!plan) return EMPTY;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const w of plan.walls ?? []) {
    visit(w.x1, w.y1);
    visit(w.x2, w.y2);
  }
  for (const r of plan.rooms ?? []) {
    for (const p of r.polygon ?? []) visit(p.x, p.y);
  }
  for (const e of plan.exits ?? []) {
    visit(e.x, e.y);
  }

  if (minX === Infinity) return EMPTY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
