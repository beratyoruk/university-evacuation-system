import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/exits?floor_id=...
 * List exits, optionally filtered by floor.
 */
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const floorId = req.query.floor_id as string | undefined;

    let sql = `SELECT id, floor_id, name, type, x, y, is_emergency_exit FROM exits`;
    const params: unknown[] = [];

    if (floorId) {
      params.push(floorId);
      sql += ` WHERE floor_id = $1`;
    }

    sql += " ORDER BY name";
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[exits] list error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch exits" });
  }
});

/**
 * GET /api/exits/:id
 * Get a single exit by ID.
 */
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, floor_id, name, type, x, y, is_emergency_exit FROM exits WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Exit not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[exits] get error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch exit" });
  }
});

/**
 * POST /api/exits
 * Create a new exit point. Admin only.
 * Body: { floor_id, name, type, x, y, is_emergency_exit? }
 */
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { floor_id, name, type, x, y, is_emergency_exit } = req.body;

    if (!floor_id || !name || x === undefined || y === undefined) {
      res.status(400).json({ success: false, error: "floor_id, name, x, and y are required" });
      return;
    }

    const validTypes = ["door", "staircase", "elevator", "emergency"];
    if (type && !validTypes.includes(type)) {
      res.status(400).json({ success: false, error: `type must be one of: ${validTypes.join(", ")}` });
      return;
    }

    const result = await query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, floor_id, name, type, x, y, is_emergency_exit`,
      [floor_id, name, type || "door", x, y, is_emergency_exit ?? false]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[exits] create error:", err);
    res.status(500).json({ success: false, error: "Failed to create exit" });
  }
});

/**
 * PUT /api/exits/:id
 * Update an exit. Admin only.
 * Body: partial { name, type, x, y, is_emergency_exit }
 */
router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, x, y, is_emergency_exit } = req.body;

    const result = await query(
      `UPDATE exits
       SET name              = COALESCE($1, name),
           type              = COALESCE($2, type),
           x                 = COALESCE($3, x),
           y                 = COALESCE($4, y),
           is_emergency_exit = COALESCE($5, is_emergency_exit)
       WHERE id = $6
       RETURNING id, floor_id, name, type, x, y, is_emergency_exit`,
      [name, type, x, y, is_emergency_exit, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Exit not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[exits] update error:", err);
    res.status(500).json({ success: false, error: "Failed to update exit" });
  }
});

/**
 * DELETE /api/exits/:id
 * Delete an exit. Admin only.
 */
router.delete("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("DELETE FROM exits WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Exit not found" });
      return;
    }

    res.json({ success: true, data: { id: result.rows[0].id, deleted: true } });
  } catch (err) {
    console.error("[exits] delete error:", err);
    res.status(500).json({ success: false, error: "Failed to delete exit" });
  }
});

export default router;
