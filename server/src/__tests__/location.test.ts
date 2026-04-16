import request from "supertest";
import jwt from "jsonwebtoken";

const mockQuery = jest.fn();
jest.mock("../db/db", () => ({
  __esModule: true,
  query: (...args: unknown[]) => mockQuery(...args),
  pool: { connect: jest.fn() },
  getClient: jest.fn(),
  transaction: jest.fn(),
}));

import locationRoutes from "../routes/location.routes";
import { buildTestApp } from "./testApp";
import { config } from "../config";

const app = buildTestApp([{ prefix: "location", router: locationRoutes }]);

const validUuid = "11111111-1111-1111-1111-111111111111";
const floorUuid = "22222222-2222-2222-2222-222222222222";

function authHeader(): string {
  const token = jwt.sign(
    { userId: validUuid, role: "user", universityId: null },
    config.jwt.secret,
    { expiresIn: "1h" }
  );
  return `Bearer ${token}`;
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("POST /api/location/update", () => {
  it("normalizes coordinates and returns the nearest waypoint", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "wp-A", x: 5, y: 5, connections: [] },
        { id: "wp-B", x: 20, y: 20, connections: [] },
      ],
      rowCount: 2,
    });

    const res = await request(app)
      .post("/api/location/update")
      .set("Authorization", authHeader())
      .send({ floor_id: floorUuid, x: 6, y: 6 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nearestWaypointId).toBe("wp-A");
    expect(res.body.data.x).toBe(6);
    expect(res.body.data.y).toBe(6);
  });

  it("rejects requests without auth", async () => {
    const res = await request(app)
      .post("/api/location/update")
      .send({ floor_id: floorUuid, x: 1, y: 1 });
    expect(res.status).toBe(401);
  });

  it("rejects malformed payload (zod)", async () => {
    const res = await request(app)
      .post("/api/location/update")
      .set("Authorization", authHeader())
      .send({ floor_id: "not-a-uuid", x: "abc" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/location/route", () => {
  function mockWaypointsAndExits(
    waypoints: Array<{ id: string; x: number; y: number; connections: string[] }>,
    exits: Array<{ id: string; x: number; y: number; is_emergency_exit: boolean }>
  ) {
    // Route handler runs waypoints query first, then exits query via Promise.all
    mockQuery
      .mockResolvedValueOnce({ rows: waypoints, rowCount: waypoints.length })
      .mockResolvedValueOnce({ rows: exits, rowCount: exits.length });
  }

  it("returns the A* route to the nearest emergency exit", async () => {
    mockWaypointsAndExits(
      [
        { id: "A", x: 0, y: 0, connections: ["B"] },
        { id: "B", x: 10, y: 0, connections: ["A"] },
      ],
      // Exit 20m east — A (dist 20) is outside the 15-unit goal radius
      // so the algorithm must traverse A→B rather than short-circuit.
      [{ id: "exit-1", x: 20, y: 0, is_emergency_exit: true }]
    );

    const res = await request(app)
      .get("/api/location/route")
      .set("Authorization", authHeader())
      .query({ floor_id: floorUuid, x: 0, y: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exitId).toBe("exit-1");
    expect(res.body.data.path).toEqual(["A", "B"]);
  });

  it("returns 404 when there are no emergency exits", async () => {
    mockWaypointsAndExits(
      [{ id: "A", x: 0, y: 0, connections: [] }],
      []
    );

    const res = await request(app)
      .get("/api/location/route")
      .set("Authorization", authHeader())
      .query({ floor_id: floorUuid, x: 0, y: 0 });

    expect(res.status).toBe(404);
  });

  it("returns 404 when no waypoints are on the floor", async () => {
    mockWaypointsAndExits([], [{ id: "e", x: 0, y: 0, is_emergency_exit: true }]);

    const res = await request(app)
      .get("/api/location/route")
      .set("Authorization", authHeader())
      .query({ floor_id: floorUuid, x: 0, y: 0 });

    expect(res.status).toBe(404);
  });

  it("rejects invalid query params", async () => {
    const res = await request(app)
      .get("/api/location/route")
      .set("Authorization", authHeader())
      .query({ floor_id: "nope", x: "bad" });
    expect(res.status).toBe(400);
  });

  it("respects the blocked query param", async () => {
    mockWaypointsAndExits(
      [
        { id: "A", x: 0, y: 0, connections: ["B", "C"] },
        { id: "B", x: 10, y: 0, connections: ["A", "D"] },
        { id: "C", x: 0, y: 10, connections: ["A", "D"] },
        { id: "D", x: 10, y: 10, connections: ["B", "C"] },
      ],
      [{ id: "exit-1", x: 12, y: 10, is_emergency_exit: true }]
    );

    const res = await request(app)
      .get("/api/location/route")
      .set("Authorization", authHeader())
      .query({ floor_id: floorUuid, x: 0, y: 0, blocked: "B" });

    expect(res.status).toBe(200);
    // Path must detour around B
    expect(res.body.data.path).not.toContain("B");
    expect(res.body.data.path).toContain("C");
  });
});
