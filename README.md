# DMS — Database Management System

DMS is a focused PostgreSQL administration workspace built with Next.js 16. It connects only to server-configured databases, exposes no connection strings to the browser, and uses real PostgreSQL catalogs and statistics rather than sample data.

## What is included

- Up to four named PostgreSQL connections with status, latency, version, user, host, and database metadata.
- A multi-tab Monaco SQL editor with selection execution, PostgreSQL formatting, saved queries, history, keyboard shortcuts, statement timeout, cancellation, destructive-query confirmation, CSV export, messages, and bounded results.
- Database, schema, table, view, function, index, relationship, extension, and role explorers.
- Table detail views for data, structure, indexes, constraints, relationships, and generated DDL.
- Live overview, activity, and monitoring views sourced from PostgreSQL statistics.
- Browser-persisted application query history and editor preferences.
- Honest backup capability states: CSV/result export is available; full `pg_dump` and provider backups require external tooling or provider APIs.
- Single-account login required before opening the dashboard.

## Environment variables

Copy `.env.example` to `.env.local` and configure at least the primary database:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
DATABASE_NAME=Production

# Optional
DATABASE_URL_2=
DATABASE_NAME_2=
DATABASE_URL_3=
DATABASE_NAME_3=
DATABASE_URL_4=
DATABASE_NAME_4=

# Required for dashboard login
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-strong-password
DASHBOARD_SESSION_SECRET=generate-with-openssl-rand-hex-32
```

Names are optional. If omitted, DMS derives the display name from the database in the URL. The full URL and password are never returned by an API.
The dashboard has exactly one account, defined by the three `DASHBOARD_*` variables. There is no registration. Keep the password and session secret in your untracked environment file or deployment secrets. Sessions expire after 12 hours.

## Local development

Requires Node.js 20+ and pnpm 10.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If no `DATABASE_URL` is configured, DMS still opens and shows guided empty states.

Quality checks:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm run build
```

If a restricted build environment prevents Turbopack's CSS worker from binding to a local port, the equivalent webpack verification is:

```bash
pnpm exec next build --webpack
```

## Vercel deployment

1. Import the repository into Vercel.
2. Add `DATABASE_URL` and optional numbered connection variables under Project Settings → Environment Variables.
3. Set `DASHBOARD_USERNAME`, a strong `DASHBOARD_PASSWORD`, and a random `DASHBOARD_SESSION_SECRET` (for example from `openssl rand -hex 32`). DMS redirects unauthenticated browser requests to `/access` and rejects unauthenticated API requests.
4. Ensure the PostgreSQL provider permits connections from Vercel and use SSL where required.
5. Deploy with the standard Next.js build command.

For an internet-facing production system, also enable Vercel Deployment Protection or place DMS behind your organization’s identity-aware proxy. The built-in login is for one shared account and does not provide per-user authorization.

## Architecture

```text
src/
├── app/                    # App Router pages, login, route handlers
│   ├── api/                # connections, database metadata, SQL execution
│   ├── [...slug]/          # database workspace routes
│   └── access/             # required single-account login
├── components/             # shell, SQL editor, explorers, monitoring, settings
├── hooks/                  # TanStack Query database hooks
├── lib/
│   ├── db/                 # server-only env config, pools, catalog queries
│   ├── api.ts              # consistent safe API errors
│   ├── history.ts          # browser-local DMS execution history
│   └── types.ts            # shared DTOs
└── store/                  # persisted workspace preferences
```

PostgreSQL access is isolated in `src/lib/db` with `server-only` guards. Pools are reused per configured connection. Route payloads are validated with Zod, identifiers are quoted, values use PostgreSQL parameters, results are capped at 1,000 rows, and execution timeouts are enforced in PostgreSQL.

## Operational limitations

- Query history and saved queries are local to the current browser. A shared, cross-device history requires a persistent application database and user accounts.
- HTTP cancellation stops the browser request; PostgreSQL's server-side `statement_timeout` is the authoritative execution limit.
- Catalog and activity visibility depends on the selected PostgreSQL role. DMS does not elevate privileges.
- A configured URL targets one database. Discovery through `pg_database` does not imply credentials can connect to every database on the server.
- DMS does not expose raw PostgreSQL server logs or Neon platform logs through ordinary database credentials.
- Full logical backups, point-in-time restore, and managed-provider snapshots require external tools or provider APIs.
