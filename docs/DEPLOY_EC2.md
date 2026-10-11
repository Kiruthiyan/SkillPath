# Deploy the SkillPath API on AWS EC2

Stack on one EC2 host: **Docker Compose** → `api` (Express, port 5000, internal only) + **Caddy** (HTTPS on 80/443, free Let's Encrypt certificate). The database stays on your existing Supabase project; nothing here creates or migrates a database.

## What you need first

- A domain/subdomain for the API (e.g. `api.yourdomain.com`) you can point at the server.
- The hosted frontend URL (exact origin, e.g. `https://skillpath.vercel.app`).
- Your existing Supabase **Session pooler** connection string (EC2 normally has no IPv6, and the direct host is IPv6-only).

## 1. Create the server (manual, in the AWS console)

- Ubuntu 22.04/24.04, `t3.small` or larger (1 GB RAM is tight for the Docker build), 20 GB disk.
- Allocate and attach an **Elastic IP** (so the DNS record never changes).
- Security group inbound rules:

| Port | Source | Purpose |
| ---- | ------ | ------- |
| 22 | Your IP only | SSH |
| 80 | 0.0.0.0/0 | HTTP (certificate issuance, redirect) |
| 443 | 0.0.0.0/0 | HTTPS |

Do **not** open 5000 — the API is only reachable through Caddy.

- DNS: create an `A` record `api.yourdomain.com` → the Elastic IP.

## 2. Install Docker

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version
```

## 3. Get the code and configure

```bash
git clone https://github.com/Kiruthiyan/SkillPath.git ~/SkillPath   # use a deploy key / token if private
cd ~/SkillPath

cp backend/.env.example backend/.env
nano backend/.env
cp deploy/.env.example deploy/.env
nano deploy/.env
```

`backend/.env` (use your **existing** values):

| Variable | Value |
| -------- | ----- |
| `DATABASE_URL` | Supabase Session pooler URI (URL-encode special characters in the password) |
| `JWT_SECRET` | **Keep the current one** so existing logins stay valid; otherwise `openssl rand -hex 48` |
| `CORS_ORIGINS` | `https://your-frontend-url` (comma-separated for several; no trailing slash) |
| `APP_BASE_URL` | `https://your-frontend-url` |
| `GOOGLE_CLIENT_ID` | Same as the frontend's `VITE_GOOGLE_CLIENT_ID` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Your existing SMTP details (password-reset emails) |
| `GEMINI_API_KEY` | Optional, enables AI features |
| `NODE_ENV`, `PORT`, `TRUST_PROXY` | `production`, `5000`, `1` (leave as in the example) |

`deploy/.env`: `API_DOMAIN=api.yourdomain.com` and `ACME_EMAIL=you@yourdomain.com`.

## 4. First deploy

```bash
./deploy/deploy.sh
```

It builds the image, starts the stack (auto-restarts on crash/reboot via `restart: unless-stopped`), waits for the container health check, and rolls back to the previous image if it fails.

## 5. Verify

```bash
curl https://api.yourdomain.com/api/healthz    # {"status":"ok"}
curl https://api.yourdomain.com/api/readyz     # {"status":"ok","database":"up"}
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs -f api
```

## 6. Point the frontend at the API

In the frontend host (e.g. Vercel → Project → Environment Variables):

```
VITE_API_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=<same Google client ID>
```

Redeploy the frontend. In Google Cloud Console → Credentials, make sure the frontend origin is in **Authorized JavaScript origins**. Test: register, login, Google sign-in, forgot-password email.

## Routine operations

```bash
cd ~/SkillPath && git pull && ./deploy/deploy.sh      # update
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env restart api
```

## Rollback

`deploy.sh` rolls back automatically when the new image is unhealthy. Manual rollback:

```bash
cd ~/SkillPath
docker tag skillpath-api:previous skillpath-api:latest
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --no-build api
# or return to a known-good commit:
git checkout <good-commit> && ./deploy/deploy.sh
```

## GitHub Actions deployment (after the manual deploy works)

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs typecheck, tests and build, SSHes to the server, runs `deploy/deploy.sh` (health check + rollback), then checks the public `/api/healthz`. It triggers on pushes to `master` that touch `backend/**` or `deploy/**`, or manually.

Create a GitHub **Environment** named `production` and add secrets:

| Secret | Value |
| ------ | ----- |
| `EC2_HOST` | Elastic IP or domain |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Private key of a dedicated deploy key (add its public key to `~/.ssh/authorized_keys` on the server) |
| `API_DOMAIN` | `api.yourdomain.com` |

Tip: require approval on the `production` environment if you want a manual gate.

## Notes

- Existing data is untouched. Schema changes (`pnpm db:push`) are **not** run by the deploy; run them deliberately and review first.
- Secrets live only in `backend/.env` on the server (git-ignored). Back it up somewhere safe.
- Logs rotate (10 MB × 3). Free disk with `docker image prune -f` if needed.
