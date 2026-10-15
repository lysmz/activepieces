const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { test } = require('node:test');
const { redisReady, httpReady, waitFor } = require('./readiness.cjs');

test('an open TCP port without Redis is not a ready queue', async context => {
  const server = net.createServer(socket => {
    socket.once('data', () => socket.end('-ERR unavailable\r\n'));
  });
  const port = await openServer({ server });
  context.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(await redisReady({ port }), false);
});

test('Redis readiness accepts a fragmented PONG response', async context => {
  const server = net.createServer(socket => {
    socket.once('data', request => {
      assert.equal(request.toString(), '*1\r\n$4\r\nPING\r\n');
      socket.write('+PO');
      setImmediate(() => socket.end('NG\r\n'));
    });
  });
  const port = await openServer({ server });
  context.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(await redisReady({ port }), true);
});

test('startup waits through unhealthy API responses before continuing', async context => {
  let requests = 0;
  const server = http.createServer((request, response) => {
    assert.equal(request.url, '/api/v1/health');
    requests++;
    response.writeHead(requests < 3 ? 503 : 200);
    response.end();
  });
  const port = await openServer({ server });
  context.after(() => new Promise(resolve => server.close(resolve)));
  await waitFor({
    check: () => httpReady({ port, pathname: '/api/v1/health' }),
    name: 'test API',
    timeoutMs: 2000,
    intervalMs: 5,
  });
  assert.equal(requests, 3);
});

test('an unavailable dependency produces a useful startup timeout', async () => {
  await assert.rejects(
    waitFor({ check: async () => false, name: 'test API', timeoutMs: 20, intervalMs: 5 }),
    /test API did not become ready/,
  );
});

function openServer({ server }) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
