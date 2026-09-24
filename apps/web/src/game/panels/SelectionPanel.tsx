import type { Character, GameView } from '@ttc/shared';
import { useUi } from '../../state/ui';
import { CharacterPanel } from './CharacterPanel';
import { ProvincePanel } from './ProvincePanel';
import { TitlePanel } from './TitlePanel';
import { ArmyPanel, BattlePanel, WarPanel } from './MilitaryPanels';

/** Panneau gauche contextuel selon la sélection courante. */
export function SelectionPanel({ view, me }: { view: GameView; me: Character }) {
  const selection = useUi((s) => s.selection)!;
  const history = useUi((s) => s.history);
  const close = () => useUi.getState().select(null);
  let body: React.ReactNode = null;
  switch (selection.kind) {
    case 'character': {
      const c = view.characters[selection.id];
      if (c) body = <CharacterPanel view={view} me={me} c={c} />;
      break;
    }
    case 'province':
      if (view.provinces[selection.id]) body = <ProvincePanel view={view} me={me} provinceId={selection.id} />;
      break;
    case 'title':
      if (view.titles[selection.id]) body = <TitlePanel view={view} me={me} titleId={selection.id} />;
      break;
    case 'army': {
      const a = view.armies[selection.id];
      if (a) body = <ArmyPanel view={view} me={me} army={a} />;
      break;
    }
    case 'war': {
      const w = view.wars[selection.id];
      if (w) body = <WarPanel view={view} me={me} war={w} />;
      break;
    }
    case 'battle': {
      const b = view.battles[selection.id];
      if (b) body = <BattlePanel view={view} battle={b} />;
      break;
    }
  }
  if (!body) body = <div className="muted" style={{ padding: 16 }}>Cet élément n’existe plus.</div>;
  return (
    <aside className="selection-panel panel" aria-label="Détails">
      <div className="selection-controls">
        {history.length > 0 && (
          <button className="icon-btn" onClick={() => useUi.getState().back()} aria-label="Précédent" title="Précédent">
            ←
          </button>
        )}
        <span className="grow" />
        <button className="icon-btn" onClick={close} aria-label="Fermer (Échap)" title="Fermer (Échap)">
          ✕
        </button>
      </div>
      {body}
    </aside>
  );
}
