# Deployment

The game is split in two, so each part can live on free hosting:

| Part                                | Where              | Notes                                                        |
| ----------------------------------- | ------------------ | ------------------------------------------------------------ |
| Client (`apps/web`, static files)   | Cloudflare Pages   | Never sleeps. Deploys from `main`.                           |
| Game server (`apps/server`, Docker) | Render (free plan) | Sleeps after 15 min without traffic; see "Keeping it awake". |
| Documentation (`docs/site`)         | GitHub Pages       | Built by `.github/workflows/docs.yml`.                       |

Rooms live in the server's memory. Restarting or redeploying the server ends games in progress; this is accepted for the MVP.

## Environment variables

| Variable             | Where                           | Meaning                                                                                                              |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `VITE_SERVER_URL`    | client build (Cloudflare Pages) | Server address, e.g. `https://tayan-server.onrender.com`. Baked in at build time.                                    |
| `CLIENT_ORIGIN`      | server (Render)                 | Address(es) of the client allowed to connect, comma separated, e.g. `https://tayan.pages.dev,https://tayan.example`. |
| `PORT`               | server                          | Set by the host; defaults to 3001.                                                                                   |
| `LOG_LEVEL`          | server                          | `info` by default.                                                                                                   |
| `ENABLE_BOTS`        | server                          | `true` by default: the host can add bots in the lobby (testing aid). Set to `false` to disable.                      |
| `VITE_ENABLE_BOTS`   | client build                    | Set to `false` to hide the bot buttons in the lobby.                                                                 |
| `RATE_LIMIT_PER_SEC` | server                          | Events per second per connection, 10 by default.                                                                     |

## Server on Render

1. Sign in at render.com with GitHub.
2. New > Blueprint > choose this repository. Render reads `render.yaml` (Docker, free plan, health check `/healthz`).
3. When asked, set `CLIENT_ORIGIN` to the client address (see below; you can edit it later under Environment).
4. Copy the service URL (for example `https://tayan-server.onrender.com`). `GET /healthz` on it should return `{"ok":true,...}`.

Every merge to `main` redeploys automatically.

## Client on Cloudflare Pages

1. Workers & Pages > Create > Pages > Connect to Git > this repository.
2. Build command: `pnpm --filter @tayan/web build`. Output directory: `apps/web/dist`.
3. Environment variables: `VITE_SERVER_URL` = the server address, `NODE_VERSION` = `22`.
4. Save and deploy. Copy the `*.pages.dev` address into the server's `CLIENT_ORIGIN`.

`apps/web/public/_redirects` makes invite links such as `/r/K7XQM` open the app.

## Keeping the free server awake

The free Render plan stops the server after 15 minutes without traffic and needs about a minute to start again. The client shows "Waking the server..." meanwhile and connects by itself, so friends can start it just by opening the page.

To avoid the wait, `.github/workflows/keepalive.yml` pings `/healthz` every 10 minutes. Enable it by adding a repository variable `SERVER_URL` (Settings > Secrets and variables > Actions > Variables). Limits: GitHub pauses scheduled workflows after 60 days without repository activity, and the free plan has 750 instance hours per month, enough for one always-on service. The paid Starter plan (7 USD/month) removes the sleeping altogether without any code change.

## Custom domain

Buy a domain at any registrar (a `.com` at Cloudflare Registrar costs about 10 to 11 USD per year, without markup). In Cloudflare Pages add it under Custom domains, then add the new address to the server's `CLIENT_ORIGIN` (comma separated). No code change is needed.

## Documentation site

Settings > Pages > Source: "GitHub Actions" (once). The site is then published to `https://<user>.github.io/tayan/`.
