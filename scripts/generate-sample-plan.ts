/**
 * generate-sample-plan.ts
 *
 * Produces a realistic-ish floor plan JSON for local development and demos.
 * Output: a 40×30 m floor with 20 rooms along a central corridor, 4 emergency
 * exits on the perimeter, and a waypoint graph (>=50 nodes) that actually
 * connects every room to every exit — so pathfinding has something to chew on.
 *
 * Usage:
 *   npx ts-node scripts/generate-sample-plan.ts > sample-plan.json
 *   npx ts-node scripts/generate-sample-plan.ts ./sample-plan.json
 */

import { promises as fs } from "fs";
import path from "path";

type Point = { x: number; y: number };
type Wall = { x1: number; y1: number; x2: number; y2: number };
type Room = { id: string; name: string; polygon: Point[]; type: string };
type Exit = {
  id: string;
  name: string;
  x: number;
  y: number;
  type: "door" | "staircase" | "elevator" | "emergency";
};
type Waypoint = { id: string; x: number; y: number; connections: string[] };

const FLOOR_WIDTH = 40;
const FLOOR_HEIGHT = 30;
const ROOM_COUNT = 20; // 10 along the top, 10 along the bottom
const ROOMS_PER_ROW = 10;
const ROOM_WIDTH = FLOOR_WIDTH / ROOMS_PER_ROW;
const ROOM_DEPTH = 9; // leaves a 12 m corridor down the middle
const CORRIDOR_Y = FLOOR_HEIGHT / 2;

const ROOM_TYPES = ["classroom", "lab", "office", "storage", "bathroom"] as const;

function buildRooms(): Room[] {
  const rooms: Room[] = [];
  for (let i = 0; i < ROOMS_PER_ROW; i++) {
    // Top row (y = 0 to ROOM_DEPTH)
    const x0 = i * ROOM_WIDTH;
    rooms.push({
      id: `room-top-${i + 1}`,
      name: `${101 + i}`,
      type: ROOM_TYPES[i % ROOM_TYPES.length],
      polygon: [
        { x: x0, y: 0 },
        { x: x0 + ROOM_WIDTH, y: 0 },
        { x: x0 + ROOM_WIDTH, y: ROOM_DEPTH },
        { x: x0, y: ROOM_DEPTH },
      ],
    });
    // Bottom row
    const y0 = FLOOR_HEIGHT - ROOM_DEPTH;
    rooms.push({
      id: `room-bot-${i + 1}`,
      name: `${201 + i}`,
      type: ROOM_TYPES[(i + 2) % ROOM_TYPES.length],
      polygon: [
        { x: x0, y: y0 },
        { x: x0 + ROOM_WIDTH, y: y0 },
        { x: x0 + ROOM_WIDTH, y: FLOOR_HEIGHT },
        { x: x0, y: FLOOR_HEIGHT },
      ],
    });
  }
  return rooms;
}

function buildWalls(): Wall[] {
  const walls: Wall[] = [];

  // Outer perimeter
  walls.push({ x1: 0, y1: 0, x2: FLOOR_WIDTH, y2: 0 });
  walls.push({ x1: FLOOR_WIDTH, y1: 0, x2: FLOOR_WIDTH, y2: FLOOR_HEIGHT });
  walls.push({ x1: FLOOR_WIDTH, y1: FLOOR_HEIGHT, x2: 0, y2: FLOOR_HEIGHT });
  walls.push({ x1: 0, y1: FLOOR_HEIGHT, x2: 0, y2: 0 });

  // Corridor-side walls with door gaps
  const DOOR_WIDTH = 1.2;
  for (let i = 0; i < ROOMS_PER_ROW; i++) {
    const x0 = i * ROOM_WIDTH;
    const doorCenter = x0 + ROOM_WIDTH / 2;

    // Top row: wall along y=ROOM_DEPTH with a gap for the door
    walls.push({ x1: x0, y1: ROOM_DEPTH, x2: doorCenter - DOOR_WIDTH / 2, y2: ROOM_DEPTH });
    walls.push({ x1: doorCenter + DOOR_WIDTH / 2, y1: ROOM_DEPTH, x2: x0 + ROOM_WIDTH, y2: ROOM_DEPTH });

    // Bottom row: wall along y=(FLOOR_HEIGHT-ROOM_DEPTH)
    const y = FLOOR_HEIGHT - ROOM_DEPTH;
    walls.push({ x1: x0, y1: y, x2: doorCenter - DOOR_WIDTH / 2, y2: y });
    walls.push({ x1: doorCenter + DOOR_WIDTH / 2, y1: y, x2: x0 + ROOM_WIDTH, y2: y });

    // Vertical dividers between adjacent rooms (skip the last to avoid dup with outer wall)
    if (i > 0) {
      walls.push({ x1: x0, y1: 0, x2: x0, y2: ROOM_DEPTH });
      walls.push({ x1: x0, y1: FLOOR_HEIGHT - ROOM_DEPTH, x2: x0, y2: FLOOR_HEIGHT });
    }
  }

  return walls;
}

function buildExits(): Exit[] {
  return [
    { id: "exit-nw", name: "Kuzey Batı Acil Çıkış", x: 0, y: CORRIDOR_Y, type: "emergency" },
    { id: "exit-ne", name: "Kuzey Doğu Acil Çıkış", x: FLOOR_WIDTH, y: CORRIDOR_Y, type: "emergency" },
    { id: "exit-s1", name: "Güney Çıkış 1", x: FLOOR_WIDTH * 0.25, y: FLOOR_HEIGHT, type: "emergency" },
    { id: "exit-s2", name: "Güney Çıkış 2", x: FLOOR_WIDTH * 0.75, y: FLOOR_HEIGHT, type: "emergency" },
  ];
}

/**
 * Build a waypoint graph: corridor spine + one node in each doorway + one
 * node near each exit. Corridor nodes are every 2 m so pathfinding has fine
 * resolution. Produces ~50 nodes for the default 40×30 layout.
 */
function buildWaypoints(): Waypoint[] {
  const waypoints: Waypoint[] = [];
  const corridorSpacing = 1.5;
  const corridorCount = Math.floor(FLOOR_WIDTH / corridorSpacing) + 1;

  // Corridor spine — one row at CORRIDOR_Y
  for (let i = 0; i < corridorCount; i++) {
    const id = `wp-cor-${i}`;
    const connections: string[] = [];
    if (i > 0) connections.push(`wp-cor-${i - 1}`);
    if (i < corridorCount - 1) connections.push(`wp-cor-${i + 1}`);
    waypoints.push({
      id,
      x: i * corridorSpacing,
      y: CORRIDOR_Y,
      connections,
    });
  }

  // Door waypoints — one per room, connecting the room door to its nearest corridor spine node
  for (let i = 0; i < ROOMS_PER_ROW; i++) {
    const x = i * ROOM_WIDTH + ROOM_WIDTH / 2;
    const spineIdx = Math.round(x / corridorSpacing);
    const spineId = `wp-cor-${Math.min(spineIdx, corridorCount - 1)}`;

    const topDoorId = `wp-door-top-${i}`;
    const botDoorId = `wp-door-bot-${i}`;

    waypoints.push({
      id: topDoorId,
      x,
      y: ROOM_DEPTH + 0.5,
      connections: [spineId],
    });
    waypoints.push({
      id: botDoorId,
      x,
      y: FLOOR_HEIGHT - ROOM_DEPTH - 0.5,
      connections: [spineId],
    });

    // Bidirectional: let the spine node know about the doors
    const spine = waypoints.find((w) => w.id === spineId);
    if (spine) {
      spine.connections.push(topDoorId, botDoorId);
    }
  }

  // Exit-approach waypoints — one just inside each exit, connected to the corridor
  const exits = buildExits();
  for (const exit of exits) {
    const id = `wp-exit-${exit.id}`;
    // Find the closest spine node
    let closest = waypoints[0];
    let closestD = Infinity;
    for (const w of waypoints) {
      if (!w.id.startsWith("wp-cor-")) continue;
      const d = Math.hypot(w.x - exit.x, w.y - exit.y);
      if (d < closestD) {
        closestD = d;
        closest = w;
      }
    }
    // Place the waypoint 1 m inside the exit, along the line to the closest corridor node
    const dx = closest.x - exit.x;
    const dy = closest.y - exit.y;
    const len = Math.hypot(dx, dy) || 1;
    waypoints.push({
      id,
      x: exit.x + (dx / len) * 1,
      y: exit.y + (dy / len) * 1,
      connections: [closest.id],
    });
    closest.connections.push(id);
  }

  return waypoints;
}

function buildPlan() {
  return {
    width: FLOOR_WIDTH,
    height: FLOOR_HEIGHT,
    walls: buildWalls(),
    rooms: buildRooms(),
    exits: buildExits(),
    waypoints: buildWaypoints(),
  };
}

async function main(): Promise<void> {
  const plan = buildPlan();
  const output = JSON.stringify(plan, null, 2);
  const target = process.argv[2];

  if (target) {
    const resolved = path.resolve(process.cwd(), target);
    await fs.writeFile(resolved, output + "\n", "utf8");
    // eslint-disable-next-line no-console
    console.log(
      `Wrote ${plan.walls.length} walls, ${plan.rooms.length} rooms, ` +
        `${plan.exits.length} exits, ${plan.waypoints.length} waypoints to ${resolved}`
    );
  } else {
    process.stdout.write(output + "\n");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
