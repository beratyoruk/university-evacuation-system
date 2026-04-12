import { Pool, PoolClient, QueryResult } from "pg";
import { config } from "../config";

/**
 * PostgreSQL connection pool singleton.
 * Uses configuration from environment variables with sensible defaults.
 */
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err: Error) => {
  console.error("[DB] Unexpected pool error:", err.message);
  process.exit(1);
});

/**
 * Execute a parameterized SQL query against the pool.
 * @param text  - SQL query string with $1, $2, … placeholders
 * @param params - Bind parameters
 * @returns Query result
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (config.nodeEnv === "development") {
    console.log("[DB] query", { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }

  return result;
}

/**
 * Acquire a dedicated client from the pool for transactions.
 * Caller must release the client when done.
 * @returns A PoolClient that must be released via client.release()
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Execute a function inside a database transaction.
 * Automatically commits on success or rolls back on error.
 * @param fn - Async function that receives a PoolClient
 * @returns The return value of fn
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
