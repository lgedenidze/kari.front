// How a guest's profile link is shown to the people who will open it.
//
// Display only. What counts as a profile link is the API's decision (ProfileLink in
// kari.back/…/Domain/Contact.cs); it hands back one address, and this names the network that
// address is on.

const NETWORKS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$|(^|\.)instagr\.am$/, "Instagram"],
  [/(^|\.)(facebook|fb)\.com$|^fb\.me$/, "Facebook"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(x|twitter)\.com$/, "X"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/^(t|telegram)\.me$/, "Telegram"],
  [/(^|\.)threads\.(net|com)$/, "Threads"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)vk\.com$/, "VK"],
];

/**
 * The network a profile link is on, by name. For one that is not listed it is the host
 * itself — so whoever is about to tap "Open …" always reads where the tap will take them.
 */
export function networkOf(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
  return NETWORKS.find(([shape]) => shape.test(host))?.[1] ?? host.replace(/^www\./, "");
}

/** The link without its scheme and "www.": short enough to read on a phone. */
export function shortLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
