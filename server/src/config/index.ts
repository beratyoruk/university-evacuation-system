import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  serverUrl: process.env.SERVER_URL || "http://localhost:3001",

  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "evacuation_db",
    user: process.env.DB_USER || "evacuser",
    password: process.env.DB_PASSWORD || "evacpass",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || "10485760", 10), // 10MB
    dir: process.env.UPLOAD_DIR || path.resolve(__dirname, "../../uploads"),
  },
};
