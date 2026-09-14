# SkillPath AI

AI-powered university and career navigator for Sri Lankan A/L students.

This repository contains two independently installable apps:

```text
SkillPath/
+-- backend/          # Express API, DB schema/import, AI integration
+-- frontend/         # Vite React app
+-- docs/             # OpenAPI spec and audit notes
+-- .github/          # CI
+-- docker-compose.yml
+-- README.md
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase Postgres project, or another PostgreSQL database

## Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

The dev server runs at `http://localhost:5173` and proxies `/api` to `http://localhost:5000`.

For production, set `VITE_API_URL` to the deployed backend origin, without a trailing slash.

```bash
cd frontend
pnpm build
```

## Backend

```bash
cd backend
cp .env.example .env
```

Set `DATABASE_URL` in `backend/.env` to your Supabase connection string. URL-encode special characters in the password, for example `@` becomes `%40`.

On Windows, the direct `db.*.supabase.co` host may fail. In Supabase Dashboard, use **Database** -> **Connect** -> **Session pooler** and copy the session mode URI.

```bash
cd backend
pnpm install
pnpm db:push
pnpm handbook:import --all
pnpm db:seed
pnpm dev
```

The API runs at `http://localhost:5000`.

```bash
cd backend
pnpm build
pnpm start
```

## Backend Environment

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing auth tokens
- `GEMINI_API_KEY` - Optional; roadmap/chat return honest unavailable errors when unset
- `PORT` - API server port, default `5000`
- `CORS_ORIGINS` - **Required in production** — comma-separated allowed frontend origins
- `APP_BASE_URL` - Deployed frontend URL (invite links + API `/` redirect)
- `GOOGLE_CLIENT_ID` - Required for Google sign-in verification
- `SMTP_*` - Required for password-reset email delivery

## Deployment

### Frontend (Vercel)

- Root Directory: `frontend`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Output Directory: `dist`
- Environment:
  - `VITE_API_URL=https://your-api.onrender.com` (no trailing slash)
  - `VITE_GOOGLE_CLIENT_ID=...` (if Google sign-in is enabled)

### Backend (Render)

Use the repo blueprint [`render.yaml`](render.yaml), or create a Web Service manually:

- Root Directory: `backend`
- Build Command: `pnpm install --frozen-lockfile && pnpm build`
- Start Command: `pnpm start`
- Health Check Path: `/api/healthz`
- Environment (set in Render dashboard):
  - `DATABASE_URL`, `JWT_SECRET` (required)
  - `CORS_ORIGINS=https://your-app.vercel.app` (required — do not leave empty)
  - `APP_BASE_URL=https://your-app.vercel.app`
  - `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `SMTP_*` as needed

Local Postgres (optional): `docker compose up -d` then point `DATABASE_URL` at `postgresql://skillpath:skillpath@localhost:5432/skillpath`.

Never commit `.env` files.
