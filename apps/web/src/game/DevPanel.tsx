import { useState } from 'react';
import { CONTENT } from '@ttc/content';
import { checkInvariants } from '@ttc/game-core';
import type { Character, GameState, GameView } from '@ttc/shared';
import { devAdvance } from '../net/socket';
import { useGame } from '../state/game';
import { useUi, pushToast } from '../state/ui';
import { act, actRaw } from './hooks';

/** Outils de développement (serveur en DEV_TOOLS=true uniquement). */
export function DevPanel({ view, me, onClose }: { view: GameView; me: Character; onClose(): void }) {
  const [eventId, setEventId] = useState(CONTENT.events[0]?.id ?? '');
  const seq = useGame((s) => s.seq);
  const version = useGame((s) => s.view?.version);
  const sel = useUi((s) => s.selection);
  return (
    <div className="dev-panel panel" role="dialog" aria-label="Outils de développement" data-testid="dev-panel">
      <div className="panel-header">
        <div className="panel-title">Outils de développement</div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>
      <div className="panel-body col" style={{ gap: 8 }}>
        <div className="muted num" style={{ fontSize: 12 }}>
          seq {seq} · version {version} · jour {view.date} · {Object.keys(view.characters).length} personnages
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <button className="btn btn-sm" onClick={() => act({ type: 'dev.addResources', payload: { gold: 1000, prestige: 500 } }, '+1000 or, +500 prestige')}>
            +1000 or
          </button>
          {[1, 30, 365].map((d) => (
            <button key={d} className="btn btn-sm" onClick={() => devAdvance(d)} data-testid={`dev-advance-${d}`}>
              +{d} j
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <select className="input grow" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Événement">
            {CONTENT.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id}
              </option>
            ))}
          </select>
          <button
            className="btn btn-sm"
            onClick={async () => {
              const ack = await actRaw({ type: 'dev.triggerEvent', payload: { eventId } });
              if (ack.ok && !(ack.result as { fired?: boolean } | undefined)?.fired) pushToast({ kind: 'info', text: 'Conditions de l’événement non remplies pour votre personnage.' });
            }}
          >
            Déclencher
          </button>
        </div>
        {sel?.kind === 'province' && (
          <button className="btn btn-sm" onClick={() => act({ type: 'dev.completeConstruction', payload: { provinceId: sel.id } }, 'Construction achevée')}>
            Achever la construction de la province
          </button>
        )}
        {sel?.kind === 'character' && sel.id !== me.id && (
          <button className="btn btn-sm btn-danger" onClick={() => act({ type: 'dev.killCharacter', payload: { characterId: sel.id } })}>
            Tuer le personnage sélectionné
          </button>
        )}
        <button className="btn btn-sm btn-danger" onClick={() => act({ type: 'dev.killCharacter', payload: { characterId: me.id } })}>
          Tuer mon personnage (tester la succession)
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            const errs = checkInvariants({ ...view, rng: [1, 2, 3, 4] } as GameState);
            pushToast({ kind: errs.length ? 'error' : 'success', text: errs.length ? `${errs.length} anomalies : ${errs.slice(0, 2).join(' ; ')}` : 'Invariants respectés' });
          }}
        >
          Vérifier les invariants (vue client)
        </button>
      </div>
    </div>
  );
}
