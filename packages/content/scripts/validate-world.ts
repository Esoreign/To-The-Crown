import { CONTENT, WORLD } from '../src/index';
import { validateContent, validateWorld } from '../src/validate';

const errors = [...validateWorld(WORLD), ...validateContent(CONTENT)];
if (errors.length) {
  console.error(`${errors.length} erreur(s) :`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(
  `Monde valide : ${WORLD.provinces.length} provinces, ${WORLD.titles.length} titres ; contenu : ${CONTENT.traits.length} traits, ${CONTENT.buildings.length} bâtiments, ${CONTENT.events.length} événements.`,
);
