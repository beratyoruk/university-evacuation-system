import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/buildings
 * List all buildings. Optionally filter by ?university_id=...
 */
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const universityId = req.query.university_id as string | undefined;

    let sql = `SELECT id, university_id, name, address, lat, lng, floors_count FROM buildings`;
    const params: unknown[] = [];

    if (universityId) {
      params.push(universityId);
      sql += ` WHERE university_id = $1`;
    }

    sql += " ORDER BY name";
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[buildings] list error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch buildings" });
  }
});

/**
 * GET /api/buildings/:id
 * Get a single building by ID, including its floors.
 */
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const buildingResult = await query(
      `SELECT id, university_id, name, address, lat, lng, floors_count
       FROM buildings WHERE id = $1`,
      [req.params.id]
    );

    if (buildingResult.rows.length === 0) {
      res.status(404).json({ success: false, error: "Building not found" });
      return;
    }

    const floorsResult = await query(
      `SELECT id, floor_number, floor_name, plan_image_url
       FROM floors WHERE building_id = $1 ORDER BY floor_number`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...buildingResult.rows[0],
        floors: floorsResult.rows,
      },
    });
  } catch (err) {
    console.error("[buildings] get error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch building" });
  }
});

/**
 * POST /api/buildings
 * Create a new building. Admin only.
 * Body: { university_id, name, address?, lat?, lng?, floors_count? }
 */
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { university_id, name, address, lat, lng, floors_count } = req.body;

    if (!university_id || !name) {
      res.status(400).json({ success: false, error: "university_id and name are required" });
      return;
    }

    const result = await query(
      `INSERT INTO buildings (university_id, name, address, lat, lng, floors_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, university_id, name, address, lat, lng, floors_count`,
      [university_id, name, address || null, lat || 0, lng || 0, floors_count || 1]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[buildings] create error:", err);
    res.status(500).json({ success: false, error: "Failed to create building" });
  }
});

/**
 * PUT /api/buildings/:id
 * Update an existing building. Admin only.
 * Body: partial { name, address, lat, lng, floors_count }
 */
router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, lat, lng, floors_count } = req.body;

    const result = await query(
      `UPDATE buildings
       SET name         = COALESCE($1, name),
           address      = COALESCE($2, address),
           lat          = COALESCE($3, lat),
           lng          = COALESCE($4, lng),
           floors_count = COALESCE($5, floors_count)
       WHERE id = $6
       RETURNING id, university_id, name, address, lat, lng, floors_count`,
      [name, address, lat, lng, floors_count, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Building not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[buildings] update error:", err);
    res.status(500).json({ success: false, error: "Failed to update building" });
  }
});

/**
 * DELETE /api/buildings/:id
 * Delete a building and all cascading data. Admin only.
 */
router.delete("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("DELETE FROM buildings WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Building not found" });
      return;
    }

    res.json({ success: true, data: { id: result.rows[0].id, deleted: true } });
  } catch (err) {
    console.error("[buildings] delete error:", err);
    res.status(500).json({ success: false, error: "Failed to delete building" });
  }
});

export default router;
