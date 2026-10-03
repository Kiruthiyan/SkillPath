import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  escapeHtml,
  loadSeoConfig,
  routeHeadHtml,
  routeOutputDir,
  siteUrl,
  stripManagedHead,
} from "./seo-utils.mjs";

const config = await loadSeoConfig();
const base = siteUrl();
const templatePath = resolve(process.cwd(), "dist", "index.html");
const template = await readFile(templatePath, "utf8");

function prerenderBody(route) {
  const heading = route.summaryHeading || route.title;
  const body = route.summaryBody || route.description;
  const noindex = route.index ? "" : '<p class="prerender-note">This account page is not intended for search indexing.</p>';

  return `<div id="root"><main class="prerender-shell" data-prerendered-route="${escapeHtml(route.path)}">
      <p class="prerender-brand">${escapeHtml(config.siteName)}</p>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(body)}</p>
      ${noindex}
    </main></div>`;
}

function prerenderHtml(route) {
  const head = routeHeadHtml(config, route, base);
  let html = stripManagedHead(template);
  html = html.replace("</head>", `    ${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', prerenderBody(route));
  return html;
}

for (const route of config.routes.filter((item) => item.prerender)) {
  const outputDir = routeOutputDir(route.path);
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "index.html"), prerenderHtml(route), "utf8");
  console.log(`Prerendered ${route.path}`);
}
