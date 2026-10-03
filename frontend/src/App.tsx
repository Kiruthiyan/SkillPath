import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/api";
import { queryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { RequireAuth } from "@/components/require-auth";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuthStore } from "@/hooks/use-auth";
import { applyRouteSeo } from "@/lib/seo";
import "@/hooks/use-auth";

import Home from "@/pages/home";
import Checker from "@/pages/checker";
import { RequireAdmin } from "@/components/require-admin";
import { RequireRole } from "@/components/require-role";
import { Skeleton } from "@/components/ui/skeleton";

const NotFound = lazy(() => import("@/pages/not-found"));
const Profile = lazy(() => import("@/pages/profile"));
const Settings = lazy(() => import("@/pages/settings"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Courses = lazy(() => import("@/pages/courses"));
const CourseDetail = lazy(() => import("@/pages/course-detail"));
const Careers = lazy(() => import("@/pages/careers"));
const Reviews = lazy(() => import("@/pages/reviews"));
const SuccessStories = lazy(() => import("@/pages/stories"));
const Roadmap = lazy(() => import("@/pages/roadmap"));
const Chat = lazy(() => import("@/pages/chat"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ChangePasswordForced = lazy(() => import("@/pages/change-password"));
const AcceptInvite = lazy(() => import("@/pages/accept-invite"));
const UniversityAdminDashboard = lazy(() => import("@/pages/university-admin/dashboard"));
const Mentors = lazy(() => import("@/pages/mentors"));
const MentorDashboard = lazy(() => import("@/pages/mentor/dashboard"));
const AdminMentors = lazy(() => import("@/pages/admin/mentors"));
const Opportunities = lazy(() => import("@/pages/opportunities"));
const AdminOpportunities = lazy(() => import("@/pages/admin/opportunities"));
const Universities = lazy(() => import("@/pages/universities"));
const AdminOverview = lazy(() => import("@/pages/admin/overview"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminImports = lazy(() => import("@/pages/admin/imports"));
const AdminReviewQueue = lazy(() => import("@/pages/admin/review-queue"));
const AdminUniversities = lazy(() => import("@/pages/admin/universities"));
const AdminCourses = lazy(() => import("@/pages/admin/courses"));
const AdminRules = lazy(() => import("@/pages/admin/rules"));
const AdminZscoreData = lazy(() => import("@/pages/admin/zscore-data"));

/**
 * Endpoints where a 401 means "the credentials you just submitted are wrong",
 * not "your session is dead". Signing the user out on these is what made a
 * mistyped current password look like a successful password change: the form
 * vanished, the user assumed it had worked, and the new password never existed.
 */
const CREDENTIAL_CHECK_ENDPOINTS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/google",
  "/api/auth/change-password",
  "/api/auth/account",
  "/api/auth/accept-invite",
  "/api/auth/reset-password",
  "/api/auth/verify-reset-otp",
  "/api/auth/forgot-password",
];

function isCredentialCheck(url: string): boolean {
  // ApiError.url may be absolute; compare on the path only.
  const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]!;
  return CREDENTIAL_CHECK_ENDPOINTS.some((endpoint) => path === endpoint);
}

function handleGlobalAuthError(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  if (isCredentialCheck(error.url)) return;

  useAuthStore.getState().logout();
}

queryClient.setDefaultOptions({
  ...queryClient.getDefaultOptions(),
  mutations: { onError: handleGlobalAuthError },
});
queryClient.getQueryCache().config.onError = handleGlobalAuthError;

function ProtectedDashboard() {
  return (
    <RequireRole roles={["student"]}>
      <Dashboard />
    </RequireRole>
  );
}

function ProtectedProfile() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}

function ProtectedSettings() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function ProtectedCourseDetail() {
  return (
    <RequireAuth>
      <CourseDetail />
    </RequireAuth>
  );
}

function ProtectedRoadmap() {
  return (
    <RequireAuth>
      <Roadmap />
    </RequireAuth>
  );
}

function ProtectedChat() {
  return (
    <RequireAuth>
      <Chat />
    </RequireAuth>
  );
}

function ProtectedCourses() {
  return (
    <RequireAuth>
      <Courses />
    </RequireAuth>
  );
}

function ProtectedUniversities() {
  return (
    <RequireAuth>
      <Universities />
    </RequireAuth>
  );
}

function ProtectedCareers() {
  return (
    <RequireAuth>
      <Careers />
    </RequireAuth>
  );
}

function ProtectedReviews() {
  return (
    <RequireAuth>
      <Reviews />
    </RequireAuth>
  );
}

function ProtectedSuccessStories() {
  return (
    <RequireAuth>
      <SuccessStories />
    </RequireAuth>
  );
}

function ProtectedAdminOverview() {
  return (
    <RequireAdmin>
      <AdminOverview />
    </RequireAdmin>
  );
}

function ProtectedAdminUsers() {
  return (
    <RequireAdmin>
      <AdminUsers />
    </RequireAdmin>
  );
}

function ProtectedAdminImports() {
  return (
    <RequireAdmin>
      <AdminImports />
    </RequireAdmin>
  );
}

function ProtectedAdminReviewQueue() {
  return (
    <RequireAdmin>
      <AdminReviewQueue />
    </RequireAdmin>
  );
}

function ProtectedAdminUniversities() {
  return (
    <RequireAdmin>
      <AdminUniversities />
    </RequireAdmin>
  );
}

function ProtectedAdminCourses() {
  return (
    <RequireAdmin>
      <AdminCourses />
    </RequireAdmin>
  );
}

function ProtectedAdminRules() {
  return (
    <RequireAdmin>
      <AdminRules />
    </RequireAdmin>
  );
}

function ProtectedAdminZscoreData() {
  return (
    <RequireAdmin>
      <AdminZscoreData />
    </RequireAdmin>
  );
}

function ForcedPasswordChangeGate() {
  const [location, setLocation] = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (token && user?.mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [token, user, location, setLocation]);

  return null;
}

function ProtectedUniversityAdminDashboard() {
  return (
    <RequireRole roles={["university_admin"]}>
      <UniversityAdminDashboard />
    </RequireRole>
  );
}

function ProtectedMentorDashboard() {
  return (
    <RequireRole roles={["mentor"]}>
      <MentorDashboard />
    </RequireRole>
  );
}

function ProtectedAdminMentors() {
  return (
    <RequireAdmin>
      <AdminMentors />
    </RequireAdmin>
  );
}

function ProtectedAdminOpportunities() {
  return (
    <RequireRole roles={["university_admin", "admin", "super_admin"]}>
      <AdminOpportunities />
    </RequireRole>
  );
}

function ProtectedMentorsDirectory() {
  return (
    <RequireRole roles={["student"]}>
      <Mentors />
    </RequireRole>
  );
}

function ProtectedOpportunities() {
  return (
    <RequireAuth>
      <Opportunities />
    </RequireAuth>
  );
}

function ProtectedChangePassword() {
  return (
    <RequireAuth>
      <ChangePasswordForced />
    </RequireAuth>
  );
}

function RouteMetadata() {
  const [location] = useLocation();

  useEffect(() => {
    applyRouteSeo(location);
  }, [location]);

  return null;
}

function PageFallback() {
  return (
    <div className="space-y-4 py-8" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** `/admin` is not a page; send it to the real landing page. */
function AdminIndexRedirect() {
  return <Redirect to="/admin/overview" replace />;
}

/**
 * Catches any unmatched `/admin/*` path. Without it those fall through to the
 * unguarded 404 route, which renders admin-looking chrome for a signed-in
 * student. Guarding it means a non-admin is redirected to their own dashboard
 * instead of seeing anything under /admin.
 */
function ProtectedAdminNotFound() {
  return (
    <RequireAdmin>
      <NotFound />
    </RequireAdmin>
  );
}

function Router() {
  return (
    <AppLayout>
      <RouteMetadata />
      <ForcedPasswordChangeGate />
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/change-password" component={ProtectedChangePassword} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/university-admin" component={ProtectedUniversityAdminDashboard} />
          <Route path="/mentors" component={ProtectedMentorsDirectory} />
          <Route path="/mentor" component={ProtectedMentorDashboard} />
          <Route path="/admin/mentors" component={ProtectedAdminMentors} />
          <Route path="/opportunities" component={ProtectedOpportunities} />
          <Route path="/admin/opportunities" component={ProtectedAdminOpportunities} />
          <Route path="/profile" component={ProtectedProfile} />
          <Route path="/settings" component={ProtectedSettings} />
          <Route path="/dashboard" component={ProtectedDashboard} />
          <Route path="/universities/:id" component={ProtectedUniversities} />
          <Route path="/universities" component={ProtectedUniversities} />
          <Route path="/courses" component={ProtectedCourses} />
          <Route path="/courses/:id" component={ProtectedCourseDetail} />
          <Route path="/checker" component={Checker} />
          <Route path="/admin" component={AdminIndexRedirect} />
          <Route path="/admin/overview" component={ProtectedAdminOverview} />
          <Route path="/admin/users" component={ProtectedAdminUsers} />
          <Route path="/admin/imports" component={ProtectedAdminImports} />
          <Route path="/admin/review" component={ProtectedAdminReviewQueue} />
          <Route path="/admin/universities" component={ProtectedAdminUniversities} />
          <Route path="/admin/courses" component={ProtectedAdminCourses} />
          <Route path="/admin/rules" component={ProtectedAdminRules} />
          <Route path="/admin/zscore" component={ProtectedAdminZscoreData} />
          <Route path="/careers" component={ProtectedCareers} />
          <Route path="/reviews" component={ProtectedReviews} />
          <Route path="/stories" component={ProtectedSuccessStories} />
          <Route path="/roadmap" component={ProtectedRoadmap} />
          <Route path="/chat" component={ProtectedChat} />
          <Route path="/admin/*" component={ProtectedAdminNotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthBootstrap />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
