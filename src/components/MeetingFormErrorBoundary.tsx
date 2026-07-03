import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MeetingFormErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("MeetingForm error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="space-y-6 p-6">
          <h1 className="text-2xl font-bold text-destructive">
            Schedule Meeting — Something went wrong
          </h1>
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-mono text-sm break-all">
                {this.state.error.message}
              </p>
              {this.state.error.stack && (
                <pre className="overflow-auto rounded bg-muted p-3 text-xs max-h-48">
                  {this.state.error.stack}
                </pre>
              )}
            </CardContent>
          </Card>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/meetings")}
          >
            Back to Meetings
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
