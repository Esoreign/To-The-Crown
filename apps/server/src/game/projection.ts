/**
 * Projection relationnelle de l'état de jeu, réécrite dans une transaction
 * lors des sauvegardes. Permet l'interrogation SQL (chroniques, statistiques,
 * outils) sans désérialiser le snapshot.
 */
import { eq } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { COUNCIL_ROLES, type GameState } from '@ttc/shared';
import { TITLE_DEFS, PROVINCE_GEO } from '@ttc/game-core';
import type { Db } from '../db/client';
import * as t from '../db/schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const CHUNK = 500;

async function replace(tx: Tx, table: PgTable & { gameId: unknown }, gameId: string, rows: Record<string, unknown>[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne générique partagée par les tables de projection
  await tx.delete(table).where(eq((table as any).gameId, gameId));
  for (let i = 0; i < rows.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes construites dynamiquement pour chaque table
    await tx.insert(table).values(rows.slice(i, i + CHUNK) as any);
  }
}

export async function writeProjection(tx: Tx, gameId: string, s: GameState): Promise<void> {
  const g = { gameId };
  const chars = Object.values(s.characters);
  await replace(tx, t.dynasties, gameId, Object.values(s.dynasties).map((d) => ({ ...g, id: d.id, name: d.name, renown: d.renown })));
  await replace(
    tx,
    t.houses,
    gameId,
    Object.values(s.houses).map((h) => ({ ...g, id: h.id, dynastyId: h.dynastyId, name: h.name, motto: h.motto, headId: h.headId, renown: h.renown, isMajor: h.isMajor })),
  );
  await replace(
    tx,
    t.characters,
    gameId,
    chars.map((c) => ({
      ...g,
      id: c.id,
      firstName: c.firstName,
      houseId: c.houseId,
      sex: c.sex,
      birth: c.birth,
      death: c.death,
      fatherId: c.fatherId,
      motherId: c.motherId,
      spouseId: c.spouseId,
      liegeId: c.liegeId,
      courtId: c.courtId,
      cultureId: c.cultureId,
      faithId: c.faithId,
      primaryTitleId: c.titleIds[0] ?? null,
      gold: c.gold,
      prestige: c.prestige,
      health: c.health,
      stress: c.stress,
      isPlayer: c.isPlayer,
      alive: c.death === null,
    })),
  );
  await replace(
    tx,
    t.characterTraits,
    gameId,
    chars.filter((c) => c.death === null).flatMap((c) => [...new Set(c.traits)].map((traitId) => ({ ...g, characterId: c.id, traitId }))),
  );
  await replace(tx, t.relationships, gameId, Object.values(s.relations).map((r) => ({ ...g, id: r.id, a: r.a, b: r.b, type: r.type, since: r.since })));
  await replace(
    tx,
    t.marriages,
    gameId,
    chars.filter((c) => c.death === null && c.sex === 'M' && c.spouseId).map((c) => ({ ...g, husbandId: c.id, wifeId: c.spouseId! })),
  );
  await replace(
    tx,
    t.titles,
    gameId,
    Object.values(s.titles).map((ti) => ({
      ...g,
      id: ti.id,
      rank: TITLE_DEFS[ti.id]!.rank,
      holderId: ti.holderId,
      deJureParentId: TITLE_DEFS[ti.id]!.deJureParentId,
      successionLaw: ti.successionLaw,
      active: ti.active,
      occupiedBy: ti.occupiedBy,
    })),
  );
  await replace(
    tx,
    t.titleClaims,
    gameId,
    Object.values(s.claims).map((c) => ({ ...g, id: c.id, characterId: c.characterId, titleId: c.titleId, kind: c.kind, pressed: c.pressed })),
  );
  await replace(
    tx,
    t.successionVotes,
    gameId,
    Object.values(s.titles).flatMap((ti) => Object.entries(ti.electionVotes).map(([electorId, candidateId]) => ({ ...g, titleId: ti.id, electorId, candidateId }))),
  );
  await replace(
    tx,
    t.provinces,
    gameId,
    Object.values(s.provinces).map((p) => ({
      ...g,
      id: p.id,
      holderId: s.titles[PROVINCE_GEO[p.id]!.countyTitleId]?.holderId ?? null,
      development: p.development,
      control: p.control,
      cultureId: p.cultureId,
      faithId: p.faithId,
      levies: Math.round(p.levies),
      garrison: Math.round(p.garrison),
    })),
  );
  await replace(
    tx,
    t.buildings,
    gameId,
    Object.values(s.provinces).flatMap((p) => Object.entries(p.buildings).map(([buildingId, level]) => ({ ...g, provinceId: p.id, buildingId, level }))),
  );
  await replace(
    tx,
    t.constructionQueues,
    gameId,
    Object.values(s.provinces)
      .filter((p) => p.construction)
      .map((p) => ({ ...g, provinceId: p.id, buildingId: p.construction!.buildingId, level: p.construction!.level, startedAt: p.construction!.startedAt, completeAt: p.construction!.completeAt })),
  );
  await replace(
    tx,
    t.vassalContracts,
    gameId,
    chars.filter((c) => c.death === null && c.liegeId).map((c) => ({ ...g, vassalId: c.id, liegeId: c.liegeId! })),
  );
  await replace(tx, t.alliances, gameId, Object.values(s.alliances).map((a) => ({ ...g, id: a.id, a: a.a, b: a.b, reason: a.reason, createdAt: a.createdAt })));
  const wars = Object.values(s.wars);
  await replace(
    tx,
    t.wars,
    gameId,
    wars.map((w) => ({ ...g, id: w.id, cb: w.cb, attackerId: w.attackerId, defenderId: w.defenderId, targetTitleId: w.targetTitleId, warScore: w.warScore, startedAt: w.startedAt, status: 'active' })),
  );
  await replace(
    tx,
    t.warParticipants,
    gameId,
    wars.flatMap((w) => [
      ...w.attackers.map((c) => ({ ...g, warId: w.id, characterId: c, side: 'attacker' })),
      ...w.defenders.map((c) => ({ ...g, warId: w.id, characterId: c, side: 'defender' })),
    ]),
  );
  const armies = Object.values(s.armies);
  await replace(
    tx,
    t.armies,
    gameId,
    armies.map((a) => ({ ...g, id: a.id, ownerId: a.ownerId, location: a.location, men: Math.round(Object.values(a.units).reduce((x, y) => x + (y ?? 0), 0)), status: a.status })),
  );
  await replace(
    tx,
    t.armyRegiments,
    gameId,
    armies.flatMap((a) => Object.entries(a.units).filter(([, m]) => (m ?? 0) > 0).map(([unit, men]) => ({ ...g, armyId: a.id, unit, men: Math.round(men ?? 0) }))),
  );
  await replace(
    tx,
    t.battles,
    gameId,
    Object.values(s.battles).map((b) => ({ ...g, id: b.id, warId: b.warId, provinceId: b.provinceId, winner: b.winner, attackerMen: Math.round(b.attacker.men), defenderMen: Math.round(b.defender.men) })),
  );
  await replace(tx, t.sieges, gameId, Object.values(s.sieges).map((x) => ({ ...g, id: x.id, provinceId: x.provinceId, besiegerId: x.besiegerId, progress: x.progress })));
  await replace(
    tx,
    t.schemes,
    gameId,
    Object.values(s.schemes).map((x) => ({ ...g, id: x.id, type: x.type, ownerId: x.ownerId, targetId: x.targetId, progress: x.progress, status: x.status })),
  );
  await replace(
    tx,
    t.schemeAgents,
    gameId,
    Object.values(s.schemes).flatMap((x) => [...new Set(x.agents)].map((characterId) => ({ ...g, schemeId: x.id, characterId }))),
  );
  await replace(tx, t.secrets, gameId, Object.values(s.secrets).map((x) => ({ ...g, id: x.id, type: x.type, ownerId: x.ownerId, exposed: x.exposed })));
  await replace(tx, t.hooks, gameId, Object.values(s.hooks).map((x) => ({ ...g, id: x.id, ownerId: x.ownerId, targetId: x.targetId, strong: x.strong })));
  await replace(
    tx,
    t.councilPositions,
    gameId,
    chars
      .filter((c) => c.death === null && c.council)
      .flatMap((c) => COUNCIL_ROLES.map((role) => ({ ...g, rulerId: c.id, role, characterId: c.council![role].characterId, task: c.council![role].task }))),
  );
  await replace(
    tx,
    t.activeEvents,
    gameId,
    Object.values(s.activeEvents).map((e) => ({ ...g, id: e.id, eventId: e.eventId, characterId: e.characterId, expiresAt: e.expiresAt })),
  );
}
