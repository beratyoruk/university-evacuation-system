import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/waypoints?floor_id=...
 * List waypoints for a given floor (required query param).
 */
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const floorId = req.query.floor_id as string | undefined;

    if (!floorId) {
      res.status(400).json({ success: false, error: "floor_id query parameter is required" });
      return;
    }

    const result = await query(
      `SELECT id, floor_id, x, y, connections FROM waypoints WHERE floor_id = $1 ORDER BY x, y`,
      [floorId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[waypoints] list error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch waypoints" });
  }
});

/**
 * GET /api/waypoints/:id
 * Get a single waypoint by ID.
 */
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, floor_id, x, y, connections FROM waypoints WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Waypoint not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[waypoints] get error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch waypoint" });
  }
});

/**
 * POST /api/waypoints
 * Create a new waypoint. Admin only.
 * Body: { floor_id, x, y, connections? }
 * connections is an array of waypoint UUIDs this node connects to.
 */
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { floor_id, x, y, connections } = req.body;

    if (!floor_id || x === undefined || y === undefined) {
      res.status(400).json({ success: false, error: "floor_id, x, and y are required" });
      return;
    }

    const result = await query(
      `INSERT INTO waypoints (floor_id, x, y, connections)
       VALUES ($1, $2, $3, $4)
       RETURNING id, floor_id, x, y, connections`,
      [floor_id, x, y, JSON.stringify(connections || [])]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[waypoints] create error:", err);
    res.status(500).json({ success: false, error: "Failed to create waypoint" });
  }
});

/**
 * PUT /api/waypoints/:id
 * Update a waypoint's position or connections. Admin only.
 * Body: partial { x, y, connections }
 */
router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { x, y, connections } = req.body;

    const result = await query(
      `UPDATE waypoints
       SET x           = COALESCE($1, x),
           y           = COALESCE($2, y),
           connections = COALESCE($3, connections)
       WHERE id = $4
       RETURNING id, floor_id, x, y, connections`,
      [x, y, connections ? JSON.stringify(connections) : null, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Waypoint not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[waypoints] update error:", err);
    res.status(500).json({ success: false, error: "Failed to update waypoint" });
  }
});

/**
 * POST /api/waypoints/bulk
 * Bulk upsert waypoints for a floor. Admin only.
 * Useful for saving an entire floor graph at once.
 * Body: { floor_id, waypoints: [{ id?, x, y, connections }] }
 */
router.post("/bulk", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { floor_id, waypoints } = req.body;

    if (!floor_id || !Array.isArray(waypoints)) {
      res.status(400).json({ success: false, error: "floor_id and waypoints array are required" });
      return;
    }

    const results = [];

    for (const wp of waypoints) {
      if (wp.id) {
        // Update existing
        const r = await query(
          `UPDATE waypoints SET x = $1, y = $2, connections = $3
           WHERE id = $4 AND floor_id = $5
           RETURNING id, floor_id, x, y, connections`,
          [wp.x, wp.y, JSON.stringify(wp.connections || []), wp.id, floor_id]
        );
        if (r.rows.length > 0) results.push(r.rows[0]);
      } else {
        // Insert new
        const r = await query(
          `INSERT INTO waypoints (floor_id, x, y, connections)
           VALUES ($1, $2, $3, $4)
           RETURNING id, floor_id, x, y, connections`,
          [floor_id, wp.x, wp.y, JSON.stringify(wp.connections || [])]
        );
        results.push(r.rows[0]);
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("[waypoints] bulk error:", err);
    res.status(500).json({ success: false, error: "Failed to bulk upsert waypoints" });
  }
});

export default router;
