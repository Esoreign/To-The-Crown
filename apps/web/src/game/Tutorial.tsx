import type { Character, GameView } from '@ttc/shared';
import { useSettings } from '../state/settings';

interface Step {
  title: string;
  text: string;
  /** Zone mise en évidence (classe CSS de positionnement). */
  anchor: 'center' | 'top' | 'left' | 'right' | 'bottom' | 'bottom-right';
}

const STEPS: Step[] = [
  {
    title: 'Bienvenue à la cour',
    text: 'Nous sommes le 1er janvier 1400 et vous incarnez un souverain de ce monde. Votre but : faire prospérer votre dynastie à travers les générations. Si votre lignée s’éteint, la partie est perdue.',
    anchor: 'center',
  },
  {
    title: 'Vos ressources',
    text: 'En haut : or, prestige, autorité, ferveur, renommée et troupes. Survolez chaque valeur pour comprendre d’où elle vient et où elle part.',
    anchor: 'top',
  },
  {
    title: 'Le temps',
    text: 'En bas à droite, l’horloge. Espace met en pause, 1, 2 et 3 règlent la vitesse. Les événements importants suspendent le jeu en solo.',
    anchor: 'bottom-right',
  },
  {
    title: 'La carte',
    text: 'Faites glisser pour vous déplacer, molette pour zoomer. Cliquez une province pour la détailler, clic droit pour interagir avec son seigneur. Les modes de carte changent l’information affichée.',
    anchor: 'center',
  },
  {
    title: 'Les écrans du royaume',
    text: 'En bas : conseil, royaume, dynastie, intrigue, armées, mariages, décisions et chronique. Commencez par nommer un conseil compétent et marier votre héritier.',
    anchor: 'bottom',
  },
  {
    title: 'L’aperçu',
    text: 'À droite, tout ce qui demande votre attention : décisions en attente, guerres, armées, complots et constructions.',
    anchor: 'right',
  },
  {
    title: 'À vous de régner',
    text: 'Chaque choix a des conséquences : opinion des vassaux, stress, secrets. Vous pouvez relancer ce guide depuis les paramètres. Bonne chance.',
    anchor: 'center',
  },
];

export function Tutorial({ me }: { view: GameView; me: Character }) {
  const step = useSettings((s) => s.tutorialStep);
  const set = useSettings((s) => s.set);
  if (step >= STEPS.length) return null;
  const s = STEPS[step]!;
  const finish = () => set({ tutorialEnabled: false, tutorialStep: STEPS.length });
  return (
    <div className={`tutorial tutorial-${s.anchor} panel`} role="dialog" aria-label="Guide" data-testid="tutorial">
      <div className="tutorial-step muted">
        {step + 1} / {STEPS.length}
      </div>
      <div className="tutorial-title display">{step === 0 ? `${s.title}, ${me.firstName}` : s.title}</div>
      <p className="tutorial-text">{s.text}</p>
      <div className="row spread">
        <button className="btn btn-ghost btn-sm" onClick={finish} data-testid="tutorial-skip">
          Passer le guide
        </button>
        <div className="row" style={{ gap: 6 }}>
          {step > 0 && (
            <button className="btn btn-sm" onClick={() => set({ tutorialStep: step - 1 })}>
              Précédent
            </button>
          )}
          <button className="btn btn-sm btn-primary" onClick={() => (step + 1 >= STEPS.length ? finish() : set({ tutorialStep: step + 1 }))} data-testid="tutorial-next">
            {step + 1 >= STEPS.length ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}
