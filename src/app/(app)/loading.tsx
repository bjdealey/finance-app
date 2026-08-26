// Route-level loading UI for the authenticated app. Shows instantly on client-side navigation
// between app pages (the shared layout stays mounted, so this fills the <main> while the next
// page's data — analysis, transaction queries, forecasts — streams in). A calm skeleton that
// echoes the common page chrome (header + a hero card + two detail cards) rather than a spinner,
// so the shape of what's arriving is already legible. The pulse freezes under reduced-motion via
// the global guard in globals.css; the role="status" text keeps it announced either way.
function Bar({ className }: { className?: string }) {
  return <div className={`rounded bg-surface-2 ${className ?? ''}`} />;
}

export default function Loading() {
  return (
    <div role="status" className="space-y-10">
      <span className="sr-only">Loading…</span>

      <div aria-hidden className="animate-pulse space-y-10">
        {/* Page header */}
        <div className="space-y-3">
          <Bar className="h-8 w-64 max-w-[70%] rounded-lg" />
          <Bar className="h-4 w-80 max-w-[85%]" />
        </div>

        {/* Hero card with a stat row */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <Bar className="h-4 w-40" />
          <Bar className="mt-3 h-10 w-56 rounded-lg" />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Bar className="h-3 w-20" />
                <Bar className="h-6 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* Two detail cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-xl border border-border bg-surface p-5">
              <Bar className="h-4 w-28" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Bar className="h-3 w-32" />
                  <Bar className="h-3 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
