import { Router } from "express";
import { pool } from "../db";

const router = Router();

// Liveness: process is up (no external dependencies). Used by Docker/Caddy/CI.
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness: also verifies the database connection.
router.get("/readyz", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ status: "ok", database: "up" });
  } catch {
    res.status(503).json({ status: "unavailable", database: "down" });
  }
});

export default router;
