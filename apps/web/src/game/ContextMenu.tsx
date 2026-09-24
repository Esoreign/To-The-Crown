import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Character, GameView } from '@ttc/shared';
import { useUi } from '../state/ui';
import { charName } from '../lib/format';
import { Portrait, Tip } from '../ui/common';
import { interactionsFor, acceptanceSummary } from './interactions';
import { AcceptanceTip } from './panels/CharacterPanel';
import { openCharacter } from './hooks';

/** Menu d'interactions rapide (clic droit sur une province ou un portrait). */
export function ContextMenu({ view, me }: { view: GameView; me: Character }) {
  const menu = useUi((s) => s.contextMenu)!;
  const target = view.characters[menu.characterId];
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });
  const list = useMemo(() => (target ? interactionsFor(view, me, target).filter((i) => i.group !== 'dev') : []), [view, me, target]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({ left: Math.min(menu.x, window.innerWidth - el.offsetWidth - 8), top: Math.min(menu.y, window.innerHeight - el.offsetHeight - 8) });
  }, [menu.x, menu.y]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) useUi.setState({ contextMenu: null });
    };
    // Enregistré au tour suivant : le clic droit qui ouvre le menu ne doit pas le refermer.
    const timer = window.setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', close);
    };
  }, []);

  if (!target) return null;
  const close = () => useUi.setState({ contextMenu: null });
  return (
    <div ref={ref} className="context-menu panel" style={pos} role="menu" aria-label={`Interactions avec ${target.firstName}`}>
      <div className="context-head">
        <Portrait c={target} view={view} size={36} />
        <div>
          <div className="display">{charName(view, target)}</div>
          <button
            className="link-btn"
            onClick={() => {
              openCharacter(target.id);
              close();
            }}
          >
            Voir la fiche
          </button>
        </div>
      </div>
      {list.map((it) => {
        const acc = acceptanceSummary(it.acceptance);
        return (
          <Tip key={it.id} content={() => <AcceptanceTip it={it} />}>
            <button
              role="menuitem"
              className={`context-item${it.danger ? ' danger' : ''}`}
              disabled={!!it.disabled}
              onClick={() => {
                close();
                void it.run();
              }}
            >
              <span className="interaction-icon" aria-hidden="true">
                {it.icon}
              </span>
              <span className="grow">{it.label}</span>
              {acc && <span className={acc.tone}>{acc.tone === 'pos' ? '✔' : '✘'}</span>}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
