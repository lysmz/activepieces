const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const failures = [];
const files = execFileSync('rg', ['--files', 'packages', '-g', '!node_modules', '-g', '!dist'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim().split(/\r?\n/);
const sources = files.filter(file => /[\\/]src[\\/].*\.(ts|tsx|mts|cts)$/.test(file));
for (const file of files) if (/(?:^|[\\/])ee[\\/]/i.test(file)) failures.push(file);
const pattern = "(from\\s+|import\\s*\\()['\"][^'\"\\n]*(/ee/|ee-embed-sdk)";
try {
  const matches = execFileSync('rg', ['-l', pattern, 'packages', '-g', '**/src/**/*.{ts,tsx,mts,cts}', '-g', '!node_modules', '-g', '!dist'], { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  failures.push(...matches.trim().split(/\r?\n/).filter(Boolean));
} catch (error) { if (error.status !== 1) throw error; }
const license = fs.readFileSync(path.join(root, 'LICENSE'));
const licenseSha256 = crypto.createHash('sha256').update(license).digest('hex');
if (licenseSha256 !== 'c66760cfe1d2361a78bc9662ec8fab43274a386bab3bf25d07e7257a0843470d') failures.push('Root LICENSE differs from the original checkout');
const report = { upstream: '97e1d1f1d78f84240782e5b771699eeea291fd9f', licenseSha256, sourcesAudited: sources.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
