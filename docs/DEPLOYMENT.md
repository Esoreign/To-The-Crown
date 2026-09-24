# Mettre le jeu en ligne

Deux façons, au choix :

| | Vercel + Supabase (recommandé pour jouer entre amis) | Render + Supabase |
| --- | --- | --- |
| Serveur | aucun : le jeu tourne dans le navigateur de l'hôte | serveur de jeu Node allumé en continu |
| Coût | gratuit | gratuit (le service s'endort) |
| À savoir | la page de celui qui a créé la partie doit rester ouverte | rien de particulier |

## A. Vercel + Supabase (sans serveur)

### 1. Supabase (déjà fait)

Le projet Supabase **To The Crown** est prêt : tables verrouillées, et fonctions du jeu installées (`database/migrations/*.sql` puis `database/supabase/web_mode.sql`). Son adresse et sa clé publique sont déjà dans `apps/web/.env.supabase`.

Pour un autre projet Supabase : exécutez ces fichiers SQL dans l'ordre (SQL Editor), puis remplacez l'adresse et la clé « publishable » dans `apps/web/.env.supabase` (ou définissez `VITE_SUPABASE_URL` et `VITE_SUPABASE_KEY` sur Vercel). Dans *Realtime › Settings*, laissez l'accès public activé.

### 2. Vercel

1. Sur vercel.com, **Add New › Project**, importez le dépôt GitHub `to-the-crown`.
2. Ne touchez à rien : le fichier `vercel.json` règle tout (installation, construction, dossier `apps/web/dist`).
3. **Deploy**. Au bout de 2–3 minutes, Vercel donne un lien du type `https://to-the-crown.vercel.app`.
4. Envoyez ce lien à vos amis. Chacun crée son compte sur le site.

Chaque `git push` sur la branche de production met le site à jour.

### Jouer

- **Solo** : *Nouvelle partie*. La partie est enregistrée dans Supabase ; *Continuer* la reprend.
- **À plusieurs** : l'un crée un salon (*Multijoueur*), donne le **code d'invitation**, les autres le saisissent. Chacun choisit son souverain, puis l'hôte lance.
- **L'hôte doit garder la page du jeu ouverte** (elle peut être en arrière-plan). S'il la ferme, la partie se met en pause pour tout le monde et reprend quand il revient.

## B. Render + Supabase (serveur de jeu)

### 1. Adresse de la base

1. Ouvrez le projet **To The Crown** sur supabase.com, cliquez sur **Connect**.
2. Choisissez **Session pooler** et copiez l'adresse (elle commence par `postgresql://postgres.`).
3. Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base (oublié ? *Project Settings › Database › Reset database password*) et ajoutez à la fin `?sslmode=no-verify`.

### 2. Render

1. Créez un compte sur render.com avec GitHub et autorisez l'accès au dépôt.
2. **New › Blueprint**, choisissez le dépôt : Render lit `render.yaml`.
3. Renseignez `DATABASE_URL` (étape 1) et `APP_ORIGIN` (`https://to-the-crown.onrender.com`, sans `/` final).
4. Validez (5 à 10 minutes). `/api/health` doit répondre `{"status":"ok"…}`.

Offre gratuite : le service s'endort après un moment sans visite ; la première visite suivante prend environ une minute.

## Autres façons de lancer le jeu

- Sur votre ordinateur avec Docker : voir le README (`docker compose up --build`).
- Toute plateforme capable de construire `infra/docker/Dockerfile` (étape « tout-en-un ») avec `DATABASE_URL`, `SESSION_SECRET` et `APP_ORIGIN`.
