import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

export function createChatServer({
  allowedOrigins = ['http://localhost:5173', 'http://localhost:3001'],
  frameAncestors = "'self' http://localhost:5173 http://localhost:3001",
} = {}) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const rooms = new Map();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors ${frameAncestors}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(dist));
  app.get(['/', '/embed'], (req, res) => res.sendFile(`${dist}/index.html`));
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws' || !allowedOrigins.includes(req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    if (wss.clients.size >= 500) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 1024 * 1024) return ws.terminate();
      ws.send(JSON.stringify(data));
    }
  };
  const broadcast = (room, data) => room.clients.forEach(ws => send(ws, data));
  wss.on('connection', ws => {
    ws.alive = true;
    ws.on('error', () => {});
    ws.on('pong', () => { ws.alive = true; });
    let room, roomId, name;
    let windowStart = Date.now(), count = 0;
    const joinTimer = setTimeout(() => ws.close(1008, 'Join timeout'), 10000);
    ws.on('message', (raw, binary) => {
      if (Date.now() - windowStart > 10000) { windowStart = Date.now(); count = 0; }
      if (++count > 30) return send(ws, { type: 'error', message: 'Slow down and try again in a few seconds.' });
      let data;
      try { if (binary) throw new Error(); data = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Invalid JSON message.' }); }
      if (!data || typeof data !== 'object') return;
      if (data.type === 'join' && !room) {
        if (typeof data.room !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(data.room) || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 40) {
          return send(ws, { type: 'error', message: 'Use a name (1–40 characters) and a room containing letters, numbers, underscores or hyphens (1–64 characters).' });
        }
        roomId = data.room;
        if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set(), history: [] });
        room = rooms.get(roomId);
        name = data.name.trim();
        ws.clientId = randomUUID();
        room.clients.add(ws);
        clearTimeout(joinTimer);
        send(ws, { type: 'joined', clientId: ws.clientId, history: room.history });
        broadcast(room, { type: 'presence', count: room.clients.size });
      } else if (data.type === 'message' && room) {
        if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000) return send(ws, { type: 'error', message: 'Messages must contain 1–2,000 characters.' });
        const message = { id: randomUUID(), clientId: ws.clientId, name, text: data.text.trim(), timestamp: new Date().toISOString() };
        room.history.push(message);
        room.history = room.history.slice(-100);
        broadcast(room, { type: 'message', message });
      } else send(ws, { type: 'error', message: 'Join a room before sending messages.' });
    });
    ws.on('close', () => {
      clearTimeout(joinTimer);
      if (!room) return;
      room.clients.delete(ws);
      if (!room.clients.size) rooms.delete(roomId);
      else broadcast(room, { type: 'presence', count: room.clients.size });
    });
  });
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
  }, 30000);
  server.on('close', () => clearInterval(heartbeat));
  return { server, wss };
}
