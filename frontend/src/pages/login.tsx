import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { LogIn, GraduationCap, Eye, EyeOff, Home, Loader2 } from "lucide-react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Successful login always lands on the role dashboard — never restore a
  // previous user's last path via ?redirect= (same-device account switch).
  const passwordChanged = new URLSearchParams(search).get("passwordChanged") === "1";

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
        setLocation(getDashboardPath(data.user.role));
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
    <div className="min-h-screen flex flex-col">
      <div className="px-4 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-4 w-4" />
          {t.nav.home}
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-bold text-2xl text-primary hover:opacity-90 transition-opacity"
          >
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span>SkillPath AI</span>
          </Link>
        </div>

        <Card className="shadow-lg border-border/80 backdrop-blur-xs">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              {t.auth.signInTitle}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {t.auth.signInSubtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Google Authentication Button */}
            <GoogleAuthButton
              mode="signin"
              onSuccess={(user) => setLocation(getDashboardPath(user?.role))}
            />

            {/* Visual Divider */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">
                  {t.auth.orDivider}
                </span>
              </div>
            </div>

            {/* Email & Password Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">
                        {t.auth.emailLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="h-10 text-sm"
                          {...field}
                        />
                      </FormControl>
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
                        <FormLabel className="text-xs font-semibold text-foreground">
                          {t.auth.passwordLabel}
                        </FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {t.auth.forgotPassword}
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="h-10 text-sm pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            title={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                            aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold shadow-sm mt-2"
                  disabled={isPending}
                >
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isPending ? t.actions.saving : t.auth.signInBtn}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-muted-foreground pt-1">
              {t.auth.dontHaveAccount}{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                {t.nav.register}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </div>
  );
}

