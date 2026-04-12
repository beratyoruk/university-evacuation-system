import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import { pool } from "./db/db";
import { errorHandler } from "./middleware/errorHandler";

// Route imports
import authRoutes from "./routes/auth.routes";
import buildingsRoutes from "./routes/buildings.routes";
import floorsRoutes from "./routes/floors.routes";
import exitsRoutes from "./routes/exits.routes";
import waypointsRoutes from "./routes/waypoints.routes";
import locationRoutes from "./routes/location.routes";

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Setup ───
const io = new SocketIOServer(server, {
  cors: {
    origin:
      config.nodeEnv === "production"
        ? false
        : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Make io accessible to route handlers via req.app.get("io")
app.set("io", io);

// ─── Global Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded floor plan images)
app.use("/uploads", express.static(path.resolve(config.upload.dir)));

// ─── API Routes ───
app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingsRoutes);
app.use("/api/floors", floorsRoutes);
app.use("/api/exits", exitsRoutes);
app.use("/api/waypoints", waypointsRoutes);
app.use("/api/location", locationRoutes);

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

  /**
   * user:location-update
   * Client sends their real-time position.
   * Broadcasted to all other clients (admin dashboards).
   */
  socket.on("user:location-update", (data: { floorId: string; x: number; y: number }) => {
    socket.broadcast.emit("user:location-update", {
      ...data,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * server:route-update
   * When the server recalculates a route (via REST API),
   * it emits this event. Clients can also request it directly.
   */
  socket.on("request:route", (data: { floorId: string; x: number; y: number }) => {
    // Forward to the location route handler logic could be done here,
    // but we keep the heavy logic in REST and just relay events.
    socket.broadcast.emit("user:requesting-route", {
      ...data,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * join/leave building rooms for scoped broadcasts.
   */
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

// ─── Start Server ───
async function start(): Promise<void> {
  try {
    // Test database connection
    const client = await pool.connect();
    client.release();
    console.log("[db] PostgreSQL connected");

    server.listen(config.port, () => {
      console.log(`\n  University Evacuation Server`);
      console.log(`  ----------------------------`);
      console.log(`  Environment : ${config.nodeEnv}`);
      console.log(`  API         : http://localhost:${config.port}/api`);
      console.log(`  WebSocket   : ws://localhost:${config.port}`);
      console.log(`  Health      : http://localhost:${config.port}/api/health\n`);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

start();
