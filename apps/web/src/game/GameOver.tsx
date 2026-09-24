import { useEffect, useRef, useState } from 'react';
import { dynastyScore } from '@ttc/game-core';
import type { GameView } from '@ttc/shared';
import { useRouter } from '../lib/router';
import { fmt } from '../lib/i18n';
import { charName, formatDateFr, rulerTitle } from '../lib/format';
import { playSound } from '../audio/audio';
import { Modal, Portrait } from '../ui/common';
import { chronicleText } from '../lib/chronicle';

/** Écran de fin : la dynastie du joueur est éteinte. */
export function GameOverScreen({ view, userId }: { view: GameView; userId: string }) {
  const go = useRouter((s) => s.go);
  const slot = view.players[userId];
  useEffect(() => {
    playSound('death');
  }, []);
  if (!slot) {
    return (
      <div className="loading-screen">
        <div className="loading-label">Vous ne participez pas à cette partie.</div>
        <button className="btn" onClick={() => go({ name: 'title' })}>
          Retour
        </button>
      </div>
    );
  }
  const rulers = slot.rulers.map((id) => view.characters[id]).filter((c) => !!c);
  const house = view.houses[slot.houseId];
  const st = slot.stats;
  const entries = view.chronicle.filter((e) => e.houseIds.includes(slot.houseId)).slice(-10);
  return (
    <div className="page-screen gameover-screen" data-testid="game-over">
      <div className="page-card panel" style={{ maxWidth: 820 }}>
        <div className="gameover-crown" aria-hidden="true">
          ♛
        </div>
        <h1 className="display page-title" style={{ textAlign: 'center' }}>
          La lignée s’éteint
        </h1>
        <p className="narrative soft" style={{ textAlign: 'center' }}>
          La maison {house?.name ?? ''} ne compte plus d’héritier. Le {formatDateFr(view.date)}, son histoire rejoint les chroniques de Caldria.
        </p>
        <div className="gameover-score">
          <span className="muted">Score dynastique</span>
          <span className="display gold num">{fmt(dynastyScore(view, slot))}</span>
        </div>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            ['Comtés (max.)', st.maxCounties],
            ['Guerres gagnées', st.warsWon],
            ['Batailles gagnées', st.battlesWon],
            ['Descendants', st.descendants],
            ['Prestige (max.)', Math.round(st.maxPrestige)],
            ['Or (max.)', Math.round(st.maxGold)],
            ['Titres créés', st.titlesCreated],
            ['Guerres perdues', st.warsLost],
          ].map(([k, v]) => (
            <div key={String(k)} className="stat-cell">
              <div className="k">{k}</div>
              <div className="v num">{fmt(Number(v))}</div>
            </div>
          ))}
        </div>
        <h3 className="section-title">Souverains de la lignée</h3>
        <div className="person-grid">
          {rulers.map((c) => (
            <div key={c!.id} className="person-tile">
              <Portrait c={c} view={view} size={52} />
              <div className="person-tile-name">{c!.firstName}</div>
              <div className="person-tile-sub muted">{c!.death !== null ? `† ${formatDateFr(c!.death)}` : rulerTitle(c!)}</div>
            </div>
          ))}
        </div>
        {entries.length > 0 && (
          <>
            <h3 className="section-title">Derniers chapitres</h3>
            {entries.map((e) => (
              <div key={e.id} className="info-line">
                <span className="num">{formatDateFr(e.date)}</span>
                <span>{chronicleText(view, e)}</span>
              </div>
            ))}
          </>
        )}
        <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 10 }}>
          <button className="btn btn-primary" onClick={() => go({ name: 'new' })}>
            Nouvelle saga
          </button>
          <button className="btn" onClick={() => go({ name: 'title' })}>
            Menu principal
          </button>
        </div>
      </div>
    </div>
  );
}

/** Annonce du changement de personnage joué (succession). */
export function SuccessionModal({ view, meId }: { view: GameView; meId: string }) {
  const prev = useRef(meId);
  const [shown, setShown] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (prev.current !== meId) {
      setShown({ from: prev.current, to: meId });
      prev.current = meId;
      playSound('fanfare');
    }
  }, [meId]);
  if (!shown) return null;
  const from = view.characters[shown.from];
  const to = view.characters[shown.to];
  if (!to) return null;
  return (
    <Modal title="Le roi est mort, vive le roi" onClose={() => setShown(null)} parchment>
      <div className="succession-modal" data-testid="succession-modal">
        <div className="row" style={{ justifyContent: 'center', gap: 24, alignItems: 'center' }}>
          {from && (
            <div className="person-tile">
              <Portrait c={from} view={view} size={72} />
              <div className="person-tile-name">{from.firstName}</div>
            </div>
          )}
          <span className="display" style={{ fontSize: 28 }}>
            →
          </span>
          <div className="person-tile">
            <Portrait c={to} view={view} size={90} />
            <div className="person-tile-name">{to.firstName}</div>
          </div>
        </div>
        <p className="narrative" style={{ textAlign: 'center' }}>
          {from ? `${charName(view, from)} a rendu son dernier souffle. ` : ''}
          Vous incarnez désormais {charName(view, to)}{rulerTitle(to) ? `, ${rulerTitle(to)}` : ''}. Les vassaux jaugent leur nouveau seigneur : leur loyauté reste à conquérir.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShown(null)}>
            Régner
          </button>
        </div>
      </div>
    </Modal>
  );
}
