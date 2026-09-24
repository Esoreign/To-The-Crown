import { DEJURE_CHILDREN, TITLE_DEFS, canCreateTitle, titleRank } from '@ttc/game-core';
import type { Character, GameView, SuccessionLaw } from '@ttc/shared';
import { fmt, t, tOr } from '../../lib/i18n';
import { charName, formatDateFr, styledName, titleFullName, titleName } from '../../lib/format';
import { ActionButton, CoatOfArms, Portrait, Tip } from '../../ui/common';
import { act, openCharacter, openTitle } from '../hooks';
import { useUi } from '../../state/ui';

const RANK_NUM: Record<string, number> = { county: 1, duchy: 2, kingdom: 3, empire: 4 };
const LAWS: SuccessionLaw[] = ['partition', 'primogeniture', 'elective', 'seniority'];
const HOW: Record<string, string> = {
  start: 'Au début de la saga',
  inheritance: 'Héritage',
  conquest: 'Conquête',
  granted: 'Octroi',
  revoked: 'Révocation',
  usurped: 'Usurpation',
  created: 'Création',
  election: 'Élection',
  independence: 'Indépendance',
  destroyed: 'Disparition',
};

export function TitlePanel({ view, me, titleId }: { view: GameView; me: Character; titleId: string }) {
  const def = TITLE_DEFS[titleId]!;
  const title = view.titles[titleId]!;
  const holder = title.holderId ? view.characters[title.holderId] : undefined;
  const parent = def.deJureParentId;
  const children = DEJURE_CHILDREN[titleId] ?? [];
  const mine = holder?.id === me.id;
  const creation = !holder && def.rank !== 'county' ? canCreateTitle(view, me.id, titleId) : null;
  const claims = Object.values(view.claims).filter((c) => c.titleId === titleId);

  return (
    <div className="title-panel" data-testid="title-panel">
      <div className="prov-header">
        <CoatOfArms seed={def.coaSeed} rank={RANK_NUM[def.rank] ?? 1} size={54} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="prov-name display">{titleFullName(titleId)}</div>
          <div className="muted">{title.active || holder ? t(`law.${title.successionLaw}`) : 'Titre non créé'}</div>
        </div>
        {holder && <Portrait c={holder} view={view} size={52} onClick={() => openCharacter(holder.id)} title={charName(view, holder)} />}
      </div>
      <div className="panel-scroll">
        <div className="info-line">
          <span>Détenteur</span>
          {holder ? (
            <button className="link-btn" onClick={() => openCharacter(holder.id)}>
              {styledName(view, holder)}
            </button>
          ) : (
            <span className="muted">Vacant</span>
          )}
        </div>
        {parent && (
          <div className="info-line">
            <span>De jure dans</span>
            <button className="link-btn" onClick={() => openTitle(parent)}>
              {titleFullName(parent)}
            </button>
          </div>
        )}
        {title.occupiedBy && (
          <div className="info-line">
            <span>Occupé par</span>
            <span className="neg">{view.characters[title.occupiedBy]?.firstName}</span>
          </div>
        )}
        {creation && (
          <div className="creation-box">
            <div className="section-title" style={{ marginTop: 0 }}>
              Créer le titre
            </div>
            <div className="info-line">
              <span>Terres de jure contrôlées</span>
              <span className={creation.share >= creation.required ? 'pos' : 'neg'}>
                {Math.round(creation.share * 100)} % / {Math.round(creation.required * 100)} %
              </span>
            </div>
            <div className="info-line">
              <span>Coût</span>
              <span>
                {fmt(creation.cost.gold)} or · {fmt(creation.cost.prestige)} prestige
              </span>
            </div>
            <ActionButton className="btn-primary btn-block" disabled={!creation.ok} onClick={() => act({ type: 'title.create', payload: { titleId } }, `${titleFullName(titleId)} est proclamé !`, null)}>
              {creation.ok ? 'Proclamer' : tOr(`reason.${creation.reason}`, 'Conditions non remplies')}
            </ActionButton>
          </div>
        )}
        {mine && me.titleIds[0] === titleId && titleRank(titleId) !== 'county' && (
          <>
            <h3 className="section-title">Loi de succession</h3>
            <div className="law-grid">
              {LAWS.map((law) => (
                <Tip key={law} content={() => <div className="soft">{t(`law.desc.${law}`)}</div>}>
                  <button
                    className={`law-btn${title.successionLaw === law ? ' active' : ''}`}
                    disabled={title.successionLaw === law}
                    onClick={() =>
                      useUi.getState().openDialog({
                        kind: 'confirm',
                        targetId: titleId,
                        confirm: {
                          title: `Adopter : ${t(`law.${law}`)}`,
                          text: `${t(`law.desc.${law}`)} Coût : ${law === 'primogeniture' ? 400 : 200} autorité${law === 'primogeniture' ? ' (autorité royale 2 requise)' : ''}. Certains vassaux désapprouveront.`,
                          danger: false,
                          run: () => act({ type: 'realm.successionLaw', payload: { titleId, law } }, `Nouvelle loi : ${t(`law.${law}`)}`),
                        },
                      })
                    }
                  >
                    {t(`law.${law}`)}
                  </button>
                </Tip>
              ))}
            </div>
          </>
        )}
        {children.length > 0 && (
          <>
            <h3 className="section-title">Titres de jure ({children.length})</h3>
            <div className="title-list">
              {children.map((cid) => {
                const h = view.titles[cid]?.holderId ? view.characters[view.titles[cid]!.holderId!] : undefined;
                return (
                  <button key={cid} className="title-row" onClick={() => openTitle(cid)}>
                    <CoatOfArms seed={TITLE_DEFS[cid]?.coaSeed ?? 1} size={20} />
                    <span className="grow">{titleName(cid)}</span>
                    <span className="muted">{h ? h.firstName : 'vacant'}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {claims.length > 0 && (
          <>
            <h3 className="section-title">Prétendants</h3>
            {claims.map((c) => (
              <div key={c.id} className="info-line">
                <button className="link-btn" onClick={() => openCharacter(c.characterId)}>
                  {charName(view, view.characters[c.characterId])}
                </button>
                <span>{t(`claim.${c.kind}`)}</span>
              </div>
            ))}
          </>
        )}
        {title.history.length > 0 && (
          <>
            <h3 className="section-title">Histoire</h3>
            <div className="history-list">
              {[...title.history]
                .reverse()
                .slice(0, 12)
                .map((h, i) => (
                  <div key={i} className="info-line">
                    <span className="num">{formatDateFr(h.date)}</span>
                    <span>
                      {h.holderId ? view.characters[h.holderId]?.firstName : '—'} · {HOW[h.how] ?? h.how}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
