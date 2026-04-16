import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { planUpload } from "../middleware/upload";
import { cacheGet, cacheSet, cacheDel, cacheKeys } from "../db/cache";

const router = Router();

/**
 * GET /api/floors/:buildingId
 * List all floors for a given building.
 */
router.get("/:buildingId", async (req: AuthRequest, res: Response) => {
  try {
    const key = cacheKeys.floorsList(String(req.params.buildingId));
    const cached = await cacheGet<unknown[]>(key);
    if (cached) {
      res.json({ success: true, data: cached, cached: true });
      return;
    }

    const result = await query(
      `SELECT id,
              building_id    AS "buildingId",
              floor_number   AS "floorNumber",
              floor_name     AS name,
              plan_image_url AS "planUrl",
              plan_json      AS "planJson"
       FROM floors
       WHERE building_id = $1
       ORDER BY floor_number`,
      [req.params.buildingId]
    );

    await cacheSet(key, result.rows);
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
router.get("/detail/:id", async (req: AuthRequest, res: Response) => {
  try {
    const key = cacheKeys.floorDetail(String(req.params.id));
    const cached = await cacheGet<unknown>(key);
    if (cached) {
      res.json({ success: true, data: cached, cached: true });
      return;
    }

    const floorResult = await query(
      `SELECT id,
              building_id    AS "buildingId",
              floor_number   AS "floorNumber",
              floor_name     AS name,
              plan_image_url AS "planUrl",
              plan_json      AS "planJson"
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

    const payload = {
      ...floorResult.rows[0],
      exits: exitsResult.rows,
      waypoints: waypointsResult.rows,
    };

    await cacheSet(key, payload);
    res.json({ success: true, data: payload });
  } catch (err) {
    console.error("[floors] detail error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch floor details" });
  }
});

/**
 * GET /api/floors/:id/plan
 * Return just the plan_json payload (walls, rooms, exits) for a floor.
 * Consumed by the public EvacuationView viewer; no auth required.
 */
router.get("/:id/plan", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT plan_json AS "planJson" FROM floors WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Floor not found" });
      return;
    }

    res.json({ success: true, data: { planJson: result.rows[0].planJson ?? { walls: [], rooms: [], exits: [] } } });
  } catch (err) {
    console.error("[floors] plan error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch floor plan" });
  }
});

/**
 * PUT /api/floors/:id/plan
 * Overwrite the plan_json payload for a floor. Admin only.
 * Body: { planJson: { walls, rooms, exits } }
 */
router.put("/:id/plan", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { planJson } = req.body;
    if (!planJson || typeof planJson !== "object") {
      res.status(400).json({ success: false, error: "planJson is required" });
      return;
    }

    const result = await query(
      `UPDATE floors SET plan_json = $1 WHERE id = $2
       RETURNING id, building_id AS "buildingId", plan_json AS "planJson"`,
      [JSON.stringify(planJson), req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Floor not found" });
      return;
    }

    await cacheDel(cacheKeys.floorDetail(String(req.params.id)));
    await cacheDel(cacheKeys.floorsList(String(result.rows[0].buildingId)));
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[floors] save plan error:", err);
    res.status(500).json({ success: false, error: "Failed to save floor plan" });
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

    await cacheDel(cacheKeys.floorsList(String(building_id)));
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

      await cacheDel(cacheKeys.floorDetail(String(req.params.id)));
      await cacheDel(cacheKeys.floorsList(String(result.rows[0].building_id)));
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error("[floors] upload-plan error:", err);
      res.status(500).json({ success: false, error: "Failed to upload floor plan" });
    }
  }
);

export default router;
