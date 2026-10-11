import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import apiRouter from "./routes";
import { logger } from "./lib/logger";

const app = express();

const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);

function collectErrorText(err: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];

  function visit(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    const record = value as Record<string, unknown>;
    for (const key of ["name", "code", "message"]) {
      const part = record[key];
      if (typeof part === "string" && part) parts.push(part);
    }

    if (Array.isArray(record.errors)) {
      for (const nested of record.errors) visit(nested);
    }
    visit(record.cause);
  }

  visit(err);
  return parts.join(" ");
}

if (process.env.NODE_ENV === "production" && !corsOrigins?.length) {
  logger.warn(
    "CORS_ORIGINS is empty in production — reflecting any Origin. Set CORS_ORIGINS to your Vercel URL(s).",
  );
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    redact: ["req.headers.authorization", "req.headers.cookie"],
  }),
);

// Gracefully handle browser DevTools probes
app.use("/.well-known", (_req, res) => {
  res.status(204).end();
});

// Redirect browser traffic on the API origin to the frontend app
app.get("/", (req, res) => {
  const webApp = process.env.APP_BASE_URL?.replace(/\/$/, "") || "http://localhost:5173";
  if (req.accepts("html")) {
    res.redirect(webApp);
  } else {
    res.json({ status: "ok", message: "SkillPath API Server", webApp });
  }
});

app.use("/api", apiRouter);

app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "Unhandled API error");
    const raw = collectErrorText(err);
    const isDatabaseConnectionError = /EACCES|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(raw);
    const isDatabaseSchemaError = raw.includes("does not exist");
    const message = isDatabaseConnectionError
      ? "Database connection failed. Check DATABASE_URL and your Supabase project status."
      : isDatabaseSchemaError
        ? "Database schema is out of date. Run: pnpm db:push"
        : "Internal server error";
    const status = isDatabaseConnectionError ? 503 : err.status ?? 500;
    res.status(status).json({ error: message });
  },
);

export default app;
