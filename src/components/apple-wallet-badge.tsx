/**
 * The "Add to Apple Wallet" badge.
 *
 * It is the one thing in the app that is not drawn in the app's own vocabulary, and must not
 * be: Apple asks that this badge look the same everywhere, so an iPhone owner knows it on
 * sight. It is black, with Apple's own proportions, its hairline rim and the Wallet mark, and
 * it is never recoloured, stretched or given another label. It is always in English: Apple
 * publishes no Georgian badge. The link around it carries the spoken name.
 *
 * This is a drawing of that badge. Apple's own file is handed out only against its Wallet
 * marketing agreement (developer.apple.com/wallet/add-to-apple-wallet-guidelines). When the
 * bar's Apple developer account has accepted it, put Apple's file here in place of this one.
 */
export function AppleWalletBadge({ height = 52 }: { height?: number }) {
  // Apple's badge is 110.739 by 35.016 points.
  const width = (height * 110.739) / 35.016;
  return (
    <svg viewBox="0 0 110.739 35.016" width={width} height={height} aria-hidden="true" className="block">
      <rect x="0.25" y="0.25" width="110.239" height="34.516" rx="5.6" fill="#000" stroke="#a6a6a6" strokeWidth="0.5" />

      {/* the Wallet mark: four cards in a pocket */}
      <g transform="translate(8.3 7.2)">
        <rect width="27.6" height="20.6" rx="3.3" fill="#dedbce" />
        <rect x="1.6" y="1.6" width="24.4" height="17.4" rx="1.9" fill="#3c9fd9" />
        <rect x="1.6" y="4.5" width="24.4" height="14.5" rx="1.9" fill="#ffb003" />
        <rect x="1.6" y="7.4" width="24.4" height="11.6" rx="1.9" fill="#40c740" />
        <rect x="1.6" y="10.3" width="24.4" height="8.7" rx="1.9" fill="#f26d5f" />
        <path
          d="M0 13h8.1c1.15 0 1.7.55 2.2 1.45.7 1.25 1.95 2.05 3.5 2.05s2.8-.8 3.5-2.05c.5-.9 1.05-1.45 2.2-1.45h8.1v4.3a3.3 3.3 0 0 1-3.3 3.3H3.3A3.3 3.3 0 0 1 0 17.3z"
          fill="#dedbce"
        />
      </g>

      {/* Apple's own typeface on an Apple device; held to the badge's widths everywhere else. */}
      <g fill="#fff" fontFamily='-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif' fontWeight="500">
        <text x="42.6" y="14.3" fontSize="7.6" textLength="22.6" lengthAdjust="spacingAndGlyphs">
          Add to
        </text>
        <text x="42.4" y="26.6" fontSize="11.4" textLength="60.4" lengthAdjust="spacingAndGlyphs">
          Apple Wallet
        </text>
      </g>
    </svg>
  );
}
