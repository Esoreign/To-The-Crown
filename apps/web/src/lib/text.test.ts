import { describe, expect, it } from 'vitest';
import { getScenario } from '@ttc/content';
import type { Effect } from '@ttc/shared';
import { scenarioView } from '../map/scenarioView';
import { describeEffects, resolveEventText } from './eventText';
import { deName, rulerTitle, styledName, titleFullName } from './format';
import { chronicleText } from './chronicle';

const view = scenarioView(getScenario('couronne_brisee'));
const aelis = view.characters.ch1!;
const aldren = view.characters.ch30!;
const torvald = view.characters.ch320!;

describe('noms et titres', () => {
  it('élide devant une voyelle mais pas devant un h', () => {
    expect(deName('Aurevanne')).toBe('d’Aurevanne');
    expect(deName('Valorie')).toBe('de Valorie');
    expect(deName('Hrovmark')).toBe('de Hrovmark');
  });

  it('forme les titres selon le rang et le sexe', () => {
    expect(rulerTitle(aelis)).toBe('Reine de Valorie');
    expect(styledName(view, aelis)).toBe('Reine Aélis de Valorie');
    expect(rulerTitle(torvald)).toBe('Empereur de Hrovmark');
    expect(titleFullName('e_hrovmark')).toBe('Empire de Hrovmark');
    expect(titleFullName('k_valorie')).toBe('Royaume de Valorie');
  });
});

describe('texte des événements', () => {
  it('remplace les variables de portée et accorde en genre', () => {
    const text = resolveEventText(view, '{target.name} est venu{target.e} voir {root.name}, {target.il} attend.', { root: aelis.id, target: aldren.id });
    expect(text).toBe('Aldren est venu voir Aélis, il attend.');
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
    expect(lines[1]!.text).toBe('Opinion d’Aldren envers vous : +15');
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
    expect(text).toContain('Aldren de Veyr déclare la guerre à Aélis de Valorie');
  });
});
