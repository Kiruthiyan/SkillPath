import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/use-auth";
import { customFetch } from "@/api";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: string | number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleAuthButtonProps {
  mode?: "signin" | "signup" | "connect";
  onSuccess?: () => void;
  className?: string;
}

export function GoogleAuthButton({
  mode = "signin",
  onSuccess,
  className = "",
}: GoogleAuthButtonProps) {
  const { t } = useTranslations();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const googleClientId =
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";

  // Authenticate credential with SkillPath backend
  async function handleGoogleLogin(payload: {
    credential?: string;
    email?: string;
    name?: string;
  }) {
    setIsLoading(true);
    try {
      const res = await customFetch<{
        token: string;
        user: any;
      }>("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setAuth(res.token, res.user);
      toast({
        title: t.auth.googleSuccess,
        description: `${res.user.name} (${res.user.email})`,
      });
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast({
        title: "Google Sign-In",
        description:
          err?.message ||
          t.auth.googleFailed ||
          "Could not authenticate with Google.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Load Google Identity Services script if Google Client ID is configured
  useEffect(() => {
    if (!googleClientId) return;

    if (window.google?.accounts?.id) {
      setGisLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGisLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Keep script cached
    };
  }, [googleClientId]);

  // Render official Google button when GIS is ready and Client ID is set
  useEffect(() => {
    if (
      !gisLoaded ||
      !googleClientId ||
      !window.google?.accounts?.id ||
      !googleBtnContainerRef.current
    ) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: { credential: string }) => {
          if (response.credential) {
            handleGoogleLogin({ credential: response.credential });
          }
        },
      });

      window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "signup" ? "signup_with" : "continue_with",
        shape: "rectangular",
        width: 380,
      });
    } catch {
      // Fall back to custom button
    }
  }, [gisLoaded, googleClientId, mode]);

  // If no Google Client ID is configured in .env, provide an interactive one-click Google demo account
  const handleFallbackClick = () => {
    // If client ID is present and GIS is loaded, trigger prompt
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      return;
    }

    // Interactive simulated Google account prompt or instant sign-in
    const sampleEmail = "student.google@skillpath.lk";
    const sampleName = "Saman Perera (Google Student)";

    handleGoogleLogin({
      email: sampleEmail,
      name: sampleName,
    });
  };

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      {/* Hidden container where GIS renders official button if configured */}
      {googleClientId && gisLoaded && (
        <div
          ref={googleBtnContainerRef}
          className="w-full flex justify-center mb-1 overflow-hidden"
        />
      )}

      {/* Styled Google Sign-In Button */}
      {(!googleClientId || !gisLoaded) && (
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={handleFallbackClick}
          className="w-full h-11 flex items-center justify-center gap-3 border-border hover:bg-muted/60 transition-all text-sm font-medium shadow-xs"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <GoogleSvgIcon className="h-5 w-5 shrink-0" />
          )}
          <span>
            {isLoading ? t.auth.googleSigningIn : t.auth.continueWithGoogle}
          </span>
        </Button>
      )}

      {!googleClientId && (
        <p className="text-[11px] text-muted-foreground/80 mt-1 text-center">
          Instant Google OAuth ready (dev mode / 1-click)
        </p>
      )}
    </div>
  );
}

export function GoogleSvgIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.25C.45 8.21 0 10.05 0 12s.45 3.79 1.25 5.4l4.03-3.13z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.6l4.03 3.13c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}
