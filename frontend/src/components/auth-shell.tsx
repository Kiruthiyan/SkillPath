import { Link } from "wouter";
import { motion } from "framer-motion";
import { GraduationCap, Home } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

function Brand() {
  return (
    <Link href="/" className="flex flex-col items-center gap-3 text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/80 bg-white/10 shadow-sm backdrop-blur lg:h-20 lg:w-20">
        <GraduationCap className="h-8 w-8 lg:h-10 lg:w-10" />
      </span>
      <span className="text-xl font-bold">SkillPath AI</span>
    </Link>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { t } = useTranslations();
  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden bg-white">
      <div className="relative flex min-h-dvh w-full min-w-0 flex-col lg:flex-row">
        {/* Brand panel: top on phones/tablets, left on laptop */}
        <aside className="relative flex shrink-0 flex-col items-center justify-center overflow-hidden bg-linear-to-b from-[#4cc0ee] to-[#1d83c4] px-6 pb-28 pt-[calc(4.5rem+env(safe-area-inset-top))] text-center text-white lg:w-1/2 lg:bg-linear-to-br lg:px-12 lg:py-12 lg:pr-36">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute bottom-10 left-6 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

          <Link
            href="/"
            className="absolute left-4 top-[calc(1rem+env(safe-area-inset-top))] z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 lg:top-6"
          >
            <Home className="h-4 w-4" />
            {t.nav.home}
          </Link>

          <div className="relative z-10 flex flex-col items-center gap-5">
            <Brand />
            <p className="hidden max-w-xs text-sm leading-relaxed text-white/85 lg:block">
              Find your next step. Explore university courses, check your eligibility and plan your
              career with AI-powered guidance.
            </p>
          </div>

          {/* Wave: bottom edge on phones/tablets */}
          <svg
            className="pointer-events-none absolute inset-x-0 -bottom-px h-24 w-full text-white lg:hidden"
            viewBox="0 0 400 96"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M-1 96V58C60 10 130 6 200 40C270 74 340 70 400 22V96Z" fill="currentColor" />
          </svg>
          {/* Wave: right edge on laptop */}
          <svg
            className="pointer-events-none absolute inset-y-0 -right-px hidden h-full w-32 text-white lg:block"
            viewBox="0 0 128 400"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M129 0V400H60C-10 340 -10 270 40 210C90 150 90 70 40 0Z" fill="currentColor" />
          </svg>
        </aside>

        {/* Form panel */}
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex min-w-0 flex-1 items-center justify-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2 sm:px-8 lg:px-12 lg:py-12"
        >
          <div className="w-full max-w-95">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>

            <div className="space-y-5">{children}</div>

            <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white px-3 font-medium text-slate-400">{label}</span>
      </div>
    </div>
  );
}

/* Shared form styling so every auth page matches. */
export const AUTH_INPUT =
  "h-12 rounded-xl border border-slate-300 bg-white text-base shadow-sm focus-visible:border-[#1d83c4] focus-visible:ring-2 focus-visible:ring-[#1d83c4]/20";
export const AUTH_BUTTON =
  "h-12 w-full rounded-xl bg-[#1d83c4] text-base font-semibold text-white shadow-sm hover:bg-[#176fa8]";
export const AUTH_LABEL = "text-sm font-medium text-slate-700";
export const AUTH_LINK = "font-semibold text-[#1d83c4] hover:underline";
