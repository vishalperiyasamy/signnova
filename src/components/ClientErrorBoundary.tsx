"use client";

import React from "react";
import { useRouter } from "next/navigation";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type State = { hasError: boolean; error?: any };

export const ClientErrorBoundary: React.FC<Props> = ({ children, fallbackTitle = "Something went wrong", fallbackMessage = "An unexpected client error occurred. You can try resetting the page." }) => {
  const router = useRouter();

  class Boundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: any): State {
      return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
      // eslint-disable-next-line no-console
      console.error("ClientErrorBoundary caught:", error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="mx-auto max-w-2xl p-6">
            <div className="rounded-xl border bg-card p-6 text-card-foreground">
              <h2 className="text-lg font-semibold">{fallbackTitle}</h2>
              <p className="mt-2 text-muted-foreground">{fallbackMessage}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                  onClick={() => {
                    // clear local error state then refresh route
                    this.setState({ hasError: false, error: undefined });
                    router.refresh();
                  }}
                >
                  Reset page
                </button>
              </div>
            </div>
          </div>
        );
      }
      return this.props.children as any;
    }
  }

  // Wrap children with the class boundary to use hooks above
  return <Boundary>{children}</Boundary>;
};

export default ClientErrorBoundary;