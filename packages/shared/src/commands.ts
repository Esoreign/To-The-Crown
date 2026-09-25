/**
 * Commandes de gameplay : le client envoie une INTENTION, le serveur valide
 * puis applique via game-core. Aucun résultat n'est jamais accepté du client.
 */
import { z } from 'zod';

const id = z.string().min(1).max(64);

export const councilRoleSchema = z.enum(['chancellor', 'marshal', 'steward', 'spymaster', 'scholar']);
export const councilTaskSchema = z.enum([
  'chancellor_relations',
  'chancellor_prestige',
  'marshal_train',
  'marshal_control',
  'steward_taxes',
  'steward_develop',
  'spymaster_secrets',
  'spymaster_disrupt',
  'scholar_fervor',
  'scholar_develop',
]);
export const skillSchema = z.enum(['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning']);
export const unitSchema = z.enum([
  'footmen',
  'archers',
  'pikemen',
  'light_cavalry',
  'heavy_cavalry',
  'horse_archers',
  'war_elephants',
  'siege_engines',
]);
export const schemeTypeSchema = z.enum(['murder', 'discover_secrets', 'fabricate_hook', 'seduce', 'befriend', 'sway', 'claim']);
export const cbSchema = z.enum([
  'county_claim',
  'duchy_claim',
  'kingdom_claim',
  'independence',
  'claimant',
  'holy_war',
  'conquest',
]);
export const decisionSchema = z.enum(['feast', 'pilgrimage', 'hunt', 'tournament', 'seclusion']);

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('marriage.propose'), payload: z.object({ characterId: id, targetId: id, useHook: z.boolean().optional() }) }),
  z.object({ type: z.literal('proposal.respond'), payload: z.object({ proposalId: id, accept: z.boolean() }) }),
  z.object({ type: z.literal('title.grant'), payload: z.object({ titleId: id, toCharacterId: id }) }),
  z.object({ type: z.literal('title.revoke'), payload: z.object({ titleId: id }) }),
  z.object({ type: z.literal('title.create'), payload: z.object({ titleId: id }) }),
  z.object({ type: z.literal('council.assign'), payload: z.object({ role: councilRoleSchema, characterId: id.nullable() }) }),
  z.object({
    type: z.literal('council.task'),
    payload: z.object({ role: councilRoleSchema, task: councilTaskSchema, provinceId: id.nullable().optional() }),
  }),
  z.object({ type: z.literal('building.construct'), payload: z.object({ provinceId: id, buildingId: id }) }),
  z.object({ type: z.literal('scheme.start'), payload: z.object({ schemeType: schemeTypeSchema, targetId: id }) }),
  z.object({ type: z.literal('scheme.cancel'), payload: z.object({ schemeId: id }) }),
  z.object({
    type: z.literal('war.declare'),
    payload: z.object({ targetId: id, cb: cbSchema, titleId: id.nullable().optional(), claimantId: id.nullable().optional() }),
  }),
  z.object({ type: z.literal('war.callAlly'), payload: z.object({ warId: id, allyId: id }) }),
  z.object({ type: z.literal('war.offerPeace'), payload: z.object({ warId: id, kind: z.enum(['enforce', 'white', 'surrender']) }) }),
  z.object({ type: z.literal('army.raise'), payload: z.object({ provinceId: id.optional() }) }),
  z.object({ type: z.literal('subject.tribute'), payload: z.object({ pactId: id, level: z.enum(['light', 'normal', 'heavy']) }) }),
  z.object({ type: z.literal('subject.release'), payload: z.object({ pactId: id }) }),
  z.object({ type: z.literal('army.disband'), payload: z.object({ armyId: id }) }),
  z.object({ type: z.literal('army.move'), payload: z.object({ armyId: id, to: id }) }),
  z.object({ type: z.literal('army.merge'), payload: z.object({ armyId: id, intoId: id }) }),
  z.object({ type: z.literal('army.commander'), payload: z.object({ armyId: id, commanderId: id.nullable() }) }),
  z.object({ type: z.literal('army.recruit'), payload: z.object({ unit: unitSchema, men: z.number().int().min(100).max(2000) }) }),
  z.object({ type: z.literal('event.choose'), payload: z.object({ activeEventId: id, choiceId: id }) }),
  z.object({ type: z.literal('diplomacy.gift'), payload: z.object({ targetId: id, amount: z.number().int().min(10).max(5000) }) }),
  z.object({ type: z.literal('diplomacy.alliance'), payload: z.object({ targetId: id, useHook: z.boolean().optional() }) }),
  z.object({ type: z.literal('diplomacy.breakAlliance'), payload: z.object({ targetId: id }) }),
  z.object({ type: z.literal('diplomacy.vassalize'), payload: z.object({ targetId: id, useHook: z.boolean().optional() }) }),
  z.object({ type: z.literal('diplomacy.independence'), payload: z.object({ vassalId: id }) }),
  z.object({ type: z.literal('character.imprison'), payload: z.object({ targetId: id }) }),
  z.object({ type: z.literal('character.release'), payload: z.object({ targetId: id }) }),
  z.object({ type: z.literal('character.execute'), payload: z.object({ targetId: id }) }),
  z.object({ type: z.literal('character.invite'), payload: z.object({ targetId: id }) }),
  z.object({ type: z.literal('character.guardian'), payload: z.object({ childId: id, tutorId: id.nullable(), focus: skillSchema }) }),
  z.object({ type: z.literal('character.designateHeir'), payload: z.object({ heirId: id.nullable() }) }),
  z.object({ type: z.literal('prisoner.ransom'), payload: z.object({ prisonerId: id }) }),
  z.object({ type: z.literal('succession.vote'), payload: z.object({ titleId: id, candidateId: id }) }),
  z.object({ type: z.literal('secret.expose'), payload: z.object({ secretId: id }) }),
  z.object({ type: z.literal('faction.join'), payload: z.object({ factionId: id }) }),
  z.object({ type: z.literal('faction.leave'), payload: z.object({ factionId: id }) }),
  z.object({ type: z.literal('realm.crownAuthority'), payload: z.object({ level: z.number().int().min(0).max(3) }) }),
  z.object({ type: z.literal('realm.successionLaw'), payload: z.object({ titleId: id, law: z.enum(['partition', 'primogeniture', 'elective', 'seniority']) }) }),
  z.object({ type: z.literal('decision.take'), payload: z.object({ decision: decisionSchema }) }),
  // Outils de développement — refusés par le serveur hors mode dev.
  z.object({ type: z.literal('dev.addResources'), payload: z.object({ gold: z.number().optional(), prestige: z.number().optional() }) }),
  z.object({ type: z.literal('dev.killCharacter'), payload: z.object({ characterId: id }) }),
  z.object({ type: z.literal('dev.triggerEvent'), payload: z.object({ eventId: id }) }),
  z.object({ type: z.literal('dev.completeConstruction'), payload: z.object({ provinceId: id }) }),
  z.object({ type: z.literal('dev.switchCharacter'), payload: z.object({ characterId: id }) }),
]);

export type GameCommand = z.infer<typeof commandSchema>;
export type CommandType = GameCommand['type'];
export type CommandOf<T extends CommandType> = Extract<GameCommand, { type: T }>;

export const commandEnvelopeSchema = z.object({
  commandId: z.string().min(8).max(64),
  expectedVersion: z.number().int().nonnegative().optional(),
  command: commandSchema,
});

export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

export function isDevCommand(cmd: GameCommand): boolean {
  return cmd.type.startsWith('dev.');
}

export type DecisionId = z.infer<typeof decisionSchema>;
