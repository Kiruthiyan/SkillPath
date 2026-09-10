import { useState } from "react";
import { Search, ShieldCheck, ShieldOff, UserCog, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useListAdminUsers,
  useSetUserRole,
  useDeactivateAdminUser,
  useReactivateAdminUser,
  type AdminUser,
} from "@/api";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/query-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { AdminLayout } from "./admin-layout";

const PAGE_SIZE = 20;

function UserRow({ user, currentUserId }: { user: AdminUser; currentUserId: number | undefined }) {
  const { toast } = useToast();
  const { mutate: setRole, isPending: isSettingRole } = useSetUserRole();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateAdminUser();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateAdminUser();
  const isSelf = user.id === currentUserId;

  function toggleRole() {
    const nextRole = user.role === "admin" ? "user" : "admin";
    setRole(
      { id: user.id, role: nextRole },
      {
        onSuccess: () => toast({ title: `${user.email} is now ${nextRole}.` }),
        onError: (err: any) =>
          toast({
            title: "Could not change role",
            description: err?.message || "Please try again.",
            variant: "destructive",
          }),
      },
    );
  }

  function handleDeactivate() {
    deactivate(user.id, {
      onSuccess: () => toast({ title: `${user.email} deactivated.` }),
      onError: (err: any) =>
        toast({
          title: "Could not deactivate account",
          description: err?.message || "Please try again.",
          variant: "destructive",
        }),
    });
  }

  function handleReactivate() {
    reactivate(user.id, {
      onSuccess: () => toast({ title: `${user.email} reactivated.` }),
      onError: (err: any) =>
        toast({
          title: "Could not reactivate account",
          description: err?.message || "Please try again.",
          variant: "destructive",
        }),
    });
  }

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{user.name || user.email}</p>
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded capitalize",
                user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {user.role}
            </span>
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                user.isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {user.isActive ? "Active" : "Deactivated"}
            </span>
            {user.googleLinked && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Google
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {user.email} · Joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" disabled={isSettingRole} onClick={toggleRole} className="gap-1.5">
            <UserCog className="h-3.5 w-3.5" />
            {user.role === "admin" ? "Make user" : "Make admin"}
          </Button>

          {user.isActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSelf}
                  title={isSelf ? "You cannot deactivate your own account here." : undefined}
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Deactivate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate this account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.email} will be signed out on their next login attempt until reactivated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isDeactivating}
                    onClick={handleDeactivate}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isReactivating}
              onClick={handleReactivate}
              className="gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminUsers() {
  usePageTitle("Admin — Users");
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "user" | "admin">("all");
  const [status, setStatus] = useState<"all" | "true" | "false">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useListAdminUsers({
    page,
    pageSize: PAGE_SIZE,
    role: role === "all" ? undefined : role,
    isActive: status === "all" ? undefined : status,
    search: search || undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v as typeof role);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as typeof status);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isError && <QueryError onRetry={() => refetch()} />}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : data && data.users.length > 0 ? (
          <div className="space-y-2">
            {data.users.map((u) => (
              <UserRow key={u.id} user={u} currentUserId={currentUser?.id} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No users match these filters.
            </CardContent>
          </Card>
        )}

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {totalPages} · {data.total} users
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
