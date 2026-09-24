/**
 * Composants d'interface réutilisables : portraits, blasons, info-bulles,
 * fenêtres modales, valeurs chiffrées animées.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { ageOf, rankOf } from '@ttc/game-core';
import type { Character, GameView } from '@ttc/shared';
import { coaSvg } from '../art/heraldry';
import { portraitSvg } from '../art/portrait';
import { playSound } from '../audio/audio';
import { fmt } from '../lib/i18n';

// ---------------------------------------------------------------- Portrait
export function Portrait({
  c,
  view,
  size = 64,
  onClick,
  showCoa = false,
  title,
}: {
  c: Character | undefined;
  view: Pick<GameView, 'date' | 'houses'>;
  size?: number;
  onClick?: () => void;
  showCoa?: boolean;
  title?: string;
}) {
  const house = c?.houseId ? view.houses[c.houseId] : undefined;
  const svg = useMemo(() => {
    if (!c) return '';
    return portraitSvg(c, { age: ageOf(c, view.date), rank: rankOf(c), houseColor: house?.color, dead: c.death !== null });
  }, [c, view.date, house?.color]);
  if (!c) return <div className="portrait empty" style={{ width: size, height: size * 1.2 }} />;
  return (
    <div
      className={`portrait${onClick ? ' clickable' : ''}${c.death !== null ? ' dead' : ''}`}
      style={{ width: size, height: size * 1.2 }}
      onClick={onClick ? () => (playSound('click'), useTip.getState().hide(), onClick()) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={title ?? c.firstName}
      title={title}
    >
      <div className="portrait-img" dangerouslySetInnerHTML={{ __html: svg }} />
      {showCoa && house && <CoatOfArms seed={house.coaSeed} size={size * 0.34} className="portrait-coa" />}
      {c.isPlayer && <span className="portrait-player" aria-label="Joueur">♛</span>}
    </div>
  );
}

// ---------------------------------------------------------------- Blason
export function CoatOfArms({ seed, rank = 0, size = 40, className, title }: { seed: number; rank?: number; size?: number; className?: string; title?: string }) {
  const svg = useMemo(() => coaSvg(seed, { rank }), [seed, rank]);
  return (
    <div
      className={`coa ${className ?? ''}`}
      style={{ width: size, height: size * (rank >= 4 ? 1.55 : rank >= 3 ? 1.35 : rank >= 2 ? 1.3 : 1.14) }}
      title={title}
      aria-label={title}
      role={title ? 'img' : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ---------------------------------------------------------------- Info-bulles
interface TipState {
  content: ReactNode | null;
  x: number;
  y: number;
  show(content: ReactNode, x: number, y: number): void;
  hide(): void;
}
export const useTip = create<TipState>((set) => ({
  content: null,
  x: 0,
  y: 0,
  show: (content, x, y) => set({ content, x, y }),
  hide: () => set({ content: null }),
}));

let tipOwner = 0;
let tipSeq = 0;

export function Tip({ content, children, delay = 280, className }: { content: ReactNode | (() => ReactNode); children: ReactNode; delay?: number; className?: string }) {
  const timer = useRef<number | null>(null);
  const id = useRef(0);
  if (!id.current) id.current = ++tipSeq;
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const show = (node: ReactNode, x: number, y: number) => {
    tipOwner = id.current;
    useTip.getState().show(node, x, y);
  };
  // Une info-bulle ne survit pas à son ancre (fenêtre fermée, élément retiré).
  useEffect(
    () => () => {
      clear();
      if (tipOwner === id.current) useTip.getState().hide();
    },
    [],
  );
  return (
    <span
      className={`tip-anchor ${className ?? ''}`}
      onMouseEnter={(e) => {
        const { clientX, clientY } = e;
        clear();
        timer.current = window.setTimeout(() => show(typeof content === 'function' ? content() : content, clientX, clientY), delay);
      }}
      onMouseMove={(e) => {
        if (useTip.getState().content) useTip.setState({ x: e.clientX, y: e.clientY });
      }}
      onMouseLeave={() => {
        clear();
        useTip.getState().hide();
      }}
      onFocus={(e) => {
        const r = (e.target as HTMLElement).getBoundingClientRect();
        show(typeof content === 'function' ? content() : content, r.left + r.width / 2, r.bottom);
      }}
      onBlur={() => useTip.getState().hide()}
    >
      {children}
    </span>
  );
}

export function TooltipLayer() {
  const { content, x, y } = useTip();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEffect(() => {
    const hide = () => useTip.getState().hide();
    window.addEventListener('mousedown', hide);
    window.addEventListener('wheel', hide, { passive: true });
    return () => {
      window.removeEventListener('mousedown', hide);
      window.removeEventListener('wheel', hide);
    };
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = x + 16;
    let top = y + 18;
    if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - 12);
    if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 12);
    setPos({ left, top });
  }, [content, x, y]);
  if (!content) return null;
  return (
    <div ref={ref} className="tooltip" style={pos} role="tooltip">
      {content}
    </div>
  );
}

/** Tableau de décomposition (source → valeur) pour les info-bulles. */
export function Breakdown({ title, rows, total, decimals = 1, unit }: { title?: string; rows: { label: string; value: number }[]; total?: number; decimals?: number; unit?: string }) {
  return (
    <div className="breakdown">
      {title && <div className="tooltip-title">{title}</div>}
      {rows.length === 0 && <div className="muted">Aucune source</div>}
      {rows.map((r, i) => (
        <div key={i} className="breakdown-row">
          <span>{r.label}</span>
          <span className={`num ${r.value > 0 ? 'pos' : r.value < 0 ? 'neg' : ''}`}>
            {r.value > 0 ? '+' : r.value < 0 ? '−' : ''}
            {fmt(Math.abs(r.value), decimals)}
            {unit ?? ''}
          </span>
        </div>
      ))}
      {total !== undefined && (
        <div className="breakdown-row total">
          <span>Total</span>
          <span className={`num ${total > 0 ? 'pos' : total < 0 ? 'neg' : ''}`}>
            {total > 0 ? '+' : total < 0 ? '−' : ''}
            {fmt(Math.abs(total), decimals)}
            {unit ?? ''}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Valeurs animées
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('');
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    setFlash(value > from ? 'up' : 'down');
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      setShown(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const clear = window.setTimeout(() => setFlash(''), 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clear);
    };
  }, [value]);
  return <span className={`num anim-num ${flash}`}>{fmt(shown, decimals)}</span>;
}

// ---------------------------------------------------------------- Modale
export function Modal({ title, onClose, children, wide, className, parchment }: { title?: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; className?: string; parchment?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${parchment ? 'parchment' : 'panel'} ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        {(title || onClose) && (
          <div className="panel-header">
            <div className="panel-title">{title}</div>
            {onClose && (
              <button className="icon-btn" onClick={onClose} aria-label="Fermer">
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max = 100, danger }: { value: number; max?: number; danger?: boolean }) {
  return (
    <div className={`progress${danger ? ' danger' : ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

/** Bouton qui attend la réponse du serveur (état de chargement bref). */
export function ActionButton({ onClick, children, className, disabled, title }: { onClick: () => Promise<unknown> | void; children: ReactNode; className?: string; disabled?: boolean; title?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn ${className ?? ''}${busy ? ' loading' : ''}`}
      disabled={disabled || busy}
      title={title}
      onClick={async () => {
        playSound('click');
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <span className={`glyph glyph-${name}`} style={{ fontSize: size }} aria-hidden="true">{GLYPHS[name] ?? '•'}</span>;
}

/** Glyphes typographiques cohérents (pas de jeu d'icônes « tech »). */
export const GLYPHS: Record<string, string> = {
  gold: '⛁',
  prestige: '✦',
  authority: '⚖',
  fervor: '✺',
  renown: '♜',
  troops: '⚔',
  crown: '♛',
  council: '⚜',
  realm: '♖',
  dynasty: '❦',
  intrigue: '☾',
  military: '⚔',
  chronicle: '✎',
  marriage: '❤',
  decisions: '✧',
  diplomacy: '✉',
  search: '⌕',
  settings: '⚙',
  map: '◈',
  pause: '❚❚',
  play: '▶',
  close: '✕',
  back: '←',
  health: '✚',
  stress: '☁',
  war: '⚔',
  alert: '!',
  chat: '✉',
};

/** Glyphes des icônes sémantiques du contenu (bâtiments, unités). */
const CONTENT_GLYPHS: Record<string, string> = {
  anchor: '⚓',
  anvil: '⚒',
  axe: '⚒',
  'banner-hall': '⚑',
  'crossed-spears': '⚔',
  'horse-head': '♞',
  horseshoe: '∩',
  keep: '♜',
  milestone: '⛯',
  mill: '✣',
  pickaxe: '⛏',
  scroll: '✉',
  seal: '✺',
  stall: '⛺',
  target: '◎',
  temple: '⛪',
  wall: '▦',
  watchtower: '♖',
  wheat: '❦',
  pitchfork: '⚒',
  'sword-shield': '⛨',
  bow: '➶',
  pike: '↟',
  'light-horse': '♞',
  'heavy-horse': '♘',
  trebuchet: '⚙',
};

export function contentGlyph(icon: string | undefined): string {
  return (icon && CONTENT_GLYPHS[icon]) || '◆';
}
