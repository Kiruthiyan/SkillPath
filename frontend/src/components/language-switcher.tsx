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
    <div className={cn("flex items-center gap-1.5", className)}>
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="h-8 w-[110px] text-xs bg-card/60 border-[hsl(var(--border))]">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent align="end">
          {supportedLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} className="text-xs">
              <span className="font-medium">{lang.nativeName}</span>{" "}
              <span className="text-muted-foreground text-[10px]">({lang.label})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
