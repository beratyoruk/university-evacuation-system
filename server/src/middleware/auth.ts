import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

/**
 * Extended Express request that carries authenticated user info.
 */
export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  universityId?: string;
}

interface JwtPayload {
  userId: string;
  role: string;
  universityId: string | null;
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header,
 * then attaches userId, userRole, and universityId to the request.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.universityId = decoded.universityId ?? undefined;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

/**
 * Role-based authorization middleware factory.
 * Must be used after `authenticate`.
 * @param roles - Allowed roles (e.g. 'admin', 'user')
 */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ success: false, error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
