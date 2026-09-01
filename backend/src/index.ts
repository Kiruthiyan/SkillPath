import "./load-env.js";
import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT ?? "5000");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const server = createServer(app);

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "API server listening");
});
