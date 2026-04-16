# API Reference

Base URL: `https://<your-server>/api`
Response envelope (all endpoints):

```jsonc
// success
{ "success": true, "data": { /* payload */ } }
// error
{ "success": false, "error": "Human-readable message" }
```

**Authentication.** All private endpoints expect a bearer token:

```
Authorization: Bearer <jwt>
```

**Rate limits** (per IP, returns HTTP 429 on exceed):

| Scope | Limit |
|---|---|
| All `/api/*` | 100 / min |
| `/api/auth/*` | 5 / min |
| `POST /api/location/update` | 2 / sec |

---

## Health

### `GET /api/health`

Public. No auth. Verifies the server process is alive.

```http
GET /api/health
```

**200**
```json
{ "success": true, "message": "...", "timestamp": "2026-04-16T10:00:00Z" }
```

---

## Authentication

### `POST /api/auth/register`

Public.

**Body** (`application/json`):
```jsonc
{
  "email": "admin@itu.edu.tr",
  "password": "min-8-chars",
  "role": "admin",                // optional: "admin" | "user"
  "university_id": "<uuid>"       // optional
}
```

**201** → `{ token, user }`

### `POST /api/auth/login`

**Body**: `{ email, password }`
**200** → `{ token, user }`
**401** → invalid credentials

### `GET /api/auth/me`

Auth required.
**200** → user profile

---

## Buildings

Base: `/api/buildings`. All require auth. Write ops require `admin` role.

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/?university_id=<uuid>` | any | List buildings |
| GET | `/:id` | any | Get building + floors |
| POST | `/` | admin | Create |
| PUT | `/:id` | admin | Update |
| DELETE | `/:id` | admin | Delete cascade |

**Create body**:
```jsonc
{
  "university_id": "<uuid>",
  "name": "Main Campus",
  "address": "Maslak, Istanbul",
  "lat": 41.104,
  "lng": 29.026,
  "floors_count": 5
}
```

---

## Floors

Base: `/api/floors`. Auth required.

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/?building_id=<uuid>` | any | List floors of a building |
| GET | `/:id` | any | Get floor with plan JSON |
| POST | `/` (multipart) | admin | Upload plan image |
| PUT | `/:id` | admin | Update metadata |
| DELETE | `/:id` | admin | Delete |

**Upload** fields:
- `building_id`, `floor_number`, `floor_name`
- `plan` (file, ≤10 MB, image)

---

## Exits

Base: `/api/exits`. Auth required.

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/?floor_id=<uuid>` | any | List exits of a floor |
| POST | `/` | admin | Create an exit |
| PUT | `/:id` | admin | Update |
| DELETE | `/:id` | admin | Delete |

**Exit types**: `door`, `staircase`, `elevator`, `emergency`.

---

## Waypoints

Base: `/api/waypoints`. Auth required. Admin for writes.

| Method | Path | Description |
|---|---|---|
| GET | `/?floor_id=<uuid>` | List waypoints for a floor |
| POST | `/` | Create node (with `connections: []` of waypoint IDs) |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Delete |

---

## Location & Routing

### `POST /api/location/update`

Auth required. Throttled at **2/sec**.

**Body**:
```json
{ "floor_id": "<uuid>", "x": 120.5, "y": 80.0 }
```

**200**:
```jsonc
{
  "success": true,
  "data": {
    "x": 120.5,
    "y": 80.0,
    "nearestWaypointId": "<uuid>",
    "nearestWaypointDistance": 4.2
  }
}
```

Broadcasts `user:location-update` over Socket.IO.

### `GET /api/location/route`

Auth required. Query params:

- `floor_id` (uuid, required)
- `x`, `y` (numbers, required)
- `blocked` (comma-separated waypoint IDs, optional — use to exclude blocked paths)

Returns the A\* route to the nearest emergency exit:

```jsonc
{
  "success": true,
  "data": {
    "path": [ { "id": "<uuid>", "x": 0, "y": 0 }, ... ],
    "distance": 42.0,
    "exitId": "<uuid>"
  }
}
```

---

## Embed (public, CORS `*`)

Intended for third-party (university) sites that embed the widget.

### `GET /api/embed/config/:universitySlug`

```http
GET /api/embed/config/itu
```

**200**:
```jsonc
{
  "success": true,
  "data": {
    "university": { "id": "...", "name": "...", "slug": "itu", "logoUrl": "..." },
    "buildingsCount": 12,
    "widget": { "version": "1.0.0", "apiBase": "/api", "supportedLocales": ["tr", "en"] }
  }
}
```

### `GET /api/embed/buildings/:universitySlug`

```jsonc
{
  "success": true,
  "data": [
    { "id": "...", "name": "Main", "address": "...", "lat": 0, "lng": 0, "floorsCount": 5 }
  ]
}
```

---

## Socket.IO Events

Connect: `wss://<your-server>` (same origin).

**Client → server**
- `user:location-update` `{ floorId, x, y }`
- `request:route` `{ floorId, x, y }`
- `join:building` / `leave:building` `<buildingId>`

**Server → clients**
- `user:location-update` `{ userId, floorId, x, y, nearestWaypointId, timestamp }`
- `server:route-update` `{ userId, floorId, route, timestamp }`
- `user:requesting-route` `{ socketId, floorId, x, y, timestamp }`

---

## Error Codes

| Status | Meaning |
|---|---|
| 400 | Validation failed — see `details[]` |
| 401 | Auth required or invalid token |
| 403 | Forbidden (role missing) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 413 | Payload too large (upload) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
