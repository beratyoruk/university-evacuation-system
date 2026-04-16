# Deployment Guide — Docker / Production

Production deployment of the University Evacuation System using Docker Compose.

---

## 1. Architecture

```
           ┌──────────────────┐
 Internet →│   Reverse Proxy   │   (Nginx / Caddy / Traefik — terminates TLS)
           └───────┬──────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
   evac-client:80        evac-server:3001
   (nginx + SPA)       (Node.js + Express + Socket.IO)
                             │
                ┌────────────┼──────────────┐
                │            │              │
         evac-postgres:5432  evac-redis:6379 uploads (volume)
```

Each component runs as a separate container; data lives in named volumes.

---

## 2. Prerequisites

- Docker ≥ 24.x and Docker Compose v2
- A DNS record pointing at the host
- A reverse proxy (Nginx / Caddy / Traefik) for TLS termination
- ≥ 2 GB RAM, ≥ 10 GB disk (more if many floor-plan uploads)

---

## 3. Environment Setup

Copy `.env.example` to `.env` at the repository root:

```bash
cp .env.example .env
```

Fill in **all** values. Production checklist:

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` — 64+ random characters (`openssl rand -hex 32`)
- [ ] `DB_PASSWORD` — not the default
- [ ] `CORS_ALLOWED_ORIGINS` — comma-separated list of university domains that may call the API
- [ ] `VITE_API_URL` / `VITE_WS_URL` — public URLs seen by the browser

Example:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<64 random hex chars>
JWT_EXPIRES_IN=7d
DB_HOST=postgres
DB_PORT=5432
DB_NAME=evacuation_db
DB_USER=evacuser
DB_PASSWORD=<strong random>
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ALLOWED_ORIGINS=https://itu.edu.tr,https://www.itu.edu.tr
VITE_API_URL=https://evac.itu.edu.tr/api
VITE_WS_URL=https://evac.itu.edu.tr
UPLOAD_MAX_SIZE=10485760
```

---

## 4. Build & Run

```bash
docker compose build
docker compose up -d
docker compose ps          # verify all services healthy
```

Initialize the database on first run:

```bash
docker compose exec server npm run db:migrate
docker compose exec server npm run db:seed   # optional fixtures
```

---

## 5. Reverse Proxy (Caddy — recommended)

`/etc/caddy/Caddyfile`:

```caddy
evac.itu.edu.tr {
  encode zstd gzip

  # API + WebSocket
  @api path /api/*
  reverse_proxy @api localhost:3001

  @socket path /socket.io/*
  reverse_proxy @socket localhost:3001

  # Uploaded images
  @uploads path /uploads/*
  reverse_proxy @uploads localhost:3001

  # Widget asset
  @widget path /widget.js /embed-demo.html
  reverse_proxy @widget localhost:5173

  # SPA
  reverse_proxy localhost:5173
}
```

Reload: `sudo systemctl reload caddy`. Caddy handles TLS automatically.

---

## 6. CI/CD via GitHub Actions

Workflows live in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push / PR | TypeScript compile + lint on both server and client |
| `deploy.yml` | push to `main` | Build and push Docker images to GHCR (`server`, `client`) |

To pull images on the host:

```bash
docker login ghcr.io -u <github-user>
docker pull ghcr.io/<owner>/<repo>-server:latest
docker pull ghcr.io/<owner>/<repo>-client:latest
docker compose up -d
```

---

## 7. Backup & Restore

**Database dump** (daily cron recommended):
```bash
docker compose exec -T postgres \
  pg_dump -U evacuser -d evacuation_db \
  | gzip > backups/db-$(date +%F).sql.gz
```

**Restore**:
```bash
gunzip -c backups/db-2026-04-16.sql.gz | \
  docker compose exec -T postgres psql -U evacuser -d evacuation_db
```

**Uploads**: backup the `server_uploads` named volume:
```bash
docker run --rm -v server_uploads:/data -v $PWD/backups:/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

---

## 8. Observability

- Container logs: `docker compose logs -f server`
- Health check: `GET /api/health` returns JSON
- Track rate-limit 429s in your reverse-proxy logs to size quotas

---

## 9. Upgrade / Rollback

```bash
git pull
docker compose pull
docker compose up -d --remove-orphans
docker compose exec server npm run db:migrate
```

Rollback:
```bash
docker compose down
docker compose pull <service>:sha-<previous-commit>
docker compose up -d
```

---

## 10. Security Checklist (production)

- [ ] TLS (HTTPS) end-to-end — widget requires HTTPS for geolocation
- [ ] Strong `JWT_SECRET` and `DB_PASSWORD`
- [ ] `CORS_ALLOWED_ORIGINS` is an exact domain list (no wildcards)
- [ ] Reverse proxy sets `X-Forwarded-For` (Express `trust proxy` is enabled)
- [ ] Container host firewalled — only 80/443 public, Postgres/Redis bound to localhost
- [ ] Periodic `docker compose pull` + image scan (`trivy image …`)
- [ ] Database backups tested (restore drill at least quarterly)
