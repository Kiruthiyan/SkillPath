import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations, type SupportedLanguage } from "@/lib/i18n";
import { useProfileStore } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "select" | "pills";
}

export function LanguageSwitcher({ className, variant = "select" }: LanguageSwitcherProps) {
  const { language, setLanguage, supportedLanguages } = useTranslations();
  const setProfileLanguage = useProfileStore((s) => s.setLanguage);

  const handleLanguageChange = (val: string) => {
    const lang = val as SupportedLanguage;
    setLanguage(lang);
    setProfileLanguage(lang);
  };

  if (variant === "pills") {
    return (
      <div className={cn("inline-flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-[hsl(var(--border))]", className)}>
        <Globe className="h-3.5 w-3.5 ml-1 mr-0.5 text-muted-foreground" />
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => handleLanguageChange(lang.code)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
              language === lang.code
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            )}
          >
            {lang.nativeName}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger
          className="h-8 px-2 rounded-full border border-border bg-card hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 gap-1"
          aria-label="Select language"
          title="Select language"
        >
          <Globe className="h-4 w-4 text-foreground shrink-0" />
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[130px]">
          {supportedLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-xs cursor-pointer py-1.5">
              <span className="font-semibold">{lang.nativeName}</span>{" "}
              <span className="text-muted-foreground text-[10px]">({lang.label})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
