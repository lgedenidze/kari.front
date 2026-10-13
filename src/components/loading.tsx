// What a screen shows when it has nothing to show yet.
//
// There is one material for it — a quiet block with a light sweeping across — and one rule:
// a screen has a single placeholder, in the shape of what is coming, and it is the same one
// whether the page is still on its way (the route's loading.tsx) or the page is here and its
// data is not. Never a spinner, never the word "loading", never one placeholder after another.
//
// `data-skeleton` names the shape; the end-to-end tests count them.

/** The outline of a ticket. Sized like `TicketCard`, so the real one lands on top of it. */
export function TicketSkeleton() {
  return (
    <div className="ticket w-full max-w-[22rem] opacity-60" aria-hidden="true" data-skeleton="ticket">
      <div className="px-5 pb-4 pt-5">
        <div className="flex justify-between">
          <span className="skeleton h-5 w-24" />
          <span className="skeleton h-5 w-20" />
        </div>
        <span className="skeleton mt-4 block h-[2.1rem] w-40" />
        <span className="skeleton mt-1.5 block h-[2.1rem] w-52" />
        <span className="skeleton mt-2 block h-5 w-16" />
        <span className="skeleton mt-4 block aspect-square w-full !rounded-2xl" />
        <span className="skeleton mt-3 block h-11 w-36" />
      </div>
      <div className="ticket-tear" />
      <div className="flex items-end justify-between px-5 pb-4 pt-3.5">
        <span className="skeleton h-10 w-24" />
        <span className="skeleton h-4 w-28" />
      </div>
    </div>
  );
}

/** Rows on their way: a list, a form, a table. `title` adds a bar where a heading will be. */
export function RowsSkeleton({ rows = 4, title = false }: { rows?: number; title?: boolean }) {
  return (
    <div className="w-full space-y-4" aria-hidden="true" data-skeleton={`rows-${rows}${title ? "-title" : ""}`}>
      {title && <span className="skeleton block h-11 w-48" />}
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton block h-[4.5rem] w-full !rounded-2xl" />
      ))}
    </div>
  );
}
