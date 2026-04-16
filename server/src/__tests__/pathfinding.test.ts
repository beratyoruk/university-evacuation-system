import { findEvacuationRoute } from "../services/pathfinding.service";

interface TestWp {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

/**
 * Tiny grid used across tests:
 *
 *    (0,0) A ── B (10,0)
 *            │       │
 *    (0,10) C ── D (10,10) ── E (20,10)
 *
 * An exit placed at (25,10) is within 15 units of both D (d=15) and E (d=5),
 * so the A* search is allowed to terminate at any of those "goal neighbor"
 * waypoints.
 */
const gridWaypoints: TestWp[] = [
  { id: "A", x: 0, y: 0, connections: ["B", "C"] },
  { id: "B", x: 10, y: 0, connections: ["A", "D"] },
  { id: "C", x: 0, y: 10, connections: ["A", "D"] },
  { id: "D", x: 10, y: 10, connections: ["B", "C", "E"] },
  { id: "E", x: 20, y: 10, connections: ["D"] },
];

describe("findEvacuationRoute (A*)", () => {
  it("finds the shortest path from A to the first goal-adjacent waypoint", () => {
    const exits = [{ id: "exit-1", x: 25, y: 10 }];
    const route = findEvacuationRoute(gridWaypoints, exits, "A");

    expect(route).not.toBeNull();
    expect(route!.exitId).toBe("exit-1");
    // A* terminates at the first waypoint within 15 units of the exit.
    // From A, that's D (via A→B→D, g=20) — total = 20 + 15 = 35 m.
    expect(route!.path[0]).toBe("A");
    expect(route!.path).toContain("D");
    expect(route!.distance).toBeCloseTo(35, 1);
    expect(route!.coordinates[0]).toEqual({ x: 0, y: 0 });
    expect(route!.coordinates[route!.coordinates.length - 1]).toEqual({ x: 25, y: 10 });
  });

  it("routes around a blocked waypoint", () => {
    const exits = [{ id: "exit-1", x: 25, y: 10 }];
    const route = findEvacuationRoute(gridWaypoints, exits, "A", ["B"]);

    expect(route).not.toBeNull();
    expect(route!.path).not.toContain("B");
    expect(route!.path).toContain("C");
    expect(route!.path).toContain("D");
    expect(route!.distance).toBeCloseTo(35, 1);
  });

  it("picks the nearest exit when multiple emergency exits exist", () => {
    const exits = [
      { id: "far-exit", x: 25, y: 10 },
      { id: "near-exit", x: 5, y: 5 },
    ];
    const route = findEvacuationRoute(gridWaypoints, exits, "A");
    expect(route).not.toBeNull();
    expect(route!.exitId).toBe("near-exit");
    expect(route!.path).toEqual(["A"]);
  });

  it("returns null when every waypoint adjacent to every exit is blocked", () => {
    const exits = [{ id: "exit-1", x: 25, y: 10 }];
    // Goal-adjacency radius is 15 units. D (dist 15) and E (dist 5) both qualify.
    // Blocking both leaves no valid termination point.
    const route = findEvacuationRoute(gridWaypoints, exits, "A", ["D", "E"]);
    expect(route).toBeNull();
  });

  it("returns null when no exits are provided", () => {
    const route = findEvacuationRoute(gridWaypoints, [], "A");
    expect(route).toBeNull();
  });

  it("returns null when the start waypoint does not exist in the graph", () => {
    const exits = [{ id: "exit-1", x: 25, y: 10 }];
    const route = findEvacuationRoute(gridWaypoints, exits, "DOES-NOT-EXIST");
    expect(route).toBeNull();
  });

  it("handles connections encoded as JSON strings (from JSONB)", () => {
    const raw = [
      { id: "A", x: 0, y: 0, connections: JSON.stringify(["B"]) as unknown as string[] },
      { id: "B", x: 10, y: 0, connections: JSON.stringify(["A"]) as unknown as string[] },
    ];
    // Exit 18m east of origin — A (dist 18) is outside goal radius, B (dist 8) is inside.
    // So A* must actually traverse A→B.
    const exits = [{ id: "exit-1", x: 18, y: 0 }];
    const route = findEvacuationRoute(raw, exits, "A");
    expect(route).not.toBeNull();
    expect(route!.path).toEqual(["A", "B"]);
  });
});
