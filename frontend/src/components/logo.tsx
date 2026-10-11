import { Link } from "wouter";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** The SkillPath AI mark: graduation cap on a blue tile. Matches /favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <GraduationCap className="h-[60%] w-[60%]" />
    </span>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <Link href="/" className={cn("inline-flex min-w-0 items-center gap-2.5 font-bold text-primary", className)}>
      <LogoMark className={markClassName} />
      <span className="truncate text-lg">SkillPath AI</span>
    </Link>
  );
}
