#!/usr/bin/env bash
#
# load-test.sh — simple k6 load test for the evacuation server.
#
# Requires: https://k6.io  (install via brew/snap/docker).
#
# Usage:
#   BASE_URL=http://localhost:3001 ./scripts/load-test.sh
#   BASE_URL=https://evac.example.edu VUS=100 DURATION=2m ./scripts/load-test.sh
#
# Overrideable env vars:
#   BASE_URL   - target server URL (default: http://localhost:3001)
#   VUS        - virtual users (default: 20)
#   DURATION   - test duration (default: 30s)
#   FLOOR_ID   - floor UUID to exercise (default: 00000000-0000-0000-0000-000000000001)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
VUS="${VUS:-20}"
DURATION="${DURATION:-30s}"
FLOOR_ID="${FLOOR_ID:-00000000-0000-0000-0000-000000000001}"

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not found. Install from https://k6.io/docs/getting-started/installation/"
  exit 1
fi

echo "Running load test against $BASE_URL ($VUS VUs, $DURATION)"

k6 run --vus "$VUS" --duration "$DURATION" \
  -e BASE_URL="$BASE_URL" \
  -e FLOOR_ID="$FLOOR_ID" \
  - <<'EOF'
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL;
const FLOOR_ID = __ENV.FLOOR_ID;

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],            // <1% errors
    http_req_duration: ["p(95)<500"],          // 95% of requests under 500ms
  },
};

export default function () {
  // Health probe — unauthenticated, tests that the server is up
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  // Route calculation — the hot path during an evacuation
  const routeRes = http.get(
    `${BASE_URL}/api/location/route?floor_id=${FLOOR_ID}&x=5&y=5`,
    { tags: { endpoint: "route" } }
  );
  check(routeRes, {
    "route responded": (r) => r.status === 200 || r.status === 401 || r.status === 404,
  });

  // Floor detail — exercised on app boot for every client
  const floorRes = http.get(
    `${BASE_URL}/api/floors/detail/${FLOOR_ID}`,
    { tags: { endpoint: "floor-detail" } }
  );
  check(floorRes, {
    "floor responded": (r) => r.status === 200 || r.status === 401 || r.status === 404,
  });

  sleep(1);
}
EOF
