# Picklepoint Run

A browser maze-chase on the real streets of Greenpoint, Brooklyn (11222). You're a pickle eating dots along Greenpoint's streets while a pigeon, a rat, a seagull and a raccoon chase you. Clear the board before the 5:00 par for a time bonus, then put your initials on the online top 10.

- **Client:** Vite + TypeScript, vanilla DOM, `<canvas>` board. No framework, no engine.
- **Leaderboard:** Cloudflare Pages Functions + D1 (SQLite).
- **Tests:** Vitest.

`reference/prototype.html` is the original single-file prototype. Don't edit it.

## Requirements

- Node 20+ (Node 22+ to run `tests/api.test.ts`, which uses `node:sqlite`)
- npm (the lockfile is `package-lock.json`)

```sh
npm install
# wrangler's runtime (workerd) needs its install script for local Pages dev:
npm install-scripts approve workerd   # only if npm reported it as skipped
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server. Without `VITE_LEADERBOARD_URL` the game uses the local leaderboard mock (localStorage) |
| `npm test` | Run all unit tests once |
| `npm run typecheck` | `tsc --noEmit` over client, functions and tests |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run pages:dev` | Build against `/api/scores` and serve `dist/` + Functions + local D1 with wrangler |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply `migrations/` to the local / production D1 database |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Project layout

```
src/shared/      board data, dot generation, scoring (used by client AND server)
src/game/        state machine, 60 Hz loop, movement, chaser AI, input
src/render/      offscreen layers, sprites, per-frame draw
src/ui/          HUD, side panel, overlays, initials entry, leaderboard table/modal
src/leaderboard/ LeaderboardClient interface, HTTP client, local mock
functions/       Cloudflare Pages Functions (GET/POST /api/scores) + validation
migrations/      D1 schema
tests/           Vitest suites
```

`src/shared/board.ts` is deterministic and font-independent: label exclusion rectangles are hard-coded, so the client and server always agree on `DOT_COUNT` (455). Any change to board data changes `BOARD_VERSION`, and the server only ranks scores for the current version. If you change the board on purpose, update `DOT_COUNT` (the board test will tell you the new number).

## Local development

### Without a backend

```sh
npm run dev
```

With `VITE_LEADERBOARD_URL` unset, the leaderboard runs on a local mock stored in `localStorage`, using the same ranking rules as the server. The full game, initials entry and Scores modal all work.

### With the real Pages Function and D1

```sh
npx wrangler login                      # once
npm run db:migrate:local                # creates .wrangler/state with the schema
echo 'IP_SALT=dev-salt' > .dev.vars     # secrets for local wrangler
npm run pages:dev                       # http://localhost:8788
```

`pages:dev` builds the client with `VITE_LEADERBOARD_URL=/api/scores` and serves `dist/` together with `functions/` and a local D1 database.

## Deploying to Cloudflare Pages

1. Create the D1 database and copy its id into `wrangler.toml` (`database_id`):
   ```sh
   npx wrangler d1 create picklepoint-scores
   ```
2. Apply migrations to production:
   ```sh
   npm run db:migrate:remote
   ```
3. Create the Pages project and set the IP salt secret (a long random string):
   ```sh
   npx wrangler pages project create picklepoint-run --production-branch main
   npx wrangler pages secret put IP_SALT --project-name picklepoint-run
   ```
4. Deploy:
   ```sh
   npm run deploy
   ```

If you build with Cloudflare's Git integration instead, set the build command to `npm run build`, the output directory to `dist`, and add `VITE_LEADERBOARD_URL=/api/scores` as a build environment variable. The D1 binding (`DB`) comes from `wrangler.toml`.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `VITE_LEADERBOARD_URL` | Client build time | Full URL of the scores endpoint, e.g. `/api/scores` (same origin; no CORS is configured). Unset means the local mock is used. |
| `IP_SALT` | Pages secret / `.dev.vars` | Salt for hashing client IPs. The server stores salted SHA-256 hashes only, never raw IPs. |

## Leaderboard API

- `GET /api/scores` → `{ top: ScoreEntry[] }` for the current board version, ordered by score (highest first), then earliest submission. Cached for 10 s.
- `POST /api/scores` with a `RunSubmission` → `201 { rank, entry, top }`, or `400`/`429` with `{ error }` in plain English.

The server recomputes points, bonus and the score bound from `src/shared/`. It rejects implausible times and blocked initials, and allows 5 submissions per IP per 10 minutes. See `functions/_lib/validate.ts`.

To swap the backend (for example to Supabase or Firebase), implement `LeaderboardClient` from `src/leaderboard/types.ts` and return it from `createLeaderboardClient()` in `src/leaderboard/client.ts`.
