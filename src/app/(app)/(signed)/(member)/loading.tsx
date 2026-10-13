import { TicketSkeleton } from "@/components/loading";

// Shown the instant a member taps a tab, while the page asks the server who is signed in.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center">
      <TicketSkeleton />
    </div>
  );
}
