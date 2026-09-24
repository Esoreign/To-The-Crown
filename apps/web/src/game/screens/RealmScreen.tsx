import { useMemo, useState } from 'react';
import {
  BALANCE,
  DEJURE_CHILDREN,
  PROVINCE_GEO,
  TITLE_DEFS,
  canCreateTitle,
  directVassals,
  domainLimit,
  domainProvinceIds,
  factionPower,
  factionRatio,
  isIndependent,
  militaryStrength,
  opinionOf,
  provinceTax,
  rankOf,
  realmProvinceIds,
  vassalLevyShare,
  vassalTaxShare,
} from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { fmt, opinionReason, t } from '../../lib/i18n';
import { charName, formatDateFr, rulerTitle, titleFullName } from '../../lib/format';
import { ActionButton, Breakdown, CoatOfArms, Portrait, ProgressBar, Tip } from '../../ui/common';
import { act, openCharacter, openProvince, openTitle } from '../hooks';
import { useUi } from '../../state/ui';
import { ScreenFrame } from './ScreenHost';

const AUTH_NAMES = ['Autorité minimale', 'Autorité limitée', 'Autorité forte', 'Autorité absolue'];
const AUTH_DESC = [
  'Les vassaux sont quasi souverains : ils vous aiment, mais contribuent peu.',
  'Un équilibre fragile entre la couronne et les grands.',
  'La couronne peut révoquer des titres et exige davantage des vassaux.',
  'Le souverain est maître chez lui ; les grands le tolèrent mal.',
];

type Tab = 'vassals' | 'laws' | 'factions' | 'domain' | 'titles';

export function RealmScreen({ view, me, tab: initial }: { view: GameView; me: Character; tab: string | null }) {
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'vassals');
  const vassals = useMemo(() => directVassals(view, me.id).filter((v) => v.titleIds.length), [view, me.id]);
  const factions = Object.values(view.factions).filter((f) => f.targetId === me.id);
  const myFactions = Object.values(view.factions).filter((f) => me.liegeId && f.targetId === me.liegeId);
  const domain = domainProvinceIds(me);
  const limit = domainLimit(view, me);
  const creatable = useMemo(() => {
    const set = new Set<string>();
    for (const pid of realmProvinceIds(view, me.id)) {
      const g = PROVINCE_GEO[pid];
      if (g) [g.duchyTitleId, g.kingdomTitleId, g.empireTitleId].forEach((x) => x && set.add(x));
    }
    return [...set]
      .filter((id) => !view.titles[id]?.holderId)
      .map((id) => ({ id, check: canCreateTitle(view, me.id, id) }))
      .filter((x) => x.check.reason !== 'rank' && x.check.reason !== 'invalid')
      .sort((a, b) => b.check.share - a.check.share);
  }, [view, me.id]);

  return (
    <ScreenFrame title="Royaume" icon="♖" wide>
      <div className="tabs">
        {(
          [
            ['vassals', `Vassaux (${vassals.length})`],
            ['laws', 'Lois'],
            ['factions', `Factions (${factions.length})`],
            ['domain', `Domaine (${domain.length}/${limit})`],
            ['titles', 'Titres à fonder'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'vassals' && (
        <table className="data-table">
          <thead>
            <tr>
              <th />
              <th>Vassal</th>
              <th>Titre</th>
              <th className="num">Opinion</th>
              <th className="num">Impôt</th>
              <th className="num">Levées</th>
              <th className="num">Armée</th>
              <th>Faction</th>
            </tr>
          </thead>
          <tbody>
            {vassals.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  Aucun vassal titré.
                </td>
              </tr>
            )}
            {vassals.map((v) => {
              const op = opinionOf(view, v.id, me.id);
              const fac = Object.values(view.factions).find((f) => f.members.includes(v.id));
              return (
                <tr key={v.id} className="clickable" onClick={() => openCharacter(v.id)}>
                  <td>
                    <Portrait c={v} view={view} size={30} />
                  </td>
                  <td>{charName(view, v)}</td>
                  <td className="soft">{rulerTitle(v)}</td>
                  <td className="num">
                    <Tip content={() => <Breakdown title="Opinion envers vous" rows={op.rows.map((r) => ({ label: opinionReason(r.reason), value: r.value }))} total={op.total} decimals={0} />}>
                      <span className={op.total >= 0 ? 'pos' : 'neg'}>{Math.round(op.total)}</span>
                    </Tip>
                  </td>
                  <td className="num">{Math.round(vassalTaxShare(view, me, v) * 100)} %</td>
                  <td className="num">{Math.round(vassalLevyShare(view, me, v) * 100)} %</td>
                  <td className="num">{fmt(militaryStrength(view, v))}</td>
                  <td>{fac ? <span className="badge danger">{t(`faction.${fac.type}`)}</span> : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {tab === 'laws' && (
        <div className="col" style={{ gap: 16 }}>
          <section>
            <h3 className="section-title">Autorité royale</h3>
            {!isIndependent(me) || rankOf(me) < 2 ? (
              <p className="muted">Réservée aux ducs, rois et empereurs indépendants.</p>
            ) : (
              <div className="authority-track">
                {AUTH_NAMES.map((name, lvl) => {
                  const current = me.crownAuthority === lvl;
                  const next = Math.abs(lvl - me.crownAuthority) === 1;
                  const cost = lvl > me.crownAuthority ? (BALANCE.authority.crownAuthorityCost[lvl] ?? 0) : 0;
                  const cd = (me.cooldowns.crown_authority ?? 0) > view.date;
                  return (
                    <div key={lvl} className={`authority-step${current ? ' active' : ''}`}>
                      <div className="display">{name}</div>
                      <div className="soft" style={{ fontSize: 12.5 }}>
                        {AUTH_DESC[lvl]}
                      </div>
                      <div className="muted num" style={{ fontSize: 12 }}>
                        Impôt vassal {Math.round((BALANCE.economy.vassalTaxByAuthority[lvl] ?? 0) * 100)} % · Levées {Math.round((BALANCE.economy.vassalLevyByAuthority[lvl] ?? 0) * 100)} % · Opinion {BALANCE.authority.crownAuthorityOpinion[lvl]}
                      </div>
                      {next && (
                        <ActionButton
                          className="btn-sm"
                          disabled={cd || me.authority < cost}
                          title={cd ? `Changement possible après le ${formatDateFr(me.cooldowns.crown_authority!)}` : undefined}
                          onClick={() => act({ type: 'realm.crownAuthority', payload: { level: lvl } }, `Nouvelle loi : ${name}`)}
                        >
                          {lvl > me.crownAuthority ? `Renforcer (${cost} autorité)` : 'Assouplir'}
                        </ActionButton>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section>
            <h3 className="section-title">Succession</h3>
            {me.titleIds[0] ? (
              <div className="row" style={{ gap: 10 }}>
                <span>
                  {titleFullName(me.titleIds[0])} : <strong>{t(`law.${view.titles[me.titleIds[0]]?.successionLaw}`)}</strong>
                </span>
                <button className="btn btn-sm" onClick={() => openTitle(me.titleIds[0]!)}>
                  Modifier…
                </button>
              </div>
            ) : (
              <p className="muted">Aucun titre.</p>
            )}
          </section>
        </div>
      )}
      {tab === 'factions' && (
        <div className="col" style={{ gap: 10 }}>
          {factions.length === 0 && <p className="muted">Aucune faction ne conspire contre vous. Pour l’instant.</p>}
          {factions.map((f) => {
            const ratio = factionRatio(view, f);
            const leader = view.characters[f.leaderId];
            return (
              <div key={f.id} className="faction-card">
                <div className="row spread">
                  <div className="display">{t(`faction.${f.type}`)}</div>
                  <span className={`badge ${f.discontent > 70 ? 'danger' : ''}`}>Mécontentement {Math.round(f.discontent)} %</span>
                </div>
                <div className="soft" style={{ fontSize: 13 }}>
                  Menée par{' '}
                  <button className="link-btn" onClick={() => leader && openCharacter(leader.id)}>
                    {charName(view, leader)}
                  </button>
                  {f.claimantId && <> · prétendant : {view.characters[f.claimantId]?.firstName}</>}
                </div>
                <div className="info-line">
                  <span>Puissance face à vous</span>
                  <span className={ratio >= 0.8 ? 'neg' : ''}>
                    {Math.round(ratio * 100)} % ({fmt(factionPower(view, f))} hommes)
                  </span>
                </div>
                <ProgressBar value={f.discontent} danger={f.discontent > 70} />
                <div className="person-grid" style={{ marginTop: 6 }}>
                  {f.members.map((m) => (
                    <Portrait key={m} c={view.characters[m]} view={view} size={32} onClick={() => openCharacter(m)} title={view.characters[m]?.firstName} />
                  ))}
                </div>
              </div>
            );
          })}
          {myFactions.length > 0 && (
            <>
              <h3 className="section-title">Factions contre votre suzerain</h3>
              {myFactions.map((f) => {
                const member = f.members.includes(me.id);
                return (
                  <div key={f.id} className="faction-card">
                    <div className="row spread">
                      <span className="display">{t(`faction.${f.type}`)}</span>
                      <ActionButton className="btn-sm" onClick={() => act({ type: member ? 'faction.leave' : 'faction.join', payload: { factionId: f.id } }, member ? 'Vous quittez la faction' : 'Vous rejoignez la faction')}>
                        {member ? 'Quitter' : 'Rejoindre'}
                      </ActionButton>
                    </div>
                    <div className="muted">{f.members.length} membres · mécontentement {Math.round(f.discontent)} %</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      {tab === 'domain' && (
        <>
          <p className="soft" style={{ marginTop: 0 }}>
            Limite de domaine : {limit} comtés (selon votre Gestion et votre rang). Au-delà, revenus et levées du domaine sont pénalisés : accordez des comtés à des vassaux.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Comté</th>
                <th className="num">Dév.</th>
                <th className="num">Contrôle</th>
                <th className="num">Impôt</th>
                <th className="num">Levées</th>
                <th>Construction</th>
              </tr>
            </thead>
            <tbody>
              {domain.map((pid) => {
                const p = view.provinces[pid]!;
                return (
                  <tr key={pid} className="clickable" onClick={() => (openProvince(pid), useUi.getState().focusProvince(pid))}>
                    <td>{PROVINCE_GEO[pid]?.name}</td>
                    <td className="num">{fmt(p.development, 1)}</td>
                    <td className={`num ${p.control < 50 ? 'neg' : ''}`}>{Math.round(p.control)} %</td>
                    <td className="num">{fmt(provinceTax(view, pid), 1)}</td>
                    <td className="num">{fmt(p.levies)}</td>
                    <td className="soft">{p.construction ? t(`building.${p.construction.buildingId}`) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {tab === 'titles' && (
        <div className="col" style={{ gap: 8 }}>
          {creatable.length === 0 && <p className="muted">Aucun titre supérieur à fonder dans votre royaume.</p>}
          {creatable.map(({ id, check }) => (
            <div key={id} className="scheme-option">
              <CoatOfArms seed={TITLE_DEFS[id]?.coaSeed ?? 1} rank={0} size={32} />
              <div className="grow">
                <button className="link-btn display" onClick={() => openTitle(id)}>
                  {titleFullName(id)}
                </button>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {Math.round(check.share * 100)} % des terres de jure (requis : {Math.round(check.required * 100)} %) · {fmt(check.cost.gold)} or · {fmt(check.cost.prestige)} prestige · {(DEJURE_CHILDREN[id] ?? []).length} titres de jure
                </div>
              </div>
              <ActionButton className="btn-sm btn-primary" disabled={!check.ok} onClick={() => act({ type: 'title.create', payload: { titleId: id } }, `${titleFullName(id)} est proclamé !`, null)}>
                Proclamer
              </ActionButton>
            </div>
          ))}
        </div>
      )}
    </ScreenFrame>
  );
}
