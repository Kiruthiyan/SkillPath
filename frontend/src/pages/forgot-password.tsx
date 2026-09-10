import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { KeyRound, GraduationCap, Eye, EyeOff, Home, CheckCircle2, Loader2 } from "lucide-react";

import { useRequestPasswordOtp, useVerifyPasswordOtp, useResetPassword } from "@/api";
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

const RESEND_COOLDOWN_SECONDS = 60;

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const otpSchema = z.object({
  otp: z.string().min(6, "Enter the 6-digit code").max(6, "Enter the 6-digit code"),
});

const newPasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPassword() {
  const { t } = useTranslations();
  usePageTitle(t.auth.forgotPasswordTitle);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const passwordForm = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const { mutate: requestOtp, isPending: isSendingOtp } = useRequestPasswordOtp();
  const { mutate: verifyOtp, isPending: isVerifyingOtp } = useVerifyPasswordOtp();
  const { mutate: resetPassword, isPending: isResettingPassword } = useResetPassword();

  function handleSendOtp(data: z.infer<typeof emailSchema>) {
    requestOtp(
      { email: data.email },
      {
        onSuccess: () => {
          setEmail(data.email);
          setStep("otp");
          setCooldown(RESEND_COOLDOWN_SECONDS);
          toast({ title: t.auth.otpSentTo, description: data.email });
        },
        onError: (err: any) => {
          toast({
            title: "Something went wrong",
            description: err?.message || "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleResend() {
    if (cooldown > 0) return;
    requestOtp(
      { email },
      {
        onSuccess: () => {
          setCooldown(RESEND_COOLDOWN_SECONDS);
          toast({ title: t.auth.otpSentTo, description: email });
        },
      },
    );
  }

  function handleVerifyOtp(data: z.infer<typeof otpSchema>) {
    verifyOtp(
      { email, otp: data.otp },
      {
        onSuccess: (res) => {
          setResetToken(res.resetToken);
          setStep("password");
        },
        onError: (err: any) => {
          toast({
            title: "Invalid code",
            description: err?.message || "That code is invalid or has expired.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleResetPassword(data: z.infer<typeof newPasswordSchema>) {
    resetPassword(
      { resetToken, newPassword: data.newPassword },
      {
        onSuccess: () => {
          setStep("success");
        },
        onError: (err: any) => {
          toast({
            title: "Could not reset password",
            description: err?.message || "Your reset session may have expired. Please start again.",
            variant: "destructive",
          });
        },
      },
    );
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
                {step === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <KeyRound className="h-5 w-5 text-primary" />
                )}
                {step === "success" ? t.auth.resetSuccessTitle : t.auth.forgotPasswordTitle}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                {step === "email" && t.auth.forgotPasswordSubtitle}
                {step === "otp" && `${t.auth.otpSentTo} ${email}`}
                {step === "password" && t.auth.resetPasswordTitle}
                {step === "success" && t.auth.resetSuccessSubtitle}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {step === "email" && (
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(handleSendOtp)} className="space-y-4">
                    <FormField
                      control={emailForm.control}
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
                    <Button
                      type="submit"
                      className="w-full h-10 text-sm font-semibold shadow-sm mt-2"
                      disabled={isSendingOtp}
                    >
                      {isSendingOtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isSendingOtp ? t.actions.saving : t.auth.sendCodeBtn}
                    </Button>
                  </form>
                </Form>
              )}

              {step === "otp" && (
                <Form {...otpForm}>
                  <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
                    <FormField
                      control={otpForm.control}
                      name="otp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-foreground">
                            {t.auth.otpLabel}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="000000"
                              autoComplete="one-time-code"
                              className="h-10 text-sm tracking-[0.4em] text-center font-semibold"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-10 text-sm font-semibold shadow-sm"
                      disabled={isVerifyingOtp}
                    >
                      {isVerifyingOtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isVerifyingOtp ? t.actions.saving : t.auth.verifyOtpBtn}
                    </Button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={cooldown > 0 || isSendingOtp}
                      className="w-full text-center text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {cooldown > 0
                        ? `${t.auth.resendCodeIn} ${cooldown}s`
                        : t.auth.resendCode}
                    </button>
                  </form>
                </Form>
              )}

              {step === "password" && (
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-foreground">
                            {t.auth.newPasswordLabel}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
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
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-foreground">
                            {t.auth.confirmPasswordLabel}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="h-10 text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-10 text-sm font-semibold shadow-sm mt-2"
                      disabled={isResettingPassword}
                    >
                      {isResettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isResettingPassword ? t.actions.saving : t.auth.resetPasswordBtn}
                    </Button>
                  </form>
                </Form>
              )}

              {step === "success" && (
                <Button
                  className="w-full h-10 text-sm font-semibold shadow-sm"
                  onClick={() => setLocation("/login")}
                >
                  {t.auth.backToSignIn}
                </Button>
              )}

              {step !== "success" && (
                <p className="text-center text-sm text-muted-foreground pt-1">
                  <Link href="/login" className="text-primary font-semibold hover:underline">
                    {t.auth.backToSignIn}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
