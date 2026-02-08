"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class OnboardingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Onboarding error:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto mt-12 px-4">
          <Card className="border-destructive/20 rounded-2xl">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Don&apos;t worry — your progress has been saved locally. Try
                refreshing the page, or start the step over.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
                <Button
                  onClick={() => this.setState({ hasError: false })}
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
