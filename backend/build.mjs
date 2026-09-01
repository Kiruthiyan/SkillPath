import * as esbuild from "esbuild";

const external = [
  "express",
  "cors",
  "pino",
  "pino-http",
  "bcryptjs",
  "jsonwebtoken",
  "@google/generative-ai",
];

await esbuild.build({
  entryPoints: ["./src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "./dist/index.js",
  packages: "external",
  external,
});
