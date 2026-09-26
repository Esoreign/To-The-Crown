import { SCHEME_DEFS, schemeDiscoveryChance, schemeSuccessChance, knownSecretsOf } from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { fmt, t } from '../../lib/i18n';
import { charName, formatDateFr } from '../../lib/format';
import { ActionButton, Portrait, ProgressBar } from '../../ui/common';
import { act, openCharacter } from '../hooks';
import { useUi } from '../../state/ui';
import { ScreenFrame } from './ScreenHost';

export function IntrigueScreen({ view, me }: { view: GameView; me: Character }) {
  const mine = Object.values(view.schemes).filter((s) => s.ownerId === me.id && s.status === 'active');
  const noticed = Object.values(view.schemes).filter(
    (s) => s.targetId === me.id && s.status === 'active' && s.discoveredBy.includes(me.id),
  );
  const against = noticed.filter((s) => SCHEME_DEFS[s.type].hostile);
  const approaches = noticed.filter((s) => !SCHEME_DEFS[s.type].hostile);
  const known = knownSecretsOf(view, me.id).filter((s) => s.ownerId !== me.id);
  const own = Object.values(view.secrets).filter((s) => s.ownerId === me.id);
  const hooks = Object.values(view.hooks).filter((h) => h.ownerId === me.id);
  const hooked = Object.values(view.hooks).filter((h) => h.targetId === me.id);
  const spymaster = me.council?.spymaster.characterId
    ? view.characters[me.council.spymaster.characterId]
    : undefined;

  return (
    <ScreenFrame title="Intrigue" icon="☾" wide>
      <div className="intrigue-grid">
        <section>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Vos complots ({mine.length})
          </h3>
          {mine.length === 0 && (
            <p className="muted">
              Aucun complot en cours. Clic droit sur un personnage ou sa fiche → Comploter.
            </p>
          )}
          {mine.map((s) => {
            const target = view.characters[s.targetId];
            return (
              <div key={s.id} className="scheme-card">
                <div className="row" style={{ gap: 10 }}>
                  <Portrait c={target} view={view} size={44} onClick={() => openCharacter(s.targetId)} />
                  <div className="grow">
                    <div className="display">{t(`scheme.${s.type}`)}</div>
                    <div className="soft">contre {charName(view, target)}</div>
                  </div>
                  <ActionButton
                    className="btn-sm btn-ghost"
                    onClick={() =>
                      act({ type: 'scheme.cancel', payload: { schemeId: s.id } }, 'Complot abandonné')
                    }
                  >
                    Abandonner
                  </ActionButton>
                </div>
                <ProgressBar value={s.progress} />
                <div className="scheme-stats muted num">
                  <span>Progression {Math.round(s.progress)} %</span>
                  <span>Puissance {fmt(s.power, 1)}</span>
                  <span>Résistance {fmt(s.resistance, 1)}</span>
                  <span className="pos">Réussite {Math.round(schemeSuccessChance(s) * 100)} %</span>
                  <span className={schemeDiscoveryChance(s) > 0.1 ? 'neg' : ''}>
                    Découverte {Math.round(schemeDiscoveryChance(s) * 100)} %/mois
                  </span>
                </div>
                {s.agents.length > 0 && (
                  <div className="row" style={{ gap: 4, marginTop: 4 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Agents :
                    </span>
                    {s.agents.map((a) => (
                      <Portrait
                        key={a}
                        c={view.characters[a]}
                        view={view}
                        size={24}
                        onClick={() => openCharacter(a)}
                      />
                    ))}
                  </div>
                )}
                {s.discoveredBy.length > 0 && (
                  <div className="neg" style={{ fontSize: 12 }}>
                    Découvert par {s.discoveredBy.map((d) => view.characters[d]?.firstName).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
          {approaches.length > 0 && (
            <>
              <h3 className="section-title">On cherche à vous plaire</h3>
              {approaches.map((s) => (
                <div key={s.id} className="info-line">
                  <button className="link-btn" onClick={() => openCharacter(s.ownerId)}>
                    {charName(view, view.characters[s.ownerId])}
                  </button>
                  <span className="soft">{t(`scheme.${s.type}`)}</span>
                </div>
              ))}
            </>
          )}
          <h3 className="section-title">Complots découverts contre vous</h3>
          {against.length === 0 && (
            <p className="muted">
              Votre maître-espion {spymaster ? `(${spymaster.firstName})` : ''} n’a rien découvert.
            </p>
          )}
          {against.map((s) => (
            <div key={s.id} className="scheme-card hostile">
              <div className="row" style={{ gap: 10 }}>
                <Portrait
                  c={view.characters[s.ownerId]}
                  view={view}
                  size={40}
                  onClick={() => openCharacter(s.ownerId)}
                />
                <div className="grow">
                  <div className="display">{t(`scheme.${s.type}`)}</div>
                  <div className="soft">ourdi par {charName(view, view.characters[s.ownerId])}</div>
                </div>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() =>
                    useUi.setState({
                      contextMenu: {
                        x: window.innerWidth / 2,
                        y: window.innerHeight / 2,
                        characterId: s.ownerId,
                      },
                    })
                  }
                >
                  Réagir
                </button>
              </div>
              <ProgressBar value={s.progress} danger />
            </div>
          ))}
        </section>
        <section>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Secrets connus ({known.length})
          </h3>
          {known.length === 0 && (
            <p className="muted">
              Lancez « Découvrir des secrets » ou confiez cette tâche à votre maître-espion.
            </p>
          )}
          {known.map((s) => (
            <div key={s.id} className="info-line">
              <span>
                <button className="link-btn" onClick={() => openCharacter(s.ownerId)}>
                  {charName(view, view.characters[s.ownerId])}
                </button>{' '}
                : {t(`secret.${s.type}`)}
              </span>
              {s.exposed ? (
                <span className="muted">révélé</span>
              ) : (
                <ActionButton
                  className="btn-sm btn-ghost"
                  onClick={() =>
                    act({ type: 'secret.expose', payload: { secretId: s.id } }, 'Le scandale éclate')
                  }
                >
                  Révéler
                </ActionButton>
              )}
            </div>
          ))}
          <h3 className="section-title">Leviers détenus ({hooks.length})</h3>
          {hooks.length === 0 && (
            <p className="muted">
              Un levier force la main : mariage, alliance ou vassalité acceptés malgré les réticences.
            </p>
          )}
          {hooks.map((h) => (
            <div key={h.id} className="info-line">
              <button className="link-btn" onClick={() => openCharacter(h.targetId)}>
                {charName(view, view.characters[h.targetId])}
              </button>
              <span className={h.strong ? 'gold' : ''}>
                {h.strong ? 'Fort' : 'Faible'}
                {h.cooldownUntil > view.date ? ` · utilisable le ${formatDateFr(h.cooldownUntil)}` : ''}
              </span>
            </div>
          ))}
          {hooked.length > 0 && (
            <>
              <h3 className="section-title">On vous tient</h3>
              {hooked.map((h) => (
                <div key={h.id} className="info-line">
                  <button className="link-btn" onClick={() => openCharacter(h.ownerId)}>
                    {charName(view, view.characters[h.ownerId])}
                  </button>
                  <span className="neg">{h.strong ? 'Levier fort' : 'Levier faible'}</span>
                </div>
              ))}
            </>
          )}
          <h3 className="section-title">Vos propres secrets</h3>
          {own.length === 0 && <p className="muted">Vous n’avez rien à cacher. En apparence.</p>}
          {own.map((s) => (
            <div key={s.id} className="info-line">
              <span>{t(`secret.${s.type}`)}</span>
              <span className={s.exposed ? 'neg' : s.knownBy.length > 1 ? 'neg' : 'muted'}>
                {s.exposed ? 'révélé' : `connu de ${Math.max(0, s.knownBy.length - 1)} personne(s)`}
              </span>
            </div>
          ))}
        </section>
      </div>
    </ScreenFrame>
  );
}
