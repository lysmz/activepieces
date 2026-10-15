const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { redisReady, httpReady, waitFor } = require('./readiness.cjs');

const root = path.resolve(__dirname, '../..');
const environment = { ...process.env, ...dotenv.parse(fs.readFileSync(path.join(root, '.env.dev'))) };
environment.AP_EDITION = 'ce';
environment.AP_DEV_PIECES = 'webhook,http,mcp';
const children = [];
let closing = false;

function launch({ command, args, cwd = root, name, env = {} }) {
  const child = spawn(command, args, { cwd, env: { ...environment, ...env }, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(`${name}: ${error.message}`); shutdown(1); });
  child.on('exit', code => { if (!closing) { console.error(`${name} exited (${code})`); shutdown(code || 1); } });
  return child;
}

function listening({ port }) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function shutdown(code) {
  if (closing) return;
  closing = true;
  await Promise.all(children.reverse().map(child => new Promise(resolve => {
    if (!child.pid || child.exitCode !== null) { resolve(); return; }
    if (process.platform === 'win32') {
      const cleanup = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      cleanup.once('error', () => { child.kill(); resolve(); });
      cleanup.once('exit', resolve);
    } else {
      child.kill();
      resolve();
    }
  })));
  process.exit(code);
}

async function main() {
  if (await listening({ port: 3000 }) || await listening({ port: 3001 }) || await listening({ port: 4200 })) throw new Error('CE ports 3000/3001/4200 are already in use. Stop the existing CE stack first.');
  if (!fs.existsSync(path.join(root, 'dist/packages/engine/main.js'))) throw new Error('Run npm run ce:build before starting the stack.');
  if (!await redisReady({ port: 16379 })) {
    console.log('Starting the workspace memory queue...');
    const script = path.join(__dirname, 'redis.sh').replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/mnt/' + drive.toLowerCase());
    launch({ command: 'wsl.exe', args: ['-d', 'Ubuntu', '--', 'bash', script], name: 'Memory queue' });
    await waitFor({ check: () => redisReady({ port: 16379 }), name: 'memory queue', timeoutMs: 60000 });
  }
  console.log('Starting the API; the first TypeScript boot can take several minutes...');
  launch({ command: process.execPath, args: [require.resolve('tsx/cli'), '--tsconfig', 'packages/server/api/tsconfig.app.json', 'packages/server/api/src/bootstrap.ts'], name: 'API', env: { AP_CONTAINER_TYPE: 'APP' } });
  await waitFor({ check: () => httpReady({ port: 3000, pathname: '/api/v1/health' }), name: 'API' });
  console.log('API ready. Starting the worker...');
  launch({ command: process.execPath, args: [require.resolve('tsx/cli'), '--tsconfig', 'packages/server/worker/tsconfig.lib.json', 'packages/server/worker/src/bootstrap.ts'], name: 'Worker', env: { AP_CONTAINER_TYPE: 'WORKER', AP_FRONTEND_URL: 'http://127.0.0.1:3000', AP_PORT: '3001' } });
  await waitFor({ check: () => httpReady({ port: 3001, pathname: '/worker/health' }), name: 'worker' });
  console.log('Worker connected and ready. Starting the web UI...');
  launch({ command: process.execPath, args: [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], cwd: path.join(root, 'packages/web'), name: 'Web' });
  await waitFor({ check: () => httpReady({ port: 4200, pathname: '/' }), name: 'web UI', timeoutMs: 120000 });
  console.log('Community Edition ready at http://localhost:4200 (dev@ap.com / 12345678).');
  console.log('Phase 1 only. DataMapper integration awaits manual verification.');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
main().catch(error => { console.error(error.message); shutdown(1); });
