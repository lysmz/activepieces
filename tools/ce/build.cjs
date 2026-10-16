const path = require('node:path');
const { spawn } = require('node:child_process');
const { ceConfig } = require('./config.cjs');

const root = path.resolve(__dirname, '../..');
const environment = ceConfig.loadEnvironment({ root });
const pieces = ceConfig.getPieces({ root, environment });
const packages = process.argv.includes('--pieces-only') ? [] : ['api', 'worker', 'web'];
const filters = [...packages, ...pieces.map(piece => piece.packageName)].map(name => `--filter=${name}`);

if (filters.length > 0) {
  const child = spawn(process.execPath, [require.resolve('turbo/bin/turbo'), 'run', 'build', ...filters, '--ui=stream'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}
