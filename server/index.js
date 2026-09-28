import { createChatServer } from './chat.js';
const { server, wss } = createChatServer({
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean),
  frameAncestors: process.env.FRAME_ANCESTORS,
});
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log(`Chat server listening on port ${process.env.PORT || 3001}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  wss.clients.forEach(ws => ws.close(1001, 'Server restarting'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
