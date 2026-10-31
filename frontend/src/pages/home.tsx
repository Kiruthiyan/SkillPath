import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";

export default function Home() {
  usePageTitle();
  const { t } = useTranslations();

  return (
    <div className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center overflow-x-hidden bg-linear-to-b from-[#4cc0ee] to-[#1d83c4] px-6 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))] text-center text-white">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex w-full max-w-xl flex-col items-center"
      >
        <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/80 bg-white/10 shadow-sm backdrop-blur">
          <GraduationCap className="h-10 w-10" />
        </span>
        <p className="mb-8 text-xl font-bold">SkillPath AI</p>

        <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Find your university and career path
        </h1>
        <p className="mb-9 max-w-md text-base leading-relaxed text-white/85 md:text-lg">
          {t.home.heroSubtitle}
        </p>

        {/* G.4: Source attribution & trust info — text only, no layout change */}
        <p className="mb-6 max-w-md text-xs leading-relaxed text-white/70">
          Eligibility data sourced from the{" "}
          <a
            href="https://www.ugc.ac.lk/downloads/admissions/cutoff_2025/COP_2024_2025-ENGLISH_Final.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white/90"
          >
            UGC Admissions Handbook (2024/25 edition)
          </a>
          . Results are estimates only — official UGC data prevails.
        </p>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button
            size="lg"
            asChild
            className="h-12 rounded-xl bg-white text-base font-semibold text-[#1d83c4] shadow-sm hover:bg-white/90"
          >
            <Link href="/checker">
              Check Z-Score <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 rounded-xl border-2 border-white bg-transparent text-base font-semibold text-white hover:bg-white/15 hover:text-white"
          >
            <Link href="/register">Create Account</Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            asChild
            className="h-12 rounded-xl text-base font-semibold text-white hover:bg-white/15 hover:text-white"
          >
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
