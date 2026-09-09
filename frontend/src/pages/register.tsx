import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { UserPlus, GraduationCap, Eye, EyeOff } from "lucide-react";

import { useRegister } from "@/api";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
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
        setLocation("/profile");
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
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4">
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
              <UserPlus className="h-5 w-5 text-primary" />
              {t.auth.registerTitle}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {t.auth.registerSubtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Google Authentication Button */}
            <GoogleAuthButton
              mode="signup"
              onSuccess={() => setLocation("/profile")}
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

            {/* Registration Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">
                        {t.auth.nameLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Kasun Bandara"
                          autoComplete="name"
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
                      <FormLabel className="text-xs font-semibold text-foreground">
                        {t.auth.passwordLabel}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="At least 6 characters"
                            autoComplete="new-password"
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
                  {isPending ? t.actions.saving : t.auth.registerBtn}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-muted-foreground pt-1">
              {t.auth.alreadyHaveAccount}{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                {t.nav.signIn}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

