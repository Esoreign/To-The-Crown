/**
 * Statistiques dynastiques (écran de fin) et fin de partie d'un joueur.
 */
import type { DynastyStats, GameState, GameView, PlayerSlot } from '@ttc/shared';
import { chronicle, notify, type Ctx } from './context';
import { descendantsOf, dynastyMembers } from './family';
import { realmSize } from './realm';

export function emptyStats(): DynastyStats {
  return { maxCounties: 0, warsWon: 0, warsLost: 0, battlesWon: 0, descendants: 0, maxGold: 0, maxPrestige: 0, titlesCreated: 0 };
}

export function updatePlayerStats(s: GameState): void {
  for (const slot of Object.values(s.players)) {
    const c = s.characters[slot.characterId];
    if (!c || slot.gameOver) continue;
    slot.stats.maxCounties = Math.max(slot.stats.maxCounties, realmSize(s, c.id));
    slot.stats.maxGold = Math.max(slot.stats.maxGold, Math.round(c.gold));
    slot.stats.maxPrestige = Math.max(slot.stats.maxPrestige, Math.round(c.prestige));
    const first = s.characters[slot.rulers[0] ?? c.id];
    if (first) slot.stats.descendants = descendantsOf(s, first).length;
  }
}

export function recordGameOver(ctx: Ctx, userId: string): void {
  const slot = ctx.s.players[userId];
  if (!slot || slot.gameOver) return;
  slot.gameOver = true;
  notify(ctx, [slot.characterId], { level: 'urgent', kind: 'game_over', vars: {}, sound: 'death' });
  const c = ctx.s.characters[slot.characterId];
  if (c) chronicle(ctx, 'dynasty_end', { name: c.id }, [c.id]);
}

/** Score de fin : territoire, prestige, descendants, durée. */
export function dynastyScore(state: GameView, slot: PlayerSlot): number {
  const years = Math.max(0, (state.date - state.startDate) / 365);
  const st = slot.stats;
  const house = state.houses[slot.houseId];
  const renown = house ? state.dynasties[house.dynastyId]?.renown ?? 0 : 0;
  const alive = house ? dynastyMembers(state, house.dynastyId).length : 0;
  return Math.round(
    st.maxCounties * 25 + st.maxPrestige * 0.5 + st.descendants * 15 + years * 10 + st.warsWon * 60 + st.battlesWon * 10 + renown + alive * 5,
  );
}
