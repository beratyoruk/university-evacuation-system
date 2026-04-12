import { pool } from "../models/database";

export async function startEmergency(data: {
  buildingId: string;
  type: string;
  severity: string;
  description: string;
  triggeredBy: string;
}) {
  const result = await pool.query(
    `INSERT INTO emergencies (building_id, type, severity, description, triggered_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.buildingId, data.type, data.severity, data.description, data.triggeredBy]
  );
  return mapEmergency(result.rows[0]);
}

export async function endEmergency(emergencyId: string) {
  const result = await pool.query(
    `UPDATE emergencies SET status = 'resolved', ended_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [emergencyId]
  );
  if (result.rows.length === 0) return null;
  return mapEmergency(result.rows[0]);
}

export async function getActiveEmergencies(buildingId?: string) {
  let query = "SELECT * FROM emergencies WHERE status = 'active'";
  const params: string[] = [];

  if (buildingId) {
    params.push(buildingId);
    query += ` AND building_id = $${params.length}`;
  }

  query += " ORDER BY started_at DESC";
  const result = await pool.query(query, params);
  return result.rows.map(mapEmergency);
}

export async function getEvacuationRoutes(emergencyId: string) {
  const result = await pool.query(
    "SELECT * FROM evacuation_routes WHERE emergency_id = $1 AND is_blocked = false",
    [emergencyId]
  );
  return result.rows.map(mapRoute);
}

export async function createEvacuationRoute(data: {
  emergencyId: string;
  floorId: string;
  path: unknown[];
  estimatedTime: number;
  distance: number;
}) {
  const result = await pool.query(
    `INSERT INTO evacuation_routes (emergency_id, floor_id, path, estimated_time, distance)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.emergencyId, data.floorId, JSON.stringify(data.path), data.estimatedTime, data.distance]
  );
  return mapRoute(result.rows[0]);
}

function mapEmergency(row: Record<string, unknown>) {
  return {
    id: row.id,
    buildingId: row.building_id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    description: row.description,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function mapRoute(row: Record<string, unknown>) {
  return {
    id: row.id,
    emergencyId: row.emergency_id,
    floorId: row.floor_id,
    path: row.path,
    estimatedTime: row.estimated_time,
    distance: row.distance,
    isBlocked: row.is_blocked,
  };
}
