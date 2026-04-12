import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db/db";
import { config } from "../config";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const SALT_ROUNDS = 12;

/**
 * Generate a JWT token for the given user.
 */
function signToken(userId: string, role: string, universityId: string | null): string {
  return jwt.sign({ userId, role, universityId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * POST /api/auth/register
 * Register a new user account.
 * Body: { email, password, role?, university_id? }
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, role, university_id } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    // Check duplicate
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = role === "admin" ? "admin" : "user";

    const result = await query(
      `INSERT INTO users (email, password_hash, role, university_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, university_id, created_at`,
      [email, passwordHash, userRole, university_id || null]
    );

    const user = result.rows[0];
    const token = signToken(user.id as string, user.role as string, user.university_id as string | null);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          universityId: user.university_id,
          createdAt: user.created_at,
        },
      },
    });
  } catch (err) {
    console.error("[auth] register error:", err);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

/**
 * POST /api/auth/login
 * Authenticate with email and password.
 * Body: { email, password }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const result = await query(
      "SELECT id, email, password_hash, role, university_id, created_at FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash as string);

    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const token = signToken(user.id as string, user.role as string, user.university_id as string | null);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          universityId: user.university_id,
          createdAt: user.created_at,
        },
      },
    });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.role, u.university_id, u.created_at,
              un.name AS university_name
       FROM users u
       LEFT JOIN universities un ON un.id = u.university_id
       WHERE u.id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        universityId: user.university_id,
        universityName: user.university_name,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error("[auth] me error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch user profile" });
  }
});

export default router;
