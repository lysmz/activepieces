# Activepieces Community Edition — Phase 1

Prepared on 15 October 2026 from upstream commit `97e1d1f1d78f84240782e5b771699eeea291fd9f` (version `0.92.2`). Local branch: `codex/activepieces-ce`.

The existing DataMapper project outside this subdirectory is preserved. Phase 2 has not been implemented.

## Running services

| Service | Address / setting | Verification |
| --- | --- | --- |
| Web UI | <http://localhost:4200> | HTTP 200, seeded login and flow canvas verified in browser |
| Node.js API | <http://localhost:3000> | Authentication and project endpoints verified |
| Database | `AP_DB_TYPE=PGLITE`, `dev/config/pglite` | Initialized and development user seeded |
| Queue | Localhost port `16379`, Redis under the existing Ubuntu WSL distribution | Persistence disabled; worker connected and processing jobs |
| Edition | CE launcher and server force `AP_EDITION=ce` | CE routes and open-source plan active |
| Development pieces | `webhook,http,mcp,data-mapper,json,data-summarizer,delay,forms,sftp,schedule,xml,approval` | All 12 built and their local metadata loaded successfully; restart required for an existing process |

Login: **`dev@ap.com` / `12345678`**.

The compatible local queue uses Redis with `--save '' --appendonly no`; `AP_REDIS_TYPE=STANDALONE` points the application at that memory-only process. Compatibility code still reads `AP_QUEUE_MODE=MEMORY` and would override that selection, so the CE loader clears the legacy variable for standalone Redis. Redis packages were extracted into `dev/runtime`; no system Redis service was installed. PGLite data persists in the workspace.

## Removed directories and license audit

The original [root LICENSE](./LICENSE) is unchanged. SHA-256: `c66760cfe1d2361a78bc9662ec8fab43274a386bab3bf25d07e7257a0843470d`.

Its first-party license exclusions are `packages/ee/` and `packages/server/api/src/app/ee/`. Those proprietary sources were excluded before the initial working-tree checkout, rather than read and subsequently deleted. All EE-named directories below are absent and their original tracked files are recorded as deletions in the local Git index:

| Directory | Treatment |
| --- | --- |
| `packages/ee/` | Excluded before checkout; removed from the Git index |
| `packages/server/api/src/app/ee/` | Excluded before checkout; removed from the Git index |
| `packages/core/shared/src/lib/ee/` | MIT-licensed shared schemas and helpers relocated to `packages/core/shared/src/lib/community-contracts/`; imports updated |
| `packages/core/shared/test/ee/` | Excluded before checkout; removed from the Git index |
| `packages/server/api/test/integration/ee/` | Excluded before checkout; removed from the Git index |
| `packages/server/api/test/unit/app/ee/` | Excluded before checkout; removed from the Git index |
| `packages/server/api/test/unit/ee/` | Excluded before checkout; removed from the Git index |
| `packages/server/worker/src/lib/execute/jobs/ee/` | Excluded before checkout; removed from the Git index and job loaders |
| `packages/server/worker/test/lib/execute/jobs/ee/` | Excluded before checkout; removed from the Git index |
| `packages/tests-e2e/scenarios/ee/` | Excluded before checkout; removed from the Git index |
| `packages/web/src/app/routes/embed/` | Physically deleted, with routes and proprietary SDK imports removed |

This upstream version uses `packages/web`, so the plan's older `packages/react-ui/src/app/ee/` path does not exist. The proprietary SDK workspace, TypeScript aliases and build task were removed. Sparse-checkout rules continue excluding every `ee` directory.

The source audit inspected **17,330 files** and found **zero EE directory or deleted-EE import failures**. Third-party dependencies retain their own licenses, as specified by the original root license. This audit covers the working-tree source exclusion; it does not rewrite upstream Git history.

## Community compatibility changes

Community adapters replace deleted commercial integrations with disabled-feature responses, pass-through resolution or CE defaults. Project authorization retains user ownership, platform boundaries and engine project checks. Proprietary entities, migrations, edition registrations and agent worker loaders are disconnected.

The local PGLite database is created from the remaining CE entity schemas. It uses schema synchronization for this fresh development installation rather than the removed commercial migration history. The checked-out Postgres path is not the validated runtime for this setup.

Windows build commands were adjusted only for the libraries and selected development pieces that need a portable replacement for `cp`. The shared package patch version was incremented for its relocated exports.

The latest piece changes affect only the `build` command in nine manifests: JSON, Approval, Data Mapper, Data Summarizer, Delay, Forms, Schedule, SFTP and XML. After TypeScript compilation, each piece must copy its `package.json` into `dist` so the local piece loader can read the package metadata. The old command used Unix `cp`, which is unavailable in a standard Windows shell. Node's `fs.copyFileSync` performs the same copy on Windows and Unix. The Webhook, HTTP and MCP manifests received that adjustment earlier. These edits do not change piece actions, inputs or transformation logic.

The piece watcher now invokes the installed Turbo script using the running Node executable. This avoids spawning the Windows `npx` shell shim as though it were a native executable. Startup also builds every piece selected in `AP_DEV_PIECES` before loading metadata; this makes the first startup work when ignored `dist` folders are absent on another PC.

## Verification

- Shared libraries and all 12 selected pieces: build passed; each piece's local metadata loaded successfully. The latest rebuild completed all 16 tasks; log: `ce-env-pieces-build.log`.
- Piece selection, environment precedence, worker authentication, startup readiness and environment-file commit protection: all 13 regression checks passed. The API build also passed after the Windows watcher change. Verification logs: `ce-pieces-build.log` and `ce-enable-pieces-api-build.log`.
- Execution engine and sandbox: build passed.
- API, worker and frontend application TypeScript checks: passed with zero errors.
- Frontend production build: passed; upstream bundling warnings remain.
- Seeded login, project listing, browser dashboard and flow canvas: verified.
- CE worker: connected to the API and polling successfully.
- EE path/import audit and original root license checksum: passed.
- Commented environment example: all 24 parsed values match the verified template; all seven configuration regression tests passed again.
- Required lint command: `npm run lint-dev` passed with all 31 tasks successful and no errors. Existing warnings remain; the latest successful full-run log is `ce-env-comments-lint.log`.
- Step settings provider crash: fixed by sharing the React context outside the hot-reloaded provider module. A regression test renders a provider and consumer loaded from different module versions; it passes, as do the frontend TypeScript check and targeted ESLint. The reported flow loaded with its HTTP settings visible. Browser connection timeouts limited the final interactive hot-reload check.
- Restart verification: all four startup readiness tests passed. The API and worker health endpoints returned HTTP 200, flags returned HTTP 200 through Vite, the worker connected over Socket.IO, and the root page opened the dashboard showing the existing flows. The verified startup log is `ce-startup.log`.
- Separate remaining catalogue issue: the remote template categories response fails the local category-array validation. This produces `/api/v1/templates/categories` errors but does not block the verified dashboard, API health, or worker connection.

## Commands for this checkout

The checkout is already installed and running. Upstream uses `workspace:*` dependencies, which `npm install` rejects; installation therefore uses Bun while the application services use Node.js.

```powershell
# Dependency installation, if needed again:
bun install --filter activepieces --filter api --filter web --filter worker --filter @activepieces/engine --filter @activepieces/piece-webhook --filter @activepieces/piece-http --filter @activepieces/piece-mcp --filter @activepieces/piece-data-mapper --filter @activepieces/piece-json --filter @activepieces/piece-data-summarizer --filter @activepieces/piece-delay --filter @activepieces/piece-forms --filter @activepieces/piece-sftp --filter @activepieces/piece-schedule --filter @activepieces/piece-xml --filter @activepieces/piece-approval

# After stopping the currently running development stack:
npm start

# Rebuild the CE runtime, selected pieces and web application:
npm run ce:build

# Repeat the EE-path and root-license audit (requires rg on PATH):
npm run ce:audit

# Repository lint verification:
npm run lint-dev
```

`npm start` runs `tools/ce/dev.cjs`, which loads configuration through `tools/ce/config.cjs`. `npm run ce:build` uses the same loader. Precedence, from lowest to highest, is inherited process variables, `.env.dev` defaults, then `.env`. The launcher fixes `AP_EDITION=ce` and manages the service roles and ports. The API and worker bootstrap files still load `.env.dev`, but dotenv does not override the configuration inherited from the launcher. The upstream `npm run dev` command follows a different path; use `npm start` for this CE setup.

Edit `AP_DEV_PIECES` in `.env` to select local pieces; this list controls both `npm start` and `npm run ce:build`. Startup builds the selected pieces before starting the API, and rejects unknown piece names. Newly selected workspaces must have their dependencies installed with Bun first. Selected piece build commands use Node's file copy instead of Unix `cp`, and the dev watcher invokes the local Turbo entry point through Node so it also works on Windows without an `npx` shell shim.

### Environment configuration

The root `.env.example` describes this local CE setup. On a fresh checkout, copy it to `.env` and fill both secret values before starting. On this host, `.env` already contains the settings and persistent secrets needed without relying on `.env.dev`; the existing encryption and JWT keys were preserved. Never replace the encryption key when reusing the database, because saved connections depend on it.

| Variables | Purpose |
| --- | --- |
| `AP_ENCRYPTION_KEY`, `AP_JWT_SECRET` | Required persistent secrets. The encryption key must be exactly 32 characters. The launcher validates them before starting services. |
| `AP_DB_TYPE=PGLITE`, `AP_CONFIG_PATH=./dev/config` | Select the local database and its persistent data directory. |
| `AP_REDIS_TYPE=STANDALONE`, `AP_REDIS_HOST=127.0.0.1`, `AP_REDIS_PORT=16379` | Connect to the workspace-local Redis process. Omit legacy `AP_QUEUE_MODE`. |
| `AP_DEV_PIECES`, `AP_PIECES_SYNC_MODE=NONE` | Select locally built pieces and avoid syncing the remote piece catalogue. |
| `AP_FRONTEND_URL=http://localhost:4200` | Public development address used to generate links and webhook URLs. |
| `AP_CACHE_BASE_PATH=./dev/cache` | Worker cache directory; replaces the unused `AP_CACHE_PATH` name. |
| `AP_DENO_PATH` | Optional for startup; set an absolute path to the real Deno executable for Deno Code steps, code transpilation and script expressions in inputs. |
| `AP_WORKER_TOKEN` | Usually omit. The CE loader signs a worker token with the effective `AP_JWT_SECRET`; an explicit token in `.env` must match that secret. |
| Remaining example settings | Development execution, logging, polling and disabled telemetry/cloud features; retained for an explicit, reproducible local setup. |

The launcher supplies `AP_CONTAINER_TYPE`, the API port 3000, worker health port 3001 and the worker's internal API URL. They do not need entries in `.env`. `AP_WEBHOOK_URL`, `AP_CACHE_PATH`, `AP_API_KEY` and Postgres credentials are unnecessary for this PGLite CE setup and are omitted from the example.

On this Windows host, `npm start` uses the existing Ubuntu WSL distribution for the workspace-local queue. It verifies Redis with `PING`, starts the API as `APP`, waits for `/api/v1/health`, then starts the worker as `WORKER` with its internal API URL on port 3000 and health listener on port 3001. Vite starts only after worker health succeeds. Wait for `Community Edition ready at http://localhost:4200` before opening the app; the first TypeScript API boot can take several minutes, with progress reported every 15 seconds.

The launcher refuses duplicate listeners on ports 3000, 3001 and 4200 and stops its child process trees when it exits. Regressions are covered by `node --test tools/ce/readiness.test.cjs tools/ce/config.test.cjs tools/ce/hooks.test.cjs`. Runtime data and verification logs are ignored by Git.

The public root `.env.example` is versioned with empty secret values. Private `.env` and local `.env.dev` changes, encryption keys and runtime data stay outside this commit. The commit hook permits only the root example and rejects other environment files; the local `.env.dev` changes remain in the working tree.

## Moving to another Windows PC

`activepieces` is a separate Git repository with origin `https://github.com/lysmz/activepieces.git`; it is not tracked by the parent `Datamapper` repository. Push the commits on `codex/activepieces-ce` to that origin before cloning the branch on the new PC. Committing or cloning only the parent repository does not transfer this checkout.

1. Install Git, Node.js matching `.nvmrc` (`v24.14.0`), Bun matching `package.json` (`1.4.0`), and WSL with an Ubuntu distribution. Install Deno for flow execution and locate its real executable. Set the new machine's absolute executable path in `AP_DENO_PATH`; do not copy a path containing the old PC's user directory.
2. Clone the Activepieces fork's `codex/activepieces-ce` branch, enter that checkout, and run the filtered `bun install` command under **Commands for this checkout**. Use Bun to install workspace dependencies; use Node/npm to launch this CE setup.
3. For a fresh application database, copy `.env.example` to `.env`, generate the two secret values using the one-line commands in its comments, and fill `AP_DENO_PATH`. The template supplies the other local settings. Run each command separately; no PowerShell continuation characters or here-strings are required.

   ```powershell
   Copy-Item .env.example .env
   ```

4. Recreate Redis on the new PC. Nothing from the old Redis instance needs transferring: it stores a disposable job queue with persistence disabled. The old `dev/runtime` binaries are ignored by Git. The launcher can use a Redis server already listening on `127.0.0.1:16379`, so a new Ubuntu installation can provide it instead. Open Ubuntu using this command in a separate terminal:

   ```powershell
   wsl -d Ubuntu
   ```

   In that Ubuntu shell, install Redis and start it in the foreground. Keep this terminal open while using the app:

   ```bash
   sudo apt-get update
   sudo apt-get install -y redis-server
   redis-server --bind 127.0.0.1 --port 16379 --save "" --appendonly no --protected-mode yes
   ```

5. Back in PowerShell at the Activepieces repository root, build the runtime, selected pieces and frontend. These build outputs are ignored by Git and must be recreated:

   ```powershell
   npm run ce:build
   ```

6. Start the app and wait for the ready message before opening `http://localhost:4200`:

   ```powershell
   npm start
   ```

To preserve existing flows, accounts and connections instead of starting with a fresh application database, stop the old app first and transfer its `dev/config` directory and private `.env` separately. Preserve the original encryption and JWT keys and update machine-specific paths. Do not commit that database or the private environment file. Redis and `dev/cache` do not need to move. A Git clone by itself starts with no local application data.

## Manual verification gate

Manual verification is complete: the webhook captured the three sample orders, the user confirmed the HTTP echo request worked, and the sample flow was published. The Community Edition is running at <http://localhost:4200>. The stock Data Mapper and JSON pieces are enabled for the next startup. Custom DataMapper dialog integration has not been started.
