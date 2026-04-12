import bcrypt from "bcrypt";
import { pool } from "./db";

/**
 * Seed the database with sample data for development:
 *  - 1 university
 *  - 1 admin user + 1 regular user
 *  - 2 buildings
 *  - 3 floors (2 in building A, 1 in building B)
 *  - Exits and waypoints for each floor
 *
 * Run via `npm run db:seed`.
 */
async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ─── University ───
    const uniResult = await client.query(
      `INSERT INTO universities (name, slug, logo_url)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["Istanbul Technical University", "itu", "https://example.com/itu-logo.png"]
    );
    const universityId = uniResult.rows[0].id;
    console.log("[seed] University created:", universityId);

    // ─── Users ───
    const adminHash = await bcrypt.hash("admin123", 12);
    const userHash = await bcrypt.hash("user123", 12);

    await client.query(
      `INSERT INTO users (email, password_hash, role, university_id) VALUES
       ($1, $2, 'admin', $3),
       ($4, $5, 'user',  $3)`,
      ["admin@itu.edu.tr", adminHash, universityId, "student@itu.edu.tr", userHash]
    );
    console.log("[seed] Users created (admin@itu.edu.tr / admin123, student@itu.edu.tr / user123)");

    // ─── Building A ───
    const buildingA = await client.query(
      `INSERT INTO buildings (university_id, name, address, lat, lng, floors_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [universityId, "Faculty of Computer Science", "Ayazaga Campus, Maslak", 41.1055, 29.0232, 2]
    );
    const buildingAId = buildingA.rows[0].id;

    // ─── Building B ───
    const buildingB = await client.query(
      `INSERT INTO buildings (university_id, name, address, lat, lng, floors_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [universityId, "Central Library", "Ayazaga Campus, Maslak", 41.1048, 29.0225, 1]
    );
    const buildingBId = buildingB.rows[0].id;
    console.log("[seed] Buildings created:", buildingAId, buildingBId);

    // ─── Floors ───
    const floorA1 = await client.query(
      `INSERT INTO floors (building_id, floor_number, floor_name)
       VALUES ($1, $2, $3) RETURNING id`,
      [buildingAId, 0, "Ground Floor"]
    );
    const floorA1Id = floorA1.rows[0].id;

    const floorA2 = await client.query(
      `INSERT INTO floors (building_id, floor_number, floor_name)
       VALUES ($1, $2, $3) RETURNING id`,
      [buildingAId, 1, "First Floor"]
    );
    const floorA2Id = floorA2.rows[0].id;

    const floorB1 = await client.query(
      `INSERT INTO floors (building_id, floor_number, floor_name)
       VALUES ($1, $2, $3) RETURNING id`,
      [buildingBId, 0, "Ground Floor"]
    );
    const floorB1Id = floorB1.rows[0].id;
    console.log("[seed] Floors created:", floorA1Id, floorA2Id, floorB1Id);

    // ─── Exits ───
    // Building A - Ground Floor
    const exitA1Main = await client.query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [floorA1Id, "Main Entrance", "door", 50, 0, false]
    );
    const exitA1Emergency = await client.query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [floorA1Id, "Emergency Exit North", "emergency", 80, 0, true]
    );
    const exitA1Stairs = await client.query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [floorA1Id, "Staircase A", "staircase", 30, 50, false]
    );

    // Building A - First Floor
    await client.query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit) VALUES
       ($1, 'Staircase A (Up)',   'staircase',  30, 50, false),
       ($1, 'Emergency Exit East', 'emergency', 100, 40, true)`,
      [floorA2Id]
    );

    // Building B - Ground Floor
    const exitB1Main = await client.query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [floorB1Id, "Library Entrance", "door", 40, 0, false]
    );
    const exitB1Emergency = await client.query(
      `INSERT INTO exits (floor_id, name, type, x, y, is_emergency_exit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [floorB1Id, "Fire Exit Rear", "emergency", 40, 80, true]
    );
    console.log("[seed] Exits created");

    // ─── Waypoints for Building A - Ground Floor ───
    // A corridor graph:  wp1 -- wp2 -- wp3
    //                           |
    //                          wp4
    const wpA1 = await insertWaypoint(client, floorA1Id, 20, 30, []);
    const wpA2 = await insertWaypoint(client, floorA1Id, 50, 30, []);
    const wpA3 = await insertWaypoint(client, floorA1Id, 80, 30, []);
    const wpA4 = await insertWaypoint(client, floorA1Id, 50, 55, []);

    // Update connections (bidirectional)
    await setConnections(client, wpA1, [wpA2]);
    await setConnections(client, wpA2, [wpA1, wpA3, wpA4]);
    await setConnections(client, wpA3, [wpA2]);
    await setConnections(client, wpA4, [wpA2]);

    // ─── Waypoints for Building A - First Floor ───
    const wpA2_1 = await insertWaypoint(client, floorA2Id, 30, 30, []);
    const wpA2_2 = await insertWaypoint(client, floorA2Id, 60, 30, []);
    const wpA2_3 = await insertWaypoint(client, floorA2Id, 90, 30, []);

    await setConnections(client, wpA2_1, [wpA2_2]);
    await setConnections(client, wpA2_2, [wpA2_1, wpA2_3]);
    await setConnections(client, wpA2_3, [wpA2_2]);

    // ─── Waypoints for Building B - Ground Floor ───
    const wpB1 = await insertWaypoint(client, floorB1Id, 20, 20, []);
    const wpB2 = await insertWaypoint(client, floorB1Id, 40, 40, []);
    const wpB3 = await insertWaypoint(client, floorB1Id, 60, 20, []);
    const wpB4 = await insertWaypoint(client, floorB1Id, 40, 65, []);

    await setConnections(client, wpB1, [wpB2, wpB3]);
    await setConnections(client, wpB2, [wpB1, wpB3, wpB4]);
    await setConnections(client, wpB3, [wpB1, wpB2]);
    await setConnections(client, wpB4, [wpB2]);
    console.log("[seed] Waypoints created with connections");

    // ─── Sample evacuation routes ───
    await client.query(
      `INSERT INTO evacuation_routes (from_waypoint_id, to_exit_id, path_json, distance) VALUES
       ($1, $2, $3, $4),
       ($5, $6, $7, $8)`,
      [
        wpA4, exitA1Emergency.rows[0].id,
        JSON.stringify([
          { x: 50, y: 55 }, { x: 50, y: 30 }, { x: 80, y: 30 }, { x: 80, y: 0 }
        ]),
        55.0,
        wpB4, exitB1Emergency.rows[0].id,
        JSON.stringify([
          { x: 40, y: 65 }, { x: 40, y: 80 }
        ]),
        15.0,
      ]
    );
    console.log("[seed] Sample evacuation routes created");

    await client.query("COMMIT");
    console.log("\n[seed] Database seeded successfully!");
    console.log("[seed] Login credentials:");
    console.log("  Admin: admin@itu.edu.tr / admin123");
    console.log("  User:  student@itu.edu.tr / user123\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seed] Seeding failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Insert a waypoint and return its UUID.
 */
async function insertWaypoint(
  client: import("pg").PoolClient,
  floorId: string,
  x: number,
  y: number,
  connections: string[]
): Promise<string> {
  const result = await client.query(
    `INSERT INTO waypoints (floor_id, x, y, connections)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [floorId, x, y, JSON.stringify(connections)]
  );
  return result.rows[0].id;
}

/**
 * Update a waypoint's connections array.
 */
async function setConnections(
  client: import("pg").PoolClient,
  waypointId: string,
  connectedIds: string[]
): Promise<void> {
  await client.query(
    `UPDATE waypoints SET connections = $1 WHERE id = $2`,
    [JSON.stringify(connectedIds), waypointId]
  );
}

seed();
