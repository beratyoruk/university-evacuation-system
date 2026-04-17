import { Router, Response } from "express";
import { query } from "../db/db";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { buildingCreateSchema, buildingUpdateSchema } from "../schemas";

const router = Router();

/**
 * GET /api/buildings
 * List all buildings. Optionally filter by ?university_id=...
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const universityId = req.query.university_id as string | undefined;

    let sql = `SELECT id, university_id, name, address,
                      lat  AS latitude,
                      lng  AS longitude,
                      floors_count AS "totalFloors"
               FROM buildings`;
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
 * Haversine great-circle distance in meters between two lat/lng pairs.
 */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * GET /api/buildings/nearest?lat=XX&lng=YY&radius=500
 * Find the closest building within `radius` meters (default 500) of the
 * given GPS coordinates. Returns the building plus all its floors, or
 * `no_building_nearby` if nothing is in range.
 */
router.get("/nearest", async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 500;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ success: false, error: "lat and lng query parameters are required" });
      return;
    }

    const buildingsResult = await query(
      `SELECT id, university_id, name, address,
              lat  AS latitude,
              lng  AS longitude,
              floors_count AS "totalFloors"
       FROM buildings
       WHERE lat IS NOT NULL AND lng IS NOT NULL`
    );

    let nearest: (typeof buildingsResult.rows[number] & { distance: number }) | null = null;
    for (const b of buildingsResult.rows) {
      const d = haversine(lat, lng, Number(b.latitude), Number(b.longitude));
      if (nearest === null || d < nearest.distance) {
        nearest = { ...b, distance: d };
      }
    }

    if (!nearest || nearest.distance > radius) {
      res.json({
        success: true,
        data: null,
        reason: "no_building_nearby",
        nearestDistance: nearest?.distance ?? null,
      });
      return;
    }

    const floorsResult = await query(
      `SELECT id,
              building_id    AS "buildingId",
              floor_number   AS "floorNumber",
              floor_name     AS name,
              plan_image_url AS "planUrl",
              plan_json      AS "planJson"
       FROM floors WHERE building_id = $1 ORDER BY floor_number`,
      [nearest.id]
    );

    res.json({
      success: true,
      data: {
        ...nearest,
        floors: floorsResult.rows,
      },
    });
  } catch (err) {
    console.error("[buildings] nearest error:", err);
    res.status(500).json({ success: false, error: "Failed to find nearest building" });
  }
});

/**
 * GET /api/buildings/:id
 * Get a single building by ID, including its floors.
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const buildingResult = await query(
      `SELECT id, university_id, name, address,
              lat  AS latitude,
              lng  AS longitude,
              floors_count AS "totalFloors"
       FROM buildings WHERE id = $1`,
      [req.params.id]
    );

    if (buildingResult.rows.length === 0) {
      res.status(404).json({ success: false, error: "Building not found" });
      return;
    }

    const floorsResult = await query(
      `SELECT id,
              building_id     AS "buildingId",
              floor_number    AS "floorNumber",
              floor_name      AS name,
              plan_image_url  AS "planUrl"
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
router.post("/", authenticate, authorize("admin"), validate(buildingCreateSchema), async (req: AuthRequest, res: Response) => {
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
router.put("/:id", authenticate, authorize("admin"), validate(buildingUpdateSchema), async (req: AuthRequest, res: Response) => {
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
