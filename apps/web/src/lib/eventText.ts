/**
 * Texte des événements : résolution des variables {portée.variable} et
 * description automatique des effets d'un choix (ce qui est annoncé est
 * exactement ce qui est appliqué par le moteur).
 */
import { PROVINCE_GEO, fullName, primaryTitleId, topLiegeId, type EventScope } from '@ttc/game-core';
import type { Character, Effect, GameView, ScopeRef } from '@ttc/shared';
import { fmtSigned, t, tOr, traitName } from './i18n';
import { deName, rulerTitle, titleName } from './format';

type View = Pick<GameView, 'characters' | 'houses' | 'titles' | 'date'>;

function relTo(view: View, c: Character, root: Character | undefined): string {
  if (!root || c.id === root.id) return '';
  const f = c.sex === 'F';
  if (root.spouseId === c.id) return f ? 'votre épouse' : 'votre époux';
  if (c.fatherId === root.id || c.motherId === root.id) return f ? 'votre fille' : 'votre fils';
  if (root.fatherId === c.id) return 'votre père';
  if (root.motherId === c.id) return 'votre mère';
  if ((c.fatherId && c.fatherId === root.fatherId) || (c.motherId && c.motherId === root.motherId)) return f ? 'votre sœur' : 'votre frère';
  if (root.liegeId === c.id) return f ? 'votre suzeraine' : 'votre suzerain';
  if (c.liegeId === root.id && c.titleIds.length) return f ? 'votre vassale' : 'votre vassal';
  if (c.courtId === root.id) return f ? 'votre courtisane' : 'votre courtisan';
  return '';
}

function charVar(view: View, c: Character, key: string, root: Character | undefined): string | undefined {
  const f = c.sex === 'F';
  switch (key) {
    case 'name':
      return c.firstName;
    case 'fullname':
      return fullName(view, c);
    case 'title': {
      const tt = rulerTitle(c);
      if (!tt) return c.firstName;
      return `${f ? 'la' : 'le'} ${tt.charAt(0).toLowerCase()}${tt.slice(1)}`;
    }
    case 'house':
      return c.houseId ? (view.houses[c.houseId]?.name ?? '') : '';
    case 'age':
      return String(Math.floor((view.date - c.birth) / 365));
    case 'culture':
      return tOr(`culture.${c.cultureId}`, c.cultureId);
    case 'faith':
      return tOr(`faith.${c.faithId}`, c.faithId);
    case 'realm': {
      const top = view.characters[topLiegeId(view, c.id)] ?? c;
      const pt = primaryTitleId(top) ?? primaryTitleId(c);
      return pt ? titleName(pt) : 'Caldria';
    }
    case 'rel':
      return relTo(view, c, root) || c.firstName;
    case 'il':
      return f ? 'elle' : 'il';
    case 'le':
      return f ? 'la' : 'le';
    case 'e':
      return f ? 'e' : '';
    case 'fils':
      return f ? 'fille' : 'fils';
    case 'seigneur':
      return f ? 'dame' : 'seigneur';
    default:
      return undefined;
  }
}

/** Remplace les variables d'un texte d'événement. */
export function resolveEventText(view: View, text: string, scope: EventScope): string {
  const root = view.characters[scope.root];
  return text.replace(/\{([a-z]+)\.([a-z_]+)\}/g, (match, ref: string, key: string) => {
    if (ref === 'province') {
      return key === 'name' && scope.provinceId ? (PROVINCE_GEO[scope.provinceId]?.name ?? match) : match;
    }
    const id = scope[ref as ScopeRef];
    const c = id ? view.characters[id] : undefined;
    if (!c) return ref === 'root' ? 'vous' : '…';
    return charVar(view, c, key, root) ?? match;
  });
}

function who(view: View, scope: EventScope, ref: ScopeRef | undefined, capital = false): string {
  const r = ref ?? 'root';
  if (r === 'root') return capital ? 'Vous' : 'vous';
  const id = scope[r];
  const c = id ? view.characters[id] : undefined;
  return c ? c.firstName : '…';
}

const num = (v: number, d = 0) => fmtSigned(v, d);

/** Description lisible des effets (une ligne par effet, imbrication indentée). */
export function describeEffects(view: View, effects: Effect[], scope: EventScope, depth = 0): { text: string; tone: 'pos' | 'neg' | ''; depth: number }[] {
  const out: { text: string; tone: 'pos' | 'neg' | ''; depth: number }[] = [];
  const push = (text: string, v = 0) => out.push({ text, tone: v > 0 ? 'pos' : v < 0 ? 'neg' : '', depth });
  const subject = (ref: ScopeRef | undefined) => (ref && ref !== 'root' ? `${who(view, scope, ref, true)} : ` : '');
  for (const e of effects) {
    if ('addGold' in e) push(`${subject(e.who)}${num(e.addGold)} or`, e.addGold);
    else if ('addPrestige' in e) push(`${subject(e.who)}${num(e.addPrestige)} prestige`, e.addPrestige);
    else if ('addAuthority' in e) push(`${subject(e.who)}${num(e.addAuthority)} autorité`, e.addAuthority);
    else if ('addFervor' in e) push(`${subject(e.who)}${num(e.addFervor)} ferveur`, e.addFervor);
    else if ('addRenown' in e) push(`${subject(e.who)}${num(e.addRenown)} renommée dynastique`, e.addRenown);
    else if ('addStress' in e) push(`${subject(e.who)}${num(e.addStress)} stress`, -e.addStress);
    else if ('addHealth' in e) push(`${subject(e.who)}${num(e.addHealth, 1)} santé`, e.addHealth);
    else if ('addOpinion' in e) {
      const o = e.addOpinion;
      push(`Opinion de ${who(view, scope, e.who)} envers ${who(view, scope, o.towards)} : ${num(o.value)}${o.months ? ` (${o.months} mois)` : ''}`, o.value);
    } else if ('addMutualOpinion' in e) {
      const o = e.addMutualOpinion;
      push(`Opinion mutuelle entre ${who(view, scope, e.who)} et ${who(view, scope, o.with)} : ${num(o.value)}`, o.value);
    } else if ('addTrait' in e) {
      const c = view.characters[scope[e.who ?? 'root'] ?? ''];
      push(`${subject(e.who)}gagne le trait « ${traitName(e.addTrait, c?.sex)} »`);
    } else if ('removeTrait' in e) {
      const c = view.characters[scope[e.who ?? 'root'] ?? ''];
      push(`${subject(e.who)}perd le trait « ${traitName(e.removeTrait, c?.sex)} »`);
    } else if ('addSkill' in e) push(`${subject(e.who)}${t(`skill.${e.addSkill.skill}`)} ${num(e.addSkill.value)}`, e.addSkill.value);
    else if ('addModifier' in e) {
      const vals = Object.entries(e.addModifier.values)
        .map(([k, v]) => `${tOr(`modkey.${k}`, k)} ${num(v ?? 0, Math.abs(v ?? 0) < 1 ? 2 : 0)}`)
        .join(', ');
      push(`${subject(e.who)}« ${tOr(`modifier.${e.addModifier.id}`, e.addModifier.id.replace(/_/g, ' '))} »${e.addModifier.months ? ` pendant ${e.addModifier.months} mois` : ''} : ${vals}`);
    } else if ('removeModifier' in e) push(`${subject(e.who)}fin de « ${tOr(`modifier.${e.removeModifier}`, e.removeModifier.replace(/_/g, ' '))} »`);
    else if ('createSecret' in e) push(`${subject(e.who)}un secret naît : ${t(`secret.${e.createSecret.type}`)}`, -1);
    else if ('discoverSecret' in e) push(`${subject(e.who)}découvre un secret de ${who(view, scope, e.discoverSecret.of)}`, 1);
    else if ('exposeSecret' in e) push(`Un secret de ${who(view, scope, e.exposeSecret.of)} est révélé`);
    else if ('createHook' in e) push(`${subject(e.who)}obtient un levier ${e.createHook.strong ? 'fort ' : ''}sur ${who(view, scope, e.createHook.on)}`, 1);
    else if ('addClaim' in e) push(`${subject(e.who)}obtient une revendication`, 1);
    else if ('startScheme' in e) push(`${subject(e.who)}lance un complot : ${t(`scheme.${e.startScheme.type}`)} contre ${who(view, scope, e.startScheme.target)}`);
    else if ('changeControl' in e) push(`Contrôle de la province ${num(e.changeControl)}`, e.changeControl);
    else if ('changeDevelopment' in e) push(`Développement ${num(e.changeDevelopment, 1)}`, e.changeDevelopment);
    else if ('changeLevies' in e) push(`Levées ${num(e.changeLevies)}`, e.changeLevies);
    else if ('killCharacter' in e) push(`${who(view, scope, e.who, true)} meurt`, -1);
    else if ('woundCharacter' in e) push(`${who(view, scope, e.who, true)} est blessé`, -1);
    else if ('imprison' in e) push(`${who(view, scope, e.who, true)} est emprisonné par ${who(view, scope, e.imprison.by)}`);
    else if ('release' in e) push(`${who(view, scope, e.who, true)} est libéré`);
    else if ('createRelationship' in e) push(`${who(view, scope, e.who, true)} et ${who(view, scope, e.createRelationship.with)} : ${t(`relation.${e.createRelationship.type}`)}`);
    else if ('breakRelationship' in e) push(`Fin du lien « ${t(`relation.${e.breakRelationship.type}`)} » avec ${who(view, scope, e.breakRelationship.with)}`);
    else if ('spawnCourtier' in e) push('Un nouveau venu rejoint votre cour', 1);
    else if ('banish' in e) push(`${who(view, scope, e.who, true)} est banni de la cour`);
    else if ('recruitMaa' in e) push(`+${e.recruitMaa.men} ${t(`unit.${e.recruitMaa.unit}`)}`, 1);
    else if ('addVassalOpinion' in e) push(`Opinion de vos vassaux : ${num(e.addVassalOpinion)}`, e.addVassalOpinion);
    else if ('chance' in e) {
      push(`${Math.round(e.chance)} % de chances :`);
      out.push(...describeEffects(view, e.then, scope, depth + 1));
      if (e.else?.length) {
        push('Sinon :');
        out.push(...describeEffects(view, e.else, scope, depth + 1));
      }
    } else if ('if' in e) {
      push('Selon les circonstances :');
      out.push(...describeEffects(view, e.then, scope, depth + 1));
      if (e.else?.length) {
        push('Sinon :');
        out.push(...describeEffects(view, e.else, scope, depth + 1));
      }
    } else if ('triggerEvent' in e) push('L’affaire aura des suites…');
    // setFlag, clearFlag, chronicle, none : invisibles pour le joueur.
  }
  return out;
}

export { deName };
