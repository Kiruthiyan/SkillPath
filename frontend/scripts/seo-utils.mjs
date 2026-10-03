import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function loadSeoConfig() {
  const file = await readFile(resolve(process.cwd(), "seo.config.json"), "utf8");
  return JSON.parse(file);
}

export function siteUrl() {
  return (process.env.VITE_PUBLIC_SITE_URL || "https://skillpath.ai").replace(/\/+$/, "");
}

export function absoluteUrl(path, base = siteUrl()) {
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function routeOutputDir(routePath) {
  if (routePath === "/") return resolve(process.cwd(), "dist");
  return resolve(process.cwd(), "dist", routePath.replace(/^\/+/, ""));
}

function organizationJsonLd(config, base) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: config.siteName,
    url: base,
    description: config.defaultDescription,
    areaServed: "LK",
    sameAs: [],
  };
}

function websiteJsonLd(config, base) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.siteName,
    url: base,
    inLanguage: "en-LK",
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/checker`,
      query: "z-score checker",
    },
  };
}

function checkerWebAppJsonLd(config, base) {
  const checker = config.routes.find((route) => route.path === "/checker");
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SkillPath AI Z-Score Checker",
    url: `${base}/checker`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    description: checker?.description || config.defaultDescription,
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
  };
}

function checkerFaqJsonLd(config) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: config.checkerFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function structuredDataFor(config, route, base) {
  return (route.structuredData || []).flatMap((key) => {
    if (key === "organization") return [organizationJsonLd(config, base)];
    if (key === "website") return [websiteJsonLd(config, base)];
    if (key === "checkerWebApp") return [checkerWebAppJsonLd(config, base)];
    if (key === "checkerFaq") return [checkerFaqJsonLd(config)];
    return [];
  });
}

export function routeHeadHtml(config, route, base = siteUrl()) {
  const canonical = absoluteUrl(route.path, base);
  const image = absoluteUrl(config.defaultImagePath, base);
  const robots = route.index ? "index,follow" : "noindex,follow";
  const structured = structuredDataFor(config, route, base)
    .map(
      (item) =>
        `<script type="application/ld+json" data-skillpath-seo="true">${JSON.stringify(item)}</script>`,
    )
    .join("\n    ");

  return [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(config.siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:type" content="${escapeHtml(route.ogType || "website")}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:locale" content="${escapeHtml(config.defaultLocale)}" />`,
    `<meta name="twitter:card" content="${escapeHtml(config.twitterCard)}" />`,
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    structured,
  ]
    .filter(Boolean)
    .join("\n    ");
}

export function stripManagedHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/\s*<meta\s+name=["']description["'][^>]*>\s*/gi, "")
    .replace(/\s*<meta\s+name=["']robots["'][^>]*>\s*/gi, "")
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/\s*<script\s+type=["']application\/ld\+json["'][^>]*data-skillpath-seo=["']true["'][\s\S]*?<\/script>\s*/gi, "");
}
