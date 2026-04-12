-- =============================================
-- University Evacuation System - Database Schema
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------
-- Universities
-- ----------------------------
CREATE TABLE IF NOT EXISTS universities (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    logo_url    TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_universities_slug ON universities(slug);

-- ----------------------------
-- Users
-- ----------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(10)  NOT NULL DEFAULT 'user'
                        CHECK (role IN ('admin', 'user')),
    university_id   UUID REFERENCES universities(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email         ON users(email);
CREATE INDEX idx_users_university_id ON users(university_id);

-- ----------------------------
-- Buildings
-- ----------------------------
CREATE TABLE IF NOT EXISTS buildings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    lat             DOUBLE PRECISION NOT NULL DEFAULT 0,
    lng             DOUBLE PRECISION NOT NULL DEFAULT 0,
    floors_count    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_buildings_university_id ON buildings(university_id);

-- ----------------------------
-- Floors
-- ----------------------------
CREATE TABLE IF NOT EXISTS floors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number    INTEGER NOT NULL,
    floor_name      VARCHAR(255) NOT NULL,
    plan_image_url  TEXT,
    plan_json       JSONB,
    UNIQUE (building_id, floor_number)
);

CREATE INDEX idx_floors_building_id ON floors(building_id);

-- ----------------------------
-- Exits
-- ----------------------------
CREATE TABLE IF NOT EXISTS exits (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id          UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    type              VARCHAR(20)  NOT NULL DEFAULT 'door'
                          CHECK (type IN ('door', 'staircase', 'elevator', 'emergency')),
    x                 DOUBLE PRECISION NOT NULL,
    y                 DOUBLE PRECISION NOT NULL,
    is_emergency_exit BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_exits_floor_id ON exits(floor_id);

-- ----------------------------
-- Waypoints
-- ----------------------------
CREATE TABLE IF NOT EXISTS waypoints (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id    UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    x           DOUBLE PRECISION NOT NULL,
    y           DOUBLE PRECISION NOT NULL,
    connections JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_waypoints_floor_id ON waypoints(floor_id);

-- ----------------------------
-- Evacuation Routes (pre-computed or cached)
-- ----------------------------
CREATE TABLE IF NOT EXISTS evacuation_routes (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_waypoint_id  UUID NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE,
    to_exit_id        UUID NOT NULL REFERENCES exits(id) ON DELETE CASCADE,
    path_json         JSONB NOT NULL DEFAULT '[]',
    distance          DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX idx_evacuation_routes_from ON evacuation_routes(from_waypoint_id);
CREATE INDEX idx_evacuation_routes_to   ON evacuation_routes(to_exit_id);
