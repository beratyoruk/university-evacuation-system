import { Router, Request, Response } from "express";
import cors from "cors";
import { query } from "../db/db";

const router = Router();

/**
 * Public embed API — intended to be consumed by third-party sites
 * that have integrated the evacuation widget. All endpoints allow
 * cross-origin requests from any origin.
 */
const publicCors = cors({ origin: "*", methods: ["GET", "OPTIONS"] });
router.use(publicCors);
router.options("*", publicCors);

/**
 * GET /api/embed/config/:universitySlug
 * Public widget configuration for the given university.
 * Exposes non-sensitive information needed to initialize the embed.
 */
router.get("/config/:universitySlug", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.universitySlug).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
      res.status(400).json({ success: false, error: "Invalid university slug" });
      return;
    }

    const uniResult = await query(
      `SELECT id, name, slug, logo_url, created_at
         FROM universities WHERE slug = $1`,
      [slug]
    );

    if (uniResult.rows.length === 0) {
      res.status(404).json({ success: false, error: "University not found" });
      return;
    }

    const uni = uniResult.rows[0];
    const buildingsCountResult = await query(
      "SELECT COUNT(*)::int AS count FROM buildings WHERE university_id = $1",
      [uni.id]
    );

    res.json({
      success: true,
      data: {
        university: {
          id: uni.id,
          name: uni.name,
          slug: uni.slug,
          logoUrl: uni.logo_url,
        },
        buildingsCount: buildingsCountResult.rows[0]?.count ?? 0,
        widget: {
          version: "1.0.0",
          apiBase: "/api",
          supportedLocales: ["tr", "en"],
        },
      },
    });
  } catch (err) {
    console.error("[embed] config error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch embed config" });
  }
});

/**
 * GET /api/embed/buildings/:universitySlug
 * Public list of buildings for a given university — no auth required.
 */
router.get("/buildings/:universitySlug", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.universitySlug).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
      res.status(400).json({ success: false, error: "Invalid university slug" });
      return;
    }

    const result = await query(
      `SELECT b.id, b.name, b.address, b.lat, b.lng, b.floors_count
         FROM buildings b
         JOIN universities u ON u.id = b.university_id
         WHERE u.slug = $1
         ORDER BY b.name`,
      [slug]
    );

    res.json({
      success: true,
      data: result.rows.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        floorsCount: b.floors_count,
      })),
    });
  } catch (err) {
    console.error("[embed] buildings error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch buildings" });
  }
});

export default router;
