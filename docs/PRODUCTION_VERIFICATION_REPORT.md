# SkillPath AI — Final Pre-Deployment Audit Report

**Date:** 2026-09-14  
**Environment:** Local `pnpm dev` (frontend :5173, backend :5000) against configured Postgres (`DATABASE_URL`; Supabase pooler). Docker Compose Postgres was available but not required — the live API used the existing DB.  
**Deploy target:** Frontend → Vercel · Backend → Render ([`render.yaml`](../render.yaml))

---

## Overall verdict

**PASS with non-blocking follow-ups** — Security gaps found in this audit were fixed and re-verified. Multi-role API RBAC and browser role landings were exercised end-to-end. Typecheck, backend tests (149), and production builds passed. Set production env vars (especially `CORS_ORIGINS`, `VITE_API_URL`, `APP_BASE_URL`) before go-live.

---

## PASS

### Verified modules (API + UI where noted)

| Module | Result |
|--------|--------|
| Authentication (login → role dashboard, logout → `/login`) | Pass (browser: student, mentor; session inject: uni-admin, admin) |
| Student dashboard + nav | Pass |
| Mentor dashboard + profile + requests | Pass (API request/accept + browser `/mentor`) |
| University Admin (Moratuwa scoped) | Pass (`/university-admin`, programmes, announcements empty state) |
| Admin overview + nav (incl. Z-Score Data) | Pass |
| Super Admin metrics API | Pass |
| Courses / Universities / Careers / Reviews / Stories / Opportunities | Pass (API 200) |
| Mentors directory (student) | Pass |
| Z-Score Checker (public) | Pass |
| Roadmap generate | Pass (honest **503** when Gemini unavailable) |
| AI Chat | Pass (honest unavailable reply when Gemini unset) |
| Saved courses (active session) | Pass |
| Handbook / admin imports / review routes | Guarded under `requireAdmin` (nav reachable) |
| Settings / profile PATCH `/users/me` | Pass with `requireActiveSession` |

### RBAC / security checks verified

- Student blocked from mentor/admin/uni-admin APIs (**403**)
- Mentor blocked from student mentor-request list (**403**)
- Uni-admin blocked from `/admin/users` (**403**)
- Admin cannot deactivate `super_admin` (**403**) — **fixed this audit**
- Deactivate bumps `tokenVersion` (stale JWT rejected) — **fixed this audit**
- Mentor request IDOR: non-owner cannot PATCH (**403**)
- Wrong-role URL → redirected to role dashboard (student → `/admin/overview` bounced back)

### Responsive breakpoints

Document overflow (`scrollWidth` vs viewport) checked via device metrics:

| Width | Pages sampled | Horizontal overflow |
|-------|---------------|---------------------|
| 320px | `/admin/overview` | None |
| 375px | dashboard, admin pages, `/courses`, `/checker` | None |
| 768px | `/admin/overview` | None |
| 1920px | `/admin/overview` | None |

Intermediate widths (360–1440) use the same Tailwind shell (`lg` sidebar / mobile scroll nav). Mobile nav uses intentional horizontal scroll for links (`shrink-0`); document itself does not overflow.

### Tests / builds

| Gate | Result |
|------|--------|
| Backend `pnpm typecheck` | Pass |
| Backend `pnpm test` | **22 files / 149 tests** pass |
| Backend `pnpm build` | Pass |
| Frontend `pnpm typecheck` | Pass |
| Frontend `pnpm build` | Pass |
| Frontend automated tests | None configured (unchanged) |

---

## FIXED (this audit)

1. **Session revocation gap** — `PATCH /users/me`, saved/*, `/ai/chat`, `/roadmaps/generate` now use `requireActiveSession` (active + `tokenVersion`), not bare JWT.
2. **Privilege escalation** — Plain `admin` can no longer deactivate/reactivate `admin` / `super_admin` accounts; only `super_admin` can. Deactivate also bumps `tokenVersion`.
3. **Production localhost hardcode** — API `GET /` redirect/JSON uses `APP_BASE_URL` (fallback localhost for local only).
4. **Dead roadmap templates** — Removed unused `ROADMAPS` / `getTemplateRoadmap` after honest 503 path.
5. **CORS misconfig signal** — Production warns if `CORS_ORIGINS` is empty.
6. **Admin Z-Score nav** — `/admin/zscore` added to admin sidebar + i18n (`zscoreData`).
7. **Auth button copy** — Login/register/forgot/checker pending labels no longer say “Saving...” (`signingIn` / `creatingAccount` / `processing`).
8. **Deploy docs** — `render.yaml`, README Render/Vercel checklist, FE/BE `.env.example` updates (`VITE_GOOGLE_CLIENT_ID`, `ADMIN_*`, CORS guidance). Removed stale `AI_REQUIRE_AUTH` docs.
9. **Contract test** — `elevated-account-policy.test.ts` covers deactivate rules.

---

## BLOCKERS

**None in code** for a correctly configured deploy.

**Must configure in hosting dashboards (ops, not code bugs):**

1. Vercel: `VITE_API_URL` = Render API origin (no trailing slash); `VITE_GOOGLE_CLIENT_ID` if Google login is used.
2. Render: `DATABASE_URL`, `JWT_SECRET`, **`CORS_ORIGINS=https://<vercel-app>`**, `APP_BASE_URL=https://<vercel-app>`, optional Gemini/SMTP/Google.
3. If the shared Supabase DB still contains historical fake seed people/reviews from older seeds, run a one-off cleanup (current `db:seed` clears careers/reviews/stories on re-run).

Temporary E2E accounts (`audit.*@skillpath.lk`) created during this audit were **deactivated** afterward. Delete those rows if this DB is production.

---

## NON-BLOCKING

| Item | Notes |
|------|--------|
| `/checker` remains public | Intentional guest tool |
| No frontend Vitest suite | CI covers FE typecheck+build only |
| Gemini unset → honest chat fallback / roadmap 503 | Correct; set `GEMINI_API_KEY` for live AI |
| SMTP unset → OTP logged, not emailed | Set SMTP on Render for forgot-password |
| Bundle >500KB warning | Vite advisory only; no functional break |
| Careers/reviews/stories may be empty | Seed clears demo people; content comes from real data/imports |
| DB was Supabase, not docker-compose Postgres | Local API used existing `DATABASE_URL`; compose remains valid for fully local Postgres |
| Login rate limit (10 / 15 min) | Expected hardening; slowed multi-account browser logins |
| OTP/email live delivery | Not re-tested (needs SMTP) |

---

## Role flow summary

```text
Login(student)  → /dashboard
Login(mentor)   → /mentor
Login(uni_admin)→ /university-admin
Login(admin)    → /admin/overview
Login(super)    → /admin/overview
Logout          → /login
Wrong role URL  → own dashboard (RequireRole)
```

---

## Deploy checklist (Vercel + Render)

1. Push branch; create Render Web Service from [`render.yaml`](../render.yaml) or manual `backend` root.
2. Set Render env vars (required: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `APP_BASE_URL`).
3. Run `pnpm db:push` (and handbook import if needed) against prod DB.
4. Create Vercel project on `frontend`; set `VITE_API_URL` to Render URL; rebuild.
5. Smoke: healthz, login each role, checker guest, one admin mutation.
