import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({
  message = "Something went wrong loading data. Please try again.",
  onRetry,
}: QueryErrorProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Failed to load</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="w-full sm:w-auto">
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
