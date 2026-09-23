/**
 * Pools de cibles pour les événements.
 */
import type { Character, GameView, TargetPool } from '@ttc/shared';
import { isAdult, isAlive } from '../characters';
import { childrenOf, isCloseRelative, parentsOf, siblingsOf } from '../family';
import { alliesOf, relationsOf } from '../opinion';
import { courtiers, directVassals, neighborRulers, topLiegeId } from '../realm';
import { planSuccession } from '../succession';

export function targetPool(state: GameView, root: Character, pool: TargetPool): Character[] {
  const byIds = (ids: (string | null | undefined)[]) =>
    ids.map((id) => (id ? state.characters[id] : undefined)).filter((c): c is Character => isAlive(c) && c.id !== root.id);
  switch (pool) {
    case 'spouse':
      return byIds([root.spouseId]);
    case 'heir':
      return root.titleIds.length ? byIds([planSuccession(state, root).primaryHeirId]) : [];
    case 'child':
      return childrenOf(state, root);
    case 'adult_child':
      return childrenOf(state, root).filter((c) => isAdult(c, state.date));
    case 'minor_child':
      return childrenOf(state, root).filter((c) => !isAdult(c, state.date));
    case 'sibling':
      return siblingsOf(state, root);
    case 'parent':
      return parentsOf(state, root).filter(isAlive);
    case 'liege':
      return byIds([root.liegeId]);
    case 'vassal':
      return directVassals(state, root.id);
    case 'councillor':
      return root.council ? byIds(Object.values(root.council).map((s) => s.characterId)) : [];
    case 'courtier': {
      const courtOwner = root.titleIds.length ? root.id : root.courtId;
      return courtOwner ? courtiers(state, courtOwner).filter((c) => c.id !== root.id && isAdult(c, state.date)) : [];
    }
    case 'rival':
      return byIds([...relationsOf(state, root.id, 'rival'), ...relationsOf(state, root.id, 'nemesis')]);
    case 'friend':
      return byIds([...relationsOf(state, root.id, 'friend'), ...relationsOf(state, root.id, 'best_friend')]);
    case 'lover':
      return byIds([...relationsOf(state, root.id, 'lover'), ...relationsOf(state, root.id, 'soulmate')]);
    case 'neighbor_ruler':
      return root.titleIds.length ? byIds(neighborRulers(state, root.id)) : [];
    case 'enemy_ruler': {
      const out: string[] = [];
      for (const w of Object.values(state.wars)) {
        if (w.attackers.includes(root.id)) out.push(w.defenderId);
        if (w.defenders.includes(root.id)) out.push(w.attackerId);
      }
      return byIds(out);
    }
    case 'ally':
      return byIds(alliesOf(state, root.id));
    case 'prisoner':
      return Object.values(state.characters).filter((c) => c.prisonerOf === root.id && isAlive(c));
    case 'schemer_against':
      return byIds(
        Object.values(state.schemes)
          .filter((s) => s.status === 'active' && s.targetId === root.id)
          .map((s) => s.ownerId),
      );
    case 'relative': {
      const top = topLiegeId(state, root.id);
      const pool = Object.values(state.characters).filter(
        (c) => isAlive(c) && c.id !== root.id && (c.courtId === root.courtId || c.courtId === top || c.houseId === root.houseId),
      );
      return pool.filter((c) => isCloseRelative(state, root, c)).slice(0, 30);
    }
    default:
      return [];
  }
}
