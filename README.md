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
- `GEMINI_API_KEY` - Optional; AI features use fallback templates when unset
- `PORT` - API server port, default `5000`
- `CORS_ORIGINS` - Comma-separated allowed origins in production
- `AI_REQUIRE_AUTH` - Set to `true` in production to require login for AI chat and roadmap generation

## UGC Handbook Updates

Official admission cutoffs are stored in `backend/data/handbooks/` and imported into the backend database.

When UGC publishes a new PDF:

```bash
cd backend
pip install -r scripts/ingest-handbook/requirements.txt
python scripts/ingest-handbook/extract.py --url https://www.ugc.ac.lk/downloads/admissions/Handbook_2025_26/student_handbook_english.pdf --year 2025_26
pnpm handbook:import --year 2025_26
pnpm db:seed
```

Predicted next-year cutoffs use a simple trend average over the last 2-3 handbook years. Gemini is used only for natural-language explanations, never for cutoff numbers.

## Deployment

Frontend on Vercel:

- Root Directory: `frontend`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Output Directory: `dist`
- Environment: `VITE_API_URL=https://your-backend.example.com`

Backend on Railway/Render/Fly/etc.:

- Root Directory: `backend`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Start Command: `pnpm start`
- Environment: `DATABASE_URL`, `JWT_SECRET`, optional `GEMINI_API_KEY`, `CORS_ORIGINS`, `AI_REQUIRE_AUTH=true`

Never commit `.env` files.
