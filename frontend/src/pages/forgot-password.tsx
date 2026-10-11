import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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
import { AuthShell, AUTH_INPUT, AUTH_BUTTON, AUTH_LABEL, AUTH_LINK } from "@/components/auth-shell";
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

  const subtitle =
    step === "email"
      ? t.auth.forgotPasswordSubtitle
      : step === "otp"
        ? `${t.auth.otpSentTo} ${email}`
        : step === "password"
          ? t.auth.resetPasswordTitle
          : t.auth.resetSuccessSubtitle;

  return (
    <AuthShell
      title={step === "success" ? t.auth.resetSuccessTitle : t.auth.forgotPasswordTitle}
      subtitle={subtitle}
      footer={
        step !== "success" ? (
          <Link href="/login" className={AUTH_LINK}>
            {t.auth.backToSignIn}
          </Link>
        ) : null
      }
    >
      {step === "email" && (
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(handleSendOtp)} className="space-y-4">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={AUTH_LABEL}>
                    {t.auth.emailLabel}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={AUTH_INPUT}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className={`mt-2 ${AUTH_BUTTON}`}
              disabled={isSendingOtp}
            >
              {isSendingOtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSendingOtp ? t.actions.processing : t.auth.sendCodeBtn}
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
                  <FormLabel className={AUTH_LABEL}>
                    {t.auth.otpLabel}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      className={`text-center font-semibold tracking-[0.4em] ${AUTH_INPUT}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className={`${AUTH_BUTTON}`}
              disabled={isVerifyingOtp}
            >
              {isVerifyingOtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isVerifyingOtp ? t.actions.processing : t.auth.verifyOtpBtn}
            </Button>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isSendingOtp}
              className="w-full text-center text-sm font-semibold text-[#1d83c4] hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
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
                  <FormLabel className={AUTH_LABEL}>
                    {t.auth.newPasswordLabel}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className={`pr-12 ${AUTH_INPUT}`}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d83c4]/30"
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
                  <FormLabel className={AUTH_LABEL}>
                    {t.auth.confirmPasswordLabel}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={AUTH_INPUT}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className={`mt-2 ${AUTH_BUTTON}`}
              disabled={isResettingPassword}
            >
              {isResettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isResettingPassword ? t.actions.processing : t.auth.resetPasswordBtn}
            </Button>
          </form>
        </Form>
      )}

      {step === "success" && (
        <Button
          className={`${AUTH_BUTTON}`}
          onClick={() => setLocation("/login")}
        >
          {t.auth.backToSignIn}
        </Button>
      )}
    </AuthShell>
  );
}
