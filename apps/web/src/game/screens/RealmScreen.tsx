import { useMemo, useState } from 'react';
import {
  BALANCE,
  DEJURE_CHILDREN,
  PROVINCE_GEO,
  TITLE_DEFS,
  canCreateTitle,
  crownAuthorityCost,
  directVassals,
  domainLimit,
  domainProvinceIds,
  factionPower,
  factionRatio,
  governmentOf,
  isExternalPact,
  isIndependent,
  legitimacyOf,
  legitimacyTarget,
  maxCrownAuthority,
  militaryStrength,
  opinionOf,
  pactsAsOverlord,
  pactsAsSubject,
  provinceTax,
  rankOf,
  realmProvinceIds,
  tributeOf,
  domainIncome,
  vassalLevyShare,
  vassalTaxShare,
} from '@ttc/game-core';
import type { Character, GameView, Pact } from '@ttc/shared';
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

type Tab = 'government' | 'vassals' | 'subjects' | 'laws' | 'factions' | 'domain' | 'titles';

export function RealmScreen({ view, me, tab: initial }: { view: GameView; me: Character; tab: string | null }) {
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'government');
  const vassals = useMemo(() => directVassals(view, me.id).filter((v) => v.titleIds.length), [view, me.id]);
  const factions = Object.values(view.factions).filter((f) => f.targetId === me.id);
  const myFactions = Object.values(view.factions).filter((f) => me.liegeId && f.targetId === me.liegeId);
  const asOverlord = useMemo(() => pactsAsOverlord(view, me.id), [view, me.id]);
  const asSubject = useMemo(() => pactsAsSubject(view, me.id), [view, me.id]);
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
            ['government', 'Institutions'],
            ['vassals', `Vassaux (${vassals.length})`],
            ['subjects', `Sujets (${asOverlord.length})`],
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
      {tab === 'government' && <GovernmentTab view={view} me={me} asSubject={asSubject} />}
      {tab === 'subjects' && <SubjectsTab view={view} me={me} pacts={asOverlord} />}
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
                  const allowed = lvl <= maxCrownAuthority(me) || lvl < me.crownAuthority;
                  const cost = lvl > me.crownAuthority ? crownAuthorityCost(me, lvl) : 0;
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
                      {next && !allowed && <div className="muted" style={{ fontSize: 12 }}>Hors de portée de votre forme de gouvernement.</div>}
                      {next && allowed && (
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

function PactRealm({ view, titleId }: { view: GameView; titleId: string }) {
  const holder = view.titles[titleId]?.holderId;
  const c = holder ? view.characters[holder] : undefined;
  return (
    <div className="row" style={{ gap: 8 }}>
      <CoatOfArms seed={TITLE_DEFS[titleId]?.coaSeed ?? 1} rank={0} size={26} />
      <div className="col" style={{ gap: 0 }}>
        <button className="link-btn" onClick={() => openTitle(titleId)}>
          {titleFullName(titleId)}
        </button>
        {c && (
          <button className="link-btn muted" style={{ fontSize: 12 }} onClick={() => openCharacter(c.id)}>
            {charName(view, c)}
          </button>
        )}
      </div>
    </div>
  );
}

function pactTribute(view: GameView, p: Pact): number {
  return tributeOf(view, p, (x) => domainIncome(view, x));
}

const TRIBUTE_LEVELS = [
  ['light', 'Léger'],
  ['normal', 'Ordinaire'],
  ['heavy', 'Lourd'],
] as const;

function GovernmentTab({ view, me, asSubject }: { view: GameView; me: Character; asSubject: Pact[] }) {
  const gov = governmentOf(me);
  const target = legitimacyTarget(view, me);
  const current = legitimacyOf(me);
  return (
    <div className="col" style={{ gap: 16 }}>
      <section>
        <h3 className="section-title">Forme de gouvernement</h3>
        {gov ? (
          <div className="col" style={{ gap: 6 }}>
            <div className="display" style={{ fontSize: 18 }}>
              {t(`government.${gov.id}`)}
            </div>
            <p className="soft narrative" style={{ margin: 0 }}>
              {t(`government.desc.${gov.id}`)}
            </p>
            <div className="info-line">
              <span>Pouvoir central</span>
              <span>{gov.authorityLabel}</span>
            </div>
            <div className="info-line">
              <span>Succession coutumière</span>
              <span>{t(`law.${gov.succession}`)}</span>
            </div>
            <div className="info-line">
              <span>Prélèvements sur les vassaux</span>
              <span className="num">
                impôt {Math.round(gov.subjectTax * 100)} % · levées {Math.round(gov.subjectLevy * 100)} %
              </span>
            </div>
            <div className="info-line">
              <span>Autorité maximale</span>
              <span>{AUTH_NAMES[maxCrownAuthority(me)]}</span>
            </div>
            <div className="info-line">
              <span>Guerres privées entre vassaux</span>
              <span>{gov.vassalWars ? 'tolérées si l’autorité est faible' : 'interdites'}</span>
            </div>
            <div className="info-line">
              <span>Sources de légitimité</span>
              <span>{gov.legitimacyFrom.map((k) => t(`legitimacy.${k === 'victory' ? 'prestige' : k}`)).join(' · ')}</span>
            </div>
          </div>
        ) : (
          <p className="muted">Gouvernement coutumier.</p>
        )}
      </section>
      <section>
        <h3 className="section-title">Légitimité</h3>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <Tip content={() => <Breakdown title="Légitimité visée" rows={target.rows.map((r) => ({ label: t(`legitimacy.${r.key}`), value: r.value }))} total={target.total} decimals={0} />}>
            <span className={`display ${current < 35 ? 'neg' : current >= 65 ? 'pos' : ''}`} style={{ fontSize: 26 }} data-testid="legitimacy">
              {Math.round(current)}
            </span>
          </Tip>
          <div className="grow">
            <ProgressBar value={current} danger={current < 35} />
            <div className="muted" style={{ fontSize: 12.5 }}>
              Tend vers {Math.round(target.total)} chaque mois. Une faible légitimité refroidit vos vassaux ; une forte les rallie.
            </div>
          </div>
        </div>
      </section>
      {asSubject.length > 0 && (
        <section>
          <h3 className="section-title">Vos obligations</h3>
          {asSubject.map((p) => (
            <div key={p.id} className="scheme-option">
              <PactRealm view={view} titleId={p.overlordTitleId} />
              <div className="grow soft" style={{ fontSize: 13 }}>
                <strong>{t(`subject.${p.type}`)}</strong> — {t(`subject.desc.${p.type}`)}
              </div>
              {isExternalPact(p) && <span className="badge">Tribut {fmt(pactTribute(view, p), 1)} / mois</span>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function SubjectsTab({ view, me, pacts }: { view: GameView; me: Character; pacts: Pact[] }) {
  if (pacts.length === 0) return <p className="muted">Aucun royaume ne vous doit allégeance par contrat.</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Sujet</th>
          <th>Contrat</th>
          <th className="num">Opinion</th>
          <th className="num">Tribut</th>
          <th>Niveau</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {pacts.map((p) => {
          const holder = view.titles[p.subjectTitleId]?.holderId;
          const op = holder ? opinionOf(view, holder, me.id) : null;
          const external = isExternalPact(p);
          return (
            <tr key={p.id} data-testid={`pact-${p.id}`}>
              <td>
                <PactRealm view={view} titleId={p.subjectTitleId} />
              </td>
              <td>
                <Tip content={() => <div className="soft">{t(`subject.desc.${p.type}`)}</div>}>
                  <span className="badge">{t(`subject.${p.type}`)}</span>
                </Tip>
              </td>
              <td className="num">{op ? <span className={op.total >= 0 ? 'pos' : 'neg'}>{Math.round(op.total)}</span> : '—'}</td>
              <td className="num">{external ? `${fmt(pactTribute(view, p), 1)} / mois` : '—'}</td>
              <td>
                {external ? (
                  <div className="row" style={{ gap: 4 }}>
                    {TRIBUTE_LEVELS.map(([level, label]) => {
                      const active = Math.abs(BALANCE.politics.tributeLevels[level] - p.tribute) < 1e-6;
                      return (
                        <ActionButton
                          key={level}
                          className={`btn-sm${active ? ' btn-primary' : ''}`}
                          disabled={active}
                          onClick={() => act({ type: 'subject.tribute', payload: { pactId: p.id, level } }, `Tribut fixé : ${label.toLowerCase()}`)}
                        >
                          {label} {Math.round(BALANCE.politics.tributeLevels[level] * 100)} %
                        </ActionButton>
                      );
                    })}
                  </div>
                ) : (
                  <span className="muted">Impôt {Math.round((BALANCE.politics.vassalTaxFactor[p.type] ?? 1) * 100)} % de l’ordinaire</span>
                )}
              </td>
              <td>
                <ActionButton className="btn-sm" onClick={() => act({ type: 'subject.release', payload: { pactId: p.id } }, `${titleFullName(p.subjectTitleId)} est affranchi`)}>
                  Affranchir
                </ActionButton>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
