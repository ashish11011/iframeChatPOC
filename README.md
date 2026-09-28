# Relay — React + Node.js iframe chat

A working guest-chat proof of concept: React/Vite UI, a Node.js/Express server, and native WebSocket messaging using `ws`. The landing page includes a real iframe preview; `/embed` renders just the chat window.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Join a room as Alice, click **Open chat**, and join the same room as Bob. Send messages in either window. Different rooms are isolated. Names and room IDs are case-sensitive; room IDs allow letters, digits, underscores and hyphens.

```sh
npm test
npm run build
npm start
```

The production build is served at http://localhost:3001 by the same Node process that handles `/ws`. No separate frontend deployment or CORS setup is necessary. The client automatically selects `ws://` locally and `wss://` over HTTPS, reconnects with backoff, and disables sending until joined. The server validates payloads, limits message length/rate, checks connection origins, and uses ping/pong heartbeats.

## Embed

```html
<iframe
  src="https://chat.example.com/embed?room=general"
  title="Live chat"
  width="400"
  height="640"
  style="border:0;border-radius:16px"
></iframe>
```

Optional `name=Alex` prefills the join form. Joining is explicit. The iframe needs no third-party cookies or local storage. Room/name URL values are not authentication credentials.

## EC2 deployment

This repository includes a Docker image, Compose configuration and Caddy reverse-proxy example. These steps assume a Linux EC2 instance with Docker Engine, the Docker Compose plugin and Caddy installed. Run Caddy on the host (the supplied upstream is host loopback).

1. Assign a stable public IP and point a domain such as `chat.example.com` to it.
2. Allow inbound TCP 80 and 443 in the EC2 security group. Limit SSH to your administrative IP. Port 3001 stays private on loopback.
3. Copy this project to the server and create `.env`:

```dotenv
PORT=3001
ALLOWED_ORIGINS=https://chat.example.com
FRAME_ANCESTORS="'self' https://YOUR-DOMAIN.lightning.force.com"
```

Add other exact Salesforce parent origins, separated by spaces, if you use Visualforce or Experience Cloud. Every ancestor in a nested frame chain must be permitted. Use the real origins visible in your org, not the example placeholders.

4. Run from the project folder:

```sh
docker compose up -d --build
```

5. Replace `chat.example.com` in `deploy/Caddyfile`, install it as `/etc/caddy/Caddyfile`, and reload Caddy:

```sh
sudo systemctl reload caddy
curl https://chat.example.com/health
```

Caddy terminates TLS and proxies both HTTP and WebSocket upgrades to Node. DNS and ports 80/443 must be reachable for certificate issuance. The health endpoint returns `{"status":"ok"}`. Ensure no upstream adds `X-Frame-Options: DENY` or `SAMEORIGIN`, which can block embedding. Node supplies the configurable CSP `frame-ancestors` header.

## Salesforce Lightning integration

1. Deploy the `embeddedChat` LWC under `salesforce/force-app/main/default/lwc` using your existing Salesforce DX project. Copy the component folder into that project's `force-app/main/default/lwc`, then use your normal metadata deployment workflow.
2. In Salesforce **Setup → Trusted URLs**, add `https://chat.example.com`, activate it, and permit **frame-src** for the applicable context.
3. In Lightning App Builder, add **Embedded Relay Chat** to a Home, App, or Record page. Set **Chat origin** to your HTTPS origin (no path). Save and activate.
4. Configure the server's `FRAME_ANCESTORS` to allow your Salesforce page's exact origin, then recreate the container with `docker compose up -d` after changing `.env`.

On record pages the LWC uses the record ID as the room; elsewhere it uses the configurable room. A second browser can join the same room at `https://chat.example.com/embed?room=RECORD_ID`. Record IDs do not enforce record permissions in this demo.

The iframe's own origin is the chat domain, so `ALLOWED_ORIGINS` must contain the **chat origin**, not the Salesforce parent. Salesforce's CSP allows loading the frame; the Node response's `frame-ancestors` controls who can embed it. WebSocket requests originate inside the external frame, whose own CSP permits its same-origin connection.

Official references: [Salesforce CSP and Trusted URLs](https://developer.salesforce.com/docs/platform/lightning-components-security/guide/content-security-policy-intro.html), [LWS iframe restrictions](https://developer.salesforce.com/docs/platform/lightning-components-security/guide/lws-iframes.html).

## Scope and production considerations

- This is unauthenticated guest chat. Anyone knowing a room ID can join, and names are self-selected. Origin checks and frame allowlists are browser controls, not authentication. Before using real customer data, implement server-verified identity and room authorization tied to Salesforce permissions; never put Salesforce session tokens in iframe URLs.
- The last 100 messages are held in memory per active room, and deleted when its last participant leaves or the server restarts. Use a database for durable history.
- Run one Node instance. Multiple instances require shared messaging/pub-sub and persistence.
- Messages are displayed only on server echo. There is no durable delivery acknowledgement or automatic resend of a message lost during a disconnect. Reconnecting clients get the surviving room history and a new guest connection identity.
- Server limits: 2,000 characters/message, 8 KB WebSocket payload, 30 inbound events/10 seconds/connection, 500 simultaneous connections. Add authenticated per-user quotas and infrastructure-level abuse controls for public production use.

## Files

- `client/src/`: React chat, iframe demonstration and styles.
- `server/chat.js`: HTTP server, WebSocket protocol and room state.
- `server/chat.test.js`: real multi-client WebSocket integration test.
- `salesforce/`: embeddable LWC example.
- `Dockerfile`, `compose.yaml`, `deploy/Caddyfile`: EC2 deployment assets.
