import { StampLoader } from "@/components/loading";
import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";

// The back office opens on its own light ground at once.
export default async function Loading() {
  const t = getDict(await getLang());
  return (
    <div className="ground-desk flex flex-1 flex-col bg-desk text-ink">
      <StampLoader label={t.common.loading} />
    </div>
  );
}
