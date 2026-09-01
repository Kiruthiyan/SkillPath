import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const envPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.env",
);

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key] === undefined) {
      process.env[key] = match[2].trim();
    }
  }
}
