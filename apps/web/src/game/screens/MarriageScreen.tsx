import { useMemo, useState } from 'react';
import {
  ageOf,
  canArrangeFor,
  courtiers,
  decisionMaker,
  evaluateMarriage,
  marriageBlocker,
  marriageCandidates,
  rankOf,
  sameDynasty,
  skill,
  usableHook,
  type Acceptance,
} from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { tOr, traitName } from '../../lib/i18n';
import { charName, rulerTitle } from '../../lib/format';
import { ActionButton, Breakdown, Portrait, Tip } from '../../ui/common';
import { SKILLS } from '../../ui/char';
import { openCharacter, propose } from '../hooks';
import { ScreenFrame } from './ScreenHost';

function Candidate({
  view,
  me,
  suitor,
  c,
  acc,
}: {
  view: GameView;
  me: Character;
  suitor: Character;
  c: Character;
  acc: Acceptance | null;
}) {
  const decider = decisionMaker(view, c.id);
  const hook = decider ? usableHook(view, me.id, decider.id) : undefined;
  const [useHook, setUseHook] = useState(false);
  const shown =
    useHook && decider && !decider.isPlayer ? evaluateMarriage(view, me.id, suitor.id, c.id, true) : acc;
  const skillSum = SKILLS.reduce((s, k) => s + skill(view, c, k), 0);
  return (
    <div className="candidate-row" data-testid="marriage-candidate">
      <Portrait c={c} view={view} size={52} onClick={() => openCharacter(c.id)} title={charName(view, c)} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div>{charName(view, c)}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {ageOf(c, view.date)} ans ·{' '}
          {rulerTitle(c) ||
            (decider && decider.id !== c.id ? `famille de ${decider.firstName}` : 'sans terre')}{' '}
          · compétences {skillSum}
        </div>
        <div className="trait-list" style={{ marginTop: 2 }}>
          {c.traits.slice(0, 4).map((tr) => (
            <span key={tr} className="trait-chip">
              {traitName(tr, c.sex)}
            </span>
          ))}
        </div>
      </div>
      {hook && (
        <label className="muted" style={{ fontSize: 12 }}>
          <input type="checkbox" checked={useHook} onChange={(e) => setUseHook(e.target.checked)} /> Levier
        </label>
      )}
      {shown ? (
        <Tip
          content={() => (
            <Breakdown
              title="Disposition"
              rows={shown.rows.map((r) => ({ label: tOr(`accept.${r.key}`, r.key), value: r.value }))}
              total={shown.score}
              decimals={0}
            />
          )}
        >
          <span className={`badge ${shown.accept ? 'good' : 'danger'}`} tabIndex={0}>
            {shown.accept ? 'Acceptera' : 'Refusera'} ({shown.score})
          </span>
        </Tip>
      ) : (
        <span className="badge gold">Joueur</span>
      )}
      <ActionButton
        className="btn-sm btn-primary"
        onClick={() =>
          propose(
            { type: 'marriage.propose', payload: { characterId: suitor.id, targetId: c.id, useHook } },
            {
              accepted: `Mariage conclu : ${suitor.firstName} et ${c.firstName}`,
              rejected: `${decider?.firstName ?? c.firstName} refuse l’union`,
              pending: 'Proposition de mariage envoyée',
            },
          )
        }
      >
        Proposer
      </ActionButton>
    </div>
  );
}

export function MarriageScreen({ view, me, arg }: { view: GameView; me: Character; arg: string | null }) {
  const targetId = arg?.startsWith('target:') ? arg.slice(7) : null;
  const target = targetId ? view.characters[targetId] : undefined;
  const suitors = useMemo(() => {
    const pool = [me, ...courtiers(view, me.id)];
    return pool
      .filter(
        (c) =>
          c.death === null &&
          !c.spouseId &&
          !c.betrothedId &&
          !c.prisonerOf &&
          canArrangeFor(view, me.id, c.id) &&
          ageOf(c, view.date) >= 3,
      )
      .sort(
        (a, b) =>
          Number(sameDynasty(view, me, b)) - Number(sameDynasty(view, me, a)) ||
          rankOf(b) - rankOf(a) ||
          a.birth - b.birth,
      );
  }, [view, me]);
  const [suitorId, setSuitor] = useState<string | null>(() =>
    target ? (suitors.find((s) => !marriageBlocker(view, s, target))?.id ?? null) : (suitors[0]?.id ?? null),
  );
  const suitor = suitorId ? view.characters[suitorId] : undefined;
  const [filter, setFilter] = useState<'all' | 'accept' | 'rulers'>('all');

  const candidates = useMemo(() => {
    if (!suitor) return [];
    if (target) {
      const block = marriageBlocker(view, suitor, target);
      if (block) return [];
      const decider = decisionMaker(view, target.id);
      return [
        {
          id: target.id,
          acceptance: decider?.isPlayer ? null : evaluateMarriage(view, me.id, suitor.id, target.id),
        },
      ];
    }
    return marriageCandidates(view, me.id, suitor.id, 40).map((x) => ({
      id: x.id,
      acceptance: x.acceptance as Acceptance | null,
    }));
  }, [view, me.id, suitor, target]);

  const list = candidates
    .map((x) => ({ c: view.characters[x.id]!, acc: x.acceptance }))
    .filter(
      (x) =>
        x.c &&
        (filter === 'all' || (filter === 'accept' ? x.acc?.accept !== false : x.c.titleIds.length > 0)),
    );

  return (
    <ScreenFrame title="Mariages" icon="❤" wide>
      <div className="marriage-grid">
        <aside className="marriage-suitors">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            À marier
          </h3>
          {suitors.length === 0 && (
            <p className="muted">Aucun membre de votre cour n’est libre de se marier.</p>
          )}
          {suitors.map((s) => {
            const blocked = target ? marriageBlocker(view, s, target) : null;
            return (
              <button
                key={s.id}
                className={`start-card${s.id === suitorId ? ' active' : ''}`}
                onClick={() => setSuitor(s.id)}
                disabled={!!blocked}
                title={blocked ? tOr(`reason.${blocked}`, blocked) : undefined}
              >
                <Portrait c={s} view={view} size={40} />
                <div>
                  <div className="start-name">{s.id === me.id ? `${s.firstName} (vous)` : s.firstName}</div>
                  <div className="start-sub">
                    {ageOf(s, view.date)} ans{sameDynasty(view, me, s) ? '' : ' · courtisan'}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>
        <section className="marriage-candidates">
          {target && (
            <p className="soft" style={{ marginTop: 0 }}>
              Union avec <strong>{charName(view, target)}</strong>. Choisissez qui, dans votre cour,
              l’épousera.
            </p>
          )}
          {!target && (
            <div className="row spread" style={{ marginBottom: 8 }}>
              <span className="soft">
                {suitor ? `Partis possibles pour ${suitor.firstName}` : 'Choisissez un membre de votre cour'}
              </span>
              <div className="tabs" style={{ border: 'none' }}>
                {(
                  [
                    ['all', 'Tous'],
                    ['accept', 'Favorables'],
                    ['rulers', 'Titrés'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={`tab${filter === id ? ' active' : ''}`}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {suitor && list.length === 0 && (
            <p className="muted">
              {target
                ? tOr(`reason.${marriageBlocker(view, suitor, target) ?? 'invalid'}`, 'Union impossible')
                : 'Aucun parti convenable pour le moment.'}
            </p>
          )}
          {suitor &&
            list.map(({ c, acc }) => (
              <Candidate key={c.id} view={view} me={me} suitor={suitor} c={c} acc={acc} />
            ))}
          <p className="muted" style={{ fontSize: 12.5 }}>
            Un mariage avec un souverain crée une alliance. Les enfants d’un prétendant de votre dynastie
            restent dans votre maison.
          </p>
        </section>
      </div>
    </ScreenFrame>
  );
}
