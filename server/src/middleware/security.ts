import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import { config } from "../config";

/**
 * Origin whitelist — drawn from config + a few safe defaults for local dev.
 * In production, set CORS_ALLOWED_ORIGINS to a comma-separated list of
 * university domains that are allowed to embed or call the API directly.
 */
const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const devOrigins =
  config.nodeEnv === "production"
    ? []
    : ["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"];

export const allowedOrigins = Array.from(new Set([...envOrigins, ...devOrigins]));

/**
 * Main API CORS — whitelist mode.
 * Non-browser clients (no origin header) are allowed through so server-to-server
 * calls and health checks still work.
 */
export const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
};

export const corsMiddleware = cors(corsOptions);

/**
 * Helmet configuration — applies a conservative set of security headers.
 * CSP is relaxed enough to keep the widget iframe and Socket.IO working,
 * but disables inline-eval and mixed-content by default.
 */
export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy:
    config.nodeEnv === "production"
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'", "ws:", "wss:"],
            "frame-ancestors": ["*"],
          },
        }
      : false,
});
