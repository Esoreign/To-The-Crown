import { describe, expect, it } from 'vitest';
import { getScenario } from '@ttc/content';
import type { Effect } from '@ttc/shared';
import { scenarioView } from '../map/scenarioView';
import { describeEffects, resolveEventText } from './eventText';
import { deLand, deName, rulerTitle, styledName, titleFullName } from './format';
import { chronicleText } from './chronicle';

const scenario = getScenario('monde_1400');
const view = scenarioView(scenario);
const rulerOf = (polity: string) => view.characters[view.titles[scenario.polities![polity]!.titleId]!.holderId!]!;
const aelis = rulerOf('brb');
const aldren = rulerOf('fra');
const torvald = rulerOf('ott');

describe('noms et titres', () => {
  it('élide devant une voyelle, pas devant un h, et accorde les pluriels', () => {
    expect(deName('Angleterre')).toBe('d’Angleterre');
    expect(deName('France')).toBe('de France');
    expect(deName('Hongrie')).toBe('de Hongrie');
    expect(deLand('Ottomans')).toBe('des Ottomans');
    expect(deName('Charles')).toBe('de Charles');
  });

  it('forme les titres selon le rang, le sexe et le gouvernement', () => {
    expect(rulerTitle(aelis)).toBe('Duchesse de Brabant');
    expect(styledName(view, aelis)).toBe('Duchesse Jeanne de Brabant');
    expect(rulerTitle(aldren)).toBe('Roi de France');
    expect(rulerTitle(torvald)).toBe('Sultan des Ottomans');
    expect(rulerTitle(rulerOf('ven'))).toBe('Doge de Venise');
    expect(titleFullName('k_fra')).toBe('Royaume de France');
    expect(titleFullName('e_ott')).toBe('Sultanat ottoman');
  });
});

describe('texte des événements', () => {
  it('remplace les variables de portée et accorde en genre', () => {
    const text = resolveEventText(view, '{target.name} est venu{target.e} voir {root.name}, {target.il} attend.', { root: aelis.id, target: aldren.id });
    expect(text).toBe('Charles est venu voir Jeanne, il attend.');
    const fem = resolveEventText(view, '{target.le} {target.seigneur} est venu{target.e}.', { root: aldren.id, target: aelis.id });
    expect(fem).toBe('la dame est venue.');
  });

  it('laisse une portée absente lisible', () => {
    expect(resolveEventText(view, 'Voir {other.name}.', { root: aelis.id })).toBe('Voir ….');
  });

  it('décrit les effets tels qu’ils seront appliqués', () => {
    const effects: Effect[] = [
      { addGold: -50 },
      { addOpinion: { towards: 'root', value: 15, reason: 'gift' }, who: 'target' },
      { chance: 40, then: [{ addTrait: 'wounded' }], else: [{ addPrestige: 10 }] },
    ];
    const lines = describeEffects(view, effects, { root: aelis.id, target: aldren.id });
    expect(lines[0]).toMatchObject({ text: '−50 or', tone: 'neg', depth: 0 });
    expect(lines[1]!.text).toBe('Opinion de Charles envers vous : +15');
    expect(lines[2]!.text).toBe('40 % de chances :');
    expect(lines[3]!.depth).toBe(1);
    expect(lines.some((l) => l.text === 'Sinon :')).toBe(true);
    expect(lines[lines.length - 1]).toMatchObject({ text: '+10 prestige', tone: 'pos', depth: 1 });
  });
});

describe('chronique', () => {
  it('raconte une guerre avec les noms des souverains', () => {
    const text = chronicleText(view, {
      id: 'x',
      date: view.date,
      kind: 'war_start',
      vars: { attacker: aldren.id, defender: aelis.id, cb: 'kingdom_claim' },
      characterIds: [],
      houseIds: [],
    });
    expect(text).toContain('déclare la guerre à');
    expect(text).toContain('Charles');
    expect(text).toContain('Jeanne');
  });
});
