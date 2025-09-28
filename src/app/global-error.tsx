"use client";

import ErrorReporter from "@/components/ErrorReporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="mx-auto max-w-2xl p-6">
          <div className="rounded-xl border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <button
              type="button"
              className="mt-4 inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
              onClick={() => reset()}
            >
              Reset page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}