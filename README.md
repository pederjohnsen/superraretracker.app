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
pnpm db:push   # create or update the tables from zenstack/schema.zmodel
pnpm dev
```

`pnpm build` runs `zen generate` first; the generated `zenstack/*.ts` files aren't committed.

### Environment variables

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Postgres connection (pooled) |
| `DATABASE_URL_UNPOOLED` | Direct connection, for `pnpm db:push` |
| `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` | Signing push notifications |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | The same public key, for subscribing in the browser |
| `WEB_PUSH_VAPID_SUBJECT` | Contact for push services (defaults to `mailto:admin@superraretracker.app`) |
| `CRON_SECRET` | Protects the scheduled endpoints |

## Scheduled jobs

The scheduled endpoints accept the secret as `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`, and are called from cron-job.org.

| Endpoint | What it does |
|---|---|
| `GET /api/poll` | Checks the stock of releases that are due, saves covers and UK prices, and sends alerts. Each release is polled more often while its stock is falling fast. |

## How it fits together

- **Setup screen** (`src/components/SetupGate.tsx`): the release list only opens once notifications are on. The steps depend on the device: iPhone and iPad add the app to the Home Screen, Android installs it, computers go straight to notifications.
- **Release list** (`src/app/page.tsx`): search, platform, sort and "Tracked only" in a bar pinned to the top (a bottom sheet on phones), and a card per release.
- **Stock tiers** (`src/lib/stock.ts`): one function gives both the card label and the notification wording, so they always agree.
- **Store titles** (`src/lib/release-title.ts`): "[Special Edition] SE#03: Haste" is split into edition, catalogue number and title. The platform comes from the release's `type`.
- **Theme**: light or dark, following the device until the person picks one; the choice is saved in a `theme` cookie so the server renders it on first paint.
