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
  language: z.string().min(1, "Select a language"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const STREAMS = ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "si", label: "Sinhala" },
  { value: "ta", label: "Tamil" },
];

export default function Profile() {
  usePageTitle("Student Profile");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const setStream = useProfileStore((s) => s.setStream);
  const setZscore = useProfileStore((s) => s.setZscore);
  const setDistrict = useProfileStore((s) => s.setDistrict);
  const setLanguage = useProfileStore((s) => s.setLanguage);
  const profileStream = useProfileStore((s) => s.stream);
  const profileZscore = useProfileStore((s) => s.zscore);
  const profileDistrict = useProfileStore((s) => s.district);
  const profileLanguage = useProfileStore((s) => s.language);
  const setAuth = useAuthStore((s) => s.setAuth);
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      stream: profileStream || authUser?.stream || "",
      zscore: profileZscore ?? authUser?.zscore ?? 0,
      district: profileDistrict || authUser?.district || "Colombo",
      language: normalizeLanguage(profileLanguage || authUser?.language),
    },
  });

  const { mutate: updateProfile, isPending } = useUpdateProfile();

  useEffect(() => {
    if (authUser?.stream) setStream(authUser.stream);
    if (authUser?.zscore != null) setZscore(authUser.zscore);
    if (authUser?.district) setDistrict(authUser.district);
    if (authUser?.language) setLanguage(normalizeLanguage(authUser.language));
  }, [authUser, setStream, setZscore, setDistrict, setLanguage]);

  useEffect(() => {
    form.reset({
      stream: profileStream || authUser?.stream || "",
      zscore: profileZscore ?? authUser?.zscore ?? 0,
      district: profileDistrict || authUser?.district || "Colombo",
      language: normalizeLanguage(profileLanguage || authUser?.language),
    });
  }, [authUser, profileStream, profileZscore, profileDistrict, profileLanguage, form]);

  function applyLocalProfile(data: ProfileFormValues) {
    setStream(data.stream);
    setZscore(data.zscore);
    setDistrict(data.district);
    setLanguage(data.language);
  }

  function onSubmit(data: ProfileFormValues) {
    applyLocalProfile(data);

    if (token) {
      updateProfile(
        { data },
        {
          onSuccess: (user) => {
            setAuth(token, user);
            toast({ title: "Profile saved", description: "Your academic profile has been updated." });
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
      title: "Profile saved locally",
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
              Student Profile
            </CardTitle>
            <CardDescription>
              Tell us about your A/L results and district for UGC quota-based recommendations.
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
                      <FormLabel>A/L Stream</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stream" />
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
                      <FormLabel>Z-Score</FormLabel>
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
                      <FormLabel>District (UGC Quota)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select district" />
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
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Language</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Profile"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
    </div>
  );
}
