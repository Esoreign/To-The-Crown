import { useMemo } from 'react';
import { CONTENT } from '@ttc/content';
import {
  PROVINCE_GEO,
  armyMen,
  buildOptions,
  developmentGrowth,
  domainProvinceIds,
  fortLevel,
  holderOfProvince,
  maxGarrison,
  provinceMaxLevies,
  provinceModifierRows,
  provinceTax,
  supplyLimit,
  topLiegeOfProvince,
} from '@ttc/game-core';
import type { Character, GameView, ModifierKey } from '@ttc/shared';
import { fmt, t, tOr } from '../../lib/i18n';
import { charName, styledName } from '../../lib/format';
import { TERRAIN_COLORS } from '../../map/colors';
import { ActionButton, Breakdown, Portrait, ProgressBar, Tip, contentGlyph } from '../../ui/common';
import { act, openArmy, openCharacter } from '../hooks';

const BUILDING_BY_ID = Object.fromEntries(CONTENT.buildings.map((b) => [b.id, b]));

export function sourceLabel(src: string): string {
  if (src === 'holder') return 'Seigneur du lieu';
  return tOr(src, tOr(`modifier.${src}`, src.replace(/^[a-z]+\./, '').replace(/_/g, ' ')));
}

function ModTip({ view, pid, keyName, title }: { view: GameView; pid: string; keyName: ModifierKey; title: string }) {
  const rows = provinceModifierRows(view, pid, keyName);
  return <Breakdown title={title} rows={rows.map((r) => ({ label: sourceLabel(r.source), value: r.value }))} decimals={2} />;
}

/** Info-bulle de survol d'une province sur la carte. */
export function ProvinceTooltip({ view, provinceId }: { view: GameView; provinceId: string }) {
  const geo = PROVINCE_GEO[provinceId];
  if (!geo) return null;
  const holder = view.characters[holderOfProvince(view, provinceId) ?? ''];
  const top = view.characters[topLiegeOfProvince(view, provinceId) ?? ''];
  const p = view.provinces[provinceId];
  const occ = view.titles[geo.countyTitleId]?.occupiedBy;
  return (
    <div>
      <div className="tooltip-title">{geo.name}</div>
      <div className="soft">
        {t(`terrain.${geo.terrain}`)} · {t(`culture.${p?.cultureId ?? geo.cultureId}`)} · {t(`faith.${p?.faithId ?? geo.faithId}`)}
      </div>
      {holder && (
        <div>
          {styledName(view, holder)}
        </div>
      )}
      {top && top.id !== holder?.id && <div className="muted">Royaume de {top.firstName}</div>}
      {p && (
        <div className="muted num">
          Dév. {fmt(p.development, 1)} · Contrôle {Math.round(p.control)} % · Impôt {fmt(provinceTax(view, provinceId), 1)}
        </div>
      )}
      {occ && <div className="neg">Occupée par {view.characters[occ]?.firstName}</div>}
    </div>
  );
}

export function ProvincePanel({ view, me, provinceId }: { view: GameView; me: Character; provinceId: string }) {
  const geo = PROVINCE_GEO[provinceId]!;
  const p = view.provinces[provinceId]!;
  const title = view.titles[geo.countyTitleId];
  const holder = view.characters[title?.holderId ?? ''];
  const top = view.characters[topLiegeOfProvince(view, provinceId) ?? ''];
  const mine = holder?.id === me.id;
  const options = useMemo(() => (mine ? buildOptions(view, provinceId, me.id) : []), [mine, view, provinceId, me.id]);
  const armies = Object.values(view.armies).filter((a) => a.location === provinceId);
  const siege = Object.values(view.sieges).find((s) => s.provinceId === provinceId);
  const occ = title?.occupiedBy ? view.characters[title.occupiedBy] : undefined;
  const tax = provinceTax(view, provinceId);
  const inDomain = domainProvinceIds(me).includes(provinceId);

  return (
    <div className="prov-panel" data-testid="province-panel">
      <div className="prov-header" style={{ ['--terrain' as string]: TERRAIN_COLORS[geo.terrain] }}>
        <div>
          <div className="prov-name display">{geo.name}</div>
          <div className="muted">
            {t(`terrain.${geo.terrain}`)}
            {geo.coastal ? ' · côtière' : ''}
            {geo.isIsland ? ' · île' : ''}
          </div>
        </div>
        {holder && <Portrait c={holder} view={view} size={52} onClick={() => openCharacter(holder.id)} title={charName(view, holder)} />}
      </div>
      <div className="panel-scroll">
        {holder && (
          <div className="info-line">
            <span>Seigneur</span>
            <button className="link-btn" onClick={() => openCharacter(holder.id)}>
              {styledName(view, holder)}
            </button>
          </div>
        )}
        {top && top.id !== holder?.id && (
          <div className="info-line">
            <span>Souverain</span>
            <button className="link-btn" onClick={() => openCharacter(top.id)}>
              {styledName(view, top)}
            </button>
          </div>
        )}
        {occ && (
          <div className="info-line">
            <span>Occupation</span>
            <span className="neg">{charName(view, occ)}</span>
          </div>
        )}
        <div className="info-line">
          <span>Culture · Foi</span>
          <span>
            {t(`culture.${p.cultureId}`)} · {t(`faith.${p.faithId}`)}
          </span>
        </div>
        <div className="prov-stats">
          <Tip content={() => <div>Croissance : {fmt(developmentGrowth(view, provinceId), 3)} / mois</div>}>
            <div className="prov-stat" tabIndex={0}>
              <span className="k">Développement</span>
              <span className="v num">{fmt(p.development, 1)}</span>
            </div>
          </Tip>
          <Tip content={() => <div>Un contrôle faible réduit impôts et levées. Il remonte avec le temps et le maréchal.</div>}>
            <div className="prov-stat" tabIndex={0}>
              <span className="k">Contrôle</span>
              <span className={`v num ${p.control < 50 ? 'neg' : ''}`}>{Math.round(p.control)} %</span>
            </div>
          </Tip>
          <Tip content={() => <ModTip view={view} pid={provinceId} keyName="tax_mult" title={`Impôt : ${fmt(tax, 2)} / mois`} />}>
            <div className="prov-stat" tabIndex={0}>
              <span className="k">Impôt</span>
              <span className="v num">{fmt(tax, 1)}</span>
            </div>
          </Tip>
          <Tip content={() => <ModTip view={view} pid={provinceId} keyName="levy_mult" title={`Levées max : ${fmt(provinceMaxLevies(view, provinceId))}`} />}>
            <div className="prov-stat" tabIndex={0}>
              <span className="k">Levées</span>
              <span className="v num">
                {fmt(p.levies)}/{fmt(provinceMaxLevies(view, provinceId))}
              </span>
            </div>
          </Tip>
          <Tip content={() => <ModTip view={view} pid={provinceId} keyName="fort_level" title={`Fortifications : ${fortLevel(view, provinceId)}`} />}>
            <div className="prov-stat" tabIndex={0}>
              <span className="k">Fort</span>
              <span className="v num">{fortLevel(view, provinceId)}</span>
            </div>
          </Tip>
          <div className="prov-stat">
            <span className="k">Garnison</span>
            <span className="v num">
              {fmt(p.garrison)}/{fmt(maxGarrison(view, provinceId))}
            </span>
          </div>
          <div className="prov-stat">
            <span className="k">Ravitaillement</span>
            <span className="v num">{fmt(supplyLimit(view, provinceId))}</span>
          </div>
        </div>
        {siege && (
          <>
            <h3 className="section-title">Siège</h3>
            <div className="info-line">
              <span>Assiégeant</span>
              <span>{view.characters[siege.besiegerId]?.firstName}</span>
            </div>
            <ProgressBar value={siege.progress} />
          </>
        )}
        {armies.length > 0 && (
          <>
            <h3 className="section-title">Armées présentes</h3>
            {armies.map((a) => (
              <button key={a.id} className="title-row" onClick={() => openArmy(a.id)}>
                <span className="grow">
                  {view.characters[a.ownerId]?.firstName} · {t(`army.${a.status}`)}
                </span>
                <span className="num">{fmt(armyMen(a))}</span>
              </button>
            ))}
          </>
        )}
        <h3 className="section-title">Bâtiments ({Object.values(p.buildings).filter(Boolean).length}/{geo.buildingSlots} emplacements)</h3>
        {Object.entries(p.buildings).filter(([, l]) => l > 0).length === 0 && <div className="muted">Aucun bâtiment.</div>}
        <div className="building-list">
          {Object.entries(p.buildings)
            .filter(([, l]) => l > 0)
            .map(([id, lvl]) => (
              <Tip key={id} content={() => <div className="soft">{tOr(`building.desc.${id}`, '')}</div>}>
                <div className="building-chip" tabIndex={0}>
                  <span aria-hidden="true">{contentGlyph(BUILDING_BY_ID[id]?.icon)}</span> {t(`building.${id}`)} <span className="muted">niv. {lvl}</span>
                </div>
              </Tip>
            ))}
        </div>
        {p.construction && (
          <div style={{ marginTop: 8 }}>
            <div className="info-line">
              <span>En construction</span>
              <span>
                {t(`building.${p.construction.buildingId}`)} niv. {p.construction.level}
              </span>
            </div>
            <ProgressBar value={((view.date - p.construction.startedAt) / Math.max(1, p.construction.completeAt - p.construction.startedAt)) * 100} />
            <div className="muted" style={{ fontSize: 12 }}>
              Achèvement dans {Math.max(0, p.construction.completeAt - view.date)} jours
            </div>
          </div>
        )}
        {mine && !p.construction && (
          <>
            <h3 className="section-title">Construire</h3>
            <div className="build-options">
              {options.map((o) => (
                <Tip
                  key={o.def.id}
                  content={() => (
                    <div>
                      <div className="tooltip-title">
                        {t(`building.${o.def.id}`)} — niveau {o.level}
                      </div>
                      <p className="soft">{tOr(`building.desc.${o.def.id}`, '')}</p>
                      {Object.entries(o.def.perLevel).map(([k, v]) => (
                        <div key={k} className="pos">
                          {tOr(`modkey.${k}`, k)} +{fmt(v ?? 0, Math.abs(v ?? 0) < 1 ? 2 : 0)}
                        </div>
                      ))}
                      {o.def.leviesPerLevel ? <div className="pos">Levées +{o.def.leviesPerLevel}</div> : null}
                      {o.reason && <div className="neg">{tOr(`building.reason.${o.reason}`, o.reason)}</div>}
                    </div>
                  )}
                >
                  <ActionButton
                    className="build-option"
                    disabled={!o.available || me.gold < o.cost}
                    onClick={() => act({ type: 'building.construct', payload: { provinceId, buildingId: o.def.id } }, `Construction lancée : ${t(`building.${o.def.id}`)}`, 'build')}
                  >
                    <span aria-hidden="true">{contentGlyph(o.def.icon)}</span>
                    <span className="grow">
                      {t(`building.${o.def.id}`)} {o.level > 1 ? `(niv. ${o.level})` : ''}
                    </span>
                    <span className={`num ${me.gold < o.cost ? 'neg' : 'gold'}`}>{fmt(o.cost)} or</span>
                    <span className="muted num">{o.days} j</span>
                  </ActionButton>
                </Tip>
              ))}
            </div>
          </>
        )}
        {inDomain && (
          <div style={{ marginTop: 12 }}>
            <ActionButton className="btn-block" onClick={() => act({ type: 'army.raise', payload: { provinceId } }, 'Levées rassemblées', 'war')}>
              ⚔ Lever les troupes ici
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
