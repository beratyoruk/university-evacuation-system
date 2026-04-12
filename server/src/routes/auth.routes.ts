import { Router, Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: "Email, password, and name are required" });
      return;
    }

    const result = await registerUser(email, password, name, role || "student");
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ success: false, error: message });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const result = await loginUser(email, password);
    res.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    res.status(401).json({ success: false, error: message });
  }
});

export default router;
