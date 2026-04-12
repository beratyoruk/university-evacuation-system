import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { findNearestWaypoint, normalizeCoordinates } from "../services/location.service";
import { findEvacuationRoute } from "../services/pathfinding.service";

const router = Router();

/**
 * POST /api/location/update
 * Receive a real-time location update from a user.
 * Body: { floor_id, x, y }
 * The server broadcasts the update via Socket.IO and stores the nearest waypoint.
 */
router.post("/update", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { floor_id, x, y } = req.body;

    if (!floor_id || x === undefined || y === undefined) {
      res.status(400).json({ success: false, error: "floor_id, x, and y are required" });
      return;
    }

    const normalized = normalizeCoordinates(x, y);

    // Find the nearest waypoint to the user's position
    const waypointsResult = await query(
      "SELECT id, x, y, connections FROM waypoints WHERE floor_id = $1",
      [floor_id]
    );

    const nearest = findNearestWaypoint(normalized.x, normalized.y, waypointsResult.rows as Array<{
      id: string; x: number; y: number; connections: string[];
    }>);

    // Broadcast via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.emit("user:location-update", {
        userId: req.userId,
        floorId: floor_id,
        x: normalized.x,
        y: normalized.y,
        nearestWaypointId: nearest?.id ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        x: normalized.x,
        y: normalized.y,
        nearestWaypointId: nearest?.id ?? null,
        nearestWaypointDistance: nearest?.distance ?? null,
      },
    });
  } catch (err) {
    console.error("[location] update error:", err);
    res.status(500).json({ success: false, error: "Failed to update location" });
  }
});

/**
 * GET /api/location/route?floor_id=...&x=...&y=...&blocked=id1,id2
 * Calculate the optimal evacuation route from the user's current position
 * to the nearest emergency exit on the given floor.
 * Optional `blocked` query param: comma-separated waypoint IDs to exclude (blocked paths).
 */
router.get("/route", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const floorId = req.query.floor_id as string;
    const x = parseFloat(req.query.x as string);
    const y = parseFloat(req.query.y as string);
    const blockedParam = req.query.blocked as string | undefined;

    if (!floorId || isNaN(x) || isNaN(y)) {
      res.status(400).json({ success: false, error: "floor_id, x, and y query params are required" });
      return;
    }

    const blockedIds = blockedParam ? blockedParam.split(",").map((s) => s.trim()) : [];

    // Fetch all waypoints and exits for this floor
    const [waypointsResult, exitsResult] = await Promise.all([
      query("SELECT id, x, y, connections FROM waypoints WHERE floor_id = $1", [floorId]),
      query(
        "SELECT id, x, y, is_emergency_exit FROM exits WHERE floor_id = $1 AND is_emergency_exit = true",
        [floorId]
      ),
    ]);

    const waypoints = waypointsResult.rows as Array<{
      id: string; x: number; y: number; connections: string[];
    }>;
    const exits = exitsResult.rows as Array<{
      id: string; x: number; y: number; is_emergency_exit: boolean;
    }>;

    if (exits.length === 0) {
      res.status(404).json({ success: false, error: "No emergency exits found on this floor" });
      return;
    }

    // Find nearest waypoint to user
    const nearest = findNearestWaypoint(x, y, waypoints);
    if (!nearest) {
      res.status(404).json({ success: false, error: "No waypoints found on this floor" });
      return;
    }

    // Run A* to find best route to closest emergency exit
    const route = findEvacuationRoute(waypoints, exits, nearest.id, blockedIds);

    if (!route) {
      res.status(404).json({ success: false, error: "No evacuation route available (all paths blocked)" });
      return;
    }

    // Broadcast the route via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.emit("server:route-update", {
        userId: req.userId,
        floorId,
        route,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true, data: route });
  } catch (err) {
    console.error("[location] route error:", err);
    res.status(500).json({ success: false, error: "Failed to calculate evacuation route" });
  }
});

export default router;
