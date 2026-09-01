import { Switch, Route, Router as WouterRouter } from "wouter";
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
import Universities from "@/pages/universities";
import Checker from "@/pages/checker";
import AdminImports from "@/pages/admin/imports";
import AdminReviewQueue from "@/pages/admin/review-queue";
import AdminUniversities from "@/pages/admin/universities";
import AdminCourses from "@/pages/admin/courses";
import AdminRules from "@/pages/admin/rules";
import AdminZscoreData from "@/pages/admin/zscore-data";
import { RequireAdmin } from "@/components/require-admin";

function handleGlobalAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    useAuthStore.getState().logout();
  }
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
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
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

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/profile" component={Profile} />
        <Route path="/dashboard" component={ProtectedDashboard} />
        <Route path="/universities/:id" component={Universities} />
        <Route path="/universities" component={Universities} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        <Route path="/checker" component={Checker} />
        <Route path="/admin/imports" component={ProtectedAdminImports} />
        <Route path="/admin/review" component={ProtectedAdminReviewQueue} />
        <Route path="/admin/universities" component={ProtectedAdminUniversities} />
        <Route path="/admin/courses" component={ProtectedAdminCourses} />
        <Route path="/admin/rules" component={ProtectedAdminRules} />
        <Route path="/admin/zscore" component={ProtectedAdminZscoreData} />
        <Route path="/careers" component={Careers} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/stories" component={SuccessStories} />
        <Route path="/roadmap" component={Roadmap} />
        <Route path="/chat" component={Chat} />
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
