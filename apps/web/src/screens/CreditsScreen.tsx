import { GAME_VERSION_LABEL } from '@ttc/shared';
import { useRouter } from '../lib/router';
import { TRACKS } from '../audio/playlist';

export function CreditsScreen() {
  const go = useRouter((s) => s.go);
  return (
    <div className="page-screen credits-screen">
      <div className="page-card panel">
        <h1 className="display page-title">To The Crown</h1>
        <p className="narrative">
          Grand jeu de stratégie dynastique médiévale sur la Terre de 1400, de l’Atlantique au Pacifique. Chaque serment a un prix.
        </p>
        <div className="divider" />
        <h3 className="section-title">Conception et développement</h3>
        <p className="soft">Monde, personnages, événements, cartes, blasons, portraits, effets sonores et musique d’ambiance générés de façon procédurale pour ce projet.</p>
        <h3 className="section-title">Musique de fond</h3>
        <ul className="soft credits-list">
          {TRACKS.map((t) => (
            <li key={t.id}>
              {t.title} — {t.artist}
            </li>
          ))}
        </ul>
        <h3 className="section-title">Polices</h3>
        <ul className="soft credits-list">
          <li>Cinzel — Natanael Gama, SIL Open Font License 1.1</li>
          <li>Cormorant Garamond — Christian Thalmann, SIL Open Font License 1.1</li>
          <li>Inter — Rasmus Andersson, SIL Open Font License 1.1</li>
        </ul>
        <h3 className="section-title">Bibliothèques</h3>
        <ul className="soft credits-list">
          <li>React, PixiJS, Zustand, Immer, Socket.IO, Vite (MIT)</li>
          <li>Fastify, Drizzle ORM, Zod, Argon2 (MIT)</li>
        </ul>
        <p className="muted">
          Aucun élément graphique, sonore ou textuel n’est repris d’un jeu existant. Les morceaux de musique de fond appartiennent à leurs auteurs respectifs. Version {GAME_VERSION_LABEL}.
        </p>
        <button className="btn btn-primary" onClick={() => go({ name: 'title' })}>
          Retour
        </button>
      </div>
    </div>
  );
}
