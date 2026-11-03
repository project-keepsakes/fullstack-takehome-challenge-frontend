const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('node:http');
const sockjs = require('sockjs');
const { Client } = require('faye-websocket');

test('SockJS creates a v4 connection ID and exchanges messages with patched UUID', { timeout: 10000 }, async () => {
  const server = createServer();
  const endpoint = sockjs.createServer({ log() {} });
  endpoint.installHandlers(server, { prefix: '/fixture' });
  let connectionId;
  endpoint.on('connection', socket => {
    connectionId = socket.id;
    socket.on('data', message => socket.write(message));
  });
  let client;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await new Promise((resolve, reject) => {
      client = new Client(`ws://127.0.0.1:${server.address().port}/fixture/000/session/websocket`);
      const deadline = setTimeout(() => reject(new Error('SockJS fixture timed out')), 5000);
      client.on('error', error => { clearTimeout(deadline); reject(error); });
      client.on('message', event => {
        if (event.data === 'o') client.send(JSON.stringify(['security-fixture']));
        if (event.data.startsWith('a')) {
          clearTimeout(deadline);
          try {
            assert.deepEqual(JSON.parse(event.data.slice(1)), ['security-fixture']);
            assert.match(connectionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
            resolve();
          } catch (error) { reject(error); }
        }
      });
    });
  } finally {
    if (client) client.close();
    await new Promise(resolve => server.close(resolve));
  }
});
