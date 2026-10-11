import "./load-env.js";
import { createServer } from "http";
import app from "./app";
import { pool } from "./db";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT ?? "5000");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const server = createServer(app);

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "API server listening");
});

// Graceful shutdown so `docker stop` / redeploys finish in-flight requests.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(() => {
    pool
      .end()
      .catch((err: unknown) => logger.error({ err }, "Error closing DB pool"))
      .finally(() => process.exit(0));
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
