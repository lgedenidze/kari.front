import { StampLoader } from "@/components/loading";
import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";

// The door opens on its own dark ground at once, so there is no flash of the wrong colour.
export default async function Loading() {
  const t = getDict(await getLang());
  return (
    <div className="ground-deep flex flex-1 flex-col bg-ink-deep text-paper-light">
      <StampLoader label={t.common.loading} />
    </div>
  );
}
