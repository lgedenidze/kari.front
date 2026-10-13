# Fonts for the ticket picture

Static cuts of **Noto Sans Georgian**, the family the app uses everywhere else. The app itself
loads the variable font through `next/font`. The ticket picture (`src/lib/ticket-image.tsx`)
is drawn on the server by Satori, which cannot read variable fonts or WOFF2, so it needs these.

| File | Width | Weight | Used for |
|---|---|---|---|
| `NotoSansGeorgian-CondensedExtraBold.ttf` | 70 | 800 | the bar's name and the guest's name |
| `NotoSansGeorgian-Regular.ttf` | 100 | 400 | text |
| `NotoSansGeorgian-Bold.ttf` | 100 | 700 | labels and the short code |

Copyright The Noto Project Authors. Licensed under the SIL Open Font License 1.1
(https://openfontlicense.org). Fetched from Google Fonts.
