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
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
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
