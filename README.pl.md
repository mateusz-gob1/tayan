# Tayan

Przeglądarkowa gra karciana multiplayer w czasie rzeczywistym, oparta na zasadach Blefa: gracze licytują układy pokerowe, które ich zdaniem występują wśród kart wszystkich graczy. Tworzysz pokój, wysyłasz link znajomym i gracie, bez kont, tylko z nickiem. Gra jest po polsku i angielsku.

English version: [README.md](README.md). Pełna specyfikacja: [docs/spec.md](docs/spec.md).

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
- `apps/server`: serwer Node.js + Socket.IO jako jedyne źródło prawdy; każdy payload przechodzi przez zod, a gracz dostaje wyłącznie własny `PlayerView`, więc cudze karty nie trafiają do klienta przed odkryciem. Zobacz [docs/protocol.md](docs/protocol.md).
- `apps/web`: klient React + Vite + Tailwind z tłumaczeniami PL/EN.

Decyzje projektowe: [docs/adr](docs/adr). Wdrożenie (Cloudflare Pages + Render, oba darmowe) opisuje [docs/deployment.md](docs/deployment.md), a zasady gry są w serwisie dokumentacji (`pnpm docs:dev`).
