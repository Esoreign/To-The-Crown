# Direction artistique

**« Manuscrit royal sombre »** : obsidienne, bronze et or pour l'interface ; parchemin pour les moments narratifs ; une carte peinte, lisible à toutes les échelles.

## Palette (jetons `apps/web/src/styles/tokens.css`)

| Rôle | Couleurs |
| --- | --- |
| Fonds | `#0b0908` → `#1b1612` |
| Panneaux | obsidienne translucide `rgba(20,16,13,.92)`, grain procédural |
| Bronze / or | `#7a5a32`, `#9a7641`, `#c9a24b`, `#d9b865`, `#ead08f` |
| Parchemin | `#f4ead3`, `#e8d9b5`, `#d8c294`, encre `#2c2016` |
| Sémantique | danger `#9e2f2f`/`#d1504a`, succès `#3f6b3a`/`#7fb069`, diplomatie `#2c3e64` |

## Typographie

- **Cinzel** : titres, noms propres, boutons (capitales romaines).
- **Cormorant Garamond** : textes narratifs (événements, chronique, accroches).
- **Inter** : données, info-bulles, tableaux (chiffres tabulaires).

## Carte

- Politique : couleur du titre principal du souverain indépendant, ombres de relief, frontières hiérarchisées (comté fin, duché, royaume épais doré).
- Terrain peint pré-rendu (plaines, cultures, collines, montagnes, forêts, marais, steppes, falaises), fleuves à largeur croissante, mer animée.
- Zoom sémantique : noms de royaumes courbés au loin, duchés puis comtés, blasons et reliefs de près.
- Huit modes : politique, terrain, cultures, confessions, économie, développement, contrôle, relations.
- Écran de sélection : même carte en style parchemin, royaume choisi à l'encre rouge.

## Art procédural

- **Blasons** (`art/heraldry.ts`) : champ, partitions, pièces honorables et meubles tirés d'une graine, couronne selon le rang.
- **Portraits** (`art/portrait.ts`) : visage, âge (rides, cheveux gris), sexe, culture (teint, cheveux), vêtements aux couleurs de la maison, couronne, santé (pâleur), décès (grisé).
- **Illustrations d'événements** (`art/scenes.ts`) : vingt compositions en silhouettes (salle du trône, conseil, chapelle, champ de bataille, cachot, port…), lumière chaude ou froide.

## Son

WebAudio uniquement (`audio/audio.ts`) : musique modale dorienne générée, ambiance de vent, effets synthétisés (clic, notification, événement, guerre, bataille, mort, naissance, pièce, fanfare). Volumes séparés dans les paramètres.

## Mouvement et accessibilité

Transitions de 120 à 600 ms, désactivées avec « Réduire les mouvements » ou `prefers-reduced-motion`. Focus visible doré, navigation clavier complète, raccourcis documentés, taille d'interface 90–125 %, rôles ARIA sur les fenêtres, menus et barres d'outils.
