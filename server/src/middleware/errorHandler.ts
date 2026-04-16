import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

/**
 * Global error-handling middleware.
 * Must be registered after all routes.
 * Catches thrown errors and multer-specific errors,
 * and returns a consistent JSON error response.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("[error]", err.message);

  // Multer file-size / file-type errors
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ success: false, error: "File too large. Maximum size is 10 MB." });
      return;
    }
    res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    return;
  }

  // Custom multer file-filter error (thrown as plain Error)
  if (err.message && err.message.includes("not allowed")) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }

  // JSON parse errors — body-parser tags these with a `type` property
  if ((err as Error & { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ success: false, error: "Invalid JSON in request body" });
    return;
  }

  // Default 500
  const status = (err as NodeJS.ErrnoException & { status?: number }).status || 500;
  const message = status === 500 ? "Internal server error" : err.message;
  res.status(status).json({ success: false, error: message });
}
