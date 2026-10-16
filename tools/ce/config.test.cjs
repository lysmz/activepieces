const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { ceConfig } = require('./config.cjs');

test('.env selections reach startup without the old three-piece override', context => {
  const root = createWorkspace({ context });
  fs.writeFileSync(path.join(root, '.env.dev'), 'AP_DEV_PIECES=webhook,http,mcp\nAP_PORT=3000\n');
  fs.writeFileSync(path.join(root, '.env'), 'AP_DEV_PIECES=webhook, data-mapper,json,xml,json\n');
  const environment = ceConfig.loadEnvironment({ root, inherited: { AP_DEV_PIECES: 'http', AP_EDITION: 'ee' } });
  assert.equal(environment.AP_DEV_PIECES, 'webhook,data-mapper,json,xml');
  assert.equal(environment.AP_PORT, '3000');
  assert.equal(environment.AP_EDITION, 'ce');
});

test('development-only checkouts retain their configured selection', context => {
  const root = createWorkspace({ context });
  fs.writeFileSync(path.join(root, '.env.dev'), 'AP_DEV_PIECES=data-mapper,json\n');
  assert.equal(ceConfig.loadEnvironment({ root, inherited: {} }).AP_DEV_PIECES, 'data-mapper,json');
});

test('configured core and community pieces resolve to build packages and typos fail early', context => {
  const root = createWorkspace({ context });
  for (const [category, name] of [['core', 'data-mapper'], ['community', 'json']]) {
    const directory = path.join(root, 'packages/pieces', category, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: `@activepieces/piece-${name}` }));
  }
  const environment = { AP_DEV_PIECES: 'data-mapper,json' };
  assert.deepEqual(ceConfig.getPieces({ root, environment }).map(piece => piece.packageName), ['@activepieces/piece-data-mapper', '@activepieces/piece-json']);
  assert.throws(() => ceConfig.getPieces({ root, environment: { AP_DEV_PIECES: 'missing-piece' } }), /no source package/);
  assert.throws(() => ceConfig.getPieces({ root, environment: { AP_DEV_PIECES: '../escape' } }), /Invalid AP_DEV_PIECES/);
});

test('a local JWT secret gets a matching worker token instead of the legacy fallback token', context => {
  const root = createWorkspace({ context });
  fs.writeFileSync(path.join(root, '.env.dev'), 'AP_JWT_SECRET=legacy-secret\nAP_WORKER_TOKEN=legacy-token\n');
  fs.writeFileSync(path.join(root, '.env'), `AP_JWT_SECRET=local-test-secret\nAP_ENCRYPTION_KEY=${'a'.repeat(32)}\n`);
  const environment = ceConfig.loadEnvironment({ root, inherited: {} });
  const principal = jwt.verify(environment.AP_WORKER_TOKEN, 'local-test-secret', { algorithms: ['HS256'], issuer: 'activepieces' });
  assert.equal(principal.type, 'WORKER');
  assert.equal(environment.AP_ENCRYPTION_KEY, 'a'.repeat(32));
  assert.doesNotThrow(() => ceConfig.validateEnvironment({ environment }));
});

test('standalone Redis is not redirected to an embedded queue by a legacy defaults file', context => {
  const root = createWorkspace({ context });
  fs.writeFileSync(path.join(root, '.env.dev'), 'AP_QUEUE_MODE=MEMORY\n');
  fs.writeFileSync(path.join(root, '.env'), 'AP_REDIS_TYPE=STANDALONE\n');
  const environment = ceConfig.loadEnvironment({ root, inherited: {} });
  dotenv.populate(environment, { AP_QUEUE_MODE: 'MEMORY' });
  assert.equal(environment.AP_QUEUE_MODE, '');
  assert.equal(environment.AP_REDIS_TYPE, 'STANDALONE');
});

test('the public example works without .env.dev after its two persistent secrets are filled', context => {
  const root = createWorkspace({ context });
  const repository = path.resolve(__dirname, '../..');
  const example = dotenv.parse(fs.readFileSync(path.join(repository, '.env.example')));
  assert.equal(example.AP_ENCRYPTION_KEY, '');
  assert.equal(example.AP_JWT_SECRET, '');
  for (const name of ['AP_QUEUE_MODE', 'AP_CACHE_PATH', 'AP_WEBHOOK_URL', 'AP_API_KEY', 'AP_WORKER_TOKEN', 'AP_POSTGRES_PASSWORD']) assert.equal(name in example, false);
  const values = { ...example, AP_ENCRYPTION_KEY: 'b'.repeat(32), AP_JWT_SECRET: 'example-test-secret' };
  fs.writeFileSync(path.join(root, '.env'), Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'));
  const environment = ceConfig.loadEnvironment({ root, inherited: {} });
  assert.doesNotThrow(() => ceConfig.validateEnvironment({ environment }));
  assert.equal(environment.AP_DB_TYPE, 'PGLITE');
  assert.equal(environment.AP_REDIS_HOST, '127.0.0.1');
  assert.equal(environment.AP_REDIS_PORT, '16379');
  assert.equal(environment.AP_FRONTEND_URL, 'http://localhost:4200');
  assert.equal(ceConfig.getPieces({ root: repository, environment }).map(piece => piece.name).join(','), example.AP_DEV_PIECES);
});

test('missing secrets and a mismatched explicit worker token fail before startup', context => {
  assert.throws(() => ceConfig.validateEnvironment({ environment: {} }), /Set AP_JWT_SECRET/);
  assert.throws(() => ceConfig.validateEnvironment({ environment: { AP_JWT_SECRET: 'test-secret' } }), /exactly 32 characters/);
  const root = createWorkspace({ context });
  const values = { AP_JWT_SECRET: 'local-test-secret', AP_ENCRYPTION_KEY: 'c'.repeat(32), AP_WORKER_TOKEN: jwt.sign({ type: 'WORKER' }, 'different-test-secret') };
  fs.writeFileSync(path.join(root, '.env'), Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'));
  const environment = ceConfig.loadEnvironment({ root, inherited: {} });
  assert.equal(environment.AP_WORKER_TOKEN, values.AP_WORKER_TOKEN);
  assert.throws(() => ceConfig.validateEnvironment({ environment }), /AP_WORKER_TOKEN must be a worker token signed with AP_JWT_SECRET/);
});

function createWorkspace({ context }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ce-config-'));
  context.after(() => {
    if (path.dirname(root) !== path.resolve(os.tmpdir())) throw new Error('Unexpected temporary workspace location');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
