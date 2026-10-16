const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('the commit hook allows the public root environment example', context => {
  const root = createRepository({ context, filenames: ['.env.example'] });
  const result = runHook({ root });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('the commit hook blocks a private environment file even beside the example', context => {
  const root = createRepository({ context, filenames: ['.env.example', '.env', '.env.dev'] });
  const result = runHook({ root });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /\.env\.dev/);
  assert.doesNotMatch(result.stdout + result.stderr, /\.env\.example/);
});

function createRepository({ context, filenames }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ce-hook-'));
  context.after(() => {
    if (path.dirname(root) !== path.resolve(os.tmpdir())) throw new Error('Unexpected temporary repository location');
    fs.rmSync(root, { recursive: true, force: true });
  });
  const initialized = spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' });
  assert.equal(initialized.status, 0, initialized.stderr);
  for (const filename of filenames) fs.writeFileSync(path.join(root, filename), 'AP_TEST_VALUE=fixture\n');
  const staged = spawnSync('git', ['add', '--', ...filenames], { cwd: root, encoding: 'utf8' });
  assert.equal(staged.status, 0, staged.stderr);
  return root;
}

function runHook({ root }) {
  const hooks = path.resolve(__dirname, '../../.husky').replaceAll('\\', '/');
  return spawnSync('git', ['-c', `core.hooksPath=${hooks}`, 'hook', 'run', 'pre-commit'], { cwd: root, encoding: 'utf8', env: { ...process.env, HUSKY: '1' } });
}
