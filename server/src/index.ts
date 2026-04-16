import express from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import { pool } from "./db/db";
import { errorHandler } from "./middleware/errorHandler";
import {
  corsMiddleware,
  corsOptions,
  helmetMiddleware,
  allowedOrigins,
} from "./middleware/security";
import { generalLimiter } from "./middleware/rateLimit";

// Route imports
import authRoutes from "./routes/auth.routes";
import buildingsRoutes from "./routes/buildings.routes";
import floorsRoutes from "./routes/floors.routes";
import exitsRoutes from "./routes/exits.routes";
import waypointsRoutes from "./routes/waypoints.routes";
import locationRoutes from "./routes/location.routes";
import embedRoutes from "./routes/embed.routes";

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Setup ───
const io = new SocketIOServer(server, {
  cors: {
    origin:
      config.nodeEnv === "production"
        ? allowedOrigins.length > 0
          ? allowedOrigins
          : false
        : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// Trust proxy so rate-limit + CORS behave correctly behind a reverse proxy
app.set("trust proxy", 1);

// ─── Security middleware ───
app.use(helmetMiddleware);
app.use(corsMiddleware);

// ─── Body parsing ───
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Static files (uploaded floor plan images)
app.use("/uploads", express.static(path.resolve(config.upload.dir)));

// ─── Global rate limit for API ───
app.use("/api", generalLimiter);

// ─── API Routes ───
app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingsRoutes);
app.use("/api/floors", floorsRoutes);
app.use("/api/exits", exitsRoutes);
app.use("/api/waypoints", waypointsRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/embed", embedRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "University Evacuation Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Error Handler (must be registered after routes) ───
app.use(errorHandler);

// ─── Socket.IO Events ───
io.on("connection", (socket) => {
  console.log(`[ws] Client connected: ${socket.id}`);

  socket.on("user:location-update", (data: { floorId: string; x: number; y: number }) => {
    socket.broadcast.emit("user:location-update", {
      ...data,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("request:route", (data: { floorId: string; x: number; y: number }) => {
    socket.broadcast.emit("user:requesting-route", {
      ...data,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("join:building", (buildingId: string) => {
    socket.join(`building:${buildingId}`);
    console.log(`[ws] ${socket.id} joined building:${buildingId}`);
  });

  socket.on("leave:building", (buildingId: string) => {
    socket.leave(`building:${buildingId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[ws] Client disconnected: ${socket.id}`);
  });
});

// avoid unused-warning for corsOptions export reuse
void corsOptions;

async function start(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
    console.log("[db] PostgreSQL connected");

    server.listen(config.port, () => {
      console.log(`\n  University Evacuation Server`);
      console.log(`  ----------------------------`);
      console.log(`  Environment : ${config.nodeEnv}`);
      console.log(`  API         : http://localhost:${config.port}/api`);
      console.log(`  WebSocket   : ws://localhost:${config.port}`);
      console.log(`  Health      : http://localhost:${config.port}/api/health`);
      console.log(`  CORS origins: ${allowedOrigins.length ? allowedOrigins.join(", ") : "(none configured)"}\n`);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

start();
