import fs from "fs";
import path from "path";
import { pool } from "./db";

/**
 * Run the database migration by executing schema.sql.
 * Creates all tables if they do not already exist.
 * Intended to be run via `npm run db:migrate`.
 */
async function migrate(): Promise<void> {
  const schemaPath = path.resolve(__dirname, "schema.sql");

  console.log("[migrate] Reading schema from", schemaPath);
  const sql = fs.readFileSync(schemaPath, "utf-8");

  const client = await pool.connect();
  try {
    console.log("[migrate] Applying schema...");
    await client.query(sql);
    console.log("[migrate] Schema applied successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
