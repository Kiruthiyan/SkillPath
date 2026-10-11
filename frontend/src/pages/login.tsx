import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { useLogin } from "@/api";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { getDashboardPath } from "@/lib/role-routes";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthShell, AuthDivider, AUTH_INPUT, AUTH_BUTTON, AUTH_LABEL, AUTH_LINK } from "@/components/auth-shell";
import { useToast } from "@/hooks/use-toast";
import { GoogleAuthButton } from "@/components/google-auth-button";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { t } = useTranslations();
  usePageTitle(t.auth.signInTitle);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  const params = new URLSearchParams(search);
  const passwordChanged = params.get("passwordChanged") === "1";
  // Return to the page the user was sent here from, but only for same-site
  // paths; route guards still bounce a role away from pages it may not open.
  const requested = params.get("redirect");
  const redirectTo =
    requested && requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/login") && !requested.startsWith("/register")
      ? requested
      : null;
  const destination = (role?: string | null) => redirectTo ?? getDashboardPath(role);

  useEffect(() => {
    if (passwordChanged) {
      toast({
        title: "Password updated",
        description: "Your password was changed. Sign in with your new password.",
      });
    }
    // Only meant to fire once, on arrival from the change-password flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        toast({ title: "Welcome back!", description: `Signed in as ${data.user.name}` });
        setLocation(destination(data.user.role));
      },
      onError: (err: any) => {
        toast({
          title: "Login failed",
          description: err?.message || "Invalid email or password.",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(data: LoginFormValues) {
    login({ data });
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={t.auth.signInSubtitle}
      footer={
        <>
          {t.auth.dontHaveAccount}{" "}
          <Link href="/register" className={AUTH_LINK}>
            {t.nav.register}
          </Link>
        </>
      }
    >
      <GoogleAuthButton
        mode="signin"
        onSuccess={(user) => setLocation(destination(user?.role))}
      />

      <AuthDivider label={t.auth.orDivider} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={AUTH_LABEL}>
                        {t.auth.emailLabel}
                      </FormLabel>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            className={`pl-10 ${AUTH_INPUT}`}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className={AUTH_LABEL}>
                          {t.auth.passwordLabel}
                        </FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-sm font-semibold text-[#1d83c4] hover:underline"
                        >
                          {t.auth.forgotPassword}
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className={`pl-10 pr-12 ${AUTH_INPUT}`}
                            {...field}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          title={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                          aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

          <Button
            type="submit"
            className={`mt-2 ${AUTH_BUTTON}`}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t.actions.signingIn : t.auth.signInBtn}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
