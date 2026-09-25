import { useMemo, useState } from 'react';
import { WORLD } from '@ttc/content';
import {
  DECISIONS,
  TITLE_DEFS,
  decisionBlocker,
  decisionCost,
  domainProvinceIds,
  ledgerOf,
  provinceTax,
  vassalTaxShare,
  directVassals,
  domainIncome,
  armyUpkeep,
} from '@ttc/game-core';
import type { Character, DecisionId, GameView } from '@ttc/shared';
import { fmt, t, tOr } from '../../lib/i18n';
import { charName, formatDateFr, rulerTitle, titleFullName } from '../../lib/format';
import { chronicleText } from '../../lib/chronicle';
import { ActionButton, CoatOfArms, Portrait } from '../../ui/common';
import { act, openCharacter, openProvince, openTitle } from '../hooks';
import { useUi } from '../../state/ui';
import { ScreenFrame } from './ScreenHost';

// ---------------------------------------------------------------- Décisions
const DECISION_ICON: Record<DecisionId, string> = { feast: '♨', pilgrimage: '✝', hunt: '➶', tournament: '⚔', seclusion: '☾' };

export function DecisionsScreen({ view, me }: { view: GameView; me: Character }) {
  return (
    <ScreenFrame title="Décisions" icon="✧">
      <div className="col" style={{ gap: 8 }}>
        {(Object.keys(DECISIONS) as DecisionId[]).map((id) => {
          const cost = decisionCost(view, me.id, id);
          const why = decisionBlocker(view, me.id, id);
          const costText = [cost.gold ? `${fmt(cost.gold)} or` : '', cost.prestige ? `${fmt(cost.prestige)} prestige` : '', cost.fervor ? `${fmt(cost.fervor)} ferveur` : ''].filter(Boolean).join(', ');
          return (
            <div key={id} className="decision-card" data-testid={`decision-${id}`}>
              <span className="decision-icon" aria-hidden="true">
                {DECISION_ICON[id]}
              </span>
              <div className="grow">
                <div className="display">{t(`decision.${id}`)}</div>
                <div className="soft" style={{ fontSize: 13 }}>
                  {t(`decision.desc.${id}`)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Coût : {costText || 'aucun'}
                  {why && (
                    <span className="neg">
                      {' '}
                      · {why === 'cooldown' ? `disponible le ${formatDateFr(me.cooldowns[`decision_${id}`] ?? view.date)}` : tOr(`reason.${why}`, why)}
                    </span>
                  )}
                </div>
              </div>
              <ActionButton className="btn-primary btn-sm" disabled={!!why} onClick={() => act({ type: 'decision.take', payload: { decision: id } }, undefined, 'confirm')}>
                Décider
              </ActionButton>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

// ---------------------------------------------------------------- Chronique
export function ChronicleScreen({ view, me }: { view: GameView; me: Character }) {
  const [filter, setFilter] = useState<'all' | 'house'>('all');
  const entries = useMemo(() => {
    const list = filter === 'house' && me.houseId ? view.chronicle.filter((e) => e.houseIds.includes(me.houseId!)) : view.chronicle;
    return [...list].reverse();
  }, [view.chronicle, filter, me.houseId]);
  const byYear = new Map<number, typeof entries>();
  for (const e of entries) {
    const y = Math.floor(e.date / 365);
    const arr = byYear.get(y) ?? [];
    arr.push(e);
    byYear.set(y, arr);
  }
  return (
    <ScreenFrame title="Chronique du monde" icon="✎" wide>
      <div className="tabs">
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tout le continent
        </button>
        <button className={`tab${filter === 'house' ? ' active' : ''}`} onClick={() => setFilter('house')}>
          Votre maison
        </button>
      </div>
      <div className="chronicle">
        {entries.length === 0 && <p className="muted">La chronique est encore vierge.</p>}
        {[...byYear.entries()].map(([year, list]) => (
          <div key={year} className="chronicle-year">
            <div className="chronicle-year-label display">{formatDateFr(list[0]!.date).split(' ').pop()}</div>
            {list.map((e) => (
              <div key={e.id} className={`chronicle-entry kind-${e.kind}`}>
                <span className="chronicle-date muted num">{formatDateFr(e.date)}</span>
                <span className="chronicle-kind">{t(`chronicle.${e.kind}`)}</span>
                <p className="chronicle-text narrative">{chronicleText(view, e)}</p>
                <div className="row" style={{ gap: 4 }}>
                  {e.characterIds.slice(0, 4).map((id) => (
                    <Portrait key={id} c={view.characters[id]} view={view} size={26} onClick={() => openCharacter(id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

// ---------------------------------------------------------------- Registre
export function LedgerScreen({ view, me }: { view: GameView; me: Character }) {
  const ledger = useMemo(() => ledgerOf(view, me), [view, me]);
  const vassals = directVassals(view, me.id).filter((v) => v.titleIds.length);
  const domain = domainProvinceIds(me);
  const upkeep = armyUpkeep(view, me);
  return (
    <ScreenFrame title="Registre du trésor" icon="⛁" wide>
      <div className="intrigue-grid">
        <section>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Bilan mensuel
          </h3>
          {ledger.income.map((r) => (
            <div key={r.key} className="info-line">
              <span>{t(`ledger.${r.key}`, r.vars)}</span>
              <span className="num pos">+{fmt(r.value, 1)}</span>
            </div>
          ))}
          {ledger.expenses.map((r) => (
            <div key={r.key} className="info-line">
              <span>{t(`ledger.${r.key}`, r.vars)}</span>
              <span className="num neg">−{fmt(Math.abs(r.value), 1)}</span>
            </div>
          ))}
          <div className="info-line total">
            <span>Solde</span>
            <span className={`num ${ledger.net >= 0 ? 'pos' : 'neg'}`}>
              {ledger.net >= 0 ? '+' : '−'}
              {fmt(Math.abs(ledger.net), 1)}
            </span>
          </div>
          <div className="info-line">
            <span>Trésor</span>
            <span className={`num ${me.gold < 0 ? 'neg' : 'gold'}`}>{fmt(me.gold)}</span>
          </div>
          <div className="info-line">
            <span>Revenu brut du domaine</span>
            <span className="num">{fmt(domainIncome(view, me), 1)}</span>
          </div>
          <div className="info-line">
            <span>Entretien militaire (levées / hommes d’armes)</span>
            <span className="num">
              {fmt(upkeep.levies, 1)} / {fmt(upkeep.maa, 1)}
            </span>
          </div>
          {me.gold < 0 && <p className="neg">Vous êtes endetté : prestige et opinion des vassaux en pâtissent chaque mois.</p>}
        </section>
        <section>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Comtés du domaine
          </h3>
          {domain.map((pid) => (
            <button key={pid} className="title-row" onClick={() => openProvince(pid)}>
              <span className="grow">{WORLD.provinces.find((p) => p.id === pid)?.name}</span>
              <span className="num">{fmt(provinceTax(view, pid), 1)}</span>
            </button>
          ))}
          {vassals.length > 0 && (
            <>
              <h3 className="section-title">Contribution des vassaux</h3>
              {vassals.map((v) => (
                <button key={v.id} className="title-row" onClick={() => openCharacter(v.id)}>
                  <span className="grow">{charName(view, v)}</span>
                  <span className="num muted">{Math.round(vassalTaxShare(view, me, v) * 100)} %</span>
                </button>
              ))}
            </>
          )}
        </section>
      </div>
    </ScreenFrame>
  );
}

// ---------------------------------------------------------------- Recherche
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function SearchScreen({ view }: { view: GameView }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 2) return { chars: [], provs: [], titles: [] };
    const chars = Object.values(view.characters)
      .filter((c) => c.death === null && norm(`${c.firstName} ${c.houseId ? (view.houses[c.houseId]?.name ?? '') : ''}`).includes(n))
      .sort((a, b) => b.titleIds.length - a.titleIds.length)
      .slice(0, 12);
    const provs = WORLD.provinces.filter((p) => norm(p.name).includes(n)).slice(0, 8);
    const titles = WORLD.titles.filter((tt) => tt.rank !== 'county' && norm(tt.name).includes(n)).slice(0, 8);
    return { chars, provs, titles };
  }, [q, view]);
  const close = () => useUi.getState().openScreen(null);
  return (
    <ScreenFrame title="Rechercher" icon="⌕">
      <input className="input" autoFocus placeholder="Personnage, maison, comté, royaume…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Recherche" data-testid="search-input" style={{ width: '100%', marginBottom: 10 }} />
      {results.chars.length > 0 && <h3 className="section-title">Personnages</h3>}
      {results.chars.map((c) => (
        <button
          key={c.id}
          className="title-row"
          onClick={() => {
            openCharacter(c.id);
            close();
          }}
        >
          <Portrait c={c} view={view} size={28} />
          <span className="grow">{charName(view, c)}</span>
          <span className="muted">{rulerTitle(c)}</span>
        </button>
      ))}
      {results.provs.length > 0 && <h3 className="section-title">Comtés</h3>}
      {results.provs.map((p) => (
        <button
          key={p.id}
          className="title-row"
          onClick={() => {
            openProvince(p.id);
            useUi.getState().focusProvince(p.id);
            close();
          }}
        >
          <span className="grow">{p.name}</span>
          <span className="muted">{t(`terrain.${p.terrain}`)}</span>
        </button>
      ))}
      {results.titles.length > 0 && <h3 className="section-title">Titres</h3>}
      {results.titles.map((tt) => (
        <button
          key={tt.id}
          className="title-row"
          onClick={() => {
            openTitle(tt.id);
            close();
          }}
        >
          <CoatOfArms seed={TITLE_DEFS[tt.id]?.coaSeed ?? 1} size={20} />
          <span className="grow">{titleFullName(tt.id)}</span>
        </button>
      ))}
      {q.trim().length >= 2 && !results.chars.length && !results.provs.length && !results.titles.length && <p className="muted">Aucun résultat.</p>}
    </ScreenFrame>
  );
}

// ---------------------------------------------------------------- Propositions
export function ProposalScreen({ view, me, proposalId }: { view: GameView; me: Character; proposalId: string | null }) {
  const incoming = Object.values(view.proposals).filter((p) => p.toId === me.id);
  const list = proposalId ? incoming.filter((p) => p.id === proposalId) : incoming;
  return (
    <ScreenFrame title="Propositions" icon="✉">
      {list.length === 0 && <p className="muted">Aucune proposition en attente.</p>}
      {list.map((p) => {
        const from = view.characters[p.fromId];
        const subjects = p.subjects.map((s) => view.characters[s]).filter(Boolean);
        let text: string;
        switch (p.kind) {
          case 'marriage':
            text = `${from?.firstName} propose d’unir ${subjects[0]?.firstName ?? '?'} et ${subjects[1]?.firstName ?? '?'}.`;
            break;
          case 'alliance':
            text = `${from?.firstName} propose une alliance défensive entre vos maisons.`;
            break;
          case 'vassalize':
            text = `${from?.firstName} exige que vous lui prêtiez serment de vassalité.`;
            break;
          case 'war_call':
            text = `${from?.firstName} vous appelle aux armes au nom de votre alliance.`;
            break;
          case 'white_peace':
            text = `${from?.firstName} propose de mettre fin à la guerre sans vainqueur.`;
            break;
          default:
            text = tOr(`proposal.${p.kind}`, p.kind);
        }
        return (
          <div key={p.id} className="proposal-card" data-testid="proposal">
            <div className="row" style={{ gap: 10 }}>
              <Portrait c={from} view={view} size={56} onClick={() => from && openCharacter(from.id)} />
              <div className="grow">
                <div className="display">{t(`proposal.${p.kind}`)}</div>
                <p className="narrative" style={{ margin: '4px 0' }}>
                  {text}
                </p>
                <div className="muted" style={{ fontSize: 12 }}>
                  Expire le {formatDateFr(p.expiresAt)}
                  {p.hookId ? ' · appuyée par un levier' : ''}
                </div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <ActionButton className="btn-ghost" onClick={() => act({ type: 'proposal.respond', payload: { proposalId: p.id, accept: false } }, 'Proposition refusée')}>
                Refuser
              </ActionButton>
              <ActionButton className="btn-primary" onClick={() => act({ type: 'proposal.respond', payload: { proposalId: p.id, accept: true } }, 'Proposition acceptée', null)}>
                Accepter
              </ActionButton>
            </div>
          </div>
        );
      })}
    </ScreenFrame>
  );
}
