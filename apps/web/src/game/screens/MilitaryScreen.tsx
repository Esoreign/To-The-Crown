import { useState } from 'react';
import { CONTENT } from '@ttc/content';
import {
  PROVINCE_GEO,
  armyMen,
  armyUpkeep,
  availableLevies,
  capitalProvinceOf,
  militaryStrength,
  sideOf,
  warsOf,
} from '@ttc/game-core';
import type { Character, GameView, UnitType } from '@ttc/shared';
import { fmt, t, tOr } from '../../lib/i18n';
import { ActionButton, Tip, contentGlyph } from '../../ui/common';
import { act, openArmy, openWar } from '../hooks';
import { useUi } from '../../state/ui';
import { ScreenFrame } from './ScreenHost';

const RECRUITABLE = CONTENT.units.filter((u) => u.id !== ('levy' as UnitType));

export function MilitaryScreen({ view, me }: { view: GameView; me: Character }) {
  const [men, setMen] = useState(200);
  const levies = availableLevies(view, me);
  const upkeep = armyUpkeep(view, me);
  const armies = Object.values(view.armies).filter((a) => a.ownerId === me.id);
  const wars = warsOf(view, me.id);
  const maaTotal = Object.values(me.maa).reduce((s, v) => s + (v ?? 0), 0);
  const cap = capitalProvinceOf(me);

  return (
    <ScreenFrame title="Armées" icon="⚔" wide>
      <div className="military-summary">
        <div className="prov-stat">
          <span className="k">Puissance totale</span>
          <span className="v num">{fmt(militaryStrength(view, me))}</span>
        </div>
        <div className="prov-stat">
          <span className="k">Levées disponibles</span>
          <span className="v num">{fmt(levies.total)}</span>
        </div>
        <div className="prov-stat">
          <span className="k">Hommes d’armes</span>
          <span className="v num">{fmt(maaTotal)}</span>
        </div>
        <div className="prov-stat">
          <span className="k">Entretien / mois</span>
          <span className="v num neg">{fmt(upkeep.levies + upkeep.maa, 1)}</span>
        </div>
        <ActionButton
          className="btn-primary"
          disabled={!cap}
          onClick={() => act({ type: 'army.raise', payload: {} }, 'Les levées se rassemblent', 'war')}
        >
          ⚔ Lever l’ost
        </ActionButton>
      </div>
      <div className="intrigue-grid">
        <section>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Armées en campagne ({armies.length})
          </h3>
          {armies.length === 0 && (
            <p className="muted">Aucune armée levée. Les levées en campagne coûtent de l’or chaque mois.</p>
          )}
          {armies.map((a) => (
            <button
              key={a.id}
              className="title-row"
              onClick={() => {
                openArmy(a.id);
                useUi.getState().focusProvince(a.location);
                useUi.getState().openScreen(null);
              }}
            >
              <span className="grow">
                {a.commanderId ? view.characters[a.commanderId]?.firstName : 'Sans commandant'} ·{' '}
                {PROVINCE_GEO[a.location]?.name}
              </span>
              <span className="muted">{t(`army.${a.status}`)}</span>
              <span className="num">{fmt(armyMen(a))}</span>
            </button>
          ))}
          <h3 className="section-title">Guerres ({wars.length})</h3>
          {wars.length === 0 && <p className="muted">La paix règne.</p>}
          {wars.map((w) => {
            const side = sideOf(w, me.id);
            const score = side === 'attacker' ? w.warScore : -w.warScore;
            return (
              <button key={w.id} className="title-row" onClick={() => openWar(w.id)}>
                <span className="grow">
                  {t(`cb.${w.cb}`)} : {view.characters[w.attackerId]?.firstName} contre{' '}
                  {view.characters[w.defenderId]?.firstName}
                </span>
                <span className={`num ${score >= 0 ? 'pos' : 'neg'}`}>
                  {score > 0 ? '+' : ''}
                  {Math.round(score)} %
                </span>
              </button>
            );
          })}
        </section>
        <section>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Hommes d’armes
          </h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
            Troupes professionnelles permanentes, plus efficaces que les levées. Elles rejoignent chaque armée
            levée.
          </p>
          <div className="setting-row">
            <label htmlFor="maa-men">Effectif</label>
            <input
              id="maa-men"
              type="range"
              min={100}
              max={1000}
              step={100}
              value={men}
              onChange={(e) => setMen(Number(e.target.value))}
            />
            <span className="num">{men}</span>
          </div>
          {RECRUITABLE.map((u) => {
            const cost = Math.round((men / 100) * u.cost);
            return (
              <div key={u.id} className="unit-row">
                <Tip
                  content={() => (
                    <div>
                      <div className="tooltip-title">{t(`unit.${u.id}`)}</div>
                      <div>
                        Dégâts {u.damage} · Robustesse {u.toughness} · Poursuite {u.pursuit} · Écran{' '}
                        {u.screen}
                      </div>
                      {u.siege ? <div>Siège {u.siege}</div> : null}
                      {u.counters?.length ? (
                        <div className="pos">Contre : {u.counters.map((c) => t(`unit.${c}`)).join(', ')}</div>
                      ) : null}
                      {u.goodTerrain?.length ? (
                        <div className="pos">
                          À l’aise : {u.goodTerrain.map((x) => tOr(`terrain.${x}`, x)).join(', ')}
                        </div>
                      ) : null}
                      {u.badTerrain?.length ? (
                        <div className="neg">
                          Gêné : {u.badTerrain.map((x) => tOr(`terrain.${x}`, x)).join(', ')}
                        </div>
                      ) : null}
                      <div className="muted">Entretien : {u.upkeep} or / 100 hommes / mois</div>
                    </div>
                  )}
                >
                  <span className="grow" tabIndex={0}>
                    <span aria-hidden="true">{contentGlyph(u.icon)}</span> {t(`unit.${u.id}`)}{' '}
                    <span className="muted num">({fmt(me.maa[u.id] ?? 0)})</span>
                  </span>
                </Tip>
                <ActionButton
                  className="btn-sm"
                  disabled={me.gold < cost}
                  onClick={() =>
                    act(
                      { type: 'army.recruit', payload: { unit: u.id as Exclude<UnitType, 'levy'>, men } },
                      `${men} ${t(`unit.${u.id}`)} recrutés`,
                      'coin',
                    )
                  }
                >
                  Recruter · <span className="num">{fmt(cost)} or</span>
                </ActionButton>
              </div>
            );
          })}
        </section>
      </div>
    </ScreenFrame>
  );
}
