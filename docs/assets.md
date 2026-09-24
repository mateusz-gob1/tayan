# Third-party assets

The code is MIT-licensed; artwork keeps its own license. Every asset used in the game is listed here.

## Playing cards (pixel art)

- **Pixel Art Playing Cards** by **Kerenel**: https://kerenel.itch.io/pixelart-cards
- License: **CC0 1.0** (public domain dedication), free for any use, no attribution required (thank you, Kerenel!)
- 56x80 px cards, AAP-64 palette, includes a high-contrast variant (orange diamonds, blue clubs)
- Used files: 52 faces, 26 high-contrast faces and 4 backs in `apps/web/src/assets/cards/`, renamed by `apps/web/scripts/import-cards.mjs` (`<rank><suit>.png`, ranks 2 to 14 with 14 = ace, suits C/D/H/S; `-hc` marks the high-contrast diamonds and clubs).
- The original numbering: the separated PNGs are numbered row by row, 14 per row (back or template, A, 2 to 10, J, Q, K); rows are hearts, spades, diamonds, clubs, high-contrast diamonds, high-contrast clubs.

## Fonts (SIL Open Font License, self-hosted through @fontsource)

- Pixelify Sans, Silkscreen, Press Start 2P (Google Fonts)

## Everything else

The logo (pixel spade), suit icons and the table are drawn in code (`apps/web/src/components/Logo.tsx`, `SuitIcon.tsx`, `theme.css`); sounds are synthesised at runtime.
