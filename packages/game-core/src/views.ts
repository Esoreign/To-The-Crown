/**
 * Vues par joueur : un client ne reçoit jamais les données qu'il ne connaît
 * pas (secrets, complots non découverts, événements d'autrui, RNG).
 */
import {
  PRIVATE_COLLECTIONS,
  type Character,
  type GameState,
  type GameView,
  type PatchOp,
  type PrivateView,
} from '@ttc/shared';

const PRIVATE_KEYS = new Set<string>([...PRIVATE_COLLECTIONS, 'rng']);

export function sanitizeCharacter(c: Character): Character {
  if (!c.realFatherId && !c.pregnancy) return c;
  const out = { ...c };
  delete out.realFatherId;
  if (c.pregnancy) out.pregnancy = { due: c.pregnancy.due, fatherId: c.spouseId ?? c.pregnancy.fatherId, illegitimate: false };
  return out;
}

/** Partie publique de l'état (identique pour tous les joueurs). */
export function publicView(state: GameState): GameView {
  const { rng: _rng, ...rest } = state;
  const characters: Record<string, Character> = {};
  for (const [id, c] of Object.entries(state.characters)) characters[id] = sanitizeCharacter(c);
  return {
    ...rest,
    characters,
    secrets: {},
    schemes: {},
    hooks: {},
    activeEvents: {},
    scheduledEvents: {},
  };
}

/** Données privées connues d'un personnage joueur. */
export function privateViewFor(state: GameState | GameView, characterId: string | null): PrivateView {
  const empty: PrivateView = { secrets: {}, schemes: {}, hooks: {}, activeEvents: {}, scheduledEvents: {} };
  if (!characterId) return empty;
  for (const s of Object.values(state.secrets)) {
    if (s.knownBy.includes(characterId) || s.ownerId === characterId || s.exposed) empty.secrets[s.id] = s;
  }
  for (const sc of Object.values(state.schemes)) {
    if (sc.ownerId === characterId || sc.agents.includes(characterId) || sc.discoveredBy.includes(characterId)) empty.schemes[sc.id] = sc;
  }
  for (const h of Object.values(state.hooks)) {
    if (h.ownerId === characterId || h.targetId === characterId) empty.hooks[h.id] = h;
  }
  for (const e of Object.values(state.activeEvents)) {
    if (e.characterId === characterId) empty.activeEvents[e.id] = e;
  }
  return empty;
}

export function touchesPrivate(ops: { path: (string | number)[] }[]): boolean {
  return ops.some((o) => PRIVATE_KEYS.has(String(o.path[0])) || o.path[0] === 'characters');
}

/**
 * Filtre les patches Immer pour diffusion publique : supprime les
 * collections privées et assainit les champs sensibles des personnages.
 */
export function publicPatches(patches: { op: string; path: (string | number)[]; value?: unknown }[], next: GameState): PatchOp[] {
  const out: PatchOp[] = [];
  const pregnancyReplaced = new Set<string>();
  for (const p of patches) {
    const root = String(p.path[0]);
    if (PRIVATE_KEYS.has(root)) continue;
    if (root === 'characters') {
      const id = String(p.path[1]);
      const field = p.path[2];
      if (field === 'realFatherId') continue;
      if (field === 'pregnancy') {
        if (pregnancyReplaced.has(id)) continue;
        pregnancyReplaced.add(id);
        const c = next.characters[id];
        out.push({ op: 'replace', path: ['characters', id, 'pregnancy'], value: c ? sanitizeCharacter(c).pregnancy : null });
        continue;
      }
      if (p.path.length === 2 && (p.op === 'add' || p.op === 'replace') && p.value) {
        out.push({ op: p.op, path: p.path, value: sanitizeCharacter(p.value as Character) });
        continue;
      }
    }
    out.push({ op: p.op as PatchOp['op'], path: p.path, value: p.value });
  }
  return out;
}
