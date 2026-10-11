import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

import { useRegister } from "@/api";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { getDashboardPath } from "@/lib/role-routes";
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

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const { t } = useTranslations();
  usePageTitle(t.auth.registerTitle);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const { mutate: register, isPending } = useRegister({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        toast({ title: "Account created!", description: "Welcome to SkillPath AI." });
        setLocation(getDashboardPath(data.user.role));
      },
      onError: (err: any) => {
        toast({
          title: "Registration failed",
          description: err?.message || "Email may already be in use.",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(data: RegisterFormValues) {
    register({ data });
  }

  return (
    <AuthShell
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      footer={
        <>
          {t.auth.alreadyHaveAccount}{" "}
          <Link href="/login" className={AUTH_LINK}>
            {t.nav.signIn}
          </Link>
        </>
      }
    >
      <GoogleAuthButton
        mode="signup"
        onSuccess={(user) => setLocation(getDashboardPath(user?.role))}
      />

      <AuthDivider label={t.auth.orDivider} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={AUTH_LABEL}>
                        {t.auth.nameLabel}
                      </FormLabel>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <FormControl>
                          <Input
                            placeholder="Kasun Bandara"
                            autoComplete="name"
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
                      <FormLabel className={AUTH_LABEL}>
                        {t.auth.passwordLabel}
                      </FormLabel>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 6 characters"
                            autoComplete="new-password"
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
            {isPending ? t.actions.creatingAccount : t.auth.registerBtn}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
