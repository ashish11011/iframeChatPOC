import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const params = new URLSearchParams(location.search);
const embedded = location.pathname === '/embed';
function Chat() {
  const [name, setName] = useState(params.get('name') || '');
  const [room, setRoom] = useState(params.get('room') || 'general');
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('offline');
  const [messages, setMessages] = useState([]);
  const [count, setCount] = useState(0);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const socket = useRef(null), identity = useRef(''), bottom = useRef(null);
  useEffect(() => {
    if (!session) return;
    let stopped = false, timer, attempts = 0;
    function connect() {
      setStatus('connecting');
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
      socket.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', ...session }));
      ws.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.type === 'joined') {
          identity.current = data.clientId; setMessages(data.history); setStatus('connected'); setError(''); attempts = 0;
        }
        if (data.type === 'message') setMessages(old => [...old, data.message].slice(-100));
        if (data.type === 'presence') setCount(data.count);
        if (data.type === 'error') setError(data.message);
      };
      ws.onclose = () => {
        if (stopped) return;
        setStatus('reconnecting'); setCount(0);
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000));
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { stopped = true; clearTimeout(timer); socket.current?.close(); };
  }, [session]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);
  function send(event) {
    event.preventDefault();
    if (!draft.trim() || status !== 'connected' || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify({ type: 'message', text: draft }));
    setDraft(''); setError('');
  }
  return <section className="chat-card" aria-label="Chat window">
    <header className="chat-header"><div className="brand-icon">r<span>↗</span></div><div><strong>{session ? `# ${session.room}` : 'Let’s start a conversation'}</strong><div className="chat-subtitle"><i className={status === 'connected' ? 'dot live' : 'dot'} />{session ? `${status} · ${count} online` : 'A little closer, in real time.'}</div></div>{session && <button className="leave" onClick={() => { setSession(null); setStatus('offline'); setMessages([]); setError(''); }}>Leave</button>}</header>
    {!session ? <form className="join-form" onSubmit={event => { event.preventDefault(); setError(''); setSession({ name: name.trim(), room }); }}>
      <div className="welcome-icon">↗</div><h2>Your conversation<br/>starts here.</h2><p>Pick a name and join a room. Anyone in the same room can chat with you.</p>
      <label>Your name<input required maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Alex" pattern=".*\S.*" /></label>
      <label>Room<input required maxLength={64} pattern="[a-zA-Z0-9_-]+" value={room} onChange={event => setRoom(event.target.value)} placeholder="general" /></label>
      <button className="primary" type="submit">Join conversation <span>→</span></button><small>No account needed · Guest chat demo</small>
    </form> : <><div className="messages" role="log" aria-live="polite" aria-label="Messages">
      <div className="room-notice">You’re in <b>#{session.room}</b><br/>Share the room name to bring someone in.</div>
      {!messages.length && <div className="empty"><span>☏</span><h3>Say the first hello.</h3><p>Messages will appear here as they arrive.</p></div>}
      {messages.map(message => <article key={message.id} className={`message ${message.clientId === identity.current ? 'own' : ''}`}><div className="message-meta">{message.name}<time>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><div className="bubble">{message.text}</div></article>)}<div ref={bottom}/>
    </div>{error && <p className="error" role="alert">{error}</p>}<form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">Message</label><input id="message" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={status === 'connected' ? 'Write a message…' : 'Reconnecting…'} autoComplete="off"/><button type="submit" disabled={status !== 'connected' || !draft.trim()} aria-label="Send message">↑</button></form><footer className="chat-footer">Powered by <b>relay</b><span>Live WebSocket connection</span></footer></>}
  </section>;
}
function App() {
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe src="${location.origin}/embed?room=general" title="Live chat" width="400" height="640" style="border:0;border-radius:16px"></iframe>`;
  return embedded ? <Chat/> : <div className="page"><nav><a className="wordmark" href="/">relay<span>●</span></a><span className="nav-label">CONVERSATIONS, CONNECTED</span><a className="nav-link" href="/embed?room=general" target="_blank" rel="noreferrer">Open chat ↗</a></nav><main><section className="intro"><div className="eyebrow"><i className="dot live"/> EMBEDDABLE LIVE CHAT</div><h1>A conversation.<br/>Anywhere you<br/><em>need it.</em></h1><p className="lead">A small window that keeps people connected. Real-time chat, ready to feel at home inside Salesforce or your own website.</p><div className="features"><span>↗ Real-time messages</span><span>▣ One simple iframe</span><span>◎ Shared chat rooms</span></div><div className="embed-box"><div><strong>Make yourself at home.</strong><button onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>{copied ? 'Copied ✓' : 'Copy embed ↗'}</button></div><code>{snippet}</code></div><p className="demo-tip">TRY IT OUT <span>Join here, then open chat in another tab with the same room name.</span></p></section><section className="preview"><div className="preview-label"><span>LIVE PREVIEW</span><span>↙ This is a real iframe</span></div><iframe src="/embed?room=general" title="Live chat preview"/><div className="preview-note"><i className="dot live"/> React + Node.js · WebSocket-powered chat</div></section></main><footer className="page-footer"><span>Built for a more connected experience.</span><span>RELAY / CHAT DEMO</span></footer></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
