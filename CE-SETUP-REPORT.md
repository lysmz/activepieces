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
| Edition | `AP_EDITION=ce` in `.env` and `.env.dev`; server edition fixed to CE | CE routes and open-source plan active |
| Development pieces | `webhook,http,mcp` | Built and available in the editor |

Login: **`dev@ap.com` / `12345678`**.

Current upstream no longer reads `AP_QUEUE_MODE`. The compatible local queue uses Redis with `--save '' --appendonly no`; `AP_REDIS_TYPE=STANDALONE` points the application at that memory-only process. Redis packages were extracted into `dev/runtime`; no system Redis service was installed. PGLite data persists in the workspace.

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

## Verification

- Shared libraries and all three selected pieces: build passed.
- Execution engine and sandbox: build passed.
- API, worker and frontend application TypeScript checks: passed with zero errors.
- Frontend production build: passed; upstream bundling warnings remain.
- Seeded login, project listing, browser dashboard and flow canvas: verified.
- CE worker: connected to the API and polling successfully.
- EE path/import audit and original root license checksum: passed.
- Required lint command: `npm run lint-dev` passed with all 31 tasks successful and no errors. Existing warnings remain; the latest successful full-run log is `ce-commit-lint.log`.
- Step settings provider crash: fixed by sharing the React context outside the hot-reloaded provider module. A regression test renders a provider and consumer loaded from different module versions; it passes, as do the frontend TypeScript check and targeted ESLint. The reported flow loaded with its HTTP settings visible. Browser connection timeouts limited the final interactive hot-reload check.
- Restart verification: all four startup readiness tests passed. The API and worker health endpoints returned HTTP 200, flags returned HTTP 200 through Vite, the worker connected over Socket.IO, and the root page opened the dashboard showing the existing flows. The verified startup log is `ce-startup.log`.
- Separate remaining catalogue issue: the remote template categories response fails the local category-array validation. This produces `/api/v1/templates/categories` errors but does not block the verified dashboard, API health, or worker connection.

## Commands for this checkout

The checkout is already installed and running. Upstream uses `workspace:*` dependencies, which `npm install` rejects; installation therefore uses Bun while the application services use Node.js.

```powershell
# Dependency installation, if needed again:
bun install --filter activepieces --filter api --filter web --filter worker --filter @activepieces/engine --filter @activepieces/piece-webhook --filter @activepieces/piece-http --filter @activepieces/piece-mcp

# After stopping the currently running development stack:
npm start

# Rebuild the CE runtime, selected pieces and web application:
npm run ce:build

# Repeat the EE-path and root-license audit (requires rg on PATH):
npm run ce:audit

# Repository lint verification:
npm run lint-dev
```

On this Windows host, `npm start` uses the existing Ubuntu WSL distribution for the workspace-local queue. It verifies Redis with `PING`, starts the API as `APP`, waits for `/api/v1/health`, then starts the worker as `WORKER` with its internal API URL on port 3000 and health listener on port 3001. Vite starts only after worker health succeeds. Wait for `Community Edition ready at http://localhost:4200` before opening the app; the first TypeScript API boot can take several minutes, with progress reported every 15 seconds.

The launcher refuses duplicate listeners on ports 3000, 3001 and 4200 and stops its child process trees when it exits. Startup readiness regressions are covered by `node --test tools/ce/readiness.test.cjs`. Runtime data and verification logs are ignored by Git.

Environment files, local encryption keys and runtime data stay outside this commit. The repository's commit hook rejects environment files; the local `.env.dev` changes remain in the working tree. The CE runtime settings are listed above.

## Manual verification gate

Manual verification is complete: the webhook captured the three sample orders, the user confirmed the HTTP echo request worked, and the sample flow was published. The Community Edition is running at <http://localhost:4200>. No DataMapper piece or custom dialog integration has been started.
