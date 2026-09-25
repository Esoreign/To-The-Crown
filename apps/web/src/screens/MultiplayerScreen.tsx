import { useEffect, useState, type FormEvent } from 'react';
import { formatDateFr, type GameSummary } from '@ttc/shared';
import { api, ApiFailure } from '../net/api';
import { useRouter } from '../lib/router';
import { errorMessage } from '../lib/i18n';
import { playSound } from '../audio/audio';

export function MultiplayerScreen() {
  const go = useRouter((s) => s.go);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [maxPlayers, setMax] = useState(4);
  const [visibility, setVis] = useState<'private' | 'public'>('private');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<{ games: GameSummary[] }>('GET', '/api/games')
      .then((r) => setGames(r.games))
      .catch(() => setGames([]));

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, []);

  const fail = (e: unknown) => setError(e instanceof ApiFailure ? errorMessage(e.code, e.message) : 'Erreur inattendue');

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ id: string }>('POST', '/api/games', {
        name: name.trim() || 'Concile des couronnes',
        mode: 'multiplayer',
        maxPlayers,
        settings: { maxSpeed: 3, autosave: true, aiDifficulty: 'normal', eventFrequency: 'normal', visibility },
      });
      playSound('confirm');
      go({ name: 'lobby', id: res.id });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api<{ id: string }>('POST', '/api/games/join', { inviteCode: code.trim().toUpperCase() });
      go({ name: 'lobby', id: res.id });
    } catch (err) {
      fail(err);
    }
  }

  async function joinPublic(g: GameSummary) {
    try {
      if (!g.isMember) await api('POST', `/api/games/${g.id}/join`, {});
      go({ name: g.status === 'running' ? 'game' : 'lobby', id: g.id });
    } catch (err) {
      fail(err);
    }
  }

  const mine = games?.filter((g) => g.isMember && g.mode === 'multiplayer') ?? [];
  const open = games?.filter((g) => !g.isMember && g.status === 'lobby') ?? [];

  return (
    <div className="page-screen">
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={() => go({ name: 'title' })}>
            ← Retour
          </button>
          <h1 className="display">Multijoueur</h1>
        </div>
        <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
          {error}
        </div>
        <div className="mp-grid">
          <div className="col" style={{ gap: 18 }}>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">Mes parties</div>
              </div>
              {games === null && <div className="panel-body muted">Chargement…</div>}
              {games && mine.length === 0 && <div className="panel-body muted">Aucune partie multijoueur. Créez-en une ou rejoignez un salon.</div>}
              {mine.map((g) => (
                <div key={g.id} className="game-row">
                  <div>
                    <div className="name">{g.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Hôte : {g.hostName} · {g.playerCount}/{g.maxPlayers} joueurs
                      {g.gameDate ? ` · ${formatDateFr(g.gameDate)}` : ''}
                      {g.rulerName ? ` · ${g.rulerName}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${g.status === 'running' ? 'good' : g.status === 'lobby' ? 'gold' : ''}`}>
                    {g.status === 'lobby' ? 'Salon' : g.status === 'running' ? 'En cours' : 'Terminée'}
                  </span>
                  <button className="btn btn-sm btn-primary" onClick={() => go({ name: g.status === 'lobby' ? 'lobby' : 'game', id: g.id })}>
                    {g.status === 'lobby' ? 'Salon' : 'Reprendre'}
                  </button>
                </div>
              ))}
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">Salons publics</div>
              </div>
              {open.length === 0 && <div className="panel-body muted">Aucun salon public ouvert pour le moment.</div>}
              {open.map((g) => (
                <div key={g.id} className="game-row">
                  <div>
                    <div className="name">{g.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Hôte : {g.hostName} · {g.playerCount}/{g.maxPlayers} joueurs
                    </div>
                  </div>
                  <span />
                  <button className="btn btn-sm" disabled={g.playerCount >= g.maxPlayers} onClick={() => joinPublic(g)}>
                    Rejoindre
                  </button>
                </div>
              ))}
            </section>
          </div>
          <div className="col" style={{ gap: 18 }}>
            <form className="panel" onSubmit={joinByCode}>
              <div className="panel-header">
                <div className="panel-title">Rejoindre avec un code</div>
              </div>
              <div className="panel-body col" style={{ gap: 10 }}>
                <input
                  className="input"
                  aria-label="Code d’invitation"
                  placeholder="EX. K7Q2ZP"
                  value={code}
                  maxLength={16}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  style={{ letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'var(--font-display)' }}
                  data-testid="invite-input"
                />
                <button className="btn btn-primary" disabled={code.trim().length < 4} data-testid="invite-join">
                  Rejoindre
                </button>
              </div>
            </form>
            <form className="panel" onSubmit={create}>
              <div className="panel-header">
                <div className="panel-title">Créer un salon</div>
              </div>
              <div className="panel-body col" style={{ gap: 10 }}>
                <div className="field">
                  <label htmlFor="mp-name">Nom</label>
                  <input id="mp-name" className="input" maxLength={48} placeholder="Concile des couronnes" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field grow">
                    <label htmlFor="mp-max">Joueurs</label>
                    <select id="mp-max" className="input" value={maxPlayers} onChange={(e) => setMax(Number(e.target.value))}>
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field grow">
                    <label htmlFor="mp-vis">Visibilité</label>
                    <select id="mp-vis" className="input" value={visibility} onChange={(e) => setVis(e.target.value as 'private' | 'public')}>
                      <option value="private">Sur invitation</option>
                      <option value="public">Publique</option>
                    </select>
                  </div>
                </div>
                <button className={`btn btn-primary${busy ? ' loading' : ''}`} disabled={busy} data-testid="create-lobby">
                  Créer le salon
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
