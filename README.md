# Super Rare Tracker

Stock alerts for [Super Rare Games](https://superraregames.com) releases: <https://www.superraretracker.app>

People install the web app, turn on notifications, track a release and choose a stock level (50% down to 2%). A scheduled poller reads each release's stock bar from the store and sends a push notification when stock drops to that level.

## Stack

- Next.js 16 (App Router) and React 19, deployed on Vercel
- Tailwind CSS v4 with shadcn/ui components (`src/components/ui`)
- ZenStack v3 on Postgres (`zenstack/schema.zmodel`)
- cheerio for scraping, Web Push for notifications

## Getting started

```bash
pnpm install
docker compose up -d     # a local Postgres (see "Local database")
pnpm db:migrate:deploy   # create the tables
pnpm dev
```

`pnpm build` runs `zen generate` first; the generated `zenstack/*.ts` files aren't committed.

### Local database

Develop against a local Postgres, never the live one. `compose.yaml` starts one with Docker; any Postgres 15 or newer works. Put its URL in `.env` (not `.env.local`): Next.js and the `zen` commands both read `.env`, so the app and the migrations always point at the same database.

```bash
# .env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/superraretracker
DATABASE_URL_UNPOOLED=postgres://postgres:postgres@localhost:5432/superraretracker
```

To copy the live data across, dump it with `pg_dump --data-only` and restore it into the local database after `pnpm db:migrate:deploy`.

### Changing the schema

Schema changes go through migrations in `zenstack/migrations`, which are committed:

1. Edit `zenstack/schema.zmodel`.
2. Run `pnpm db:migrate:dev --name <what-changed>`. It writes a new migration and applies it to the local database.
3. Commit the migration with the code that needs it.

On Vercel **production** deploys, `pnpm build` applies any pending migrations to the live database before building (`scripts/migrate-deploy.mjs`). If one fails, the build fails and the previous deployment stays live. Local builds skip this, so they never change the live database.

Only `main` is deployed: `vercel.json` turns off preview deploys for every other branch and pull request, since a preview would share the live database. (`**` rather than `*`, so branch names with a `/` are covered too.) The migration step also skips any preview deploy, in case previews are turned back on.

`pnpm db:push` still works for quick experiments on the local database, but anything it changes must also end up in a migration.

### Environment variables

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Postgres connection (pooled) |
| `DATABASE_URL_UNPOOLED` | Direct connection, used by migrations |
| `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` | Signing push notifications |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | The same public key, for subscribing in the browser |
| `WEB_PUSH_VAPID_SUBJECT` | Contact for push services (defaults to `mailto:admin@superraretracker.app`) |
| `CRON_SECRET` | Protects the scheduled endpoints |

## Scheduled jobs

The scheduled endpoints accept the secret as `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`, and are called from cron-job.org.

| Endpoint | What it does |
|---|---|
| `GET /api/poll` | Checks the stock of releases that are due, saves covers and UK prices, and sends alerts. Each release is polled more often while its stock is falling fast. |
| `GET /api/monitor` | Adds new releases from the store's collections, and fills in the cover, price and saved title parts of any release still missing them. Run just after the 4pm UK announcement (set the cron-job.org job's time zone to Europe/London). `?dryRun=1` lists what it would add without saving; `?days=30` looks further back than the usual 7 days. It also deletes alerts older than 30 days. |

### When the store changes

Each publisher is a module in `src/lib/publishers/<key>/` with everything the app assumes about its store: how to read stock, price and cover, its launch time, and the monitor's rules. For Super Rare Games, the monitor rules are in `src/lib/publishers/super-rare-games/monitor-config.ts`: the collections it reads, which product types count as releases, how it tells the platform, what it strips from titles, and how it finds the release date. Edit the rules there, then check them with `?dryRun=1`.

**Lost in Cult** (`src/lib/publishers/lost-in-cult/`, rules in `config.ts`) sells each game as one product with Retail and EDITION options. Only the EDITION options become releases, one per platform (`lic-<product>-ps5`); Retail options and game + vinyl bundles are skipped. The store's JSON (`?format=json-pretty`) gives the exact copies left per option, and the print run comes from the description ("Limited to 1,000 copies (PS5), 1,500 copies (Switch 2)"), saved as `printRun`. Stock % is copies left ÷ print run. If the print run can't be read, the card shows the copies left instead ("312 left") and alerts can't be set; fill in `printRun` by hand to fix it. To add the editions already on sale the first time, run the monitor once with `?days=365`.

New releases are saved with their card title, catalogue number and edition already split out (`title`, `catalogue`, `edition` on `Release`). If one comes out wrong, correct those columns and it stays corrected. Releases without a saved `title` are split from `name` when the list loads.

## How it fits together

- **Setup screen** (`src/components/SetupGate.tsx`): the release list only opens once notifications are on. The steps depend on the device: iPhone and iPad add the app to the Home Screen, Android installs it, computers go straight to notifications.
- **Release list** (`src/app/page.tsx`): search, platform, sort and "Tracked only" in a bar pinned to the top (a bottom sheet on phones), and a card per release.
- **Alert history** (`src/lib/alerts.ts`): every stock and restock alert is saved as an `Alert` for the device before its push goes out, so the app can show the ones the device hasn't seen yet, even if the notification was swiped away or never arrived. `GET /api/subscriptions` returns them as `unseenAlerts`, and `POST /api/alerts/seen` marks them seen once shown. In the app (`src/components/UnseenSummary.tsx`, the `newAlert` strip on `ReleaseCard`), they show as "2 new alerts since your last visit" above the filters and a "New" strip on each card, with those cards first; they stay until dismissed or the app is reopened, and coming back to the app picks up any that arrived meanwhile. Alerts are kept for 30 days. Tapping a notification opens the app at the release (`/?release=<key>`), or, if the app is open, brings it forward and posts `{ type: "open-release", key }` to it; the app icon's badge shows the unseen count.
- **Stock tiers** (`src/lib/stock.ts`): one function gives both the card label and the notification wording, so they always agree.
- **Store titles** (`src/lib/release-title.ts`): "[Special Edition] SE#03: Haste" is split into edition, catalogue number and title. The platform comes from the release's `type`.
- **Theme**: light or dark, following the device until the person picks one; the choice is saved in a `theme` cookie so the server renders it on first paint.
