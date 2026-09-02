import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User } from "lucide-react";

import { useUpdateProfile } from "@/api";
import { useProfileStore, UGC_DISTRICTS } from "@/hooks/use-profile";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { normalizeLanguage } from "@/lib/language";
import { useTranslations, type SupportedLanguage } from "@/lib/i18n";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const profileSchema = z.object({
  stream: z.string().min(1, "Select your stream"),
  zscore: z.coerce.number().min(-4).max(4, "Z-score must be between -4 and 4"),
  district: z.string().min(1, "Select your district"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const STREAMS = ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"];

export default function Profile() {
  const { t, language: currentUiLanguage, setLanguage: setUiLanguage } = useTranslations();
  usePageTitle(t.profile.title);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const setStream = useProfileStore((s) => s.setStream);
  const setZscore = useProfileStore((s) => s.setZscore);
  const setDistrict = useProfileStore((s) => s.setDistrict);
  const setLanguage = useProfileStore((s) => s.setLanguage);
  const profileStream = useProfileStore((s) => s.stream);
  const profileZscore = useProfileStore((s) => s.zscore);
  const profileDistrict = useProfileStore((s) => s.district);
  const setAuth = useAuthStore((s) => s.setAuth);
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      stream: profileStream || authUser?.stream || "",
      zscore: profileZscore ?? authUser?.zscore ?? 0,
      district: profileDistrict || authUser?.district || "Colombo",
    },
  });

  const { mutate: updateProfile, isPending } = useUpdateProfile();

  useEffect(() => {
    if (authUser?.stream) setStream(authUser.stream);
    if (authUser?.zscore != null) setZscore(authUser.zscore);
    if (authUser?.district) setDistrict(authUser.district);
    if (authUser?.language) {
      const norm = normalizeLanguage(authUser.language);
      setLanguage(norm);
      setUiLanguage(norm as SupportedLanguage);
    }
  }, [authUser, setStream, setZscore, setDistrict, setLanguage, setUiLanguage]);

  useEffect(() => {
    form.reset({
      stream: profileStream || authUser?.stream || "",
      zscore: profileZscore ?? authUser?.zscore ?? 0,
      district: profileDistrict || authUser?.district || "Colombo",
    });
  }, [authUser, profileStream, profileZscore, profileDistrict, form]);

  function applyLocalProfile(data: ProfileFormValues) {
    setStream(data.stream);
    setZscore(data.zscore);
    setDistrict(data.district);
  }

  function onSubmit(data: ProfileFormValues) {
    applyLocalProfile(data);

    if (token) {
      updateProfile(
        { data: { ...data, language: currentUiLanguage } },
        {
          onSuccess: (user) => {
            setAuth(token, user);
            toast({ title: t.profile.savedToast, description: "Your academic profile has been updated." });
            setLocation("/dashboard");
          },
          onError: () => {
            toast({
              title: "Failed to save profile",
              description: "Your changes were saved locally. Please try again.",
              variant: "destructive",
            });
          },
        },
      );
      return;
    }

    toast({
      title: t.profile.savedToast,
      description: "Sign in to sync your profile across devices.",
    });
    setLocation("/courses");
  }

  return (
    <div className="max-w-lg mx-auto py-4 md:py-8 pb-12">
      <Card className="shadow-sm border border-[hsl(var(--border))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            {t.profile.title}
          </CardTitle>
          <CardDescription>
            {t.profile.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="stream"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.profile.streamLabel}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.profile.streamPlaceholder} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STREAMS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zscore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.profile.zscoreLabel}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="-4" max="4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.profile.districtLabel}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.profile.districtPlaceholder} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UGC_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t.actions.saving : t.profile.saveButton}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
