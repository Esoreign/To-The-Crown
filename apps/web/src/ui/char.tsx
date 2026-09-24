/**
 * Éléments de présentation des personnages : traits, compétences,
 * étiquettes cliquables.
 */
import { skill, skillBreakdown } from '@ttc/game-core';
import type { Character, GameView, SkillKey } from '@ttc/shared';
import { fmtSigned, t, tOr, traitName } from '../lib/i18n';
import { TRAIT_BY_ID, charName, traitTone } from '../lib/format';
import { Breakdown, Tip } from './common';

export const SKILLS: SkillKey[] = ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning'];

function traitTooltip(id: string, sex: 'M' | 'F') {
  const def = TRAIT_BY_ID[id];
  const rows: string[] = [];
  if (def?.skills) for (const [k, v] of Object.entries(def.skills)) if (v) rows.push(`${t(`skill.${k}`)} ${fmtSigned(v, 0)}`);
  if (def?.modifiers) for (const [k, v] of Object.entries(def.modifiers)) if (v) rows.push(`${tOr(`modkey.${k}`, k)} ${fmtSigned(v, Math.abs(v) < 1 ? 2 : 0)}`);
  return (
    <div>
      <div className="tooltip-title">{traitName(id, sex)}</div>
      {def && <div className="muted">{tOr(`trait.category.${def.category}`, def.category)}</div>}
      <p className="soft">{tOr(`trait.desc.${id}`, '')}</p>
      {rows.length > 0 && (
        <div>
          {rows.map((r) => (
            <div key={r} className="num">
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TraitChip({ id, sex }: { id: string; sex: 'M' | 'F' }) {
  return (
    <Tip content={() => traitTooltip(id, sex)}>
      <span className={`trait-chip ${traitTone(id)}`} tabIndex={0}>
        {traitName(id, sex)}
      </span>
    </Tip>
  );
}

export function TraitList({ c }: { c: Character }) {
  if (!c.traits.length) return <span className="muted">Aucun trait notable</span>;
  return (
    <div className="trait-list">
      {c.traits.map((id) => (
        <TraitChip key={id} id={id} sex={c.sex} />
      ))}
    </div>
  );
}

export function SkillGrid({ c, view }: { c: Character; view: GameView }) {
  return (
    <div className="stat-grid">
      {SKILLS.map((k) => (
        <Tip
          key={k}
          content={() => (
            <Breakdown
              title={t(`skill.${k}`)}
              rows={skillBreakdown(view, c, k).map((r) => ({ label: r.source.startsWith('trait.') ? traitName(r.source.slice(6), c.sex) : tOr(`resource.row.${r.source}`, r.source), value: r.value }))}
              total={skill(view, c, k)}
              decimals={0}
            />
          )}
        >
          <div className="stat-cell" tabIndex={0} aria-label={`${t(`skill.${k}`)} ${skill(view, c, k)}`}>
            <div className="k">{t(`skill.short.${k}`)}</div>
            <div className="v num">{skill(view, c, k)}</div>
          </div>
        </Tip>
      ))}
    </div>
  );
}

/** Nom cliquable d'un personnage. */
export function CharLink({ c, view, onOpen }: { c: Character | undefined; view: Pick<GameView, 'houses'>; onOpen?: (id: string) => void }) {
  if (!c) return <span className="muted">—</span>;
  if (!onOpen) return <span>{charName(view, c)}</span>;
  return (
    <button className="link-btn char-link" onClick={() => onOpen(c.id)}>
      {charName(view, c)}
    </button>
  );
}
