import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createChatServer } from './chat.js';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';

test('example environment preserves quoted CSP self and all allowed ancestors', () => {
  const env = parseEnv(readFileSync(new URL('../.env.example', import.meta.url), 'utf8'));
  assert.equal(env.FRAME_ANCESTORS, "'self' http://localhost:5173 http://localhost:3001");
});

test('room delivery, history, isolation, validation and embedding headers', async t => {
  const { server, wss } = createChatServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  t.after(async () => { wss.clients.forEach(ws => ws.terminate()); await new Promise(resolve => server.close(resolve)); });
  async function client(room, name) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://localhost:5173' });
    const inbox = [];
    ws.on('message', raw => inbox.push(JSON.parse(raw.toString())));
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'join', room, name }));
    await until(() => inbox.some(m => m.type === 'joined'));
    return { ws, inbox };
  }
  const alice = await client('general', 'Alice');
  const bob = await client('general', 'Bob');
  const other = await client('private', 'Other');
  alice.ws.send(JSON.stringify({ type: 'message', text: 'Hello Bob' }));
  await until(() => bob.inbox.some(m => m.message?.text === 'Hello Bob'));
  assert.ok(alice.inbox.some(m => m.message?.text === 'Hello Bob'));
  const late = await client('general', 'Late');
  assert.equal(late.inbox.find(m => m.type === 'joined').history[0].text, 'Hello Bob');
  alice.ws.send(JSON.stringify({ type: 'message', text: 'x'.repeat(2001) }));
  await until(() => alice.inbox.some(m => m.type === 'error'));
  assert.equal(other.inbox.filter(m => m.type === 'message').length, 0);
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors/);
  assert.equal(res.headers.get('x-frame-options'), null);
  const bad = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://evil.example' });
  await new Promise(resolve => bad.on('error', error => { assert.match(error.message, /403/); resolve(); }));
  bob.ws.close();
  await until(() => late.inbox.some(m => m.type === 'presence' && m.count === 2));
});
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for WebSocket event');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
