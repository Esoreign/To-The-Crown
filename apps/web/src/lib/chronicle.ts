/**
 * Mise en récit des entrées de chronique (identifiants → noms).
 */
import { PROVINCE_GEO } from '@ttc/game-core';
import type { ChronicleEntry, GameView } from '@ttc/shared';
import { t, tOr } from './i18n';
import { charName, titleFullName } from './format';

type View = Pick<GameView, 'characters' | 'houses'>;

function who(view: View, id: string | number | undefined): string {
  if (id === undefined || id === '') return 'un inconnu';
  const c = view.characters[String(id)];
  return c ? charName(view, c) : String(id);
}

const CAUSE: Record<string, string> = {
  natural: 'de vieillesse',
  illness: 'de maladie',
  battle: 'au combat',
  murder: 'assassiné',
  execution: 'exécuté',
  accident: 'd’un accident',
  childbirth: 'en couches',
  duel: 'en duel',
  stress: 'de désespoir',
};

export function chronicleText(view: View, e: ChronicleEntry): string {
  const v = e.vars;
  switch (e.kind) {
    case 'game_start':
      return '1er janvier 1400 : de Paris à Pékin, de Tombouctou à Tenochtitlan, chaque dynastie écrit son histoire.';
    case 'coronation':
      return `${who(view, v.name)} est couronné et proclame le ${titleFullName(String(v.title)).toLowerCase()}.`;
    case 'title_created':
      return `${who(view, v.name)} fonde le ${titleFullName(String(v.title)).toLowerCase()}.`;
    case 'royal_marriage':
      return `Mariage de ${who(view, v.a)} et ${who(view, v.b)}.`;
    case 'heir_born':
      return `Naissance de ${who(view, v.name)}, enfant de ${who(view, v.parent)}.`;
    case 'ruler_death':
      return `${who(view, v.name)}${v.title ? `, ${titleFullName(String(v.title))},` : ''} meurt ${CAUSE[String(v.cause)] ?? ''} à ${v.age} ans.`;
    case 'great_battle':
      return `Grande bataille à ${v.province} : ${who(view, v.winner)} l’emporte sur ${who(view, v.loser)} (${v.men} combattants).`;
    case 'war_start':
      return `${who(view, v.attacker)} déclare la guerre à ${who(view, v.defender)} (${t(`cb.${v.cb}`)}).`;
    case 'war_end': {
      const res = v.result === 'attacker' ? `victoire de ${who(view, v.attacker)}` : v.result === 'defender' ? `${who(view, v.defender)} repousse l’assaut` : 'paix blanche';
      return `Fin de la guerre entre ${who(view, v.attacker)} et ${who(view, v.defender)} : ${res}${v.title ? ` (${titleFullName(String(v.title))})` : ''}.`;
    }
    case 'usurpation':
      return v.kind === 'independence' ? `${who(view, v.name)} arrache son indépendance.` : `${who(view, v.name)} s’empare du ${titleFullName(String(v.title)).toLowerCase()}.`;
    case 'murder_discovered':
      return `Le crime de ${who(view, v.name)} est découvert : un meurtre éclabousse la cour.`;
    case 'dynasty_end':
      return `Avec ${who(view, v.name)} s’éteint une lignée.`;
    case 'event': {
      const text = tOr(String(v.text), String(v.text));
      return text.replace('{root}', who(view, v.root)).replace('{target}', who(view, v.target));
    }
    default:
      return t(`chronicle.${e.kind}`);
  }
}

export function chroniclePlace(v: Record<string, string | number>): string | null {
  const p = v.province && PROVINCE_GEO[String(v.province)];
  return p ? p.name : null;
}
