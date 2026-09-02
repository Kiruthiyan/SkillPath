import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import apiRouter from "./routes";
import { logger } from "./lib/logger";

const app = express();

const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);

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

// Redirect browser traffic on port 5000 to the frontend app
app.get("/", (req, res) => {
  if (req.accepts("html")) {
    res.redirect("http://localhost:5173");
  } else {
    res.json({ status: "ok", message: "SkillPath API Server", webApp: "http://localhost:5173" });
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
    const raw = [err.message, (err as { cause?: Error }).cause?.message]
      .filter(Boolean)
      .join(" ");
    const message = raw.includes("ENOTFOUND") || raw.includes("ECONNREFUSED")
      ? "Database connection failed. Check DATABASE_URL and your Supabase project status."
      : raw.includes("does not exist")
        ? "Database schema is out of date. Run: pnpm db:push"
        : "Internal server error";
    res.status(err.status ?? 500).json({ error: message });
  },
);

export default app;
