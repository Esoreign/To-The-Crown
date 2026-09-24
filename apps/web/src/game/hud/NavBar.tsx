import { useGame } from '../../state/game';
import { useUi, type ScreenId } from '../../state/ui';
import { playSound } from '../../audio/audio';

export const NAV: { id: Exclude<ScreenId, null>; label: string; icon: string; key: string }[] = [
  { id: 'council', label: 'Conseil', icon: '⚜', key: 'C' },
  { id: 'realm', label: 'Royaume', icon: '♖', key: 'K' },
  { id: 'dynasty', label: 'Dynastie', icon: '❦', key: 'D' },
  { id: 'intrigue', label: 'Intrigue', icon: '☾', key: 'I' },
  { id: 'military', label: 'Armées', icon: '⚔', key: 'L' },
  { id: 'marriage', label: 'Mariages', icon: '❤', key: 'G' },
  { id: 'decisions', label: 'Décisions', icon: '✧', key: 'N' },
  { id: 'chronicle', label: 'Chronique', icon: '✎', key: 'H' },
];

export function NavBar({ onBell, unread, onChat, chatUnread, multiplayer }: { onBell(): void; unread: number; onChat(): void; chatUnread: number; multiplayer: boolean }) {
  const screen = useUi((s) => s.screen);
  const openScreen = useUi((s) => s.openScreen);
  const hasEvents = useGame((s) => !!s.world && Object.values(s.world.activeEvents).some((e) => e.characterId === s.youCharacterId));
  return (
    <nav className="navbar panel" aria-label="Écrans du royaume">
      {NAV.map((n) => (
        <button
          key={n.id}
          className={`nav-btn${screen === n.id ? ' active' : ''}`}
          onClick={() => {
            playSound('click');
            openScreen(screen === n.id ? null : n.id);
          }}
          title={`${n.label} (${n.key})`}
          aria-pressed={screen === n.id}
          data-testid={`nav-${n.id}`}
        >
          <span className="nav-icon" aria-hidden="true">
            {n.icon}
          </span>
          <span className="nav-label">{n.label}</span>
        </button>
      ))}
      <span className="nav-sep" />
      <button className="nav-btn" onClick={() => openScreen(screen === 'search' ? null : 'search')} title="Rechercher (F)">
        <span className="nav-icon" aria-hidden="true">
          ⌕
        </span>
        <span className="nav-label">Chercher</span>
      </button>
      <button className={`nav-btn${hasEvents ? ' pulse' : ''}`} onClick={onBell} title="Notifications" data-testid="nav-notifications">
        <span className="nav-icon" aria-hidden="true">
          ♪
        </span>
        <span className="nav-label">Nouvelles</span>
        {unread > 0 && <span className="nav-badge num">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {multiplayer && (
        <button className="nav-btn" onClick={onChat} title="Discussion" data-testid="nav-chat">
          <span className="nav-icon" aria-hidden="true">
            ✉
          </span>
          <span className="nav-label">Discussion</span>
          {chatUnread > 0 && <span className="nav-badge num">{chatUnread}</span>}
        </button>
      )}
    </nav>
  );
}
