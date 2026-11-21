# London Theatre Planner

Pick your travel dates and the shows you'd like to see, and get a day-by-day calendar of every matinee and evening performance.

Show schedules are scraped from [officiallondontheatre.com](https://officiallondontheatre.com) (OLT) and [londontheatre.co.uk](https://www.londontheatre.co.uk) (LTC). Both show lists are merged by title: shows on OLT are scraped from OLT, with LTC as a fallback for the same show, and shows only LTC sells are scraped from LTC. They're stored in SQLite, and show images are copied into your own S3 bucket, so the site has no external dependencies at runtime.

## Local setup

Requires Node 22+, pnpm and Docker with Compose.

```sh
cp .env.example .env
pnpm install
docker compose up -d      # local S3 (RustFS), console at http://localhost:9001 (rustfsadmin / rustfsadmin)
pnpm s3:init              # create the bucket
pnpm db:migrate           # create/upgrade data/app.db
pnpm scrape               # ~6 minutes for all current shows
pnpm dev                  # http://localhost:4321
```

## Scraper

```sh
pnpm scrape                              # all shows from both sites (OLT first, LTC fallback)
pnpm scrape --show "lion king"           # only shows whose title matches
pnpm scrape --limit 5                    # first N listed shows
pnpm scrape --source ltc --show phantom  # one site only, no fallback
```

Scrapes can also be started from the Scrapes page, which asks for the `SCRAPE_TOKEN` set in `.env` (generate one with `openssl rand -hex 16`). If it isn't set, the button is refused. Viewing the page needs no token.

Each run replaces a show's future performances (cancelled dates disappear) and logs its result in the `scrape_runs` table. A failing show doesn't stop the run.

Note: OLT only lists performances that are still bookable, so sold-out dates don't appear.

## Other commands

```sh
pnpm test         # parser tests run on saved HTML in tests/fixtures
pnpm check        # type-check
pnpm db:generate  # after editing src/db/schema.ts
```

## Deployment

Every push to `main` runs the tests and type-check, then publishes `ghcr.io/spavat/london-theatre-planner:latest` (plus a tag with the full commit sha) through GitHub Actions. A `deploy` job then waits for an approval in the `production` environment and switches the VPS to that sha (stack managed by the `infra` repo).

The stack (compose file, `.env` written from ansible-vault) lives in the `infra` repo (`stacks/london-theatre-planner/`) and is deployed to `/opt/stacks/london-theatre-planner` on the VPS. Production variables: `stacks/london-theatre-planner/.env.j2` in `infra` (`.env.example` here is for local development).

On startup the container applies database migrations, then starts the weekly scrape (Mondays 05:00 London time, `SCRAPE_CRON` to change it). If no full scrape has run in the last week, one starts a minute after boot, so the first deploy fills the database by itself (about 20 minutes, mostly converting images).

On the VPS, from `/opt/stacks/london-theatre-planner`:

- Manual scrape: `docker compose exec london-theatre-planner node dist/scrape.mjs [--show "lion king"]`
- The SQLite database is in `/srv/appdata/london-theatre-planner/data`, saved by the nightly backup (`infra/docs/backup.md`).
