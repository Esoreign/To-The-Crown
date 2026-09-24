import { useEffect, useMemo } from 'react';
import { EVENT_BY_ID, stressForTags } from '@ttc/game-core';
import type { ActiveEvent, EventChoiceDef, GameView } from '@ttc/shared';
import { sceneSvg } from '../art/scenes';
import { describeEffects, resolveEventText } from '../lib/eventText';
import { fmt } from '../lib/i18n';
import { charName } from '../lib/format';
import { playSound } from '../audio/audio';
import { useUi } from '../state/ui';
import { ActionButton, Portrait, Tip } from '../ui/common';
import { act, openCharacter } from './hooks';

function costText(c: EventChoiceDef['cost']): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.gold) parts.push(`${fmt(c.gold)} or`);
  if (c.prestige) parts.push(`${fmt(c.prestige)} prestige`);
  if (c.fervor) parts.push(`${fmt(c.fervor)} ferveur`);
  if (c.authority) parts.push(`${fmt(c.authority)} autorité`);
  return parts.join(', ');
}

function affordable(view: GameView, meId: string, c: EventChoiceDef['cost']): boolean {
  const me = view.characters[meId];
  if (!me || !c) return true;
  return (c.gold ?? 0) <= me.gold && (c.prestige ?? 0) <= me.prestige && (c.fervor ?? 0) <= me.fervor && (c.authority ?? 0) <= me.authority;
}

export function EventModal({ view, ev }: { view: GameView; ev: ActiveEvent }) {
  const def = EVENT_BY_ID[ev.eventId];
  const me = view.characters[ev.characterId];
  useEffect(() => {
    playSound('event');
  }, [ev.id]);
  const text = useMemo(() => (def ? resolveEventText(view, def.text, ev.scope) : ''), [def, view, ev.scope]);
  if (!def || !me) return null;
  const choices = def.choices.filter((c) => ev.available.includes(c.id));
  const portraits = (def.portraits ?? ['root']).map((r) => ev.scope[r]).filter((id): id is string => !!id);
  const daysLeft = ev.expiresAt - view.date;
  const close = () => useUi.setState({ openEventId: null });

  return (
    <div className="modal-backdrop event-backdrop">
      <div className="modal parchment event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title" data-testid="event-modal">
        <div className="event-art" dangerouslySetInnerHTML={{ __html: sceneSvg(def.illustration, ev.id.length + def.id.length) }} />
        <div className="event-portraits">
          {portraits.map((id) => (
            <div key={id} className="event-portrait">
              <Portrait c={view.characters[id]} view={view} size={78} onClick={() => openCharacter(id)} title={charName(view, view.characters[id])} />
              <div className="event-portrait-name">{view.characters[id]?.firstName}</div>
            </div>
          ))}
        </div>
        <button className="icon-btn event-minimize" onClick={close} aria-label="Réduire (l’événement reste en attente)" title="Réduire">
          ▾
        </button>
        <div className="event-body">
          <h2 id="event-title" className="event-title">
            {def.title}
          </h2>
          <p className="event-text">{text}</p>
          <div className="event-choices">
            {choices.map((ch) => {
              const effects = describeEffects(view, ch.effects, ev.scope);
              const stress = stressForTags(me, ch.tags);
              const can = affordable(view, me.id, ch.cost);
              const cost = costText(ch.cost);
              return (
                <Tip
                  key={ch.id}
                  content={() => (
                    <div>
                      <div className="tooltip-title">Conséquences</div>
                      {ch.tooltip && <p className="soft">{resolveEventText(view, ch.tooltip, ev.scope)}</p>}
                      {cost && <div className="neg">Coût : {cost}</div>}
                      {ch.hiddenEffects ? (
                        <div className="muted">Les conséquences sont incertaines…</div>
                      ) : effects.length ? (
                        effects.map((e, i) => (
                          <div key={i} className={e.tone} style={{ paddingLeft: e.depth * 12 }}>
                            {e.text}
                          </div>
                        ))
                      ) : (
                        <div className="muted">Aucune conséquence notable.</div>
                      )}
                      {stress !== 0 && <div className={stress > 0 ? 'neg' : 'pos'}>Stress {stress > 0 ? '+' : ''}{stress} (selon votre caractère)</div>}
                    </div>
                  )}
                >
                  <ActionButton
                    className="event-choice"
                    disabled={!can}
                    onClick={async () => {
                      if (await act({ type: 'event.choose', payload: { activeEventId: ev.id, choiceId: ch.id } }, undefined, null)) {
                        playSound('confirm');
                        // Enchaîne sur le prochain événement en attente, s'il y en a.
                        const next = Object.values(view.activeEvents).find((e) => e.characterId === ev.characterId && e.id !== ev.id);
                        useUi.setState({ openEventId: next?.id ?? null });
                      }
                    }}
                  >
                    <span className="event-choice-label">{resolveEventText(view, ch.label, ev.scope)}</span>
                    <span className="event-choice-meta">
                      {cost && <span className={can ? 'neg' : 'neg strong'}>{cost}</span>}
                      {stress > 0 && <span className="neg">☁ +{stress}</span>}
                      {stress < 0 && <span className="pos">☁ {stress}</span>}
                      {!ch.hiddenEffects &&
                        effects
                          .filter((e) => e.depth === 0)
                          .slice(0, 3)
                          .map((e, i) => (
                            <span key={i} className={e.tone}>
                              {e.text}
                            </span>
                          ))}
                      {ch.hiddenEffects && <span className="muted">???</span>}
                    </span>
                  </ActionButton>
                </Tip>
              );
            })}
          </div>
          <div className="event-footer muted">{daysLeft > 0 ? `Sans réponse, une décision sera prise dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.` : 'Décision imminente.'}</div>
        </div>
      </div>
    </div>
  );
}
