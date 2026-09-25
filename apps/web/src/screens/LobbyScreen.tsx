import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { getScenario } from '@ttc/content';
import { capitalProvinceOf, holderOfProvince, realmProvinceIds, topLiegeOfProvince } from '@ttc/game-core';
import type { LobbyState } from '@ttc/shared';
import { MapView } from '../map/MapView';
import { scenarioView } from '../map/scenarioView';
import { api, ApiFailure } from '../net/api';
import { joinLobby, sendChat } from '../net/socket';
import { useRouter } from '../lib/router';
import { useAuth } from '../state/auth';
import { useGame } from '../state/game';
import { pushToast } from '../state/ui';
import { errorMessage, t } from '../lib/i18n';
import { rulerTitle, styledName } from '../lib/format';
import { playSound } from '../audio/audio';
import { Portrait } from '../ui/common';
import { RulerSheet } from './NewGameScreen';

export function LobbyScreen({ gameId }: { gameId: string }) {
  const go = useRouter((s) => s.go);
  const user = useAuth((s) => s.user)!;
  const scenario = useMemo(() => getScenario('monde_1400'), []);
  const view = useMemo(() => scenarioView(scenario), [scenario]);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ provinceId: string; at: number } | null>(null);
  const chat = useGame((s) => s.chat);
  const [msg, setMsg] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useGame.setState({ chat: [] });
    return joinLobby(
      gameId,
      (l) => setLobby(l),
      (id) => {
        playSound('fanfare');
        go({ name: 'game', id }, true);
      },
      () => {
        pushToast({ kind: 'error', text: 'Vous avez été expulsé du salon.' });
        go({ name: 'multiplayer' }, true);
      },
    );
  }, [gameId, go]);

  useEffect(() => {
    if (lobby?.status === 'running') go({ name: 'game', id: gameId }, true);
  }, [lobby?.status, gameId, go]);

  useEffect(() => chatEnd.current?.scrollIntoView({ block: 'end' }), [chat.length]);

  const me = lobby?.players.find((p) => p.userId === user.id);
  const isHost = lobby?.hostId === user.id;
  const takenBy = new Map(lobby?.players.filter((p) => p.characterId).map((p) => [p.characterId!, p.displayName]) ?? []);
  const shown = preview ?? me?.characterId ?? scenario.recommended[0]!.characterId;
  const c = view.characters[shown];
  const realm = useMemo(() => (c ? realmProvinceIds(view, c.id) : []), [view, c]);

  const call = async (method: 'POST' | 'PATCH', path: string, body?: unknown) => {
    try {
      await api(method, `/api/games/${gameId}${path}`, body);
      return true;
    } catch (e) {
      pushToast({ kind: 'error', text: e instanceof ApiFailure ? errorMessage(e.code, e.message) : 'Erreur inattendue' });
      playSound('error');
      return false;
    }
  };

  const pick = (id: string) => {
    const ch = view.characters[id];
    if (!ch || !ch.titleIds.length) return;
    setPreview(id);
    const cap = capitalProvinceOf(ch);
    if (cap) setFocus({ provinceId: cap, at: performance.now() });
  };

  async function sendMsg(e: FormEvent) {
    e.preventDefault();
    const text = msg.trim();
    if (!text) return;
    if (await sendChat(gameId, text)) setMsg('');
  }

  if (!lobby) {
    return (
      <div className="loading-screen">
        <div className="boot-crown">♛</div>
        <div className="loading-label">Connexion au salon…</div>
      </div>
    );
  }

  const allReady = lobby.players.length >= 1 && lobby.players.every((p) => p.ready && p.characterId);
  const takenOther = c && takenBy.has(c.id) && me?.characterId !== c.id;

  return (
    <div className="lobby-grid">
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
            const top = topLiegeOfProvince(view, pid);
            const holder = holderOfProvince(view, pid);
            if (top && top !== shown && !realm.includes(pid)) pick(top);
            else if (holder) pick(holder);
          }}
        />
        <div className="newgame-hint">Choisissez votre souverain</div>
        <div className="panel lobby-picker">
          <div className="start-list" style={{ padding: 8 }}>
            {scenario.recommended.map((r) => {
              const ch = view.characters[r.characterId]!;
              const taken = takenBy.get(r.characterId);
              return (
                <button key={r.characterId} className={`start-card${shown === r.characterId ? ' active' : ''}`} onClick={() => pick(r.characterId)}>
                  <Portrait c={ch} view={view} size={40} />
                  <div>
                    <div className="start-name">
                      {ch.firstName}
                      <span className={`diff-badge diff-${r.difficulty}`}>{t(`difficulty.${r.difficulty}`)}</span>
                    </div>
                    <div className="start-sub">{taken ? `Choisi par ${taken}` : rulerTitle(ch)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
      <aside className="newgame-side right">
        <header>
          <div className="row spread">
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (!isHost && (await call('POST', '/leave'))) go({ name: 'multiplayer' });
                else if (isHost) go({ name: 'multiplayer' });
              }}
            >
              ← {isHost ? 'Retour' : 'Quitter'}
            </button>
            <span className="badge gold">{lobby.players.length}/{lobby.maxPlayers}</span>
          </div>
          <h2 style={{ marginTop: 10 }}>{lobby.name}</h2>
          <div className="row" style={{ gap: 10, marginTop: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Code d’invitation
            </span>
            <span className="invite-code" data-testid="invite-code">
              {lobby.inviteCode}
            </span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(lobby.inviteCode);
                pushToast({ kind: 'success', text: 'Code copié' });
              }}
            >
              Copier
            </button>
          </div>
        </header>
        <div className="ruler-sheet" style={{ flex: '1 1 50%' }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Joueurs
          </h3>
          <div className="lobby-players">
            {lobby.players.map((p) => {
              const ch = p.characterId ? view.characters[p.characterId] : undefined;
              return (
                <div key={p.userId} className={`lobby-player${p.userId === user.id ? ' me' : ''}`}>
                  <Portrait c={ch} view={view} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <span className={`presence-dot${p.online ? ' on' : ''}`} />
                      {p.displayName} {p.isHost && <span className="badge gold">Hôte</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {ch ? styledName(view, ch) : 'Aucun souverain'}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`badge ${p.ready ? 'good' : ''}`}>{p.ready ? 'Prêt' : 'En attente'}</span>
                    {isHost && !p.isHost && (
                      <button className="icon-btn" title="Expulser" aria-label={`Expulser ${p.displayName}`} onClick={() => call('POST', '/kick', { userId: p.userId })}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {c && (
            <>
              <div className="divider" />
              <RulerSheet view={view} c={c} rec={scenario.recommended.find((r) => r.characterId === c.id)} onPick={pick} />
            </>
          )}
        </div>
        {isHost && (
          <div style={{ padding: '0 18px' }}>
            <h3 className="section-title">Paramètres</h3>
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input grow"
                aria-label="Difficulté de l’IA"
                value={lobby.settings.aiDifficulty}
                onChange={(e) => call('PATCH', '/settings', { aiDifficulty: e.target.value })}
              >
                <option value="easy">IA clémente</option>
                <option value="normal">IA normale</option>
                <option value="hard">IA impitoyable</option>
              </select>
              <select
                className="input grow"
                aria-label="Vitesse maximale"
                value={lobby.settings.maxSpeed}
                onChange={(e) => call('PATCH', '/settings', { maxSpeed: Number(e.target.value) })}
              >
                <option value={1}>Vitesse max 1</option>
                <option value={2}>Vitesse max 2</option>
                <option value={3}>Vitesse max 3</option>
              </select>
            </div>
          </div>
        )}
        <div className="newgame-footer">
          <div className="chat-log" aria-live="polite" style={{ maxHeight: 140 }}>
            {chat.length === 0 && <span className="muted">Aucun message.</span>}
            {chat.map((m) => (
              <div key={m.id} className="chat-msg">
                <span className="when">{new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="who">{m.displayName}</span>
                {m.text}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form className="row" style={{ gap: 6 }} onSubmit={sendMsg}>
            <input className="input grow" aria-label="Message" maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Écrire aux autres joueurs…" />
            <button className="btn btn-sm">Envoyer</button>
          </form>
          <div className="row" style={{ gap: 8 }}>
            {c && me?.characterId !== c.id && (
              <button
                className="btn grow"
                disabled={!!takenOther || !!me?.ready}
                onClick={() => call('POST', '/select', { characterId: c.id }).then((ok) => ok && playSound('confirm'))}
                data-testid="lobby-select"
              >
                {takenOther ? `Choisi par ${takenBy.get(c.id)}` : `Choisir ${c.firstName}`}
              </button>
            )}
            <button
              className={`btn grow ${me?.ready ? '' : 'btn-primary'}`}
              disabled={!me?.characterId}
              onClick={() => call('POST', '/ready', { ready: !me?.ready })}
              data-testid="lobby-ready"
            >
              {me?.ready ? 'Annuler' : 'Prêt'}
            </button>
          </div>
          {isHost && (
            <button className="btn btn-primary btn-lg btn-block" disabled={!allReady} onClick={() => call('POST', '/start')} data-testid="lobby-start">
              {allReady ? 'Lancer la partie' : 'En attente des joueurs…'}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
