import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { KeyRound, GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";

import { useChangePassword } from "@/api/auth-account";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuthStore } from "@/hooks/use-auth";
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

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordForced() {
  usePageTitle("Change Password Required");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const { mutate: changePassword, isPending } = useChangePassword();

  function onSubmit(data: FormValues) {
    changePassword(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          toast({
            title: "Password updated",
            description: "Please sign in again with your new password.",
          });
          // The backend invalidates the current token on a successful change,
          // so patching mustChangePassword locally and pushing on to a
          // dashboard (the old behavior) would land on a page whose very next
          // request 401s. Sign out cleanly and send the user to login instead.
          logout();
          setLocation("/login?passwordChanged=1");
        },
        onError: (err: any) => {
          toast({
            title: "Could not update password",
            description: err?.data?.error || err?.message || "Please check your current password and try again.",
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center py-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 font-bold text-2xl text-primary">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                <GraduationCap className="h-6 w-6" />
              </div>
              <span>SkillPath AI</span>
            </div>
          </div>

          <Card className="shadow-lg border-border/80 backdrop-blur-xs">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Change Password Required
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                For security, you must set a new password before continuing.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Temporary / current password
                        </FormLabel>
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="current-password"
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
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-foreground">
                          New password
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
                              aria-label={showPassword ? "Hide password" : "Show password"}
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
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Confirm new password
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
                  <Button type="submit" className="w-full h-10 text-sm font-semibold shadow-sm mt-2" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isPending ? "Saving..." : "Set new password"}
                  </Button>
                </form>
              </Form>
              <p className="text-center text-xs text-muted-foreground pt-1">
                Access is restricted until your password is changed.{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline" onClick={() => useAuthStore.getState().logout()}>
                  Sign out
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
