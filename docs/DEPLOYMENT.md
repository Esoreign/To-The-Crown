# Mettre le jeu en ligne (Supabase + Render)

Résultat : un lien du type `https://to-the-crown.onrender.com` à partager avec vos amis.

- **Supabase** garde la base de données (comptes, parties, sauvegardes).
- **Render** fait tourner le jeu (serveur + site + musique) en continu.

> Vercel ne convient pas : il coupe les programmes au bout de quelques secondes, alors que le serveur de jeu doit rester allumé pour faire avancer le temps et relier les joueurs en direct.

## 1. Supabase (déjà préparé)

Le projet Supabase **To The Crown** contient déjà toutes les tables du jeu, verrouillées (inaccessibles depuis l'API publique de Supabase) et les données de référence.

Il reste à récupérer **l'adresse de connexion** :

1. Ouvrez le projet **To The Crown** sur supabase.com.
2. Cliquez sur **Connect** (en haut).
3. Choisissez **Session pooler** et copiez l'adresse (elle commence par `postgresql://postgres.`).
4. Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base. Oublié ? *Project Settings › Database › Reset database password*.
5. Ajoutez à la fin : `?sslmode=no-verify` (connexion chiffrée).

Exemple (inventé) :

```
postgresql://postgres.abcdefgh:MonMotDePasse@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=no-verify
```

Utilisez bien le **Session pooler** : c'est lui qui fonctionne depuis Render.

## 2. Render

1. Créez un compte sur render.com avec votre compte GitHub, et autorisez l'accès au dépôt `to-the-crown`.
2. **New › Blueprint**, choisissez le dépôt et la branche du jeu. Render lit le fichier `render.yaml` et prépare le service **to-the-crown**.
3. Remplissez les deux champs demandés :
   - `DATABASE_URL` : l'adresse Supabase de l'étape 1 ;
   - `APP_ORIGIN` : `https://to-the-crown.onrender.com` (l'adresse de votre service ; si Render en donne une autre, recopiez-la ici, sans `/` à la fin).
4. Validez. La première construction prend 5 à 10 minutes.
5. Ouvrez l'adresse du service : le jeu s'affiche. Créez vos comptes et jouez.

`SESSION_SECRET` est généré automatiquement par Render.

## Bon à savoir

- **Offre gratuite de Render** (à vérifier sur leur site) : le service s'endort après un moment sans visite ; la première visite suivante prend environ une minute. Les parties sont sauvegardées dans Supabase avant l'arrêt et reprennent ensuite.
- **Mise à jour** : chaque `git push` sur la branche relance automatiquement la construction.
- **En cas de souci** : onglet *Logs* du service sur Render. L'adresse `/api/health` doit répondre `{"status":"ok"…}`.

## Autres façons de lancer le jeu

- Sur votre ordinateur, avec Docker : voir le README (`docker compose up --build`).
- Toute plateforme capable de construire le `Dockerfile` (`infra/docker/Dockerfile`, étape par défaut « tout-en-un ») et de fournir `DATABASE_URL`, `SESSION_SECRET` et `APP_ORIGIN`.
