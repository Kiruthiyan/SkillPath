import { useEffect } from "react";
import { getSeoRoute } from "@/lib/seo";

const BASE_TITLE = "SkillPath AI";

export function usePageTitle(title?: string) {
  useEffect(() => {
    if (typeof window !== "undefined" && getSeoRoute(window.location.pathname)) {
      return;
    }
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
