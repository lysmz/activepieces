const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

function loadEnvironment({ root, inherited = process.env }) {
  const local = readEnvironment({ root, filename: '.env' });
  const environment = { ...inherited, ...readEnvironment({ root, filename: '.env.dev' }), ...local, AP_EDITION: 'ce' };
  const names = [...new Set((environment.AP_DEV_PIECES ?? 'webhook,http,mcp').split(',').map(name => name.trim()).filter(Boolean))];
  const workerToken = local.AP_WORKER_TOKEN || (environment.AP_JWT_SECRET
    ? jwt.sign({ id: randomUUID(), type: 'WORKER' }, environment.AP_JWT_SECRET, { expiresIn: '100y', keyid: '1', algorithm: 'HS256', issuer: 'activepieces' })
    : environment.AP_WORKER_TOKEN);
  return {
    ...environment,
    AP_DEV_PIECES: names.join(','),
    ...(environment.AP_REDIS_TYPE === 'STANDALONE' ? { AP_QUEUE_MODE: '' } : {}),
    ...(workerToken ? { AP_WORKER_TOKEN: workerToken } : {}),
  };
}

function validateEnvironment({ environment }) {
  if (!environment.AP_JWT_SECRET) throw new Error('Set AP_JWT_SECRET in .env before starting the CE stack.');
  if (environment.AP_ENCRYPTION_KEY?.length !== 32) throw new Error('Set AP_ENCRYPTION_KEY in .env to exactly 32 characters. Preserve the existing key when reusing database data.');
  try {
    const principal = jwt.verify(environment.AP_WORKER_TOKEN, environment.AP_JWT_SECRET, { algorithms: ['HS256'], issuer: 'activepieces' });
    if (typeof principal !== 'object' || principal.type !== 'WORKER') throw new Error('Invalid worker principal');
  } catch {
    throw new Error('AP_WORKER_TOKEN must be a worker token signed with AP_JWT_SECRET. Remove it from .env to let the launcher generate it.');
  }
}

function getPieces({ root, environment }) {
  return environment.AP_DEV_PIECES.split(',').filter(Boolean).map(name => {
    if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error(`Invalid AP_DEV_PIECES entry: ${name}`);
    const directory = ['core', 'community'].map(category => path.join(root, 'packages/pieces', category, name)).find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
    if (!directory) throw new Error(`AP_DEV_PIECES entry has no source package: ${name}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    return { name, directory, packageName: manifest.name };
  });
}

function readEnvironment({ root, filename }) {
  const file = path.join(root, filename);
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

module.exports = { ceConfig: { loadEnvironment, getPieces, validateEnvironment } };
