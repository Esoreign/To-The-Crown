import { useState, type FormEvent } from 'react';
import { ApiFailure } from '../net/api';
import { resetSocket } from '../net/socket';
import { useAuth } from '../state/auth';
import { errorMessage } from '../lib/i18n';
import { Modal } from '../ui/common';

export function AuthModal({ mode, onMode, onClose, onDone }: { mode: 'login' | 'register'; onMode(m: 'login' | 'register'): void; onClose(): void; onDone(): void }) {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && (password.length < 10 || !/\d/.test(password))) {
      setError('Le mot de passe doit contenir au moins 10 caractères dont un chiffre.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, username, password);
      resetSocket();
      onDone();
    } catch (err) {
      setError(err instanceof ApiFailure ? (err.code === 'VALIDATION_FAILED' ? err.message : errorMessage(err.code, err.message)) : 'Erreur inattendue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === 'login' ? 'Connexion' : 'Créer un compte'} onClose={onClose} className="auth-modal">
      <form onSubmit={submit} className="auth-form" noValidate>
        <div className="field">
          <label htmlFor="auth-email">Adresse e-mail</label>
          <input id="auth-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="auth-name">Nom public</label>
            <input id="auth-name" className="input" autoComplete="nickname" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-pass">Mot de passe</label>
          <input
            id="auth-pass"
            className="input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'register' && <span className="muted" style={{ fontSize: 12 }}>10 caractères minimum, avec au moins un chiffre.</span>}
        </div>
        <div className="form-error" role="alert">
          {error}
        </div>
        <button className={`btn btn-primary btn-block btn-lg${busy ? ' loading' : ''}`} type="submit" disabled={busy}>
          {mode === 'login' ? 'Entrer à la cour' : 'Fonder ma lignée'}
        </button>
        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Pas encore de compte ?{' '}
              <button type="button" className="link-btn" onClick={() => onMode('register')}>
                Créer un compte
              </button>
            </>
          ) : (
            <>
              Déjà inscrit ?{' '}
              <button type="button" className="link-btn" onClick={() => onMode('login')}>
                Se connecter
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
