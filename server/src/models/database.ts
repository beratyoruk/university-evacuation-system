import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
  process.exit(-1);
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS buildings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
        longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
        total_floors INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS floors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
        floor_number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        plan_url TEXT,
        width DOUBLE PRECISION NOT NULL DEFAULT 100,
        height DOUBLE PRECISION NOT NULL DEFAULT 100,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS floor_plan_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
        x DOUBLE PRECISION NOT NULL,
        y DOUBLE PRECISION NOT NULL,
        z DOUBLE PRECISION NOT NULL DEFAULT 0,
        type VARCHAR(50) NOT NULL,
        label VARCHAR(255) NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS floor_plan_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
        from_node_id UUID NOT NULL REFERENCES floor_plan_nodes(id) ON DELETE CASCADE,
        to_node_id UUID NOT NULL REFERENCES floor_plan_nodes(id) ON DELETE CASCADE,
        weight DOUBLE PRECISION NOT NULL DEFAULT 1,
        is_accessible BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS sensors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
        node_id UUID REFERENCES floor_plan_nodes(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        last_reading DOUBLE PRECISION,
        last_reading_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS emergencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        description TEXT NOT NULL DEFAULT '',
        triggered_by UUID REFERENCES users(id),
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS evacuation_routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        emergency_id UUID NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
        floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
        path JSONB NOT NULL DEFAULT '[]',
        estimated_time DOUBLE PRECISION NOT NULL DEFAULT 0,
        distance DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_blocked BOOLEAN NOT NULL DEFAULT false
      );
    `);
    console.log("Database tables initialized successfully");
  } finally {
    client.release();
  }
}
