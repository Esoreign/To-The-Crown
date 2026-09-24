import { useMemo, type ReactNode } from 'react';
import { EVENT_BY_ID, PROVINCE_GEO, armyMen, domainProvinceIds, factionRatio, schemeSuccessChance, sideOf, warsOf } from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { useUi } from '../../state/ui';
import { useSettings } from '../../state/settings';
import { useGame } from '../../state/game';
import { fmt, t } from '../../lib/i18n';
import { charName } from '../../lib/format';
import { ProgressBar } from '../../ui/common';
import { openArmy, openCharacter, openProvince, openWar, select } from '../hooks';

function Section({ id, title, count, children, urgent }: { id: string; title: string; count: number; children: ReactNode; urgent?: boolean }) {
  const hidden = useSettings((s) => s.hiddenOutliner.includes(id));
  const set = useSettings((s) => s.set);
  if (count === 0) return null;
  return (
    <section className={`outliner-section${urgent ? ' urgent' : ''}`}>
      <button
        className="outliner-head"
        aria-expanded={!hidden}
        onClick={() => {
          const cur = useSettings.getState().hiddenOutliner;
          set({ hiddenOutliner: hidden ? cur.filter((x) => x !== id) : [...cur, id] });
        }}
      >
        <span>{title}</span>
        <span className="outliner-count num">{count}</span>
        <span className="outliner-caret">{hidden ? '▸' : '▾'}</span>
      </button>
      {!hidden && <div className="outliner-body">{children}</div>}
    </section>
  );
}

function Row({ onClick, children, testId }: { onClick(): void; children: ReactNode; testId?: string }) {
  return (
    <button className="outliner-row" onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}

export function Outliner({ view, me }: { view: GameView; me: Character }) {
  const openEvent = (id: string) => useUi.setState({ openEventId: id });
  const presence = useGame((s) => s.presence);
  const data = useMemo(() => {
    const events = Object.values(view.activeEvents).filter((e) => e.characterId === me.id);
    const proposals = Object.values(view.proposals).filter((p) => p.toId === me.id);
    const sent = Object.values(view.proposals).filter((p) => p.fromId === me.id);
    const wars = warsOf(view, me.id);
    const armies = Object.values(view.armies).filter((a) => a.ownerId === me.id);
    const schemes = Object.values(view.schemes).filter((s) => s.ownerId === me.id && s.status === 'active');
    const threats = Object.values(view.schemes).filter((s) => s.targetId === me.id && s.status === 'active' && s.discoveredBy.includes(me.id));
    const battles = Object.values(view.battles).filter((b) => b.phase !== 'ended' && [b.attacker.ownerId, b.defender.ownerId].some((o) => wars.some((w) => sideOf(w, o) !== null)));
    const sieges = Object.values(view.sieges).filter((s) => wars.some((w) => w.id === s.warId));
    const builds = domainProvinceIds(me).filter((p) => view.provinces[p]?.construction);
    const prisoners = Object.values(view.characters).filter((c) => c.prisonerOf === me.id && c.death === null);
    const factions = Object.values(view.factions).filter((f) => f.targetId === me.id);
    return { events, proposals, sent, wars, armies, schemes, threats, battles, sieges, builds, prisoners, factions };
  }, [view, me]);

  const online = presence.filter((p) => p.characterId);

  return (
    <aside className="outliner panel" aria-label="Aperçu" data-testid="outliner">
      <div className="outliner-title display">Aperçu</div>
      <div className="outliner-scroll">
        <Section id="events" title="Décisions en attente" count={data.events.length} urgent>
          {data.events.map((e) => (
            <Row key={e.id} onClick={() => openEvent(e.id)} testId="outliner-event">
              <span className="dot urgent" />
              <span className="grow">{EVENT_BY_ID[e.eventId]?.title ?? e.eventId}</span>
            </Row>
          ))}
        </Section>
        <Section id="proposals" title="Propositions reçues" count={data.proposals.length} urgent>
          {data.proposals.map((p) => {
            const from = view.characters[p.fromId];
            return (
              <Row key={p.id} onClick={() => useUi.setState({ screen: 'diplomacy', screenArg: `proposal:${p.id}` })}>
                <span className="dot urgent" />
                <span className="grow">{t(`notif.proposal_${p.kind}`, { from: from?.firstName ?? '?' })}</span>
              </Row>
            );
          })}
        </Section>
        <Section id="wars" title="Guerres" count={data.wars.length}>
          {data.wars.map((w) => {
            const side = sideOf(w, me.id);
            const score = side === 'attacker' ? w.warScore : -w.warScore;
            const foe = view.characters[side === 'attacker' ? w.defenderId : w.attackerId];
            return (
              <Row key={w.id} onClick={() => openWar(w.id)}>
                <span className="grow">⚔ {foe?.firstName ?? '?'}</span>
                <span className={`num ${score >= 0 ? 'pos' : 'neg'}`}>{score > 0 ? '+' : ''}{Math.round(score)} %</span>
              </Row>
            );
          })}
        </Section>
        <Section id="battles" title="Batailles" count={data.battles.length} urgent>
          {data.battles.map((b) => (
            <Row key={b.id} onClick={() => select('battle', b.id)}>
              <span className="grow">{b.name}</span>
              <span className="muted">{t(`phase.${b.phase}`)}</span>
            </Row>
          ))}
        </Section>
        <Section id="armies" title="Armées" count={data.armies.length}>
          {data.armies.map((a) => (
            <Row key={a.id} onClick={() => openArmy(a.id)} testId="outliner-army">
              <span className="grow">
                {a.commanderId ? (view.characters[a.commanderId]?.firstName ?? 'Armée') : 'Armée'} · {PROVINCE_GEO[a.location]?.name}
              </span>
              <span className="num">{fmt(armyMen(a))}</span>
            </Row>
          ))}
        </Section>
        <Section id="sieges" title="Sièges" count={data.sieges.length}>
          {data.sieges.map((s) => (
            <Row key={s.id} onClick={() => openProvince(s.provinceId)}>
              <span className="grow">{PROVINCE_GEO[s.provinceId]?.name}</span>
              <span style={{ width: 60 }}>
                <ProgressBar value={s.progress} />
              </span>
            </Row>
          ))}
        </Section>
        <Section id="threats" title="Complots contre vous" count={data.threats.length} urgent>
          {data.threats.map((s) => (
            <Row key={s.id} onClick={() => openCharacter(s.ownerId)}>
              <span className="dot urgent" />
              <span className="grow">
                {t(`scheme.${s.type}`)} · {view.characters[s.ownerId]?.firstName}
              </span>
            </Row>
          ))}
        </Section>
        <Section id="schemes" title="Complots" count={data.schemes.length}>
          {data.schemes.map((s) => (
            <Row key={s.id} onClick={() => useUi.getState().openScreen('intrigue')}>
              <span className="grow">
                {t(`scheme.${s.type}`)} · {view.characters[s.targetId]?.firstName}
              </span>
              <span className="muted num">{Math.round(schemeSuccessChance(s) * 100)} %</span>
            </Row>
          ))}
        </Section>
        <Section id="factions" title="Factions hostiles" count={data.factions.length} urgent={data.factions.some((f) => f.discontent > 70)}>
          {data.factions.map((f) => (
            <Row key={f.id} onClick={() => useUi.getState().openScreen('realm', 'factions')}>
              <span className="grow">{t(`faction.${f.type}`)}</span>
              <span className={`num ${f.discontent > 70 ? 'neg' : 'muted'}`}>{Math.round(factionRatio(view, f) * 100)} %</span>
            </Row>
          ))}
        </Section>
        <Section id="builds" title="Constructions" count={data.builds.length}>
          {data.builds.map((p) => {
            const c = view.provinces[p]!.construction!;
            const pct = ((view.date - c.startedAt) / Math.max(1, c.completeAt - c.startedAt)) * 100;
            return (
              <Row key={p} onClick={() => openProvince(p)}>
                <span className="grow">{t(`building.${c.buildingId}`)}</span>
                <span style={{ width: 60 }}>
                  <ProgressBar value={pct} />
                </span>
              </Row>
            );
          })}
        </Section>
        <Section id="prisoners" title="Prisonniers" count={data.prisoners.length}>
          {data.prisoners.map((c) => (
            <Row key={c.id} onClick={() => openCharacter(c.id)}>
              <span className="grow">{charName(view, c)}</span>
            </Row>
          ))}
        </Section>
        <Section id="sent" title="Propositions envoyées" count={data.sent.length}>
          {data.sent.map((p) => (
            <Row key={p.id} onClick={() => openCharacter(p.toId)}>
              <span className="grow">
                {t(`proposal.${p.kind}`)} · {view.characters[p.toId]?.firstName}
              </span>
            </Row>
          ))}
        </Section>
        {online.length > 1 && (
          <Section id="players" title="Joueurs" count={online.length}>
            {online.map((p) => (
              <Row key={p.userId} onClick={() => p.characterId && openCharacter(p.characterId)}>
                <span className={`presence-dot${p.online ? ' on' : ''}`} />
                <span className="grow">{p.displayName}</span>
                <span className="muted">{p.characterId ? view.characters[p.characterId]?.firstName : ''}</span>
              </Row>
            ))}
          </Section>
        )}
        {data.events.length + data.wars.length + data.armies.length + data.schemes.length + data.builds.length === 0 && (
          <div className="muted outliner-empty">Le royaume est calme. Profitez-en pour bâtir, marier et comploter.</div>
        )}
      </div>
    </aside>
  );
}
