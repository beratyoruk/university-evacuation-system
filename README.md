# University Evacuation System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/three.js-r169-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-blue?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Version](https://img.shields.io/badge/version-1.0.0-informational.svg)](CHANGELOG.md)

Real-time indoor evacuation guidance for universities with a 3D floor plan viewer, live routing, and an embeddable widget.

> **Demo** — _Canlı demo GIF / ekran görüntüsü eklenecek:_
> ![Demo placeholder](docs/demo.gif)
> _(Replace `docs/demo.gif` with a screen recording of the evacuation flow.)_

## Highlights

- Interactive 3D floor plans rendered with Three.js / react-three-fiber
- A* evacuation pathfinding with support for blocked waypoints
- Real-time location & route updates over WebSocket (Socket.IO)
- Admin panel with floor plan uploader, waypoint and exit editors
- Embeddable widget so universities can drop a live map onto their own site
- Progressive Web App with offline-capable service worker
- JWT auth, rate limiting, Redis-cached hot paths, HTTP compression
- i18n-ready (TR + EN bundled)

## Feature Status

| Area                      | Status |
|---------------------------|--------|
| 3D Three.js viewer        | ✅ |
| 2D fallback map           | ✅ |
| A* pathfinding service    | ✅ |
| Real-time user location   | ✅ |
| Evacuation route updates  | ✅ |
| WebSocket broadcasts      | ✅ |
| Admin plan uploader       | ✅ |
| Waypoint / exit editors   | ✅ |
| Embeddable widget         | ✅ |
| PWA + service worker      | ✅ |
| Security hardening        | ✅ |
| CI / CD workflows         | ✅ |
| Server test suite (Jest)  | ✅ |
| Client test suite (Vitest)| ✅ |
| Redis cache (5 min TTL)   | ✅ |
| Response compression      | ✅ |
| Lazy-loaded 3D bundle     | ✅ |
| Distance-based LOD        | ✅ |
| i18n (TR + EN)            | ✅ |

## Quick Start

Three commands, assuming you have Docker installed:

```bash
git clone https://github.com/beratyoruk/university-evacuation-system.git
cd university-evacuation-system
docker-compose up -d
```

That's it.

- Frontend → http://localhost:5173
- API → http://localhost:3001/api
- Health check → http://localhost:3001/api/health

### Local development (without Docker)

```bash
# Server
cd server && npm install && npm run dev

# Client (separate terminal)
cd client && npm install && npm run dev
```

### Running the test suites

```bash
# Server (Jest + Supertest)
cd server && npm test

# Client (Vitest + Testing Library)
cd client && npm test
```

### Generating a sample floor plan

```bash
cd server && npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  ../scripts/generate-sample-plan.ts ../sample-plan.json
```

A ready-made sample is also checked in: **`scripts/sample-floor-plan.json`** — a
mid-size university floor (10 rooms incl. 6 classrooms, teachers' office, WCs,
two emergency exits, two staircases) with a corridor waypoint graph. A copy is
served at **`/sample-plan.json`** by the client dev server, so you can drag it
straight into the Floor Plan editor (Admin → Floor Plans).

### Load testing

```bash
# Requires k6 — https://k6.io
BASE_URL=http://localhost:3001 ./scripts/load-test.sh
```

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React 18, Vite 5, Three.js, @react-three/fiber |
| State      | Zustand                                        |
| Styling    | Tailwind CSS                                   |
| Backend    | Node.js, Express, TypeScript                   |
| Real-time  | Socket.IO                                      |
| Database   | PostgreSQL 15                                  |
| Cache      | Redis 7                                        |
| Auth       | JWT + bcrypt                                   |
| Testing    | Jest, Supertest, Vitest, Testing Library       |
| Container  | Docker & Docker Compose                        |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTS                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Web App    │  │ Embed Widget │  │  Admin Dashboard    │  │
│  │  (R3F/PWA)  │  │  (iframe)    │  │  (Plan Editor)      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼─────────────────────┼─────────────┘
          ▼                ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│  API GATEWAY (Express + Socket.IO on :3001)                 │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  REST API  │  │  WebSocket  │  │  Auth / Rate Limits  │  │
│  └──────┬─────┘  └──────┬──────┘  └──────────────────────┘  │
│         ▼               ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pathfinding • Location • Buildings • Waypoints     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────┬────────────────────────────────┬───────────────────┘
        ▼                                ▼
┌──────────────────┐              ┌──────────────────┐
│   PostgreSQL     │              │     Redis        │
│  (source of      │              │  (cache, 5-min  │
│   truth)         │              │   TTL)           │
└──────────────────┘              └──────────────────┘
```

## Project Structure

```
university-evacuation-system/
├── client/           # React + Vite frontend (PWA)
│   └── src/
│       ├── components/    # FloorViewer (3D), UI, PlanEditor
│       ├── pages/         # user + admin screens
│       ├── services/      # location + route services
│       ├── i18n/          # tr.json, en.json, useTranslation hook
│       ├── store/         # Zustand stores
│       └── __tests__/     # Vitest suites
├── server/           # Node + Express backend
│   └── src/
│       ├── routes/        # REST handlers
│       ├── services/      # pathfinding, location
│       ├── middleware/    # auth, rate limit, security
│       ├── db/            # pg pool + Redis cache
│       └── __tests__/     # Jest suites
├── shared/types/     # Types shared between client & server
├── embed/            # Embeddable widget (iframe + widget.js)
├── scripts/          # sample-plan generator, k6 load test
├── docs/             # API.md, DEPLOYMENT.md, INTEGRATION.md
├── docker-compose.yml
└── README.md
```

## API Highlights

| Method | Endpoint                         | Description                   |
|--------|----------------------------------|-------------------------------|
| POST   | `/api/auth/register`             | Register a new user           |
| POST   | `/api/auth/login`                | Login and receive a JWT       |
| GET    | `/api/buildings`                 | List buildings                |
| GET    | `/api/floors/:buildingId`        | Floors in a building          |
| GET    | `/api/floors/detail/:id`         | Floor + exits + waypoints     |
| POST   | `/api/floors/:id/upload-plan`    | Upload plan (admin)           |
| POST   | `/api/location/update`           | Push a location update        |
| GET    | `/api/location/route`            | Calculate evacuation route    |
| GET    | `/api/embed/*`                   | Public endpoints for widgets  |

See [docs/API.md](docs/API.md) for the full reference.

## WebSocket Events

| Event                  | Direction       | Description                     |
|------------------------|-----------------|---------------------------------|
| `user:location-update` | Client → Server | User position update            |
| `server:route-update`  | Server → Client | Broadcast route recalculation   |
| `emergency:start`      | Server → Client | Emergency triggered             |
| `emergency:end`        | Server → Client | Emergency cleared               |
| `join:building`        | Client → Server | Join a building's broadcast room|

## Contributing

We'd love help. Quick checklist:

1. Fork the repo and create a branch off `main`.
2. Install deps: `npm install` inside both `server/` and `client/`.
3. Run tests in the directory you touched — `npm test` must be green.
4. Keep PRs focused; one feature/fix per PR.
5. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
6. For public API changes, update [docs/API.md](docs/API.md) and the CHANGELOG.
7. Describe what you tested (golden path + at least one edge case).

Security issues → please email instead of opening a public issue.

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)
