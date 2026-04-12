// ============================================
// University Evacuation System - Shared Types
// ============================================

// --- User & Auth ---

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "admin" | "staff" | "student";

export interface AuthPayload {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

// --- Building & Floor ---

export interface Building {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalFloors: number;
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  planUrl: string | null;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface FloorPlanNode {
  id: string;
  floorId: string;
  x: number;
  y: number;
  z: number;
  type: NodeType;
  label: string;
}

export type NodeType = "room" | "corridor" | "exit" | "stairs" | "elevator" | "door";

export interface FloorPlanEdge {
  id: string;
  floorId: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  isAccessible: boolean;
}

// --- Sensor ---

export interface Sensor {
  id: string;
  floorId: string;
  nodeId: string;
  type: SensorType;
  status: SensorStatus;
  lastReading: number | null;
  lastReadingAt: string | null;
}

export type SensorType = "smoke" | "heat" | "occupancy" | "gas" | "door_status";
export type SensorStatus = "active" | "inactive" | "alert" | "fault";

export interface SensorReading {
  sensorId: string;
  value: number;
  timestamp: string;
}

// --- Emergency & Evacuation ---

export interface Emergency {
  id: string;
  buildingId: string;
  type: EmergencyType;
  severity: EmergencySeverity;
  status: EmergencyStatus;
  description: string;
  triggeredBy: string;
  startedAt: string;
  endedAt: string | null;
}

export type EmergencyType = "fire" | "earthquake" | "gas_leak" | "flood" | "security_threat" | "other";
export type EmergencySeverity = "low" | "medium" | "high" | "critical";
export type EmergencyStatus = "active" | "resolved" | "cancelled";

export interface EvacuationRoute {
  id: string;
  emergencyId: string;
  floorId: string;
  path: RoutePoint[];
  estimatedTime: number; // seconds
  distance: number; // meters
  isBlocked: boolean;
}

export interface RoutePoint {
  nodeId: string;
  x: number;
  y: number;
  z: number;
  order: number;
}

// --- WebSocket Events ---

export interface WsEmergencyStart {
  emergency: Emergency;
  routes: EvacuationRoute[];
}

export interface WsEmergencyEnd {
  emergencyId: string;
  endedAt: string;
}

export interface WsRouteUpdate {
  emergencyId: string;
  route: EvacuationRoute;
}

export interface WsSensorData {
  sensorId: string;
  type: SensorType;
  value: number;
  status: SensorStatus;
  timestamp: string;
}

export interface WsUserLocation {
  userId: string;
  floorId: string;
  x: number;
  y: number;
}

export interface WsUserSafe {
  userId: string;
  exitNodeId: string;
  timestamp: string;
}

// --- API Response ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
