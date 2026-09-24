import { useMemo, useState } from 'react';
import { TITLE_DEFS, childrenOf, dynastyMembers, houseMembers, parentsOf, planSuccession, primogenitureLine, siblingsOf } from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { fmt, t } from '../../lib/i18n';
import { charName, rulerTitle, titleName } from '../../lib/format';
import { CoatOfArms, Portrait } from '../../ui/common';
import { act, openCharacter } from '../hooks';
import { ScreenFrame } from './ScreenHost';

function TreeNode({ view, c, focus, onFocus, meId }: { view: GameView; c: Character; focus: boolean; onFocus(id: string): void; meId: string }) {
  const spouse = c.spouseId ? view.characters[c.spouseId] : undefined;
  return (
    <div className={`tree-node${focus ? ' focus' : ''}${c.id === meId ? ' me' : ''}`}>
      <Portrait c={c} view={view} size={focus ? 64 : 48} onClick={() => onFocus(c.id)} title={charName(view, c)} />
      <div className="tree-name">{c.firstName}</div>
      <div className="tree-sub muted">{c.death !== null ? '†' : rulerTitle(c) || `${Math.floor((view.date - c.birth) / 365)} ans`}</div>
      {focus && spouse && (
        <div className="tree-spouse">
          <span className="muted">❤</span>
          <Portrait c={spouse} view={view} size={40} onClick={() => openCharacter(spouse.id)} title={charName(view, spouse)} />
        </div>
      )}
    </div>
  );
}

function FamilyTree({ view, me }: { view: GameView; me: Character }) {
  const [focusId, setFocus] = useState(me.id);
  const focus = view.characters[focusId] ?? me;
  const parents = parentsOf(view, focus);
  const grand = parents.flatMap((p) => parentsOf(view, p));
  const siblings = siblingsOf(view, focus, false);
  const kids = childrenOf(view, focus, false);
  const grandkids = kids.flatMap((k) => childrenOf(view, k, false));
  const rows: { label: string; list: Character[] }[] = [
    { label: 'Grands-parents', list: grand },
    { label: 'Parents', list: parents },
    { label: 'Génération', list: [...siblings.filter((s) => s.birth < focus.birth), focus, ...siblings.filter((s) => s.birth >= focus.birth)] },
    { label: 'Enfants', list: kids },
    { label: 'Petits-enfants', list: grandkids },
  ];
  return (
    <div className="family-tree">
      <div className="row spread" style={{ marginBottom: 6 }}>
        <span className="muted">Cliquez un portrait pour recentrer l’arbre ; « fiche » ouvre le personnage.</span>
        {focusId !== me.id && (
          <button className="btn btn-sm" onClick={() => setFocus(me.id)}>
            Revenir à vous
          </button>
        )}
      </div>
      {rows.map((r) =>
        r.list.length ? (
          <div key={r.label} className="tree-row">
            <div className="tree-label">{r.label}</div>
            <div className="tree-members">
              {r.list.map((c) => (
                <div key={c.id} className="tree-cell">
                  <TreeNode view={view} c={c} focus={c.id === focus.id} onFocus={setFocus} meId={me.id} />
                  <button className="link-btn tree-open" onClick={() => openCharacter(c.id)}>
                    fiche
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function Succession({ view, me }: { view: GameView; me: Character }) {
  const plan = useMemo(() => planSuccession(view, me), [view, me]);
  const line = useMemo(() => primogenitureLine(view, me, 8), [view, me]);
  const heir = plan.primaryHeirId ? view.characters[plan.primaryHeirId] : undefined;
  const pt = me.titleIds[0];
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="succession-head">
        {heir ? (
          <>
            <Portrait c={heir} view={view} size={80} onClick={() => openCharacter(heir.id)} />
            <div>
              <div className="muted">Héritier principal</div>
              <div className="display" style={{ fontSize: 20 }}>
                {charName(view, heir)}
              </div>
              <div className="soft">
                {Math.floor((view.date - heir.birth) / 365)} ans · {pt ? t(`law.${view.titles[pt]?.successionLaw}`) : ''}
              </div>
            </div>
          </>
        ) : (
          <div className="neg display">Aucun héritier : à votre mort, votre dynastie perdra ses terres.</div>
        )}
      </div>
      {Object.keys(plan.titles).length > 0 && (
        <>
          <h3 className="section-title">Répartition des titres</h3>
          {Object.entries(plan.titles).map(([tid, hid]) => (
            <div key={tid} className="info-line">
              <span>
                <CoatOfArms seed={TITLE_DEFS[tid]?.coaSeed ?? 1} size={16} /> {titleName(tid)}
              </span>
              <span>{hid ? view.characters[hid]?.firstName : <span className="neg">sans héritier</span>}</span>
            </div>
          ))}
          {plan.heirs.length > 1 && <p className="neg" style={{ fontSize: 13 }}>La loi de partage divisera votre héritage entre {plan.heirs.length} héritiers.</p>}
        </>
      )}
      {plan.election && (
        <>
          <h3 className="section-title">Élection en cours</h3>
          {plan.election.map((e) => (
            <div key={e.candidateId} className="info-line">
              <button className="link-btn" onClick={() => openCharacter(e.candidateId)}>
                {charName(view, view.characters[e.candidateId])}
              </button>
              <span className="num">{e.votes} voix</span>
            </div>
          ))}
          {pt && (
            <div className="muted" style={{ fontSize: 12.5 }}>
              Vous pouvez soutenir un candidat :{' '}
              {plan.election.slice(0, 4).map((e) => (
                <button key={e.candidateId} className="btn btn-sm" style={{ marginRight: 4 }} onClick={() => void act({ type: 'succession.vote', payload: { titleId: pt, candidateId: e.candidateId } }, 'Vote enregistré')}>
                  {view.characters[e.candidateId]?.firstName}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <h3 className="section-title">Ordre dynastique</h3>
      {line.map((c, i) => (
        <div key={c.id} className="info-line">
          <span>
            {i + 1}.{' '}
            <button className="link-btn" onClick={() => openCharacter(c.id)}>
              {charName(view, c)}
            </button>
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="muted">{Math.floor((view.date - c.birth) / 365)} ans</span>
            {me.nominatedHeirId === c.id ? (
              <span className="badge good">désigné</span>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={() => void act({ type: 'character.designateHeir', payload: { heirId: c.id } }, `${c.firstName} est désigné héritier`)}>
                Désigner
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DynastyScreen({ view, me }: { view: GameView; me: Character }) {
  const [tab, setTab] = useState<'tree' | 'succession' | 'house'>('tree');
  const house = me.houseId ? view.houses[me.houseId] : undefined;
  const dynasty = house ? view.dynasties[house.dynastyId] : undefined;
  const members = house ? houseMembers(view, house.id) : [];
  const dynMembers = dynasty ? dynastyMembers(view, dynasty.id) : [];
  return (
    <ScreenFrame title={house ? `Maison ${house.name}` : 'Dynastie'} icon="❦" wide>
      <div className="tabs">
        {(
          [
            ['tree', 'Arbre familial'],
            ['succession', 'Succession'],
            ['house', 'Maison et dynastie'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'tree' && <FamilyTree view={view} me={me} />}
      {tab === 'succession' && <Succession view={view} me={me} />}
      {tab === 'house' && house && (
        <div className="col" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 16 }}>
            <CoatOfArms seed={house.coaSeed} rank={0} size={80} />
            <div>
              <div className="display" style={{ fontSize: 22, color: 'var(--color-gold-300)' }}>
                Maison {house.name}
              </div>
              <div className="narrative soft">« {house.motto} »</div>
              <div className="muted">
                Dynastie {dynasty?.name} · renommée {fmt(dynasty?.renown ?? 0)} · {members.length} membres vivants · {dynMembers.length} dans la dynastie
              </div>
            </div>
          </div>
          {house.history && <p className="narrative">{house.history}</p>}
          {dynasty && dynasty.houseIds.length > 1 && (
            <>
              <h3 className="section-title">Branches</h3>
              {dynasty.houseIds.map((hid) => {
                const h = view.houses[hid];
                const head = h?.headId ? view.characters[h.headId] : undefined;
                return h ? (
                  <div key={hid} className="info-line">
                    <span>Maison {h.name}</span>
                    <span>{head ? head.firstName : '—'}</span>
                  </div>
                ) : null;
              })}
            </>
          )}
          <h3 className="section-title">Membres vivants</h3>
          <div className="person-grid">
            {members.map((c) => (
              <div key={c.id} className="person-tile">
                <Portrait c={c} view={view} size={46} onClick={() => openCharacter(c.id)} title={charName(view, c)} />
                <div className="person-tile-name">{c.firstName}</div>
                <div className="person-tile-sub muted">{rulerTitle(c) || `${Math.floor((view.date - c.birth) / 365)} ans`}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}
