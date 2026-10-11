# SkillPath AI

AI-powered university and career navigator for Sri Lankan A/L students. Check Z-score eligibility, explore UGC-handbook courses and universities, build career roadmaps, chat with an AI guide, and connect with mentors.

## Features

- **Public Z-score checker** — no account needed.
- **Courses and universities** — searchable data imported from the UGC handbooks (2022–2025).
- **AI roadmap and chat** — powered by Google Gemini (optional; returns an honest "unavailable" error when no key is set).
- **Role-based dashboards** — student, mentor, university admin and admin, each with its own navigation and route guards.
- **Authentication** — email/password and Google sign-in, with OTP-based password reset by email.
- **Responsive UI** — mobile-first with bottom navigation on phones and a sidebar on desktop; English, Sinhala and Tamil.

## Tech stack

| Layer    | Technology                                                          |
| -------- | ------------------------------------------------------------------- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Query, wouter |
| Backend  | Node.js, Express, TypeScript, Drizzle ORM, Vitest                   |
| Database | PostgreSQL (Supabase or any Postgres)                               |
| Hosting  | Vercel (frontend), Render (backend)                                 |

## Repository layout

```text
SkillPath/
├── backend/            Express API, database schema, handbook import, AI integration
├── frontend/           Vite + React application
├── HandBook/           Source UGC handbook data
├── docs/               OpenAPI spec and audit reports
├── .github/workflows/  CI workflow
├── docker-compose.yml  Optional local Postgres
└── render.yaml         Render blueprint for the API
```

## Getting started

**Prerequisites:** Node.js 20+, pnpm 9+, and a PostgreSQL database.

### 1. Backend

```bash
cd backend
cp .env.example .env     # then fill in the values below
pnpm install
pnpm db:push             # create tables
pnpm handbook:import --all
pnpm db:seed
pnpm dev                 # http://localhost:5000
```

For a local database: `docker compose up -d`, then set
`DATABASE_URL=postgresql://skillpath:skillpath@localhost:5432/skillpath`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev                 # http://localhost:5173 (proxies /api to :5000)
```

## Environment variables

**Backend** (`backend/.env`)

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `JWT_SECRET` | Secret for signing auth tokens (required) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins (required in production) |
| `APP_BASE_URL` | Deployed frontend URL, used for invite links |
| `GOOGLE_CLIENT_ID` | Verifies Google sign-in |
| `GEMINI_API_KEY` | Enables AI roadmap and chat |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Sends password-reset OTP emails |
| `PORT` | API port (default `5000`) |

**Frontend** (`frontend/.env`)

| Variable | Purpose |
| -------- | ------- |
| `VITE_API_URL` | Deployed backend origin, no trailing slash (production) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth web client ID |

On Windows, Supabase's direct `db.*.supabase.co` host may fail; use the **Session pooler** URI from *Database → Connect* instead, and URL-encode special characters in the password.

## Scripts

| Where | Command | Description |
| ----- | ------- | ----------- |
| backend | `pnpm dev` / `build` / `start` | Run, build and serve the API |
| backend | `pnpm typecheck` / `pnpm test` | Type-check and run tests |
| backend | `pnpm db:push` / `db:seed` | Apply schema and seed data |
| backend | `pnpm seed:super-admin` | One-time super admin bootstrap |
| backend | `pnpm handbook:import` | Import handbook data |
| frontend | `pnpm dev` / `build` / `preview` | Run, build (with SEO prerender) and preview |
| frontend | `pnpm typecheck` | Type-check |

## Deployment

**Frontend (Vercel)** — Root directory `frontend`; install `pnpm install --frozen-lockfile`; build `pnpm build`; output `dist`; set `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`.

**Backend (AWS EC2)** — Docker Compose + Caddy HTTPS; see [`docs/DEPLOY_EC2.md`](docs/DEPLOY_EC2.md).

**Backend (Render)** — Use [`render.yaml`](render.yaml) or create a Web Service with root `backend`, build `pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`, health check `/api/healthz`. Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` and `APP_BASE_URL`, plus the optional keys above.

## Security

Never commit `.env` files. Only `.env.example` templates are tracked. Auth routes are guarded on both the client and the API; see [`docs/`](docs) for the API spec and audit reports.
