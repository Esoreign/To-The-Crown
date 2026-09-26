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
          Grand jeu de stratégie dynastique médiévale sur la Terre de 1400, de l’Atlantique au Pacifique.
          Chaque serment a un prix.
        </p>
        <div className="divider" />
        <h3 className="section-title">Conception et développement</h3>
        <p className="soft">
          Personnages, événements, blasons, portraits, effets sonores et musique d’ambiance créés pour ce
          projet. Frontières, royaumes et dynasties de 1400 reconstitués pour le jeu, avec un niveau de
          fiabilité affiché pour chaque entité.
        </p>
        <h3 className="section-title">Données géographiques</h3>
        <ul className="soft credits-list">
          <li>
            Natural Earth — terres, lacs, fleuves, lieux, régions physiques (domaine public),
            naturalearthdata.com
          </li>
          <li>
            Relief : Terrain Tiles on AWS (Mapzen / Tilezen Joerd) — ETOPO1 (NOAA), GMTED2010 (USGS), SRTM
            (NASA) et autres sources citées par le projet Joerd
          </li>
        </ul>
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
          <li>React, Zustand, Immer, Socket.IO, Vite (MIT)</li>
          <li>MapLibre GL JS (BSD-3-Clause), topojson-client (ISC)</li>
          <li>Fastify, Drizzle ORM, Zod, Argon2 (MIT)</li>
        </ul>
        <p className="muted">
          Aucun élément graphique, sonore ou textuel n’est repris d’un jeu existant. Les morceaux de musique
          de fond appartiennent à leurs auteurs respectifs. Version {GAME_VERSION_LABEL}.
        </p>
        <button className="btn btn-primary" onClick={() => go({ name: 'title' })}>
          Retour
        </button>
      </div>
    </div>
  );
}
