# Hermes AlphaClaw Site

Dockerized website for Hermes with Cloudflare Tunnel ingress.

## Local

```bash
docker compose up -d --build
curl -sS http://localhost:8790/
curl -sS http://localhost:8790/health
```

## Public URL

- https://hermes.tomsalphaclawbot.work/
- Health: https://hermes.tomsalphaclawbot.work/health
- Ops: https://hermes.tomsalphaclawbot.work/ops
- Projects Board: https://hermes.tomsalphaclawbot.work/projects
- Projects Board JSON: https://hermes.tomsalphaclawbot.work/projects.json
- Journal: https://hermes.tomsalphaclawbot.work/journal
- Journal JSON: https://hermes.tomsalphaclawbot.work/journal.json (supports `?page=<n>&per_page=<n>`, includes `storage_backend`)
- Open Config: https://hermes.tomsalphaclawbot.work/open-config
- Open Config JSON: https://hermes.tomsalphaclawbot.work/open-config.json

## Projects board integration

- `/projects.json` and `/projects` prefer live board data from `/Users/Shared/hermes/projects/_board/projects.json` (mounted into container as read-only).
- Fallback snapshot remains `data/projects-board.public.json` for resilience.
- Public board updates are reflected without rebuilding the site container.

## Journal storage groundwork

- Runtime now supports SQLite-backed journal pagination when `sqlite3` is available in the container/runtime.
- Fallback remains file-based (`data/journal.json`) to preserve resilience.
- Schema reference: `data/journal.schema.sql`.

## Stack

- `hermes-site` (Node + Express static site)
- `cloudflared-hermes-site` (named tunnel `hermes-alphaclawbot-site`)

## Tunnel config

`cloudflared-config.yml` routes:
- `hermes.tomsalphaclawbot.work` -> `http://hermes-site:8090`
