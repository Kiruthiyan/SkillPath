import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            An unexpected error occurred. Please refresh the page.
          </p>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
