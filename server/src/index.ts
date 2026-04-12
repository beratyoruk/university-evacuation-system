import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import { initDatabase } from "./models/database";
import authRoutes from "./routes/auth.routes";
import buildingRoutes from "./routes/building.routes";
import emergencyRoutes from "./routes/emergency.routes";

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: config.nodeEnv === "production" ? false : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Make io accessible to routes
app.set("io", io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded floor plans)
app.use("/uploads", express.static(path.resolve(config.upload.dir)));

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/buildings", buildingRoutes);
app.use("/api/v1/emergency", emergencyRoutes);

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() });
});

// Socket.IO events
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("user:location", (data) => {
    // Broadcast user location to admin clients
    socket.broadcast.emit("user:location", {
      ...data,
      socketId: socket.id,
    });
  });

  socket.on("user:safe", (data) => {
    // Broadcast that user reached safety
    io.emit("user:safe", {
      ...data,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("join:building", (buildingId: string) => {
    socket.join(`building:${buildingId}`);
    console.log(`Socket ${socket.id} joined building:${buildingId}`);
  });

  socket.on("leave:building", (buildingId: string) => {
    socket.leave(`building:${buildingId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
async function start() {
  try {
    // Initialize database tables
    await initDatabase();
    console.log("Database connected and initialized");

    server.listen(config.port, () => {
      console.log(`\n🚀 University Evacuation Server running on port ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   API: http://localhost:${config.port}/api/v1`);
      console.log(`   WebSocket: ws://localhost:${config.port}\n`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
