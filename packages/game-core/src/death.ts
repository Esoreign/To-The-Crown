/**
 * Décès d'un personnage : libération des rôles, succession, changement de
 * personnage joueur, mise à jour des guerres, alliances et maisons.
 */
import { COUNCIL_ROLES, type Character, type DeathCause, type GameState } from '@ttc/shared';
import { BALANCE } from './balance';
import { ageOf, isAdult, isAlive } from './characters';
import { chronicle, notify, requestPause, type Ctx } from './context';
import { TITLE_DEFS } from './content';
import { fireOnAction } from './events/engine';
import { createCharacter, birthForAge } from './factory';
import { houseMembers } from './family';
import { addOpinion } from './opinion';
import { directVassals, rankOf, topLiegeId } from './realm';
import { planSuccession, playerHeir } from './succession';
import { lowestDeJureTitleHeldOver, transferTitle, fixRankConsistency } from './titles';
import { endWar } from './war';
import { autoFillCouncil } from './council';
import { recordGameOver } from './stats';
import { bumpStructure } from './index-cache';

export function killCharacter(ctx: Ctx, charId: string, cause: DeathCause, killerId: string | null = null): void {
  const s = ctx.s;
  const c = s.characters[charId];
  if (!c || c.death !== null) return;
  c.death = s.date;
  bumpStructure();
  c.deathCause = cause;
  c.killerId = killerId;
  c.pregnancy = null;
  c.prisonerOf = null;
  const wasPlayer = c.isPlayer;

  // Conjoint et fiançailles.
  if (c.spouseId) {
    const sp = s.characters[c.spouseId];
    if (sp) {
      sp.spouseId = null;
      sp.formerSpouseIds.push(c.id);
      if (isAlive(sp)) notify(ctx, [sp.id], { level: 'important', kind: 'spouse_died', vars: { name: c.firstName }, focus: { type: 'character', id: c.id }, sound: 'death' });
    }
    c.formerSpouseIds.push(c.spouseId);
    c.spouseId = null;
  }
  if (c.betrothedId) {
    const b = s.characters[c.betrothedId];
    if (b) b.betrothedId = null;
    c.betrothedId = null;
  }
  // Alliances matrimoniales rompues.
  for (const [id, al] of Object.entries(s.alliances)) {
    if (al.viaMarriage?.includes(charId)) delete s.alliances[id];
    bumpStructure();
  }
  // Prisonniers libérés, rôles de conseil, tuteurs.
  for (const other of Object.values(s.characters)) {
    if (other.prisonerOf === charId) other.prisonerOf = null;
    if (other.council) {
      for (const r of COUNCIL_ROLES) if (other.council[r].characterId === charId) other.council[r].characterId = null;
    }
    if (other.education?.tutorId === charId) other.education.tutorId = null;
    if (other.guardianId === charId) other.guardianId = null;
    if (other.nominatedHeirId === charId) other.nominatedHeirId = null;
  }
  for (const [id, r] of Object.entries(s.relations)) if (r.a === charId || r.b === charId) delete s.relations[id];
  bumpStructure();
  for (const [id, h] of Object.entries(s.hooks)) if (h.ownerId === charId || h.targetId === charId) delete s.hooks[id];
  for (const sch of Object.values(s.schemes)) {
    if (sch.status !== 'active') continue;
    if (sch.ownerId === charId || sch.targetId === charId) sch.status = 'cancelled';
    sch.agents = sch.agents.filter((a) => a !== charId);
  }
  for (const [id, f] of Object.entries(s.factions)) {
    f.members = f.members.filter((m) => m !== charId);
    if (f.leaderId === charId) f.leaderId = f.members[0] ?? '';
    if (f.claimantId === charId || f.targetId === charId || !f.members.length || !f.leaderId) delete s.factions[id];
  }
  for (const [id, p] of Object.entries(s.proposals)) if (p.fromId === charId || p.toId === charId || p.subjects.includes(charId)) delete s.proposals[id];
  for (const [id, ev] of Object.entries(s.activeEvents)) if (ev.characterId === charId) delete s.activeEvents[id];
  for (const a of Object.values(s.armies)) if (a.commanderId === charId) a.commanderId = null;

  // Succession.
  const landed = c.titleIds.length > 0;
  const plan = landed ? planSuccession(s, c) : null;
  const primaryTitle = c.titleIds[0] ?? null;
  const rank = rankOf(c);
  if (landed && plan) applySuccession(ctx, c.id, plan);

  // Joueur : continue avec l'héritier.
  if (wasPlayer) {
    const slot = Object.values(s.players).find((p) => p.characterId === charId);
    c.isPlayer = false;
    const heirId = plan ? playerHeir(s, c, plan) : null;
    const heir = heirId ? s.characters[heirId] : undefined;
    if (slot) {
      if (heir && isAlive(heir) && heir.titleIds.length && !heir.isPlayer) {
        slot.characterId = heir.id;
        slot.houseId = heir.houseId ?? slot.houseId;
        slot.rulers.push(heir.id);
        heir.isPlayer = true;
        heir.aiNextThink = Number.MAX_SAFE_INTEGER;
        notify(ctx, [heir.id], {
          level: 'urgent',
          kind: 'succession',
          vars: { old: c.firstName, heir: heir.firstName, title: primaryTitle ?? '' },
          focus: { type: 'character', id: heir.id },
          sound: 'death',
        });
        fireOnAction(ctx, 'succession', heir.id, { other: c.id });
        requestPause(ctx);
      } else {
        recordGameOver(ctx, slot.userId);
      }
    }
  }

  // Notifications et chronique.
  const liege = c.liegeId;
  const toNotify = [liege, ...c.childIds, c.fatherId, c.motherId];
  if (landed) toNotify.push(...Object.values(s.players).map((p) => p.characterId));
  notify(ctx, toNotify, {
    level: landed && rank >= 2 ? 'important' : 'info',
    kind: `death_${cause}`,
    vars: { name: c.firstName, age: ageOf(c, s.date), title: primaryTitle ?? '' },
    focus: { type: 'character', id: c.id },
    sound: landed ? 'death' : undefined,
  });
  if ((landed && rank >= 2) || wasPlayer) {
    chronicle(ctx, 'ruler_death', { name: c.id, title: primaryTitle ?? '', cause, age: ageOf(c, s.date) }, [c.id]);
  }

  // Chef de maison.
  if (c.houseId) {
    const house = s.houses[c.houseId];
    if (house && house.headId === charId) {
      const heirSameHouse = plan?.primaryHeirId && s.characters[plan.primaryHeirId]?.houseId === house.id ? plan.primaryHeirId : null;
      const members = houseMembers(s, house.id).sort((a, b) => rankOf(b) - rankOf(a) || a.birth - b.birth);
      house.headId = heirSameHouse ?? members[0]?.id ?? null;
    }
  }
  // Orphelins : tuteur désigné = le suzerain de la cour.
  for (const kidId of c.childIds) {
    const kid = s.characters[kidId];
    if (kid && isAlive(kid) && !isAdult(kid, s.date) && kid.guardianId === null) kid.guardianId = kid.courtId;
  }
  // Opinion : les enfants et le conjoint pleurent, les rivaux se réjouissent.
  void addOpinion;
}

/** Répartit les titres, réaffecte vassaux, cour, armées et guerres. */
export function applySuccession(ctx: Ctx, deceasedId: string, plan: ReturnType<typeof planSuccession>): void {
  const s = ctx.s;
  const c = s.characters[deceasedId]!;
  const oldLiege = c.liegeId;
  const vassals = directVassals(s, deceasedId);
  const courtiers = Object.values(s.characters).filter((x) => x.courtId === deceasedId && x.id !== deceasedId && x.death === null);
  const titles = [...c.titleIds];
  const primaryHeir = plan.primaryHeirId;

  // Titres sans héritier : le suzerain les récupère, sinon un noble local est créé.
  let fallbackHeir: string | null = null;
  const needFallback = titles.some((t) => !plan.titles[t]);
  if (needFallback) {
    if (oldLiege && s.characters[oldLiege] && isAlive(s.characters[oldLiege])) fallbackHeir = oldLiege;
    else fallbackHeir = spawnLocalRuler(ctx, c.id);
  }
  // Transfert du titre principal en premier pour fixer le rang du principal héritier.
  for (const t of titles) {
    const heir = plan.titles[t] ?? fallbackHeir;
    if (!heir) continue;
    const heirChar = s.characters[heir]!;
    // Un héritier non titré devient vassal de l'ancien suzerain du défunt.
    const liegeForNew = heirChar.titleIds.length === 0 ? (heir === oldLiege ? null : oldLiege) : undefined;
    transferTitle(s, t, heir, heir === fallbackHeir && heir === oldLiege ? 'revoked' : plan.law === 'elective' ? 'election' : 'inheritance', {
      liegeId: liegeForNew,
    });
  }
  // Les titres sans suite (duchés, royaumes) vacants deviennent inactifs.
  for (const t of titles) {
    if (!s.titles[t]!.holderId && TITLE_DEFS[t]!.rank !== 'county') s.titles[t]!.active = false;
  }

  // Héritiers secondaires : vassaux de l'héritier principal si rang inférieur.
  if (primaryHeir) {
    for (const h of plan.heirs) {
      if (h === primaryHeir) continue;
      const hc: Character | undefined = s.characters[h];
      if (!hc || hc.liegeId || hc.titleIds.length === 0) continue;
      if (rankOf(hc) < rankOf(s.characters[primaryHeir]!) && hc.liegeId !== primaryHeir) {
        // Au partage, les cadets restent vassaux de leur aîné (CK : ils le deviennent).
        hc.liegeId = primaryHeir;
        bumpStructure();
        fixRankConsistency(s, h);
      }
    }
  }

  // Vassaux : rejoignent l'héritier détenant le titre de jure le plus proche, sinon l'héritier principal.
  for (const v of vassals) {
    if (!isAlive(v) || v.liegeId !== deceasedId) continue;
    const cap = v.titleIds[0] ? TITLE_DEFS[v.titleIds[0]]?.capitalProvinceId : undefined;
    let newLiege: string | null = primaryHeir ?? fallbackHeir;
    if (cap) {
      for (const h of plan.heirs) {
        const hc = s.characters[h];
        if (hc && lowestDeJureTitleHeldOver(hc, cap)) {
          newLiege = h;
          break;
        }
      }
    }
    v.liegeId = newLiege === v.id ? null : newLiege;
    bumpStructure();
    fixRankConsistency(s, v.id);
  }
  // Cour.
  for (const x of courtiers) x.courtId = primaryHeir ?? fallbackHeir;
  bumpStructure();

  // Armées : transférées à l'héritier principal.
  for (const a of Object.values(s.armies)) {
    if (a.ownerId === deceasedId) {
      if (primaryHeir) a.ownerId = primaryHeir;
      else delete s.armies[a.id];
    }
  }
  // Hommes d'armes.
  if (primaryHeir) {
    const heir = s.characters[primaryHeir]!;
    for (const [u, men] of Object.entries(c.maa)) heir.maa[u as keyof typeof heir.maa] = (heir.maa[u as keyof typeof heir.maa] ?? 0) + (men ?? 0);
    heir.gold += Math.max(0, c.gold);
    heir.prestige += Math.max(0, c.prestige * 0.25);
    c.gold = 0;
    c.maa = {};
    // Nouveau règne : les vassaux doutent.
    for (const v of directVassals(s, primaryHeir)) {
      addOpinion(s, v.id, primaryHeir, BALANCE.opinion.newRuler, 'opinion.reason.new_ruler', BALANCE.opinion.newRulerYears * 12);
    }
    autoFillCouncil(s, primaryHeir);
    for (const h of plan.heirs) if (h !== primaryHeir) autoFillCouncil(s, h);
    fireOnAction(ctx, 'death_of_liege', primaryHeir, { other: deceasedId });
    if (plan.heirs.length > 1) {
      notify(ctx, [primaryHeir, ...Object.values(s.players).map((p) => p.characterId)], {
        level: 'important',
        kind: 'partition',
        vars: { name: c.firstName, count: plan.heirs.length },
        focus: { type: 'character', id: primaryHeir },
      });
    }
  }

  // Guerres : le principal héritier reprend les guerres, sinon paix blanche.
  for (const w of Object.values(s.wars)) {
    const isAttackerLeader = w.attackerId === deceasedId;
    const isDefenderLeader = w.defenderId === deceasedId;
    if (w.claimantId === deceasedId && w.cb === 'claimant') {
      endWar(ctx, w.id, 'white');
      continue;
    }
    if (isAttackerLeader || isDefenderLeader) {
      if (!primaryHeir || (w.targetTitleId && !s.titles[w.targetTitleId]?.holderId)) {
        endWar(ctx, w.id, 'white');
        continue;
      }
      if (isAttackerLeader) w.attackerId = primaryHeir;
      if (isDefenderLeader) w.defenderId = primaryHeir;
      if (w.claimantId === deceasedId) w.claimantId = primaryHeir;
    }
    w.attackers = [...new Set(w.attackers.map((x) => (x === deceasedId ? primaryHeir : x)).filter((x): x is string => !!x))];
    w.defenders = [...new Set(w.defenders.map((x) => (x === deceasedId ? primaryHeir : x)).filter((x): x is string => !!x))];
    if (w.attackers.some((a) => w.defenders.includes(a))) endWar(ctx, w.id, 'white');
    else if (primaryHeir && topLiegeId(s, primaryHeir) !== primaryHeir && (w.attackerId === primaryHeir || w.defenderId === primaryHeir)) {
      // Héritier vassal de son adversaire : la guerre n'a plus de sens.
      const other = w.attackerId === primaryHeir ? w.defenderId : w.attackerId;
      if (topLiegeId(s, primaryHeir) === topLiegeId(s, other)) endWar(ctx, w.id, 'white');
    }
  }
}

/** Crée un noble local lorsqu'un titre n'a aucun héritier possible. */
function spawnLocalRuler(ctx: Ctx, deceasedId: string): string {
  const s = ctx.s;
  const dec = s.characters[deceasedId]!;
  const houseId = `h_local_${s.nextId}`;
  const dynastyId = `dy_local_${s.nextId}`;
  const name = TITLE_DEFS[dec.titleIds[0] ?? '']?.name ?? 'Caldria';
  s.dynasties[dynastyId] = { id: dynastyId, name, houseIds: [houseId], renown: 0 };
  s.houses[houseId] = {
    id: houseId,
    name,
    motto: 'Relever ce qui est tombé.',
    dynastyId,
    founderId: null,
    headId: null,
    coaSeed: ctx.rng.int(1, 2 ** 30),
    color: '#6b5a3a',
    renown: 0,
    history: 'Maison nouvelle, élevée par la vacance d’un fief.',
    isMajor: false,
    cultureId: dec.cultureId,
  };
  const id = `ch${s.nextId++}`;
  const c = createCharacter(s as GameState, ctx.rng, {
    id,
    sex: 'M',
    birth: birthForAge(s.date, ctx.rng.int(24, 45), ctx.rng),
    cultureId: dec.cultureId,
    faithId: dec.faithId,
    houseId,
    now: s.date,
  });
  c.gold = 20;
  c.courtId = c.id;
  bumpStructure();
  s.houses[houseId]!.headId = c.id;
  s.houses[houseId]!.founderId = c.id;
  return c.id;
}
