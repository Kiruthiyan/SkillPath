import { useEffect } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/api";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { RequireAuth } from "@/components/require-auth";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuthStore } from "@/hooks/use-auth";
import "@/hooks/use-auth";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Dashboard from "@/pages/dashboard";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import Careers from "@/pages/careers";
import Reviews from "@/pages/reviews";
import SuccessStories from "@/pages/stories";
import Roadmap from "@/pages/roadmap";
import Chat from "@/pages/chat";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ChangePasswordForced from "@/pages/change-password";
import AcceptInvite from "@/pages/accept-invite";
import UniversityAdminDashboard from "@/pages/university-admin/dashboard";
import Mentors from "@/pages/mentors";
import MentorDashboard from "@/pages/mentor/dashboard";
import AdminMentors from "@/pages/admin/mentors";
import Opportunities from "@/pages/opportunities";
import AdminOpportunities from "@/pages/admin/opportunities";
import Universities from "@/pages/universities";
import Checker from "@/pages/checker";
import AdminOverview from "@/pages/admin/overview";
import AdminUsers from "@/pages/admin/users";
import AdminImports from "@/pages/admin/imports";
import AdminReviewQueue from "@/pages/admin/review-queue";
import AdminUniversities from "@/pages/admin/universities";
import AdminCourses from "@/pages/admin/courses";
import AdminRules from "@/pages/admin/rules";
import AdminZscoreData from "@/pages/admin/zscore-data";
import { RequireAdmin } from "@/components/require-admin";
import { RequireRole } from "@/components/require-role";

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
  queryClient.clear();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: handleGlobalAuthError,
    },
  },
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
    <RequireAuth>
      <Mentors />
    </RequireAuth>
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
      <ForcedPasswordChangeGate />
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
