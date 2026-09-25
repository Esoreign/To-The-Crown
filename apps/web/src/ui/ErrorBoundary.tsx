import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Change de valeur pour réinitialiser la barrière (ex. changement d'écran). */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: string;
}

/**
 * Barrière d'erreur : une panne d'affichage montre un écran de reprise au
 * lieu d'une page noire. La partie est sauvegardée côté hôte ou serveur ;
 * recharger la page la reprend.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[To The Crown] Erreur d’affichage', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="loading-screen" role="alert" data-testid="error-screen">
        <div className="boot-crown">♛</div>
        <div className="loading-label">Un incident a interrompu l’affichage.</div>
        <p className="muted" style={{ maxWidth: 520, textAlign: 'center' }}>
          Votre partie est sauvegardée. Rechargez la page pour la reprendre.
          <br />
          <code style={{ fontSize: 12 }}>{error.message}</code>
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    );
  }
}
