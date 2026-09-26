import type { ReactNode } from 'react';
import type { Character, GameView } from '@ttc/shared';
import { useUi } from '../../state/ui';
import { CouncilScreen } from './CouncilScreen';
import { RealmScreen } from './RealmScreen';
import { DynastyScreen } from './DynastyScreen';
import { IntrigueScreen } from './IntrigueScreen';
import { MilitaryScreen } from './MilitaryScreen';
import { MarriageScreen } from './MarriageScreen';
import { ChronicleScreen, DecisionsScreen, LedgerScreen, ProposalScreen, SearchScreen } from './MiscScreens';

export function ScreenFrame({
  title,
  icon,
  children,
  wide,
  actions,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`screen panel${wide ? ' wide' : ''}`}
      role="dialog"
      aria-label={title}
      data-testid="screen"
    >
      <div className="panel-header">
        {icon && (
          <span className="screen-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="panel-title">{title}</div>
        <span className="grow" />
        {actions}
        <button
          className="icon-btn"
          onClick={() => useUi.getState().openScreen(null)}
          aria-label="Fermer (Échap)"
          title="Fermer (Échap)"
        >
          ✕
        </button>
      </div>
      <div className="screen-body">{children}</div>
    </section>
  );
}

export function ScreenHost({ view, me }: { view: GameView; me: Character }) {
  const screen = useUi((s) => s.screen);
  const arg = useUi((s) => s.screenArg);
  switch (screen) {
    case 'council':
      return <CouncilScreen view={view} me={me} />;
    case 'realm':
      return <RealmScreen view={view} me={me} tab={arg} />;
    case 'dynasty':
      return <DynastyScreen view={view} me={me} />;
    case 'intrigue':
      return <IntrigueScreen view={view} me={me} />;
    case 'military':
      return <MilitaryScreen view={view} me={me} />;
    case 'marriage':
      return <MarriageScreen view={view} me={me} arg={arg} />;
    case 'decisions':
      return <DecisionsScreen view={view} me={me} />;
    case 'chronicle':
      return <ChronicleScreen view={view} me={me} />;
    case 'ledger':
      return <LedgerScreen view={view} me={me} />;
    case 'search':
      return <SearchScreen view={view} />;
    case 'diplomacy':
      return (
        <ProposalScreen view={view} me={me} proposalId={arg?.startsWith('proposal:') ? arg.slice(9) : null} />
      );
    default:
      return null;
  }
}
