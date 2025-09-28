"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // eslint-disable-next-line no-console
  console.error("App Error Boundary:", error);
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page. You can try resetting the page.
        </p>
        {error?.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">Error ID: {error.digest}</p>
        ) : null}
        <div className="mt-4">
          <Button onClick={() => reset()}>Reset page</Button>
        </div>
      </div>
    </div>
  );
}