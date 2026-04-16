# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-04-16

First stable release.

### Added
- **3D floor plan viewer** built on Three.js / react-three-fiber with walls,
  rooms, exits, user marker, and evacuation route visualization.
- **A\* pathfinding service** with support for blocked waypoints, multiple
  exits, and JSONB-encoded adjacency lists.
- **Real-time location + route updates** over Socket.IO, with a debounced
  client-side service and local cache fallback for network failures.
- **Admin panel**: building manager, floor plan uploader, exit editor, and
  waypoint editor — all with a browser-based plan editor.
- **Public evacuation UI** with PWA / service worker support, 2D fallback
  map, voice navigation hints, and vibration on arrival.
- **Embeddable widget** (`embed/widget.js` + iframe builder) so universities
  can drop a live map onto any page.
- **i18n scaffolding**: `tr.json` / `en.json` and a tiny `useTranslation`
  hook with locale persistence and navigator-language detection.
- **Comprehensive test suites**: 22 Jest/Supertest specs on the server
  (auth, pathfinding, location + route calculation) and 18 Vitest specs on
  the client (FloorViewer render, coordinate transforms, route service).
- **Sample-plan generator** (`scripts/generate-sample-plan.ts`) producing a
  realistic 20-room, 4-exit, 51-waypoint layout for demos.
- **k6 load test harness** (`scripts/load-test.sh`) exercising the health,
  route, and floor-detail hot paths.

### Performance
- Redis-backed caching for floor detail, floor list, and route calculations
  with a 5-minute TTL and graceful fallback when Redis is unreachable.
- HTTP response compression (`compression` middleware, 1 KB threshold) for
  JSON payloads (floor plans, waypoint graphs).
- Three.js bundle is lazy-loaded behind `React.lazy` + `Suspense` so the
  initial paint doesn't wait for the 3D engine.
- `InstancedMesh` batching for wall segments and `React.memo` on the hot
  floor-viewer primitives (rooms, exits) to skip needless re-renders.
- Distance-based LOD via drei's `<Detailed>`: SDF room labels drop out
  beyond ~40 units to keep large floors interactive.

### Security
- Helmet, CORS allow-list, JWT auth, bcrypt password hashing.
- Tiered rate limits: 100 req/min globally, 5 req/min on auth endpoints,
  2 req/sec on location updates. Disabled automatically in the test env.
- Zod-validated request bodies / query strings on mutation endpoints.
- Upload hardening (MIME + size limits, safe filename handling).

### Documentation
- README with quickstart, badge row, feature checklist, architecture
  diagram, API overview, and contributing guide.
- `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/INTEGRATION.md`.

[1.0.0]: https://github.com/beratyoruk/university-evacuation-system/releases/tag/v1.0.0
