import { Link } from "wouter";
import {
  Users,
  UserCheck,
  UserX,
  Link2,
  UserPlus,
  GraduationCap,
  Building2,
  Briefcase,
  Star,
  BookOpen,
  Map as MapIcon,
  FileClock,
  UserRound,
  BadgeCheck,
  Clock,
  Landmark,
  Megaphone,
  Upload,
  FileSearch,
  type LucideIcon,
} from "lucide-react";
import { useAdminMetrics } from "@/api";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/query-error";
import { AdminLayout } from "./admin-layout";

function MetricCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            {label}
          </span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-1">
          {loading ? (
            <Skeleton className="h-8 w-16 my-1" />
          ) : (
            <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/mentors", label: "Add Mentor", icon: UserRound },
  { href: "/admin/universities", label: "Add University", icon: Building2 },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap },
  { href: "/admin/opportunities", label: "Add Opportunity", icon: Megaphone },
  { href: "/admin/imports", label: "Import Handbook", icon: Upload },
  { href: "/admin/review", label: "Review Extracted Data", icon: FileSearch },
];

export default function AdminOverview() {
  usePageTitle("Admin — Overview");
  const { data, isLoading, isError, refetch } = useAdminMetrics();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {isError && <QueryError onRetry={() => refetch()} />}

        <div>
          <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_ACTIONS.map((a) => (
              <Button key={a.href} asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={a.href}>
                  <a.icon className="h-3.5 w-3.5" />
                  {a.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">People</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            <MetricCard label="Students" value={data?.studentCount ?? "—"} icon={Users} loading={isLoading} />
            <MetricCard
              label="Active Mentors"
              value={data?.activeMentors ?? "—"}
              icon={BadgeCheck}
              loading={isLoading}
            />
            <MetricCard
              label="Pending Mentor Verification"
              value={data?.pendingMentorVerification ?? "—"}
              icon={Clock}
              loading={isLoading}
            />
            <MetricCard
              label="Total Users"
              value={data?.totalUsers ?? "—"}
              icon={UserPlus}
              loading={isLoading}
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">Users</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            <MetricCard label="Active" value={data?.activeUsers ?? "—"} icon={UserCheck} loading={isLoading} />
            <MetricCard
              label="Deactivated"
              value={data?.deactivatedUsers ?? "—"}
              icon={UserX}
              loading={isLoading}
            />
            <MetricCard
              label="Google-linked"
              value={data?.googleLinkedUsers ?? "—"}
              icon={Link2}
              loading={isLoading}
            />
            <MetricCard
              label="New (7d)"
              value={data?.newUsersLast7d ?? "—"}
              icon={UserPlus}
              loading={isLoading}
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">Platform</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            <MetricCard
              label="Universities (handbook)"
              value={data?.totalUniversities ?? "—"}
              icon={Building2}
              loading={isLoading}
            />
            <MetricCard
              label="Government Universities"
              value={data?.governmentUniversities ?? "—"}
              icon={Landmark}
              loading={isLoading}
            />
            <MetricCard
              label="Private Universities"
              value={data?.privateUniversities ?? "—"}
              icon={Building2}
              loading={isLoading}
            />
            <MetricCard
              label="Courses"
              value={data?.totalCourses ?? "—"}
              icon={GraduationCap}
              loading={isLoading}
            />
            <MetricCard label="Careers" value={data?.totalCareers ?? "—"} icon={Briefcase} loading={isLoading} />
            <MetricCard label="Reviews" value={data?.totalReviews ?? "—"} icon={Star} loading={isLoading} />
            <MetricCard label="Stories" value={data?.totalStories ?? "—"} icon={BookOpen} loading={isLoading} />
            <MetricCard
              label="Roadmaps Generated"
              value={data?.roadmapsGenerated ?? "—"}
              icon={MapIcon}
              loading={isLoading}
            />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <FileClock className="h-4 w-4 text-primary" />
              Recent Handbook Imports
            </CardTitle>
            <CardDescription>Latest extraction batches submitted for review.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : data && data.recentBatches.length > 0 ? (
              <div className="space-y-2">
                {data.recentBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                  >
                    <div>
                      <p className="text-sm font-medium">{batch.sourceFileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch.academicYear} · {new Date(batch.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary capitalize">
                      {batch.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No handbook imports yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
