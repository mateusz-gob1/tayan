# Tayan: notatki dla programistów

Jak uruchomić i zrozumieć kod. O samej grze: [README](../README.pl.md).

## Uruchomienie lokalne

Wymagane: Node.js 22+ i pnpm.

```bash
pnpm install
pnpm dev
```

Otwórz http://localhost:5173, utwórz pokój i zaproś innych linkiem. Żeby pograć samemu, dodaj do pokoju boty (to zwykli klienci WebSocket):

```bash
pnpm dev:bots KODPOKOJU 2
```

Inne komendy: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm engine:deck-table`, `pnpm engine:cli`.

## Jak to działa

- `packages/engine`: czysta logika gry bez I/O, ten sam kod waliduje ruchy na serwerze i podpowiada deklaracje w interfejsie.
- `apps/server`: serwer Node.js + Socket.IO jako jedyne źródło prawdy; każdy payload przechodzi przez zod, a gracz dostaje wyłącznie własny `PlayerView`, więc cudze karty nie trafiają do klienta przed odkryciem. Zobacz [protocol.md](protocol.md).
- `apps/web`: klient React + Vite + Tailwind z tłumaczeniami PL/EN.

Decyzje projektowe: [adr](adr). Wdrożenie (Cloudflare Pages + Render, oba darmowe) opisuje [deployment.md](deployment.md), a zasady gry są w serwisie dokumentacji (`pnpm docs:dev`).
