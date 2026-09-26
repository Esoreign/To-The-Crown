import { useMemo, useState } from 'react';
import { getScenario, CULTURE_BY_ID, FAITH_BY_ID } from '@ttc/content';
import {
  TITLE_DEFS,
  ageOf,
  capitalProvinceOf,
  directVassals,
  governmentOf,
  holderOfProvince,
  isExternalPact,
  pactsAsSubject,
  militaryStrength,
  planSuccession,
  primaryTitleId,
  rankOf,
  realmProvinceIds,
  topLiegeOfProvince,
} from '@ttc/game-core';
import type { Character, GameView, RecommendedStart } from '@ttc/shared';
import { MapView } from '../map/MapView';
import { scenarioView } from '../map/scenarioView';
import { api, ApiFailure } from '../net/api';
import { useRouter } from '../lib/router';
import { errorMessage, fmt, t } from '../lib/i18n';
import { charName, rulerTitle, styledName, titleName } from '../lib/format';
import { playSound } from '../audio/audio';
import { CoatOfArms, Portrait } from '../ui/common';
import { SkillGrid, TraitList } from '../ui/char';

const SCENARIO = getScenario('monde_1400');

export function RulerSheet({
  view,
  c,
  rec,
  onPick,
}: {
  view: GameView;
  c: Character;
  rec?: RecommendedStart;
  onPick(id: string): void;
}) {
  const pt = primaryTitleId(c);
  const polityId = pt ? TITLE_DEFS[pt]?.polityId : undefined;
  const polity = polityId ? SCENARIO.polities?.[polityId] : undefined;
  const gov = governmentOf(c);
  const bonds = pactsAsSubject(view, c.id);
  const house = c.houseId ? view.houses[c.houseId] : undefined;
  const counties = realmProvinceIds(view, c.id).length;
  const plan = useMemo(() => planSuccession(view, c), [view, c]);
  const heirId = plan.primaryHeirId;
  const heir = heirId ? view.characters[heirId] : undefined;
  const spouse = c.spouseId ? view.characters[c.spouseId] : undefined;
  const liege = c.liegeId ? view.characters[c.liegeId] : undefined;
  const vassals = directVassals(view, c.id).filter((v) => v.titleIds.length > 0);
  return (
    <div className="ruler-sheet">
      <div className="ruler-head">
        <Portrait c={c} view={view} size={96} showCoa />
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <div className="ruler-name">{charName(view, c)}</div>
          <div className="ruler-title">{rulerTitle(c)}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {ageOf(c, view.date)} ans ·{' '}
            {CULTURE_BY_ID[c.cultureId] ? t(`culture.${c.cultureId}`) : c.cultureId} ·{' '}
            {FAITH_BY_ID[c.faithId] ? t(`faith.${c.faithId}`) : c.faithId}
          </div>
          {rec && (
            <div>
              <span className={`diff-badge diff-${rec.difficulty}`} style={{ marginLeft: 0 }}>
                {t(`difficulty.${rec.difficulty}`)}
              </span>
            </div>
          )}
        </div>
        {pt && (
          <CoatOfArms seed={TITLE_DEFS[pt]?.coaSeed ?? 1} rank={rankOf(c)} size={52} title={titleName(pt)} />
        )}
      </div>
      {rec && (
        <>
          <p className="narrative gold" style={{ fontStyle: 'italic', margin: '12px 0 4px' }}>
            {rec.tagline}
          </p>
          <p className="narrative soft" style={{ margin: '0 0 8px' }}>
            {rec.description}
          </p>
        </>
      )}
      <SkillGrid c={c} view={view} />
      <h3 className="section-title">Traits</h3>
      <TraitList c={c} />
      <h3 className="section-title">Situation</h3>
      {gov && (
        <div className="info-line">
          <span>Gouvernement</span>
          <span>{t(`government.${gov.id}`)}</span>
        </div>
      )}
      {bonds.map((p) => (
        <div key={p.id} className="info-line">
          <span>{t(`subject.${p.type}`)}</span>
          <span>
            {titleName(p.overlordTitleId)}
            {isExternalPact(p) ? ` · tribut ${Math.round(p.tribute * 100)} %` : ''}
          </span>
        </div>
      ))}
      <div className="info-line">
        <span>Maison</span>
        <span>{house?.name ?? '—'}</span>
      </div>
      <div className="info-line">
        <span>Comtés</span>
        <span className="num">{counties}</span>
      </div>
      <div className="info-line">
        <span>Trésor</span>
        <span className="num">{fmt(c.gold)} or</span>
      </div>
      <div className="info-line">
        <span>Puissance militaire</span>
        <span className="num">{fmt(militaryStrength(view, c))} hommes</span>
      </div>
      <div className="info-line">
        <span>Succession</span>
        <span>{pt ? t(`law.${view.titles[pt]?.successionLaw ?? 'partition'}`) : '—'}</span>
      </div>
      <div className="info-line">
        <span>Héritier</span>
        <span>
          {heir ? `${heir.firstName} (${ageOf(heir, view.date)} ans)` : <span className="neg">Aucun</span>}
        </span>
      </div>
      <div className="info-line">
        <span>Conjoint</span>
        <span>{spouse ? spouse.firstName : 'Aucun'}</span>
      </div>
      {liege && (
        <div className="info-line">
          <span>Suzerain</span>
          <button className="link-btn" onClick={() => onPick(liege.id)}>
            {charName(view, liege)}
          </button>
        </div>
      )}
      {rec && (
        <>
          <h3 className="section-title">Difficultés</h3>
          <ul className="soft" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {rec.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <h3 className="section-title">Objectif suggéré</h3>
          <p className="soft" style={{ margin: 0, fontSize: 13 }}>
            {rec.objective}
          </p>
        </>
      )}
      {polity && (
        <>
          <h3 className="section-title">Repères historiques</h3>
          <div>
            <span className={`badge confidence-${polity.confidence}`} data-testid="polity-confidence">
              {t(`confidence.${polity.confidence}`)}
            </span>
          </div>
          {polity.note && (
            <p className="soft" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {polity.note}
            </p>
          )}
        </>
      )}
      {vassals.length > 0 && (
        <>
          <h3 className="section-title">Vassaux jouables</h3>
          <div className="col" style={{ gap: 2 }}>
            {vassals.slice(0, 12).map((v) => (
              <button
                key={v.id}
                className="link-btn"
                style={{ textAlign: 'left' }}
                onClick={() => onPick(v.id)}
              >
                {styledName(view, v)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function NewGameScreen() {
  const go = useRouter((s) => s.go);
  const scenario = useMemo(() => getScenario('monde_1400'), []);
  const view = useMemo(() => scenarioView(scenario), [scenario]);
  const [selected, setSelected] = useState<string>(scenario.recommended[0]!.characterId);
  const [name, setName] = useState('');
  const [aiDifficulty, setAi] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [eventFrequency, setFreq] = useState<'low' | 'normal' | 'high'>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState<{
    provinceId: string;
    at: number;
    zoom?: number;
    realmOf?: string;
  } | null>(() => {
    // Ouvre la carte sur le premier royaume conseillé.
    const first = view.characters[scenario.recommended[0]!.characterId];
    const cap = first ? capitalProvinceOf(first) : null;
    return cap && first ? { provinceId: cap, at: 0, realmOf: first.id } : null;
  });

  const c = view.characters[selected];
  const rec = scenario.recommended.find((r) => r.characterId === selected);
  const realm = useMemo(() => (c ? realmProvinceIds(view, c.id) : []), [view, c]);

  const pick = (id: string, center = true) => {
    const ch = view.characters[id];
    if (!ch || ch.titleIds.length === 0) return;
    playSound('click');
    setSelected(id);
    const cap = capitalProvinceOf(ch);
    if (center && cap) setFocus({ provinceId: cap, at: performance.now(), realmOf: id });
  };

  async function start() {
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ id: string; status: string }>('POST', '/api/games', {
        name: name.trim() || `Saga de ${c.firstName}`.slice(0, 48),
        mode: 'solo',
        characterId: c.id,
        maxPlayers: 1,
        settings: { maxSpeed: 3, autosave: true, aiDifficulty, eventFrequency, visibility: 'private' },
      });
      playSound('fanfare');
      go({ name: 'game', id: res.id });
    } catch (e) {
      setError(e instanceof ApiFailure ? errorMessage(e.code, e.message) : 'Erreur inattendue');
      setBusy(false);
    }
  }

  return (
    <div className="newgame-screen">
      <aside className="newgame-side">
        <header>
          <button className="btn btn-ghost btn-sm" onClick={() => go({ name: 'title' })}>
            ← Retour
          </button>
          <h2 style={{ marginTop: 10 }}>{scenario.name}</h2>
          <p className="narrative soft" style={{ margin: '6px 0 0', fontSize: 15 }}>
            {scenario.intro}
          </p>
        </header>
        <div className="start-list" role="listbox" aria-label="Souverains recommandés">
          {scenario.recommended.map((r) => {
            const ch = view.characters[r.characterId];
            if (!ch) return null;
            return (
              <button
                key={r.characterId}
                role="option"
                aria-selected={selected === r.characterId}
                className={`start-card${selected === r.characterId ? ' active' : ''}`}
                onClick={() => pick(r.characterId)}
                data-testid={`start-${r.characterId}`}
                data-polity={TITLE_DEFS[primaryTitleId(ch) ?? '']?.polityId}
              >
                <Portrait c={ch} view={view} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div className="start-name">
                    {ch.firstName}
                    <span className={`diff-badge diff-${r.difficulty}`}>
                      {t(`difficulty.${r.difficulty}`)}
                    </span>
                  </div>
                  <div className="start-sub">{rulerTitle(ch)}</div>
                  <div
                    className="muted"
                    style={{
                      fontSize: 11.5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {r.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="newgame-map">
        <MapView
          styleMode="parchment"
          view={view}
          mapMode="political"
          className="map-host"
          selectedProvince={c ? capitalProvinceOf(c) : null}
          highlight={realm}
          focus={focus}
          onClick={(pid) => {
            if (!pid) return;
            // Premier clic : le souverain indépendant ; clic dans son royaume : le vassal local.
            const top = topLiegeOfProvince(view, pid);
            const holder = holderOfProvince(view, pid);
            if (top && top !== selected && !realm.includes(pid)) pick(top, false);
            else if (holder) pick(holder, false);
          }}
        />
        <div className="newgame-hint">Choisissez un souverain sur la carte ou dans la liste</div>
      </main>
      <aside className="newgame-side right">
        {c ? (
          <RulerSheet view={view} c={c} rec={rec} onPick={(id) => pick(id)} />
        ) : (
          <div className="ruler-sheet muted">Aucun souverain choisi.</div>
        )}
        <div className="newgame-footer">
          <div className="field">
            <label htmlFor="game-name">Nom de la partie</label>
            <input
              id="game-name"
              className="input"
              maxLength={48}
              placeholder={c ? `Saga de ${c.firstName}` : ''}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field grow">
              <label htmlFor="ai-diff">IA</label>
              <select
                id="ai-diff"
                className="input"
                value={aiDifficulty}
                onChange={(e) => setAi(e.target.value as typeof aiDifficulty)}
              >
                <option value="easy">Clémente</option>
                <option value="normal">Normale</option>
                <option value="hard">Impitoyable</option>
              </select>
            </div>
            <div className="field grow">
              <label htmlFor="ev-freq">Événements</label>
              <select
                id="ev-freq"
                className="input"
                value={eventFrequency}
                onChange={(e) => setFreq(e.target.value as typeof eventFrequency)}
              >
                <option value="low">Rares</option>
                <option value="normal">Normaux</option>
                <option value="high">Fréquents</option>
              </select>
            </div>
          </div>
          <div className="form-error" role="alert">
            {error}
          </div>
          <button
            className={`btn btn-primary btn-lg btn-block${busy ? ' loading' : ''}`}
            disabled={!c || busy}
            onClick={start}
            data-testid="start-game"
          >
            Prendre la couronne
          </button>
        </div>
      </aside>
    </div>
  );
}
