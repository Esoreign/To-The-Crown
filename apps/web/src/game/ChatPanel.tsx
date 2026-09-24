import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useGame } from '../state/game';
import { useUi } from '../state/ui';
import { sendChat } from '../net/socket';

export function ChatPanel({ gameId }: { gameId: string }) {
  const chat = useGame((s) => s.chat);
  const presence = useGame((s) => s.presence);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [chat.length]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (v && (await sendChat(gameId, v))) setText('');
  }
  return (
    <div className="chat-panel panel" role="dialog" aria-label="Discussion" data-testid="chat-panel">
      <div className="panel-header">
        <div className="panel-title">Discussion</div>
        <span className="muted" style={{ fontSize: 12 }}>
          {presence.filter((p) => p.online).length} en ligne
        </span>
        <button className="icon-btn" onClick={() => useUi.setState({ chatOpen: false })} aria-label="Fermer">
          ✕
        </button>
      </div>
      <div className="chat-log" aria-live="polite">
        {chat.length === 0 && <span className="muted">Aucun message.</span>}
        {chat.map((m) => (
          <div key={m.id} className="chat-msg">
            <span className="when">{new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="who">{m.displayName}</span>
            {m.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="row" style={{ gap: 6, padding: 8 }} onSubmit={submit}>
        <input className="input grow" aria-label="Message" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" data-testid="chat-input" />
        <button className="btn btn-sm">Envoyer</button>
      </form>
    </div>
  );
}
