import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { absoluteUrl, loadSeoConfig, siteUrl } from "./seo-utils.mjs";

const config = await loadSeoConfig();
const base = siteUrl();
const dist = resolve(process.cwd(), "dist");
const indexableRoutes = config.routes.filter((route) => route.index);

await mkdir(dist, { recursive: true });

const robots = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin",
  "Disallow: /dashboard",
  "Disallow: /settings",
  "Disallow: /profile",
  "Disallow: /roadmap",
  "Disallow: /chat",
  "Disallow: /mentor",
  "Disallow: /university-admin",
  `Sitemap: ${absoluteUrl("/sitemap.xml", base)}`,
  "",
].join("\n");

const sitemapUrls = indexableRoutes
  .map(
    (route) => `  <url>
    <loc>${absoluteUrl(route.path, base)}</loc>
    <changefreq>${route.path === "/" ? "weekly" : "monthly"}</changefreq>
    <priority>${route.path === "/" ? "1.0" : "0.8"}</priority>
  </url>`,
  )
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</urlset>
`;

await writeFile(resolve(dist, "robots.txt"), robots, "utf8");
await writeFile(resolve(dist, "sitemap.xml"), sitemap, "utf8");

console.log(`Generated robots.txt and sitemap.xml for ${indexableRoutes.length} indexable routes.`);
