/**
 * Effets mensuels des tâches du conseil.
 */
import type { Character } from '@ttc/shared';
import { BALANCE } from './balance';
import { domainProvinceIds, isAlive } from './characters';
import { notify, type Ctx } from './context';
import { seatSkill } from './council';
import { addOpinion, opinion } from './opinion';
import { allVassals, directVassals } from './realm';
import { discoverScheme } from './schemes';
import { hookFromSecret } from './secrets';

/** Efficacité d'un conseiller : réduite de moitié s'il déteste son seigneur. */
function efficiency(ctx: Ctx, ruler: Character, charId: string | null): number {
  if (!charId) return 0;
  return opinion(ctx.s, charId, ruler.id) < -30 ? 0.5 : 1;
}

function targetProvince(ctx: Ctx, ruler: Character, provinceId: string | null | undefined, key: 'control' | 'development'): string | null {
  const domain = domainProvinceIds(ruler);
  if (provinceId && domain.includes(provinceId)) return provinceId;
  if (!domain.length) return null;
  const sorted = [...domain].sort((a, b) => {
    const pa = ctx.s.provinces[a]!;
    const pb = ctx.s.provinces[b]!;
    return key === 'control' ? pa.control - pb.control : pb.development - pa.development;
  });
  return sorted[0]!;
}

export function monthlyCouncil(ctx: Ctx, ruler: Character): void {
  const s = ctx.s;
  const council = ruler.council;
  if (!council) return;
  // Chancelier : relations avec les vassaux.
  if (council.chancellor.task === 'chancellor_relations' && council.chancellor.characterId) {
    const skill = seatSkill(s, ruler, 'chancellor') * efficiency(ctx, ruler, council.chancellor.characterId);
    council.chancellor.progress += skill * BALANCE.council.taskProgressPerSkill;
    if (council.chancellor.progress >= 60) {
      council.chancellor.progress = 0;
      for (const v of directVassals(s, ruler.id)) addOpinion(s, v.id, ruler.id, 3, 'opinion.reason.chancellor', 24);
    }
  }
  // Maréchal : contrôle.
  if (council.marshal.task === 'marshal_control' && council.marshal.characterId) {
    const pid = targetProvince(ctx, ruler, council.marshal.provinceId, 'control');
    if (pid) {
      const p = s.provinces[pid]!;
      const skill = seatSkill(s, ruler, 'marshal') * efficiency(ctx, ruler, council.marshal.characterId);
      p.control = Math.min(100, p.control + skill * BALANCE.council.controlPerSkill);
    }
  }
  // Intendant : développement.
  if (council.steward.task === 'steward_develop' && council.steward.characterId) {
    const pid = targetProvince(ctx, ruler, council.steward.provinceId, 'development');
    if (pid) {
      const p = s.provinces[pid]!;
      const skill = seatSkill(s, ruler, 'steward') * efficiency(ctx, ruler, council.steward.characterId);
      p.development = Math.min(BALANCE.economy.developmentMax, p.development + skill * BALANCE.council.developPerSkill);
    }
  }
  // Érudit : développement (savoir).
  if (council.scholar.task === 'scholar_develop' && council.scholar.characterId) {
    const pid = targetProvince(ctx, ruler, council.scholar.provinceId, 'development');
    if (pid) {
      const p = s.provinces[pid]!;
      const skill = seatSkill(s, ruler, 'scholar') * efficiency(ctx, ruler, council.scholar.characterId);
      p.development = Math.min(BALANCE.economy.developmentMax, p.development + skill * BALANCE.council.developPerSkill * 0.6);
    }
  }
  // Maître-espion.
  if (council.spymaster.characterId) {
    const skill = seatSkill(s, ruler, 'spymaster') * efficiency(ctx, ruler, council.spymaster.characterId);
    if (council.spymaster.task === 'spymaster_secrets') {
      if (ctx.rng.chance(skill * BALANCE.council.secretDiscoveryPerSkill)) {
        const realm = new Set([ruler.id, ...allVassals(s, ruler.id).map((v) => v.id)]);
        const candidates = Object.values(s.secrets).filter(
          (sec) => !sec.exposed && !sec.knownBy.includes(ruler.id) && sec.ownerId !== ruler.id && (realm.has(sec.ownerId) || s.characters[sec.ownerId]?.courtId === ruler.id),
        );
        if (candidates.length) {
          const sec = ctx.rng.pick(candidates);
          sec.knownBy.push(ruler.id);
          hookFromSecret(ctx, sec.id, ruler.id);
          const owner = s.characters[sec.ownerId];
          notify(ctx, [ruler.id], {
            level: 'important',
            kind: 'secret_discovered',
            vars: { owner: owner?.firstName ?? '', type: sec.type },
            focus: { type: 'character', id: sec.ownerId },
          });
        }
      }
    } else {
      // Contre-espionnage : découvrir les complots visant le souverain.
      for (const sch of Object.values(s.schemes)) {
        if (sch.status !== 'active' || sch.targetId !== ruler.id || sch.discoveredBy.includes(ruler.id)) continue;
        if (ctx.rng.chance(skill * 0.006)) discoverScheme(ctx, sch, ruler.id);
      }
    }
  }
  void isAlive;
}
