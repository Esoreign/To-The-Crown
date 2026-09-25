import { useMemo, useState } from 'react';
import { CULTURE_BY_ID, FAITH_BY_ID } from '@ttc/content';
import {
  BALANCE,
  TITLE_DEFS,
  ageOf,
  childrenOf,
  directVassals,
  fertilityValue,
  healthLabel,
  healthValue,
  isAdult,
  knownSecretsOf,
  opinionOf,
  parentsOf,
  planSuccession,
  rankOf,
  realmProvinceIds,
  relationsOf,
  siblingsOf,
  stressLevel,
  seatOf,
  topLiegeId,
} from '@ttc/game-core';
import type { Character, GameView, RelationType } from '@ttc/shared';
import { fmt, opinionReason, t, tOr } from '../../lib/i18n';
import { ageText, charName, councilTitle, rulerTitle, styledName, titleName } from '../../lib/format';
import { Breakdown, CoatOfArms, Portrait, ProgressBar, Tip } from '../../ui/common';
import { SkillGrid, TraitList } from '../../ui/char';
import { openCharacter, openTitle } from '../hooks';
import { GROUP_LABEL, acceptanceSummary, interactionsFor, type Interaction, type InteractionGroup } from '../interactions';

function OpinionBadge({ view, of, towards, label }: { view: GameView; of: string; towards: string; label: string }) {
  const op = useMemo(() => opinionOf(view, of, towards), [view, of, towards]);
  return (
    <Tip content={() => <Breakdown title={label} rows={op.rows.map((r) => ({ label: opinionReason(r.reason), value: r.value }))} total={op.total} decimals={0} />}>
      <div className="opinion-badge" tabIndex={0}>
        <span className="muted">{label}</span>
        <span className={`num opinion-value ${op.total > 0 ? 'pos' : op.total < 0 ? 'neg' : ''}`}>
          {op.total > 0 ? '+' : ''}
          {Math.round(op.total)}
        </span>
      </div>
    </Tip>
  );
}

export function AcceptanceTip({ it }: { it: Interaction }) {
  return (
    <div>
      <div className="tooltip-title">{it.label}</div>
      {it.disabled && <div className="neg">Indisponible : {it.disabled}</div>}
      {it.cost && <div className="soft">Coût : {it.cost}</div>}
      {it.toPlayer && <div className="soft">Ce souverain est incarné par un joueur : il décidera lui-même.</div>}
      {it.acceptance && (
        <Breakdown title="Disposition" rows={it.acceptance.rows.map((r) => ({ label: tOr(`accept.${r.key}`, r.key), value: r.value }))} total={it.acceptance.score} decimals={0} />
      )}
    </div>
  );
}

export function InteractionList({ view, me, target }: { view: GameView; me: Character; target: Character }) {
  const list = useMemo(() => interactionsFor(view, me, target), [view, me, target]);
  const groups = [...new Set(list.map((i) => i.group))] as InteractionGroup[];
  if (!list.length) return null;
  return (
    <div className="interactions">
      {groups.map((g) => (
        <div key={g} className="interaction-group">
          <div className="interaction-group-title">{GROUP_LABEL[g]}</div>
          <div className="interaction-buttons">
            {list
              .filter((i) => i.group === g)
              .map((it) => {
                const acc = acceptanceSummary(it.acceptance);
                return (
                  <Tip key={it.id} content={() => <AcceptanceTip it={it} />}>
                    <button className={`interaction-btn${it.danger ? ' danger' : ''}`} disabled={!!it.disabled} onClick={() => void it.run()} data-testid={`interact-${it.id}`}>
                      <span className="interaction-icon" aria-hidden="true">
                        {it.icon}
                      </span>
                      <span className="grow">{it.label}</span>
                      {acc && <span className={`interaction-acc ${acc.tone}`}>{acc.tone === 'pos' ? '✔' : '✘'}</span>}
                    </button>
                  </Tip>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonTile({ view, c, label }: { view: GameView; c: Character | undefined; label?: string }) {
  if (!c) return null;
  return (
    <div className="person-tile">
      <Portrait c={c} view={view} size={46} onClick={() => openCharacter(c.id)} title={charName(view, c)} />
      <div className="person-tile-name">{c.firstName}</div>
      <div className="person-tile-sub muted">{label ?? (c.death !== null ? '†' : `${ageOf(c, view.date)} ans`)}</div>
    </div>
  );
}

const REL_ORDER: RelationType[] = ['soulmate', 'lover', 'best_friend', 'friend', 'mentor', 'ward', 'rival', 'nemesis'];

export function CharacterPanel({ view, me, c }: { view: GameView; me: Character; c: Character }) {
  const [tab, setTab] = useState<'overview' | 'family' | 'relations' | 'titles'>('overview');
  const isMe = c.id === me.id;
  const house = c.houseId ? view.houses[c.houseId] : undefined;
  const liege = c.liegeId ? view.characters[c.liegeId] : undefined;
  const court = c.courtId && c.courtId !== c.id ? view.characters[c.courtId] : undefined;
  const pt = c.titleIds[0];
  const health = healthValue(view, c);
  const stress = stressLevel(c);
  const seat = liege ? seatOf(liege, c.id) : court ? seatOf(court, c.id) : null;

  return (
    <div className="char-panel" data-testid="character-panel">
      <div className="char-header">
        <Portrait c={c} view={view} size={92} showCoa />
        <div className="char-header-info">
          <div className="char-name">{charName(view, c)}</div>
          <div className="char-title">{rulerTitle(c) || (seat ? councilTitle(liege ?? court, seat) : court ? `Cour de ${court.firstName}` : 'Sans terre')}</div>
          <div className="muted char-meta">
            {ageText(c, view.date)} · {CULTURE_BY_ID[c.cultureId] ? t(`culture.${c.cultureId}`) : ''} · {FAITH_BY_ID[c.faithId] ? t(`faith.${c.faithId}`) : ''}
          </div>
          <div className="char-badges">
            {isMe && <span className="badge gold">Vous</span>}
            {c.isPlayer && !isMe && <span className="badge gold">Joueur</span>}
            {c.prisonerOf && <span className="badge danger">Prisonnier de {view.characters[c.prisonerOf]?.firstName}</span>}
            {me.nominatedHeirId === c.id && <span className="badge good">Héritier désigné</span>}
            {c.pregnancy && <span className="badge">Enceinte</span>}
          </div>
        </div>
        {pt && (
          <button className="char-coa" onClick={() => openTitle(pt)} aria-label={titleName(pt)}>
            <CoatOfArms seed={TITLE_DEFS[pt]?.coaSeed ?? 1} rank={rankOf(c)} size={44} />
          </button>
        )}
      </div>
      <div className="tabs">
        {(
          [
            ['overview', 'Aperçu'],
            ['family', 'Famille'],
            ['relations', 'Relations'],
            ['titles', 'Titres'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel-scroll">
        {tab === 'overview' && (
          <>
            <SkillGrid c={c} view={view} />
            <div className="vitals">
              <Tip content={() => <div>Santé : {fmt(health, 1)} / 10</div>}>
                <div className="vital" tabIndex={0}>
                  <span className="muted">Santé</span>
                  <span className={health < 3 ? 'neg' : health >= 6 ? 'pos' : ''}>{t(`health.${healthLabel(health)}`)}</span>
                </div>
              </Tip>
              <Tip content={() => <div>Stress : {Math.round(c.stress)} / {BALANCE.stress.max}. À chaque palier ({BALANCE.stress.levels.join(', ')}), une crise et ses séquelles.</div>}>
                <div className="vital" tabIndex={0}>
                  <span className="muted">Stress</span>
                  <span className={stress >= 2 ? 'neg' : ''}>{t(`stress.${stress}`)}</span>
                  <ProgressBar value={c.stress} max={BALANCE.stress.max} danger={stress >= 2} />
                </div>
              </Tip>
              <div className="vital">
                <span className="muted">Fertilité</span>
                <span>{isAdult(c, view.date) ? `${Math.round(fertilityValue(view, c) * 100)} %` : '—'}</span>
              </div>
              {c.titleIds.length > 0 && (
                <div className="vital">
                  <span className="muted">Or</span>
                  <span className="num">{fmt(c.gold)}</span>
                </div>
              )}
            </div>
            <h3 className="section-title">Traits</h3>
            <TraitList c={c} />
            {c.education && (
              <div className="info-line" style={{ marginTop: 8 }}>
                <span>Éducation</span>
                <span>
                  {t(`skill.${c.education.focus}`)} · {Math.round(c.education.progress)} %{c.education.tutorId ? ` · ${view.characters[c.education.tutorId]?.firstName ?? ''}` : ''}
                </span>
              </div>
            )}
            {!isMe && (
              <>
                <h3 className="section-title">Opinions</h3>
                <div className="row" style={{ gap: 8 }}>
                  <OpinionBadge view={view} of={c.id} towards={me.id} label="Envers vous" />
                  <OpinionBadge view={view} of={me.id} towards={c.id} label="Votre opinion" />
                </div>
                <h3 className="section-title">Interactions</h3>
                <InteractionList view={view} me={me} target={c} />
              </>
            )}
          </>
        )}
        {tab === 'family' && <FamilyTab view={view} c={c} />}
        {tab === 'relations' && <RelationsTab view={view} me={me} c={c} />}
        {tab === 'titles' && <TitlesTab view={view} c={c} liege={liege} />}
      </div>
      {house && (
        <div className="char-footer muted">
          Maison {house.name} · <em>{house.motto}</em>
        </div>
      )}
    </div>
  );
}

function FamilyTab({ view, c }: { view: GameView; c: Character }) {
  const parents = parentsOf(view, c);
  const spouse = c.spouseId ? view.characters[c.spouseId] : undefined;
  const betrothed = c.betrothedId ? view.characters[c.betrothedId] : undefined;
  const kids = childrenOf(view, c, false);
  const sibs = siblingsOf(view, c, false);
  const former = c.formerSpouseIds.map((id) => view.characters[id]).filter((x): x is Character => !!x);
  const Group = ({ title, list, label }: { title: string; list: (Character | undefined)[]; label?: (x: Character) => string }) =>
    list.filter(Boolean).length ? (
      <>
        <h3 className="section-title">{title}</h3>
        <div className="person-grid">
          {list.filter((x): x is Character => !!x).map((x) => (
            <PersonTile key={x.id} view={view} c={x} label={label?.(x)} />
          ))}
        </div>
      </>
    ) : null;
  return (
    <>
      <Group title="Parents" list={parents} />
      <Group title="Conjoint" list={[spouse]} />
      <Group title="Fiançailles" list={[betrothed]} />
      <Group title="Enfants" list={kids} />
      <Group title="Frères et sœurs" list={sibs} />
      <Group title="Anciens conjoints" list={former} />
      {!parents.length && !spouse && !kids.length && !sibs.length && <div className="muted">Aucune famille connue.</div>}
    </>
  );
}

function RelationsTab({ view, me, c }: { view: GameView; me: Character; c: Character }) {
  const rels = REL_ORDER.flatMap((type) => relationsOf(view, c.id, type).map((id) => ({ type, other: view.characters[id] })));
  const secrets = knownSecretsOf(view, me.id).filter((s) => s.ownerId === c.id);
  const hooks = Object.values(view.hooks).filter((h) => (h.ownerId === me.id && h.targetId === c.id) || (h.ownerId === c.id && h.targetId === me.id));
  const claims = Object.values(view.claims).filter((cl) => cl.characterId === c.id);
  return (
    <>
      <h3 className="section-title">Liens personnels</h3>
      {rels.length === 0 && <div className="muted">Aucun lien notable.</div>}
      {rels.map((r) => (
        <div key={`${r.type}-${r.other?.id}`} className="info-line">
          <span>{t(`relation.${r.type}`)}</span>
          <button className="link-btn" onClick={() => r.other && openCharacter(r.other.id)}>
            {charName(view, r.other)}
          </button>
        </div>
      ))}
      <h3 className="section-title">Secrets connus</h3>
      {secrets.length === 0 && <div className="muted">Vous ne connaissez aucun secret de ce personnage.</div>}
      {secrets.map((s) => (
        <div key={s.id} className="info-line">
          <span>{t(`secret.${s.type}`)}</span>
          <span className={s.exposed ? 'muted' : 'gold'}>{s.exposed ? 'Révélé' : 'Caché'}</span>
        </div>
      ))}
      {hooks.length > 0 && (
        <>
          <h3 className="section-title">Leviers</h3>
          {hooks.map((h) => (
            <div key={h.id} className="info-line">
              <span>{h.ownerId === me.id ? 'Vous tenez un levier' : 'Ce personnage vous tient'}</span>
              <span className={h.strong ? 'gold' : ''}>{h.strong ? 'Fort' : 'Faible'}</span>
            </div>
          ))}
        </>
      )}
      {claims.length > 0 && (
        <>
          <h3 className="section-title">Revendications</h3>
          {claims.map((cl) => (
            <div key={cl.id} className="info-line">
              <button className="link-btn" onClick={() => openTitle(cl.titleId)}>
                {titleName(cl.titleId)}
              </button>
              <span>
                {t(`claim.${cl.kind}`)} · {tOr(`claim.origin.${cl.origin}`, cl.origin)}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function TitlesTab({ view, c, liege }: { view: GameView; c: Character; liege: Character | undefined }) {
  const vassals = directVassals(view, c.id).filter((v) => v.titleIds.length);
  const top = topLiegeId(view, c.id);
  const plan = useMemo(() => (c.titleIds.length ? planSuccession(view, c) : null), [view, c]);
  const heir = plan?.primaryHeirId ? view.characters[plan.primaryHeirId] : undefined;
  return (
    <>
      {liege && (
        <div className="info-line">
          <span>Suzerain</span>
          <button className="link-btn" onClick={() => openCharacter(liege.id)}>
            {styledName(view, liege)}
          </button>
        </div>
      )}
      {top !== c.id && top !== liege?.id && (
        <div className="info-line">
          <span>Souverain</span>
          <button className="link-btn" onClick={() => openCharacter(top)}>
            {charName(view, view.characters[top])}
          </button>
        </div>
      )}
      {c.titleIds.length > 0 && (
        <>
          <div className="info-line">
            <span>Comtés du royaume</span>
            <span className="num">{realmProvinceIds(view, c.id).length}</span>
          </div>
          <div className="info-line">
            <span>Héritier principal</span>
            {heir ? (
              <button className="link-btn" onClick={() => openCharacter(heir.id)}>
                {charName(view, heir)}
              </button>
            ) : (
              <span className="neg">Aucun</span>
            )}
          </div>
        </>
      )}
      <h3 className="section-title">Titres</h3>
      {c.titleIds.length === 0 && <div className="muted">Aucun titre.</div>}
      <div className="title-list">
        {c.titleIds.map((tid) => (
          <button key={tid} className="title-row" onClick={() => openTitle(tid)}>
            <CoatOfArms seed={TITLE_DEFS[tid]?.coaSeed ?? 1} rank={0} size={22} />
            <span className="grow">{titleName(tid)}</span>
            <span className="muted">{t(`rank.${TITLE_DEFS[tid]?.rank}`)}</span>
          </button>
        ))}
      </div>
      {vassals.length > 0 && (
        <>
          <h3 className="section-title">Vassaux ({vassals.length})</h3>
          <div className="person-grid">
            {vassals.map((v) => (
              <PersonTile key={v.id} view={view} c={v} label={titleName(v.titleIds[0])} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
