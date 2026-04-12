import { Router, Response } from "express";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import {
  startEmergency,
  endEmergency,
  getActiveEmergencies,
  getEvacuationRoutes,
} from "../services/emergency.service";

const router = Router();

router.post("/start", authenticate, authorize("admin", "staff"), async (req: AuthRequest, res: Response) => {
  try {
    const { buildingId, type, severity, description } = req.body;

    if (!buildingId || !type) {
      res.status(400).json({ success: false, error: "buildingId and type are required" });
      return;
    }

    const emergency = await startEmergency({
      buildingId,
      type,
      severity: severity || "medium",
      description: description || "",
      triggeredBy: req.userId!,
    });

    // Emit to all connected clients via Socket.IO (handled in index.ts)
    const io = req.app.get("io");
    if (io) {
      io.emit("emergency:start", { emergency, routes: [] });
    }

    res.status(201).json({ success: true, data: emergency });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start emergency";
    res.status(400).json({ success: false, error: message });
  }
});

router.post("/end", authenticate, authorize("admin", "staff"), async (req: AuthRequest, res: Response) => {
  try {
    const { emergencyId } = req.body;

    if (!emergencyId) {
      res.status(400).json({ success: false, error: "emergencyId is required" });
      return;
    }

    const emergency = await endEmergency(emergencyId);
    if (!emergency) {
      res.status(404).json({ success: false, error: "Active emergency not found" });
      return;
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("emergency:end", { emergencyId, endedAt: emergency.endedAt });
    }

    res.json({ success: true, data: emergency });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to end emergency";
    res.status(400).json({ success: false, error: message });
  }
});

router.get("/active", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const buildingId = req.query.buildingId as string | undefined;
    const emergencies = await getActiveEmergencies(buildingId);
    res.json({ success: true, data: emergencies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch emergencies";
    res.status(500).json({ success: false, error: message });
  }
});

router.get("/routes/:emergencyId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const routes = await getEvacuationRoutes(req.params.emergencyId);
    res.json({ success: true, data: routes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch routes";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
