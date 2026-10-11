import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { GraduationCap, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";

import { useAcceptInvite } from "@/api/invites";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuthStore } from "@/hooks/use-auth";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Enter your name"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function AcceptInvite() {
  usePageTitle("Accept Invite");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "" },
  });

  const { mutate: acceptInvite, isPending } = useAcceptInvite();

  function onSubmit(data: FormValues) {
    acceptInvite(
      { token, name: data.name, password: data.password },
      {
        onSuccess: (res) => {
          setAuth(res.token, res.user);
          toast({ title: "Welcome to SkillPath AI" });
          setLocation(getDashboardPath(res.user.role));
        },
        onError: (err: any) => {
          toast({
            title: "Could not accept invite",
            description: err?.message || "This invite link may be invalid or expired.",
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
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl text-primary hover:opacity-90 transition-opacity">
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
                Accept Invite
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Set your name and password to activate your account.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {!token ? (
                <p className="text-center text-sm text-destructive">
                  This invite link is missing a token. Please use the link from your invite email.
                </p>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-foreground">Full name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" className="h-10 text-sm" {...field} />
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
                          <FormLabel className="text-xs font-semibold text-foreground">Password</FormLabel>
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
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-10 text-sm font-semibold shadow-sm mt-2" disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isPending ? "Activating..." : "Activate Account"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
