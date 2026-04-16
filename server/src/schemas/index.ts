import { z } from "zod";

const uuid = z.string().uuid("Invalid UUID");
const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/i, "Invalid slug");

/* ── Auth ── */
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "user"]).optional(),
  university_id: uuid.optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

/* ── Buildings ── */
export const buildingCreateSchema = z.object({
  university_id: uuid,
  name: z.string().min(1).max(255),
  address: z.string().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  floors_count: z.number().int().min(1).max(200).optional(),
});

export const buildingUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  floors_count: z.number().int().min(1).max(200).optional(),
});

/* ── Floors ── */
export const floorCreateSchema = z.object({
  building_id: uuid,
  floor_number: z.number().int().min(-10).max(200),
  floor_name: z.string().min(1).max(255),
  plan_image_url: z.string().url().optional(),
});

/* ── Exits ── */
export const exitCreateSchema = z.object({
  floor_id: uuid,
  name: z.string().min(1).max(255),
  type: z.enum(["door", "staircase", "elevator", "emergency"]).optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  is_emergency_exit: z.boolean().optional(),
});

/* ── Waypoints ── */
export const waypointCreateSchema = z.object({
  floor_id: uuid,
  x: z.number().finite(),
  y: z.number().finite(),
  connections: z.array(uuid).optional(),
});

/* ── Location ── */
export const locationUpdateSchema = z.object({
  floor_id: uuid,
  x: z.number().finite(),
  y: z.number().finite(),
});

export const routeQuerySchema = z.object({
  floor_id: uuid,
  x: z.coerce.number().finite(),
  y: z.coerce.number().finite(),
  blocked: z.string().max(2000).optional(),
});

/* ── Embed ── */
export const slugParamSchema = z.object({ universitySlug: slug });
