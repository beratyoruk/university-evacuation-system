import { pool } from "../models/database";

export async function getAllBuildings() {
  const result = await pool.query(
    "SELECT id, name, address, latitude, longitude, total_floors, created_at, updated_at FROM buildings ORDER BY name"
  );
  return result.rows.map(mapBuilding);
}

export async function getBuildingById(id: string) {
  const result = await pool.query(
    "SELECT id, name, address, latitude, longitude, total_floors, created_at, updated_at FROM buildings WHERE id = $1",
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapBuilding(result.rows[0]);
}

export async function createBuilding(data: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalFloors: number;
}) {
  const result = await pool.query(
    `INSERT INTO buildings (name, address, latitude, longitude, total_floors)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, address, latitude, longitude, total_floors, created_at, updated_at`,
    [data.name, data.address, data.latitude, data.longitude, data.totalFloors]
  );
  return mapBuilding(result.rows[0]);
}

export async function getFloorsByBuildingId(buildingId: string) {
  const result = await pool.query(
    `SELECT id, building_id, floor_number, name, plan_url, width, height, created_at, updated_at
     FROM floors WHERE building_id = $1 ORDER BY floor_number`,
    [buildingId]
  );
  return result.rows.map(mapFloor);
}

export async function createFloor(data: {
  buildingId: string;
  floorNumber: number;
  name: string;
  width: number;
  height: number;
}) {
  const result = await pool.query(
    `INSERT INTO floors (building_id, floor_number, name, width, height)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, building_id, floor_number, name, plan_url, width, height, created_at, updated_at`,
    [data.buildingId, data.floorNumber, data.name, data.width, data.height]
  );
  return mapFloor(result.rows[0]);
}

export async function updateFloorPlan(floorId: string, planUrl: string) {
  const result = await pool.query(
    `UPDATE floors SET plan_url = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, building_id, floor_number, name, plan_url, width, height, created_at, updated_at`,
    [planUrl, floorId]
  );
  if (result.rows.length === 0) return null;
  return mapFloor(result.rows[0]);
}

function mapBuilding(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    totalFloors: row.total_floors,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFloor(row: Record<string, unknown>) {
  return {
    id: row.id,
    buildingId: row.building_id,
    floorNumber: row.floor_number,
    name: row.name,
    planUrl: row.plan_url,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
