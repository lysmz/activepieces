const http = require('node:http');
const net = require('node:net');

function redisReady({ port }) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let response = '';
    socket.setTimeout(1000);
    socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'));
    socket.on('data', chunk => {
      response += chunk.toString();
      if (response.includes('\r\n')) finish(response.startsWith('+PONG\r\n'));
    });
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
    socket.once('end', () => finish(false));
    function finish(ready) {
      socket.destroy();
      resolve(ready);
    }
  });
}

function httpReady({ port, pathname }) {
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: pathname, timeout: 2000 }, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('error', () => resolve(false));
    request.once('timeout', () => { request.destroy(); resolve(false); });
  });
}

async function waitFor({ check, name, timeoutMs = 900000, intervalMs = 1000, onProgress = console.log }) {
  const started = Date.now();
  let nextProgress = started + 15000;
  while (!await check()) {
    if (Date.now() - started >= timeoutMs) throw new Error(`${name} did not become ready within ${Math.ceil(timeoutMs / 1000)} seconds.`);
    if (Date.now() >= nextProgress) {
      onProgress(`Waiting for ${name} (${Math.floor((Date.now() - started) / 1000)}s)...`);
      nextProgress = Date.now() + 15000;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

module.exports = { redisReady, httpReady, waitFor };
