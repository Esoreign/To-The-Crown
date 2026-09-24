import { useEffect, useState } from 'react';
import { formatDateFr, type GameNotification } from '@ttc/shared';
import { useGame, type UiNotification } from '../../state/game';
import { useUi } from '../../state/ui';
import { t } from '../../lib/i18n';
import { select } from '../hooks';

export function notifText(n: GameNotification): string {
  return t(`notif.${n.kind}`, n.vars);
}

export function openNotification(n: GameNotification): void {
  useGame.getState().markRead(n.id);
  const f = n.focus;
  if (!f) return;
  if (f.type === 'event') useUi.setState({ openEventId: f.id });
  else if (f.type === 'scheme') useUi.getState().openScreen('intrigue');
  else {
    select(f.type, f.id);
    if (f.type === 'province') useUi.getState().focusProvince(f.id);
  }
}

const LIFETIME: Record<string, number> = { urgent: 14000, important: 9000, info: 6000 };

/** Pile de notifications récentes (disparaissent seules, sauf survol). */
export function NotificationStack() {
  const notifications = useGame((s) => s.notifications);
  const [now, setNow] = useState(Date.now());
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const visible = notifications.filter((n) => !n.read && (hover || now - n.receivedAt < (LIFETIME[n.level] ?? 6000))).slice(0, 5);
  return (
    <div className="notif-stack" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-live="polite">
      {visible.map((n) => (
        <div key={n.id} className={`notif-card ${n.level}`} role="button" tabIndex={0} onClick={() => openNotification(n)} onKeyDown={(e) => e.key === 'Enter' && openNotification(n)}>
          <div className="notif-text">{notifText(n)}</div>
          <button
            className="icon-btn notif-close"
            aria-label="Ignorer"
            onClick={(e) => {
              e.stopPropagation();
              useGame.getState().markRead(n.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** Historique complet des notifications. */
export function NotificationHistory({ onClose }: { onClose(): void }) {
  const notifications = useGame((s) => s.notifications);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'important'>('all');
  const list: UiNotification[] = notifications.filter((n) => filter === 'all' || n.level === filter);
  return (
    <div className="notif-history panel" role="dialog" aria-label="Notifications">
      <div className="panel-header">
        <div className="panel-title">Notifications</div>
        <button className="btn btn-sm btn-ghost" onClick={() => useGame.getState().markRead()}>
          Tout marquer lu
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>
      <div className="tabs" style={{ padding: '0 10px' }}>
        {(['all', 'urgent', 'important'] as const).map((f) => (
          <button key={f} className={`tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Toutes' : f === 'urgent' ? 'Urgentes' : 'Importantes'}
          </button>
        ))}
      </div>
      <div className="notif-history-list">
        {list.length === 0 && <div className="muted" style={{ padding: 12 }}>Aucune notification.</div>}
        {list.map((n) => (
          <button key={n.id} className={`notif-line ${n.level}${n.read ? ' read' : ''}`} onClick={() => openNotification(n)}>
            <span className="muted num">{formatDateFr(n.date)}</span>
            <span>{notifText(n)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
