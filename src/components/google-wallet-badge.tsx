import type { Lang } from "@/venue";

// Google's own file, in each language (public/wallet/), exactly as Google hands it out.
const BADGE: Record<Lang, { src: string; width: number }> = {
  ka: { src: "/wallet/add-to-google-wallet.ka.svg", width: 204 },
  en: { src: "/wallet/add-to-google-wallet.en.svg", width: 199 },
};

/**
 * The "Add to Google Wallet" button.
 *
 * Like Apple's badge it is not drawn in the app's vocabulary, and must not be. Google's rule
 * is stricter still: use only the files Google provides, never a redrawn one, never another
 * colour, radius or label; at least 48 points tall, with 8 points of clear space round it
 * (developers.google.com/wallet/generic/resources/brand-guidelines). So these are Google's
 * files, at the size they come in — and Google publishes one in Georgian.
 */
export function GoogleWalletBadge({ lang }: { lang: Lang }) {
  const badge = BADGE[lang];
  // A plain picture: a file this small needs no optimiser, and must not be redrawn by one.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={badge.src} width={badge.width} height={55} alt="" className="block" />;
}
