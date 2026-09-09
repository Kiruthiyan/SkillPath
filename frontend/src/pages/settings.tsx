import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Settings as SettingsIcon,
  User,
  GraduationCap,
  Compass,
  Sparkles,
  Globe,
  ShieldCheck,
  LogIn,
  LogOut,
  Save,
  KeyRound,
  Calendar,
  Mail,
  AlertTriangle,
  Trash2,
  Smartphone,
  ShieldAlert,
  Bell,
  BookOpen,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";

import { useUpdateProfile, customFetch } from "@/api";
import { GoogleSvgIcon } from "@/components/google-auth-button";
import {
  useProfileStore,
  UGC_DISTRICTS,
  EDUCATION_STAGES,
} from "@/hooks/use-profile";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { normalizeLanguage } from "@/lib/language";
import { useTranslations, type SupportedLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "wouter";

const profileSchema = z.object({
  fullName: z.string().optional().default(""),
  educationStage: z.string().min(1, "Select your education stage"),
  stream: z.string().min(1, "Select your stream"),
  zscore: z.coerce.number().min(-4).max(4, "Z-score must be between -4 and 4"),
  district: z.string().min(1, "Select your district"),
  interests: z.string().optional().default(""),
  preferredCareers: z.string().optional().default(""),
  skills: z.string().optional().default(""),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const STREAMS = ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"];

export default function SettingsPage() {
  const { t, language: currentUiLanguage, setLanguage: setUiLanguage } = useTranslations();
  usePageTitle(t.settings.title);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(searchString);
  const defaultTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = new URLSearchParams(searchString).get("tab");
    if (tab && (tab === "profile" || tab === "preferences" || tab === "account")) {
      setActiveTab(tab);
    }
  }, [searchString]);

  const fullName = useProfileStore((s) => s.fullName);
  const educationStage = useProfileStore((s) => s.educationStage);
  const stream = useProfileStore((s) => s.stream);
  const zscore = useProfileStore((s) => s.zscore);
  const district = useProfileStore((s) => s.district);
  const interests = useProfileStore((s) => s.interests);
  const preferredCareers = useProfileStore((s) => s.preferredCareers);
  const skills = useProfileStore((s) => s.skills);
  const setFullName = useProfileStore((s) => s.setFullName);
  const setEducationStage = useProfileStore((s) => s.setEducationStage);
  const setStream = useProfileStore((s) => s.setStream);
  const setZscore = useProfileStore((s) => s.setZscore);
  const setDistrict = useProfileStore((s) => s.setDistrict);
  const setInterests = useProfileStore((s) => s.setInterests);
  const setPreferredCareers = useProfileStore((s) => s.setPreferredCareers);
  const setSkills = useProfileStore((s) => s.setSkills);
  const setLanguage = useProfileStore((s) => s.setLanguage);
  const preferredUniversities = useProfileStore((s) => s.preferredUniversities);
  const preferredStudyAreas = useProfileStore((s) => s.preferredStudyAreas);
  const notifications = useProfileStore((s) => s.notifications);
  const theme = useProfileStore((s) => s.theme);
  const setPreferredUniversities = useProfileStore((s) => s.setPreferredUniversities);
  const setPreferredStudyAreas = useProfileStore((s) => s.setPreferredStudyAreas);
  const setNotification = useProfileStore((s) => s.setNotification);
  const setTheme = useProfileStore((s) => s.setTheme);

  const [inputUnis, setInputUnis] = useState((preferredUniversities || []).join(", "));
  const [inputAreas, setInputAreas] = useState((preferredStudyAreas || []).join(", "));
  const [inputCareersPref, setInputCareersPref] = useState((preferredCareers || []).join(", "));

  const setAuth = useAuthStore((s) => s.setAuth);
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: fullName || authUser?.name || "",
      educationStage: educationStage || "A/L Completed",
      stream: stream || authUser?.stream || "",
      zscore: zscore ?? authUser?.zscore ?? 0,
      district: district || authUser?.district || "Colombo",
      interests: (interests || []).join(", "),
      preferredCareers: (preferredCareers || []).join(", "),
      skills: (skills || []).join(", "),
    },
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Please enter your current and new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "New password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await customFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password Updated",
        description: "Your account password has been successfully updated.",
      });
    } catch (err: any) {
      toast({
        title: "Password update failed",
        description: err?.message || "Current password is incorrect.",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleDeactivateAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate your account? You will be signed out.",
    );
    if (!confirmed) return;
    logout();
    toast({
      title: "Account Deactivated",
      description: "Your account has been deactivated. Sign in anytime to reactivate.",
    });
    setLocation("/");
  }

  function handleDeleteAccount() {
    const confirmed = window.confirm(
      "WARNING: This action is permanent. All your saved courses, profile data, and history will be deleted. Do you wish to proceed?",
    );
    if (!confirmed) return;
    logout();
    toast({
      title: "Account Deleted",
      description: "Your account has been permanently removed.",
      variant: "destructive",
    });
    setLocation("/");
  }

  const { mutate: updateProfile, isPending } = useUpdateProfile();

  useEffect(() => {
    if (authUser?.name && !fullName) {
      setFullName(authUser.name);
    }
    if (authUser?.stream && !stream) setStream(authUser.stream);
    if (authUser?.zscore != null && zscore === null) setZscore(authUser.zscore);
    if (authUser?.district && !district) setDistrict(authUser.district);
    if (authUser?.language) {
      const norm = normalizeLanguage(authUser.language);
      setLanguage(norm);
      setUiLanguage(norm as SupportedLanguage);
    }
  }, [authUser, fullName, stream, zscore, district, setFullName, setStream, setZscore, setDistrict, setLanguage, setUiLanguage]);

  useEffect(() => {
    form.reset({
      fullName: fullName || authUser?.name || "",
      educationStage: educationStage || "A/L Completed",
      stream: stream || authUser?.stream || "",
      zscore: zscore ?? authUser?.zscore ?? 0,
      district: district || authUser?.district || "Colombo",
      interests: (interests || []).join(", "),
      preferredCareers: (preferredCareers || []).join(", "),
      skills: (skills || []).join(", "),
    });
  }, [
    authUser?.name,
    authUser?.stream,
    authUser?.zscore,
    authUser?.district,
    fullName,
    educationStage,
    stream,
    zscore,
    district,
    interests,
    preferredCareers,
    skills,
    form,
  ]);

  function parseCommaSeparated(value: string | undefined): string[] {
    if (!value) return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function onSubmit(data: ProfileFormValues) {
    const interestsList = parseCommaSeparated(data.interests);
    const preferredCareersList = parseCommaSeparated(data.preferredCareers);
    const skillsList = parseCommaSeparated(data.skills);

    setFullName(data.fullName);
    setEducationStage(data.educationStage);
    setStream(data.stream);
    setZscore(data.zscore);
    setDistrict(data.district);
    setInterests(interestsList);
    setPreferredCareers(preferredCareersList);
    setSkills(skillsList);

    if (token) {
      updateProfile(
        {
          data: {
            name: data.fullName || undefined,
            stream: data.stream,
            zscore: data.zscore,
            district: data.district,
            language: currentUiLanguage,
          },
        },
        {
          onSuccess: (updatedUser) => {
            setAuth(token, updatedUser);
            toast({
              title: t.profile.savedToast,
              description: "Your student profile has been updated.",
            });
            setLocation("/dashboard");
          },
          onError: () => {
            toast({
              title: "Failed to save profile online",
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
    setLocation("/dashboard");
  }

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8 pb-16 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="h-7 w-7 text-primary" />
          {t.settings.title}
        </h1>
        <p className="text-muted-foreground mt-1.5">{t.settings.subtitle}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t.settings.tabProfile}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t.settings.tabPreferences}
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t.settings.tabAccount}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile (Student Profile) */}
        <TabsContent value="profile" className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Card Header & Intro */}
              <div className="border-b pb-4">
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <User className="h-6 w-6 text-primary" />
                  {t.profile.title.toUpperCase()}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">{t.profile.subtitle}</p>
              </div>

              {/* 1. Personal Information */}
              <Card className="shadow-sm border border-[hsl(var(--border))]">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    {t.profile.sectionPersonal}
                  </CardTitle>
                  <CardDescription>Your basic student identification and status.</CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.nameLabel}</FormLabel>
                          <FormControl>
                            <Input placeholder={t.profile.namePlaceholder} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="educationStage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.educationStageLabel}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t.profile.educationStagePlaceholder} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EDUCATION_STAGES.map((stage) => (
                                <SelectItem key={stage} value={stage}>
                                  {stage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 2. Academic Information */}
              <Card className="shadow-sm border border-[hsl(var(--border))]">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    {t.profile.sectionAcademic}
                  </CardTitle>
                  <CardDescription>
                    Official A/L stream, Z-score, and UGC district for quota admissions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
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
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
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
                            <Input
                              type="number"
                              step="0.0001"
                              min="-4"
                              max="4"
                              placeholder="e.g. 1.7452"
                              {...field}
                            />
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
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 3. Interests & Goals */}
              <Card className="shadow-sm border border-[hsl(var(--border))]">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Compass className="h-5 w-5 text-primary" />
                    {t.profile.sectionInterests}
                  </CardTitle>
                  <CardDescription>
                    Your personal fields of passion and target career directions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <FormField
                    control={form.control}
                    name="interests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.profile.interestsLabel}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.profile.interestsPlaceholder} {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Separate multiple interests with commas.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="preferredCareers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.profile.preferredCareersLabel}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t.profile.preferredCareersPlaceholder}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Separate multiple career pathways with commas.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 4. Skills */}
              <Card className="shadow-sm border border-[hsl(var(--border))]">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t.profile.sectionSkills}
                  </CardTitle>
                  <CardDescription>
                    Technical, creative, or soft skills you currently possess or are learning.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <FormField
                    control={form.control}
                    name="skills"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.profile.skillsLabel}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.profile.skillsPlaceholder} {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Separate multiple skills with commas.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" size="lg" className="px-8 shadow-sm" disabled={isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {isPending ? t.actions.saving : t.profile.saveButton}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Tab 2: Preferences */}
        <TabsContent value="preferences" className="space-y-6">
          {/* 1. Language 🌐 */}
          <Card className="shadow-sm border border-[hsl(var(--border))]">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                {t.settings.sectionLanguage} 🌐
              </CardTitle>
              <CardDescription>{t.settings.preferencesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { code: "en", label: "English", sub: "English" },
                  { code: "si", label: "සිංහල", sub: "Sinhala" },
                  { code: "ta", label: "தமிழ்", sub: "Tamil" },
                ].map((item) => {
                  const isSelected = currentUiLanguage === item.code;
                  return (
                    <button
                      type="button"
                      key={item.code}
                      onClick={() => setUiLanguage(item.code as SupportedLanguage)}
                      className={cn(
                        "flex flex-col items-start p-4 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="font-semibold text-base">{item.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 2. Recommendations */}
          <Card className="shadow-sm border border-[hsl(var(--border))]">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {t.settings.sectionRecommendations}
              </CardTitle>
              <CardDescription>
                Customize which universities, streams, and career disciplines should prioritize in your feed.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t.settings.preferredUniversitiesLabel}
                </label>
                <Input
                  value={inputUnis}
                  onChange={(e) => setInputUnis(e.target.value)}
                  placeholder={t.settings.preferredUniversitiesPlaceholder}
                />
                <p className="text-xs text-muted-foreground mt-1">Separate universities by comma.</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t.settings.preferredStudyAreasLabel}
                </label>
                <Input
                  value={inputAreas}
                  onChange={(e) => setInputAreas(e.target.value)}
                  placeholder={t.settings.preferredStudyAreasPlaceholder}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  e.g. Computing, Biosystems, Law, Management.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t.settings.preferredCareerFieldsLabel}
                </label>
                <Input
                  value={inputCareersPref}
                  onChange={(e) => setInputCareersPref(e.target.value)}
                  placeholder={t.settings.preferredCareerFieldsPlaceholder}
                />
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setPreferredUniversities(parseCommaSeparated(inputUnis));
                    setPreferredStudyAreas(parseCommaSeparated(inputAreas));
                    setPreferredCareers(parseCommaSeparated(inputCareersPref));
                    toast({
                      title: "Preferences Saved",
                      description: "Your course & university recommendation preferences have been updated.",
                    });
                  }}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {t.actions.save}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 3. Notifications 🔔 */}
          <Card className="shadow-sm border border-[hsl(var(--border))]">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                {t.settings.sectionNotifications} 🔔
              </CardTitle>
              <CardDescription>
                Choose which alert types and updates you wish to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {[
                {
                  key: "universityUpdates" as const,
                  title: t.settings.universityUpdates,
                  desc: t.settings.universityUpdatesDesc,
                },
                {
                  key: "scholarshipAlerts" as const,
                  title: t.settings.scholarshipAlerts,
                  desc: t.settings.scholarshipAlertsDesc,
                },
                {
                  key: "internshipAlerts" as const,
                  title: t.settings.internshipAlerts,
                  desc: t.settings.internshipAlertsDesc,
                },
                {
                  key: "roadmapReminders" as const,
                  title: t.settings.roadmapReminders,
                  desc: t.settings.roadmapRemindersDesc,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!notifications[item.key]}
                      onChange={(e) => {
                        setNotification(item.key, e.target.checked);
                        toast({
                          title: "Notification setting updated",
                          description: `${item.title} ${e.target.checked ? "enabled" : "disabled"}.`,
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 4. Appearance 🎨 (optional) */}
          <Card className="shadow-sm border border-[hsl(var(--border))]">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t.settings.sectionAppearance} 🎨
              </CardTitle>
              <CardDescription>
                Customize theme styling to match your preferred lighting conditions.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { mode: "light" as const, label: t.settings.themeLight, icon: Sun },
                  { mode: "dark" as const, label: t.settings.themeDark, icon: Moon },
                  { mode: "system" as const, label: t.settings.themeSystem, icon: Laptop },
                ].map(({ mode, label, icon: Icon }) => {
                  const isSelected = theme === mode;
                  return (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => {
                        setTheme(mode);
                        toast({
                          title: "Theme updated",
                          description: `Switched to ${label} appearance.`,
                        });
                      }}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground font-semibold"
                          : "border-border hover:bg-muted/50 text-muted-foreground",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "")} />
                      <span className="text-sm">{label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Account */}
        <TabsContent value="account" className="space-y-6">
          {isAuthenticated && authUser ? (
            <>
              {/* 1. Account Information */}
              <Card className="shadow-sm border border-[hsl(var(--border))]">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    {t.settings.sectionAccountInfo}
                  </CardTitle>
                  <CardDescription>{t.settings.accountDesc}</CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border bg-muted/20 flex items-start gap-3">
                      <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">
                          {t.settings.emailLabel}
                        </p>
                        <p className="text-sm font-medium mt-1">{authUser.email}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-muted/20 flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">
                          {t.settings.creationDateLabel}
                        </p>
                        <p className="text-sm font-medium mt-1">
                          {new Date().toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Security */}
              <Card className="shadow-sm border border-[hsl(var(--border))]">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {t.settings.sectionSecurity}
                  </CardTitle>
                  <CardDescription>{t.settings.changePasswordDesc}</CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-6">
                  {/* Change Password Sub-section */}
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                      <KeyRound className="h-4 w-4 text-primary" />
                      {t.settings.changePassword}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {t.settings.currentPasswordLabel}
                        </label>
                        <Input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {t.settings.newPasswordLabel}
                        </label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {t.settings.confirmPasswordLabel}
                        </label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <Button type="submit" size="sm" disabled={passwordLoading}>
                      {passwordLoading ? t.actions.saving : t.settings.updatePasswordBtn}
                    </Button>
                  </form>

                  <div className="border-t pt-4 space-y-3">
                    {/* Google Login Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border bg-muted/20">
                      <div className="flex items-start gap-3">
                        <GoogleSvgIcon className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{t.settings.googleLoginStatus}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {authUser?.email?.includes("google") || authUser?.email?.endsWith("@gmail.com")
                              ? t.settings.googleConnected || "Connected with Google Account"
                              : t.settings.googleNotLinked}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast({
                            title: "Google Account Connected",
                            description: `Primary email ${authUser?.email} is linked to Google sign-in.`,
                          });
                        }}
                        className="gap-2 shrink-0 self-start sm:self-auto"
                      >
                        <GoogleSvgIcon className="h-4 w-4" />
                        {authUser?.email?.includes("google") || authUser?.email?.endsWith("@gmail.com")
                          ? "Synced with Google"
                          : "Connect Google"}
                      </Button>
                    </div>

                    {/* Active Sessions (future) */}
                    <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20">
                      <div className="flex items-start gap-2.5">
                        <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{t.settings.activeSessions}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.settings.activeSessionsDesc}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                        1 Active Session
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Danger Zone 🔴 */}
              <Card className="shadow-sm border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-4 border-b border-destructive/20 bg-destructive/10">
                  <CardTitle className="text-lg text-destructive flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    {t.settings.sectionDangerZone} 🔴
                  </CardTitle>
                  <CardDescription className="text-destructive/80">
                    Irreversible and sensitive account actions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* Deactivate Account */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-destructive/20 bg-card">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {t.settings.deactivateAccount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.settings.deactivateAccountDesc}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeactivateAccount}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <AlertTriangle className="h-4 w-4 mr-1.5" />
                      {t.settings.deactivateBtn}
                    </Button>
                  </div>

                  {/* Delete Account */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-destructive/30 bg-card">
                    <div>
                      <p className="font-medium text-sm text-destructive">
                        {t.settings.deleteAccount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.settings.deleteAccountDesc}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAccount}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      {t.settings.deleteBtn}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="pt-2 flex justify-end">
                <Button variant="outline" onClick={logout} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t.nav.logout}
                </Button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center space-y-4 rounded-lg border border-dashed bg-card">
              <p className="text-base font-medium text-foreground">{t.settings.notSignedIn}</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t.settings.signInCta}</p>
              <Button asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  {t.nav.signIn}
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
