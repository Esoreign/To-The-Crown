import { useMemo } from 'react';
import {
  TITLE_DEFS,
  availableLevies,
  ledgerOf,
  monthlyAuthority,
  monthlyFervor,
  monthlyPrestige,
  primaryTitleId,
  rankOf,
  sumRows,
} from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { fmt, fmtSigned, t, tOr } from '../../lib/i18n';
import { charName, rulerTitle } from '../../lib/format';
import { AnimatedNumber, Breakdown, CoatOfArms, Portrait, Tip } from '../../ui/common';
import { openCharacter, openTitle } from '../hooks';
import { useUi } from '../../state/ui';
import { MusicButton } from '../../ui/music';

function Resource({ icon, label, value, delta, decimals = 0, tip, testId, warn }: { icon: string; label: string; value: number; delta?: number; decimals?: number; tip: () => React.ReactNode; testId?: string; warn?: boolean }) {
  return (
    <Tip content={tip}>
      <div className={`resource${warn ? ' warn' : ''}`} tabIndex={0} aria-label={`${label} ${fmt(value, decimals)}`} data-testid={testId}>
        <span className="resource-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="resource-value">
          <AnimatedNumber value={value} decimals={decimals} />
        </span>
        {delta !== undefined && Math.abs(delta) >= 0.05 && <span className={`resource-delta num ${delta > 0 ? 'pos' : 'neg'}`}>{fmtSigned(delta, 1)}</span>}
      </div>
    </Tip>
  );
}

export function TopBar({ view, me }: { view: GameView; me: Character }) {
  const ledger = useMemo(() => ledgerOf(view, me), [view, me]);
  const prestige = useMemo(() => monthlyPrestige(view, me), [view, me]);
  const fervor = useMemo(() => monthlyFervor(view, me), [view, me]);
  const authority = useMemo(() => monthlyAuthority(view, me), [view, me]);
  const levies = useMemo(() => availableLevies(view, me), [view, me]);
  const maa = Object.values(me.maa).reduce((s, v) => s + (v ?? 0), 0);
  const house = me.houseId ? view.houses[me.houseId] : undefined;
  const dynasty = house ? view.dynasties[house.dynastyId] : undefined;
  const pt = primaryTitleId(me);
  const openScreen = useUi((s) => s.openScreen);

  const rowLabel = (key: string) => tOr(`resource.row.${key}`, key);

  return (
    <header className="topbar" role="banner">
      <div className="topbar-ruler">
        <Portrait c={me} view={view} size={44} onClick={() => openCharacter(me.id)} title={charName(view, me)} />
        {pt && (
          <button className="topbar-coa" onClick={() => openTitle(pt)} aria-label={rulerTitle(me)}>
            <CoatOfArms seed={TITLE_DEFS[pt]?.coaSeed ?? 1} rank={rankOf(me)} size={30} />
          </button>
        )}
        <div className="topbar-name">
          <div className="display">{me.firstName}</div>
          <div className="muted">{rulerTitle(me) || 'Sans terre'}</div>
        </div>
      </div>
      <div className="topbar-resources">
        <Resource
          icon="⛁"
          label={t('resource.gold')}
          value={me.gold}
          delta={ledger.net}
          testId="res-gold"
          warn={me.gold < 0}
          tip={() => (
            <div>
              <div className="tooltip-title">{t('resource.gold')}</div>
              <p className="soft">{t('resource.desc.gold')}</p>
              <Breakdown title="Revenus mensuels" rows={ledger.income.map((r) => ({ label: t(`ledger.${r.key}`, r.vars), value: r.value }))} />
              <Breakdown title="Dépenses mensuelles" rows={ledger.expenses.map((r) => ({ label: t(`ledger.${r.key}`, r.vars), value: -Math.abs(r.value) }))} total={ledger.net} />
              <p className="muted">Clic : registre détaillé</p>
            </div>
          )}
        />
        <Resource
          icon="✦"
          label={t('resource.prestige')}
          value={me.prestige}
          delta={sumRows(prestige)}
          tip={() => (
            <div>
              <div className="tooltip-title">{t('resource.prestige')}</div>
              <p className="soft">{t('resource.desc.prestige')}</p>
              <Breakdown title="Par mois" rows={prestige.map((r) => ({ label: rowLabel(r.key), value: r.value }))} total={sumRows(prestige)} decimals={2} />
            </div>
          )}
        />
        <Resource
          icon="⚖"
          label={t('resource.authority')}
          value={me.authority}
          delta={sumRows(authority)}
          tip={() => (
            <div>
              <div className="tooltip-title">{t('resource.authority')}</div>
              <p className="soft">{t('resource.desc.authority')}</p>
              <Breakdown title="Par mois" rows={authority.map((r) => ({ label: rowLabel(r.key), value: r.value }))} total={sumRows(authority)} decimals={2} />
            </div>
          )}
        />
        <Resource
          icon="✺"
          label={t('resource.fervor')}
          value={me.fervor}
          delta={sumRows(fervor)}
          tip={() => (
            <div>
              <div className="tooltip-title">{t('resource.fervor')}</div>
              <p className="soft">{t('resource.desc.fervor')}</p>
              <Breakdown title="Par mois" rows={fervor.map((r) => ({ label: rowLabel(r.key), value: r.value }))} total={sumRows(fervor)} decimals={2} />
            </div>
          )}
        />
        <Resource
          icon="♜"
          label={t('resource.renown')}
          value={dynasty?.renown ?? 0}
          tip={() => (
            <div>
              <div className="tooltip-title">{t('resource.renown')}</div>
              <p className="soft">{t('resource.desc.renown')}</p>
              <div className="breakdown-row">
                <span>Dynastie</span>
                <span>{dynasty?.name ?? '—'}</span>
              </div>
              <div className="breakdown-row">
                <span>Maison {house?.name}</span>
                <span className="num">{fmt(house?.renown ?? 0)}</span>
              </div>
            </div>
          )}
        />
        <Resource
          icon="⚔"
          label={t('resource.troops')}
          value={levies.total + maa}
          tip={() => (
            <div>
              <div className="tooltip-title">{t('resource.troops')}</div>
              <p className="soft">{t('resource.desc.troops')}</p>
              <Breakdown
                rows={[
                  { label: 'Levées du domaine', value: levies.domain },
                  { label: 'Levées des vassaux', value: levies.vassals },
                  { label: 'Hommes d’armes', value: maa },
                ]}
                total={levies.total + maa}
                decimals={0}
              />
            </div>
          )}
        />
      </div>
      <MusicButton className="topbar-music" />
      <button className="topbar-ledger icon-btn" onClick={() => openScreen('ledger')} aria-label="Registre du trésor" title="Registre du trésor">
        ⛁
      </button>
    </header>
  );
}
