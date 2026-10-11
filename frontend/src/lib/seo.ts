import seoRegistry from "../../seo.config.json";

export interface SeoRouteConfig {
  path: string;
  title: string;
  description: string;
  index: boolean;
  ogType?: string;
  prerender?: boolean;
  summaryHeading?: string;
  summaryBody?: string;
  structuredData?: string[];
}

interface SeoRegistry {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultImagePath: string;
  defaultLocale: string;
  twitterCard: string;
  routes: SeoRouteConfig[];
  checkerFaq: Array<{ question: string; answer: string }>;
}

export const seoConfig = seoRegistry as SeoRegistry;

type JsonLd = Record<string, unknown>;

export function normalizeSeoPath(pathname: string): string {
  const withoutQuery = pathname.split("?", 1)[0] || "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function getSeoRoute(pathname: string): SeoRouteConfig | undefined {
  const path = normalizeSeoPath(pathname);
  return seoConfig.routes.find((route) => route.path === path);
}

export function getSiteUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return "https://skillpath.ai";
}

function absoluteUrl(path: string, siteUrl = getSiteUrl()): string {
  if (path.startsWith("http")) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function organizationJsonLd(siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: seoConfig.siteName,
    url: siteUrl,
    description: seoConfig.defaultDescription,
    areaServed: "LK",
    sameAs: [],
  };
}

function websiteJsonLd(siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seoConfig.siteName,
    url: siteUrl,
    inLanguage: "en-LK",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/checker`,
      query: "z-score checker",
    },
  };
}

function checkerWebAppJsonLd(siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SkillPath AI Z-Score Checker",
    url: `${siteUrl}/checker`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    description: getSeoRoute("/checker")?.description ?? seoConfig.defaultDescription,
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
  };
}

function checkerFaqJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seoConfig.checkerFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function structuredDataFor(route: SeoRouteConfig, siteUrl: string): JsonLd[] {
  const keys = route.structuredData ?? [];
  const items: JsonLd[] = [];
  for (const key of keys) {
    if (key === "organization") items.push(organizationJsonLd(siteUrl));
    if (key === "website") items.push(websiteJsonLd(siteUrl));
    if (key === "checkerWebApp") items.push(checkerWebAppJsonLd(siteUrl));
    if (key === "checkerFaq") items.push(checkerFaqJsonLd());
  }
  return items;
}

function setStructuredData(route: SeoRouteConfig, siteUrl: string) {
  document.head.querySelectorAll('script[type="application/ld+json"][data-skillpath-seo="true"]').forEach((node) => {
    node.remove();
  });

  for (const item of structuredDataFor(route, siteUrl)) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.skillpathSeo = "true";
    script.textContent = JSON.stringify(item);
    document.head.appendChild(script);
  }
}

export function applyRouteSeo(pathname: string) {
  if (typeof document === "undefined") return;

  const route = getSeoRoute(pathname);
  const siteUrl = getSiteUrl();
  const title = route?.title ?? seoConfig.defaultTitle;
  const description = route?.description ?? seoConfig.defaultDescription;
  const canonicalPath = route?.path ?? normalizeSeoPath(pathname);
  const canonical = absoluteUrl(canonicalPath, siteUrl);
  const image = absoluteUrl(seoConfig.defaultImagePath, siteUrl);
  const robots = route ? (route.index ? "index,follow" : "noindex,follow") : "noindex,follow";

  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
  upsertCanonical(canonical);
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: seoConfig.siteName });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: route?.ogType ?? "website" });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
  upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: seoConfig.defaultLocale });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: seoConfig.twitterCard });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

  if (route) {
    setStructuredData(route, siteUrl);
  } else {
    setStructuredData(
      {
        path: canonicalPath,
        title,
        description,
        index: false,
        structuredData: [],
      },
      siteUrl,
    );
  }
}
