/**
 * Conseil : cinq fonctions occupées par des personnages réels, chacune avec
 * une tâche active aux effets mesurables (appliqués dans le tick mensuel).
 */
import {
  COUNCIL_ROLES,
  ErrorCodes,
  GameError,
  type Character,
  type CouncilRole,
  type CouncilTask,
  type GameState,
  type GameView,
  type SkillKey,
} from '@ttc/shared';
import { isAdult, isAlive, skill } from './characters';
import { courtiers, directVassals } from './realm';
import { defaultCouncil } from './titles';

export const ROLE_SKILL: Record<CouncilRole, SkillKey> = {
  chancellor: 'diplomacy',
  marshal: 'martial',
  steward: 'stewardship',
  spymaster: 'intrigue',
  scholar: 'learning',
};

export const ROLE_TASKS: Record<CouncilRole, CouncilTask[]> = {
  chancellor: ['chancellor_relations', 'chancellor_prestige'],
  marshal: ['marshal_train', 'marshal_control'],
  steward: ['steward_taxes', 'steward_develop'],
  spymaster: ['spymaster_disrupt', 'spymaster_secrets'],
  scholar: ['scholar_fervor', 'scholar_develop'],
};

/** Tâches nécessitant une province cible. */
export const PROVINCE_TASKS = new Set<CouncilTask>(['marshal_control', 'steward_develop', 'scholar_develop']);

/** Candidats éligibles au conseil d'un dirigeant. */
export function councilCandidates(state: GameView, rulerId: string): Character[] {
  const ruler = state.characters[rulerId];
  if (!ruler) return [];
  const pool = new Map<string, Character>();
  for (const c of courtiers(state, rulerId)) pool.set(c.id, c);
  for (const v of directVassals(state, rulerId)) pool.set(v.id, v);
  if (ruler.spouseId) {
    const sp = state.characters[ruler.spouseId];
    if (sp) pool.set(sp.id, sp);
  }
  return [...pool.values()].filter(
    (c) => isAlive(c) && isAdult(c, state.date) && !c.prisonerOf && c.id !== rulerId && !c.isPlayer,
  );
}

export function seatOf(ruler: Character, charId: string): CouncilRole | null {
  if (!ruler.council) return null;
  for (const r of COUNCIL_ROLES) if (ruler.council[r].characterId === charId) return r;
  return null;
}

/** Remplit les sièges vacants avec les meilleurs candidats. */
export function autoFillCouncil(state: GameState, rulerId: string): void {
  const ruler = state.characters[rulerId];
  if (!ruler || ruler.titleIds.length === 0) return;
  ruler.council ??= defaultCouncil();
  const used = new Set(COUNCIL_ROLES.map((r) => ruler.council![r].characterId).filter(Boolean) as string[]);
  const candidates = councilCandidates(state, rulerId);
  for (const role of COUNCIL_ROLES) {
    const seat = ruler.council[role];
    const current = seat.characterId ? state.characters[seat.characterId] : undefined;
    if (current && isAlive(current) && !current.prisonerOf) continue;
    if (seat.characterId) used.delete(seat.characterId);
    const key = ROLE_SKILL[role];
    const best = candidates
      .filter((c) => !used.has(c.id))
      .sort((a, b) => skill(state, b, key) - skill(state, a, key))[0];
    seat.characterId = best?.id ?? null;
    seat.progress = 0;
    if (best) used.add(best.id);
  }
}

export function assignCouncil(state: GameState, rulerId: string, role: CouncilRole, charId: string | null): void {
  const ruler = state.characters[rulerId];
  if (!ruler?.council) throw new GameError(ErrorCodes.INVALID_TARGET, 'Aucun conseil');
  if (charId) {
    const ok = councilCandidates(state, rulerId).some((c) => c.id === charId);
    if (!ok) throw new GameError(ErrorCodes.INVALID_TARGET, 'Candidat non éligible');
    for (const r of COUNCIL_ROLES) if (ruler.council[r].characterId === charId) ruler.council[r].characterId = null;
  }
  ruler.council[role].characterId = charId;
  ruler.council[role].progress = 0;
}

/** Compétence d'un siège (0 si vacant). */
export function seatSkill(state: GameView, ruler: Character, role: CouncilRole): number {
  const id = ruler.council?.[role].characterId;
  const c = id ? state.characters[id] : undefined;
  return c && isAlive(c) ? skill(state, c, ROLE_SKILL[role]) : 0;
}
