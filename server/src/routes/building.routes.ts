import { Router, Response } from "express";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { upload } from "../utils/upload";
import {
  getAllBuildings,
  getBuildingById,
  createBuilding,
  getFloorsByBuildingId,
  createFloor,
  updateFloorPlan,
} from "../services/building.service";

const router = Router();

router.get("/", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const buildings = await getAllBuildings();
    res.json({ success: true, data: buildings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch buildings";
    res.status(500).json({ success: false, error: message });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const building = await getBuildingById(req.params.id);
    if (!building) {
      res.status(404).json({ success: false, error: "Building not found" });
      return;
    }
    res.json({ success: true, data: building });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch building";
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, latitude, longitude, totalFloors } = req.body;
    const building = await createBuilding({ name, address, latitude, longitude, totalFloors });
    res.status(201).json({ success: true, data: building });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create building";
    res.status(400).json({ success: false, error: message });
  }
});

router.get("/:id/floors", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const floors = await getFloorsByBuildingId(req.params.id);
    res.json({ success: true, data: floors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch floors";
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/:id/floors", authenticate, authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { floorNumber, name, width, height } = req.body;
    const floor = await createFloor({
      buildingId: req.params.id,
      floorNumber,
      name,
      width: width || 100,
      height: height || 100,
    });
    res.status(201).json({ success: true, data: floor });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create floor";
    res.status(400).json({ success: false, error: message });
  }
});

router.post(
  "/:buildingId/floors/:floorId/plan",
  authenticate,
  authorize("admin"),
  upload.single("plan"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded" });
        return;
      }
      const planUrl = `/uploads/${req.file.filename}`;
      const floor = await updateFloorPlan(req.params.floorId, planUrl);
      if (!floor) {
        res.status(404).json({ success: false, error: "Floor not found" });
        return;
      }
      res.json({ success: true, data: floor });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload floor plan";
      res.status(400).json({ success: false, error: message });
    }
  }
);

export default router;
