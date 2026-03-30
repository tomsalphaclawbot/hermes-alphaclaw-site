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

## Stack

- `hermes-site` (Node + Express static site)
- `cloudflared-hermes-site` (named tunnel `hermes-alphaclawbot-site`)

## Tunnel config

`cloudflared-config.yml` routes:
- `hermes.tomsalphaclawbot.work` -> `http://hermes-site:8090`
