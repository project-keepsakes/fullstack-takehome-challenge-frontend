const assert = require('node:assert/strict');
const test = require('node:test');
const { adaptDevServerConfig } = require('./dev-server-config.cjs');

test('keeps development access on loopback without wildcard CORS', () => {
  const config = adaptDevServerConfig({
    host: '0.0.0.0', allowedHosts: 'all',
    headers: { 'Access-Control-Allow-Origin': '*', 'X-Test': 'kept' },
    devMiddleware: { publicPath: '/raffle' },
  });
  assert.equal(config.host, '127.0.0.1');
  assert.deepEqual(config.allowedHosts, ['127.0.0.1', 'localhost']);
  assert.deepEqual(config.headers, { 'X-Test': 'kept' });
  assert.equal(config.devMiddleware.publicPath, '/raffle/');
  assert.equal(config.server, 'http');
});

test('preserves middleware ordering when converting the removed CRA hooks', () => {
  const order = [];
  const config = adaptDevServerConfig({
    onBeforeSetupMiddleware(server) { server.app.use(() => order.push('before')); },
    onAfterSetupMiddleware(server) { server.app.use(() => order.push('after')); },
  });
  const before = [];
  const layers = config.setupMiddlewares([
    { middleware: () => order.push('built-in') },
  ], { isValidHost: () => true, app: { use(fn) { before.push(fn); } } });
  before.forEach(fn => fn({ headers: {} }, {}, () => {}));
  layers.forEach(layer => layer.middleware());
  assert.deepEqual(order, ['before', 'built-in', 'after']);
  assert.equal(config.onBeforeSetupMiddleware, undefined);
  assert.equal(config.onAfterSetupMiddleware, undefined);
});

test('blocks cross-origin access before CRA overlay middleware runs', () => {
  const before = [];
  const server = {
    stats: { compilation: {} },
    isValidHost: () => true,
    app: { use(fn) { before.push(fn); } },
  };
  const config = adaptDevServerConfig({ onBeforeSetupMiddleware(overlay) {
    assert.equal(overlay._stats, server.stats);
    overlay.app.use(() => assert.fail('overlay must not run'));
  } });
  config.setupMiddlewares([], server);
  for (const origin of ['https://other.example', 'http://127.0.0.1:9999', 'null']) {
    let status;
    before[0]({ headers: { host: '127.0.0.1:3000', origin } }, {
      status(code) { status = code; return this; },
      end() {},
    }, () => assert.fail('request must not continue'));
    assert.equal(status, 403);
  }
  let status;
  before[0]({ headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'cross-site' } }, {
    status(code) { status = code; return this; },
    end() {},
  }, () => assert.fail('cross-site request without Origin must not continue'));
  assert.equal(status, 403);
});

test('preserves HTTPS options and normalizes the root public path', () => {
  const https = { key: 'synthetic-key', cert: 'synthetic-cert' };
  const config = adaptDevServerConfig({ https, devMiddleware: { publicPath: '' } });
  assert.deepEqual(config.server, { type: 'https', options: https });
  assert.equal(config.devMiddleware.publicPath, '/');
  assert.equal(config.https, undefined);
});
