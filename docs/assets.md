# Third-party assets

The code is MIT-licensed; artwork keeps its own license. Every asset used in the game is listed here.

## Playing cards (pixel art)

- **Pixel Art Playing Cards** by **Kerenel**: https://kerenel.itch.io/pixelart-cards
- License: **CC0 1.0** (public domain dedication), free for any use, no attribution required (thank you, Kerenel!)
- 56x80 px cards, AAP-64 palette, includes a high-contrast variant (orange diamonds, blue clubs)
- Used files: 52 faces, 26 high-contrast faces and 4 backs in `apps/web/src/assets/cards/`, renamed by `apps/web/scripts/import-cards.mjs` (`<rank><suit>.png`, ranks 2 to 14 with 14 = ace, suits C/D/H/S; `-hc` marks the high-contrast diamonds and clubs).
- The original numbering: the separated PNGs are numbered row by row, 14 per row (back or template, A, 2 to 10, J, Q, K); rows are hearts, spades, diamonds, clubs, high-contrast diamonds, high-contrast clubs.

## Fonts (SIL Open Font License, self-hosted through @fontsource)

- Jersey 25, Silkscreen, Press Start 2P (Google Fonts)

## Everything else

The logo (pixel spade), suit icons and the table are drawn in code (`apps/web/src/components/Logo.tsx`, `SuitIcon.tsx`, `theme.css`); sounds are synthesised at runtime.

## Logo and favicon

The logo (`apps/web/src/assets/logo.png`, 155×62 px, 6 colours) was generated in Midjourney and then converted to a real pixel grid (block-majority downscale, a fixed palette, and a uniform one-pixel outline redrawn around the shapes), so it scales by whole numbers like the cards. The favicon (`apps/web/public/favicon.png`, 32×32) is an ace of spades drawn for the project. `docs/social-preview.png` (1280×640) is the image for the repository's social preview (Settings → General → Social preview).
