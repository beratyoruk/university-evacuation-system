import express, { Express } from "express";
import { errorHandler } from "../middleware/errorHandler";

/**
 * Build a minimal Express app for integration-style route tests.
 * Mounts the given routers on /api/<prefix>. Skips socket.io, security
 * headers, and rate limiting so tests stay fast and deterministic.
 */
export function buildTestApp(mounts: Array<{ prefix: string; router: express.Router }>): Express {
  const app = express();
  app.use(express.json());
  for (const m of mounts) {
    app.use(`/api/${m.prefix}`, m.router);
  }
  app.use(errorHandler);
  return app;
}
