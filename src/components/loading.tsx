// What a screen shows in the moment before its content arrives. Never the word "loading" on
// an empty page: the shape of what is coming, in the app's own materials, so the screen does
// not jump when the content lands.

/** The outline of a ticket, with a light sweeping across the paper. */
export function TicketSkeleton() {
  return (
    <div className="ticket w-full max-w-[22rem] opacity-60" aria-hidden="true">
      <div className="px-5 pb-4 pt-5">
        <div className="flex justify-between">
          <span className="skeleton h-4 w-24" />
          <span className="skeleton h-4 w-20" />
        </div>
        <span className="skeleton mt-5 block h-9 w-40" />
        <span className="skeleton mt-2 block h-9 w-52" />
        <span className="skeleton mt-3 block h-4 w-16" />
        <span className="skeleton mt-4 block aspect-square w-full !rounded-2xl" />
        <span className="skeleton mt-3 block h-4 w-36" />
      </div>
      <div className="ticket-tear" />
      <div className="flex justify-between px-5 pb-4 pt-3.5">
        <span className="skeleton h-8 w-24" />
        <span className="skeleton h-4 w-28" />
      </div>
    </div>
  );
}

/** A screen title and a few rows: a list, a form, a table on its way. */
export function RowsSkeleton({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="w-full space-y-4" aria-hidden="true">
      {title && <span className="skeleton block h-11 w-48" />}
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton block h-[4.5rem] w-full !rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * A stamp being inked: the ring draws itself round. For the door and the back office, where
 * there is no single shape to promise.
 */
export function StampLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16" role="status">
      <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeLinecap="round" className="stamp-loader" aria-hidden="true">
        <circle cx="32" cy="32" r="27" strokeWidth="4" opacity="0.2" />
        <circle cx="32" cy="32" r="27" strokeWidth="4" strokeDasharray="46 124" className="stamp-loader-ring" />
        <circle cx="32" cy="32" r="16" strokeWidth="2.5" opacity="0.35" />
      </svg>
      <p className="text-sm font-semibold opacity-70">{label}</p>
    </div>
  );
}
