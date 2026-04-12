import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { planUpload } from "../middleware/upload";

const router = Router();

/**
 * GET /api/floors/:buildingId
 * List all floors for a given building.
 */
router.get("/:buildingId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, building_id, floor_number, floor_name, plan_image_url, plan_json
       FROM floors
       WHERE building_id = $1
       ORDER BY floor_number`,
      [req.params.buildingId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[floors] list error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch floors" });
  }
});

/**
 * GET /api/floors/detail/:id
 * Get a single floor with its exits and waypoints.
 */
router.get("/detail/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const floorResult = await query(
      `SELECT id, building_id, floor_number, floor_name, plan_image_url, plan_json
       FROM floors WHERE id = $1`,
      [req.params.id]
    );

    if (floorResult.rows.length === 0) {
      res.status(404).json({ success: false, error: "Floor not found" });
      return;
    }

    const [exitsResult, waypointsResult] = await Promise.all([
      query("SELECT id, name, type, x, y, is_emergency_exit FROM exits WHERE floor_id = $1", [req.params.id]),
      query("SELECT id, x, y, connections FROM waypoints WHERE floor_id = $1", [req.params.id]),
    ]);

    res.json({
      success: true,
      data: {
        ...floorResult.rows[0],
        exits: exitsResult.rows,
        waypoints: waypointsResult.rows,
      },
    });
  } catch (err) {
    console.error("[floors] detail error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch floor details" });
  }
});

/**
 * POST /api/floors
 * Create a new floor. Admin only.
 * Body: { building_id, floor_number, floor_name, plan_json? }
 */
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { building_id, floor_number, floor_name, plan_json } = req.body;

    if (!building_id || floor_number === undefined || !floor_name) {
      res.status(400).json({ success: false, error: "building_id, floor_number, and floor_name are required" });
      return;
    }

    const result = await query(
      `INSERT INTO floors (building_id, floor_number, floor_name, plan_json)
       VALUES ($1, $2, $3, $4)
       RETURNING id, building_id, floor_number, floor_name, plan_image_url, plan_json`,
      [building_id, floor_number, floor_name, plan_json ? JSON.stringify(plan_json) : null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[floors] create error:", err);
    res.status(500).json({ success: false, error: "Failed to create floor" });
  }
});

/**
 * POST /api/floors/:id/upload-plan
 * Upload a floor plan image (png/jpg/svg) or JSON file.
 * The file is stored on disk and its URL saved to the database.
 * Admin only. Max 10 MB.
 */
router.post(
  "/:id/upload-plan",
  authenticate,
  authorize("admin"),
  planUpload.single("plan"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded" });
        return;
      }

      const planUrl = `/uploads/${req.file.filename}`;

      const result = await query(
        `UPDATE floors SET plan_image_url = $1 WHERE id = $2
         RETURNING id, building_id, floor_number, floor_name, plan_image_url`,
        [planUrl, req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: "Floor not found" });
        return;
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error("[floors] upload-plan error:", err);
      res.status(500).json({ success: false, error: "Failed to upload floor plan" });
    }
  }
);

export default router;
