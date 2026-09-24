import { useMemo } from 'react';
import {
  BALANCE,
  PROVINCE_GEO,
  alliesOf,
  armyMen,
  canEnforce,
  councilCandidates,
  evaluateCallToArms,
  evaluatePeace,
  pathDays,
  sideOf,
  skill,
  warGoalProvinces,
} from '@ttc/game-core';
import type { Army, Battle, BattleSide, Character, GameView, War } from '@ttc/shared';
import { fmt, t, tOr } from '../../lib/i18n';
import { charName, formatDateFr, titleName } from '../../lib/format';
import { ActionButton, Breakdown, Portrait, ProgressBar, Tip } from '../../ui/common';
import { act, openCharacter, openProvince, openTitle, propose, select } from '../hooks';
import { useUi } from '../../state/ui';

// ---------------------------------------------------------------- Armée
export function ArmyPanel({ view, me, army }: { view: GameView; me: Character; army: Army }) {
  const owner = view.characters[army.ownerId];
  const mine = army.ownerId === me.id;
  const commander = army.commanderId ? view.characters[army.commanderId] : undefined;
  const candidates = useMemo(() => (mine ? [me, ...councilCandidates(view, me.id)].filter((c) => c.death === null) : []), [mine, view, me]);
  const eta = army.path.length ? pathDays(army.location, army.path) - army.moveProgress : 0;
  const others = Object.values(view.armies).filter((a) => a.id !== army.id && a.ownerId === army.ownerId && a.location === army.location);
  const men = armyMen(army);
  return (
    <div className="army-panel" data-testid="army-panel">
      <div className="prov-header">
        <div>
          <div className="prov-name display">Armée de {owner?.firstName}</div>
          <div className="muted">
            {t(`army.${army.status}`)} · {PROVINCE_GEO[army.location]?.name}
          </div>
        </div>
        <div className="army-men num">{fmt(men)}</div>
      </div>
      <div className="panel-scroll">
        <div className="info-line">
          <span>Moral</span>
          <span style={{ width: 140 }}>
            <ProgressBar value={army.morale} danger={army.morale < 30} />
          </span>
        </div>
        {army.shattered > 0 && (
          <div className="info-line">
            <span>En déroute</span>
            <span className="neg">{army.shattered} jours</span>
          </div>
        )}
        <h3 className="section-title">Composition</h3>
        {Object.entries(army.units)
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([u, n]) => (
            <div key={u} className="info-line">
              <span>{t(`unit.${u}`)}</span>
              <span className="num">{fmt(n ?? 0)}</span>
            </div>
          ))}
        <h3 className="section-title">Commandant</h3>
        {mine ? (
          <select
            className="input"
            aria-label="Commandant"
            value={army.commanderId ?? ''}
            onChange={(e) => void act({ type: 'army.commander', payload: { armyId: army.id, commanderId: e.target.value || null } }, 'Commandant nommé')}
          >
            <option value="">— Aucun —</option>
            {candidates
              .sort((a, b) => skill(view, b, 'martial') - skill(view, a, 'martial'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} (Martial {skill(view, c, 'martial')})
                </option>
              ))}
          </select>
        ) : commander ? (
          <button className="link-btn" onClick={() => openCharacter(commander.id)}>
            {charName(view, commander)} (Martial {skill(view, commander, 'martial')})
          </button>
        ) : (
          <span className="muted">Aucun</span>
        )}
        {army.path.length > 0 && (
          <>
            <h3 className="section-title">Itinéraire</h3>
            <div className="soft" style={{ fontSize: 13 }}>
              {army.path.map((p) => PROVINCE_GEO[p]?.name).join(' → ')}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Arrivée estimée dans {Math.max(0, Math.round(eta))} jours
            </div>
          </>
        )}
        {mine && (
          <>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              Clic droit sur une province pour y faire marcher l’armée.
            </p>
            <div className="col" style={{ gap: 6 }}>
              {others.map((o) => (
                <ActionButton key={o.id} onClick={() => act({ type: 'army.merge', payload: { armyId: o.id, intoId: army.id } }, 'Armées fusionnées')}>
                  Fusionner avec l’armée voisine ({fmt(armyMen(o))})
                </ActionButton>
              ))}
              <ActionButton className="btn-danger" onClick={() => act({ type: 'army.disband', payload: { armyId: army.id } }, 'Armée dissoute').then((ok) => ok && useUi.getState().select(null))}>
                Dissoudre l’armée
              </ActionButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Guerre
function ScoreBar({ score }: { score: number }) {
  const pct = (score + 100) / 2;
  return (
    <div className="warscore" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(score)}>
      <div className="warscore-fill" style={{ width: `${pct}%` }} />
      <div className="warscore-mid" />
      <div className="warscore-label num">
        {score > 0 ? '+' : ''}
        {Math.round(score)} %
      </div>
    </div>
  );
}

function SideList({ view, ids, leader }: { view: GameView; ids: string[]; leader: string }) {
  return (
    <div className="war-side">
      {ids.map((id) => {
        const c = view.characters[id];
        if (!c) return null;
        return (
          <div key={id} className="war-member">
            <Portrait c={c} view={view} size={34} onClick={() => openCharacter(id)} title={charName(view, c)} />
            <span className={id === leader ? 'gold' : ''}>{c.firstName}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WarPanel({ view, me, war }: { view: GameView; me: Character; war: War }) {
  const side = sideOf(war, me.id);
  const leader = side === 'attacker' ? war.attackerId : side === 'defender' ? war.defenderId : null;
  const isLeader = leader === me.id;
  const myScore = side === 'defender' ? -war.warScore : war.warScore;
  const goal = useMemo(() => warGoalProvinces(view, war), [view, war]);
  const allies = side ? alliesOf(view, me.id).filter((a) => !sideOf(war, a)) : [];
  const enemyLeader = view.characters[side === 'attacker' ? war.defenderId : war.attackerId];
  const white = isLeader ? evaluatePeace(view, war, me.id, 'white') : null;
  return (
    <div className="war-panel" data-testid="war-panel">
      <div className="prov-header">
        <div>
          <div className="prov-name display">{t(`cb.${war.cb}`)}</div>
          <div className="muted">
            Depuis le {formatDateFr(war.startedAt)}
            {war.targetTitleId && (
              <>
                {' · '}
                <button className="link-btn" onClick={() => openTitle(war.targetTitleId!)}>
                  {titleName(war.targetTitleId)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="panel-scroll">
        <div className="war-sides">
          <SideList view={view} ids={war.attackers} leader={war.attackerId} />
          <span className="war-vs display">contre</span>
          <SideList view={view} ids={war.defenders} leader={war.defenderId} />
        </div>
        <Tip
          content={() => (
            <Breakdown
              title="Score de guerre (attaquant)"
              rows={[
                { label: 'Batailles', value: war.battleScore },
                { label: 'Occupations', value: war.occupationScore },
                { label: 'Objectif tenu dans la durée', value: war.ticking },
              ]}
              total={war.warScore}
              decimals={0}
            />
          )}
        >
          <div tabIndex={0}>
            <ScoreBar score={war.warScore} />
          </div>
        </Tip>
        {side && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            Votre camp : {myScore > 0 ? '+' : ''}
            {Math.round(myScore)} %. Il faut {BALANCE.war.enforceThreshold} % pour imposer vos conditions.
          </div>
        )}
        <div className="info-line">
          <span>Pertes (attaquants / défenseurs)</span>
          <span className="num">
            {fmt(war.casualties[0])} / {fmt(war.casualties[1])}
          </span>
        </div>
        {war.claimantId && (
          <div className="info-line">
            <span>Prétendant</span>
            <button className="link-btn" onClick={() => openCharacter(war.claimantId!)}>
              {charName(view, view.characters[war.claimantId])}
            </button>
          </div>
        )}
        {goal.length > 0 && (
          <div className="info-line">
            <span>Objectif</span>
            <span>
              {goal
                .slice(0, 4)
                .map((p) => PROVINCE_GEO[p]?.name)
                .join(', ')}
              {goal.length > 4 ? '…' : ''}
            </span>
          </div>
        )}
        {war.battles.length > 0 && (
          <>
            <h3 className="section-title">Batailles</h3>
            {war.battles
              .map((b) => view.battles[b])
              .filter((b): b is Battle => !!b)
              .slice(-8)
              .reverse()
              .map((b) => (
                <button key={b.id} className="title-row" onClick={() => select('battle', b.id)}>
                  <span className="grow">{b.name}</span>
                  <span className={b.winner === side ? 'pos' : b.winner ? 'neg' : 'muted'}>{b.winner ? (b.winner === 'attacker' ? 'Attaquants' : 'Défenseurs') : t(`phase.${b.phase}`)}</span>
                </button>
              ))}
          </>
        )}
        {isLeader && (
          <>
            <h3 className="section-title">Négocier avec {enemyLeader?.firstName}</h3>
            <div className="col" style={{ gap: 6 }}>
              <ActionButton className="btn-primary" disabled={!canEnforce(war, me.id)} onClick={() => act({ type: 'war.offerPeace', payload: { warId: war.id, kind: 'enforce' } }, 'Vos conditions sont imposées', null)} title={`Score de ${BALANCE.war.enforceThreshold} % requis`}>
                Imposer vos conditions
              </ActionButton>
              <Tip content={() => (white ? <Breakdown title="Disposition" rows={white.rows.map((r) => ({ label: tOr(`accept.${r.key}`, r.key), value: r.value }))} total={white.score} decimals={0} /> : null)}>
                <ActionButton onClick={() => propose({ type: 'war.offerPeace', payload: { warId: war.id, kind: 'white' } }, { accepted: 'Paix blanche signée', rejected: 'Paix blanche refusée', pending: 'Offre de paix envoyée' })}>
                  Proposer une paix blanche {white && !enemyLeader?.isPlayer && <span className={white.accept ? 'pos' : 'neg'}> ({white.accept ? 'acceptée' : 'refusée'})</span>}
                </ActionButton>
              </Tip>
              <ActionButton
                className="btn-danger"
                onClick={() =>
                  useUi.getState().openDialog({
                    kind: 'confirm',
                    targetId: war.id,
                    confirm: { title: 'Capituler', text: 'Vous acceptez la défaite : l’ennemi obtient ce qu’il réclamait.', danger: true, run: () => act({ type: 'war.offerPeace', payload: { warId: war.id, kind: 'surrender' } }, 'Vous avez capitulé', null) },
                  })
                }
              >
                Capituler
              </ActionButton>
            </div>
          </>
        )}
        {allies.length > 0 && (
          <>
            <h3 className="section-title">Appeler vos alliés</h3>
            {allies.map((a) => {
              const ally = view.characters[a]!;
              const acc = ally.isPlayer ? null : evaluateCallToArms(view, war, me.id, a);
              return (
                <ActionButton key={a} onClick={() => propose({ type: 'war.callAlly', payload: { warId: war.id, allyId: a } }, { accepted: `${ally.firstName} rejoint la guerre`, rejected: `${ally.firstName} refuse`, pending: 'Appel envoyé' })}>
                  {ally.firstName} {acc && <span className={acc.accept ? 'pos' : 'neg'}>({acc.accept ? 'viendra' : 'refusera'})</span>}
                </ActionButton>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Bataille
function BattleSideView({ view, s, title, won }: { view: GameView; s: BattleSide; title: string; won: boolean }) {
  const cmd = s.commanderId ? view.characters[s.commanderId] : undefined;
  return (
    <div className={`battle-side${won ? ' won' : ''}`}>
      <div className="section-title" style={{ marginTop: 0 }}>
        {title} {won && '🏆'}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Portrait c={cmd ?? view.characters[s.ownerId]} view={view} size={44} onClick={() => openCharacter(s.commanderId ?? s.ownerId)} />
        <div>
          <div>{view.characters[s.ownerId]?.firstName}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {cmd ? `Commandant : ${cmd.firstName}` : 'Sans commandant'}
          </div>
        </div>
      </div>
      <div className="info-line">
        <span>Hommes</span>
        <span className="num">
          {fmt(s.men)} / {fmt(s.startMen)}
        </span>
      </div>
      <div className="info-line">
        <span>Pertes</span>
        <span className="num neg">{fmt(s.casualties)}</span>
      </div>
      <div className="info-line">
        <span>Avantage</span>
        <span className="num">{s.advantage > 0 ? '+' : ''}{fmt(s.advantage)}</span>
      </div>
      <ProgressBar value={s.morale} danger={s.morale < 30} />
    </div>
  );
}

export function BattlePanel({ view, battle }: { view: GameView; battle: Battle }) {
  return (
    <div className="battle-panel" data-testid="battle-panel">
      <div className="prov-header">
        <div>
          <div className="prov-name display">{battle.name}</div>
          <div className="muted">
            {t(`phase.${battle.phase}`)} · jour {battle.day} ·{' '}
            <button className="link-btn" onClick={() => openProvince(battle.provinceId)}>
              {PROVINCE_GEO[battle.provinceId]?.name}
            </button>
          </div>
        </div>
      </div>
      <div className="panel-scroll">
        <div className="battle-sides">
          <BattleSideView view={view} s={battle.attacker} title="Attaquants" won={battle.winner === 'attacker'} />
          <BattleSideView view={view} s={battle.defender} title="Défenseurs" won={battle.winner === 'defender'} />
        </div>
        <div className="info-line">
          <span>Terrain</span>
          <span>{tOr(`terrain.${battle.terrain}`, battle.terrain)}</span>
        </div>
        {battle.warScoreDelta !== 0 && (
          <div className="info-line">
            <span>Score de guerre</span>
            <span className="num">{battle.warScoreDelta > 0 ? '+' : ''}{fmt(battle.warScoreDelta)}</span>
          </div>
        )}
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => select('war', battle.warId)}>
          Voir la guerre
        </button>
      </div>
    </div>
  );
}
