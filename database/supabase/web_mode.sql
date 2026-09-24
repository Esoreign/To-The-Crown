-- =============================================================================
-- To The Crown — mode « navigateur » (site statique + Supabase, sans serveur).
--
-- À appliquer APRÈS les migrations de `database/migrations` (tables du jeu et
-- RLS). Le client n'accède jamais directement aux tables (RLS sans politique) :
-- il appelle uniquement les fonctions `public.ttc_*` ci-dessous, qui vérifient
-- le jeton de session à chaque appel. Script idempotent (ré-exécutable).
--
-- Mots de passe : bcrypt (pgcrypto, coût 10) — Argon2 n'existe pas dans
-- PostgreSQL. Sessions : seul le SHA-256 du jeton est stocké.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists ttc_private;
revoke all on schema ttc_private from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema ttc_private from anon, authenticated';
  end if;
end $$;

-- Présence dans le salon (sondage régulier du client).
create table if not exists public.web_presence (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
alter table public.web_presence enable row level security;

-- Limitation de débit (inscriptions, connexions échouées, créations de parties).
create table if not exists public.web_rate_events (
  id bigserial primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists web_rate_events_key_idx on public.web_rate_events (key, at);
alter table public.web_rate_events enable row level security;

-- -----------------------------------------------------------------------------
-- Outils internes (schéma non exposé)
-- -----------------------------------------------------------------------------

-- Erreur métier : le code (ErrorCodes) passe dans `hint`, le message en français.
-- Quand une écriture doit survivre à l'erreur (compteur de tentatives), la
-- fonction renvoie plutôt `{"error": {"code", "message"}}`.
create or replace function ttc_private.fail(p_code text, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using message = p_message, hint = p_code, errcode = 'P0001';
end $$;

create or replace function ttc_private.client_ip()
returns text language plpgsql stable set search_path = '' as $$
declare
  v_headers jsonb;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  return coalesce(nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''), 'local');
exception when others then
  return 'local';
end $$;

-- Compte les événements récents d'une clé ; au-delà de la limite, erreur RATE_LIMITED.
create or replace function ttc_private.rate_check(p_key text, p_limit int, p_window interval, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.web_rate_events where key = p_key and at > now() - p_window) >= p_limit then
    perform ttc_private.fail('RATE_LIMITED', p_message);
  end if;
end $$;

create or replace function ttc_private.rate_hit(p_key text)
returns void language sql set search_path = '' as $$
  insert into public.web_rate_events (key) values (p_key);
$$;

create or replace function ttc_private.hash_token(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function ttc_private.user_json(p_user public.users)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p_user.id, 'username', p_user.username, 'email', p_user.email, 'createdAt', p_user.created_at);
$$;

create or replace function ttc_private.new_session(p_user uuid)
returns text language plpgsql set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.sessions (user_id, token_hash, expires_at, user_agent)
  values (p_user, ttc_private.hash_token(v_token), now() + interval '30 days', 'web');
  return v_token;
end $$;

-- Utilisateur du jeton (null si absent, expiré ou révoqué).
create or replace function ttc_private.try_user(p_token text)
returns uuid language sql stable set search_path = '' as $$
  select s.user_id from public.sessions s
  where s.token_hash = ttc_private.hash_token(p_token) and s.revoked_at is null and s.expires_at > now()
  limit 1;
$$;

create or replace function ttc_private.require_user(p_token text)
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v_user uuid := ttc_private.try_user(p_token);
begin
  if v_user is null then
    perform ttc_private.fail('AUTH_REQUIRED', 'Connexion requise');
  end if;
  return v_user;
end $$;

create or replace function ttc_private.must_game(p_game uuid)
returns public.games language plpgsql stable set search_path = '' as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game;
  if v_game.id is null then
    perform ttc_private.fail('GAME_NOT_FOUND', 'Partie introuvable');
  end if;
  return v_game;
end $$;

create or replace function ttc_private.is_member(p_game uuid, p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.game_players where game_id = p_game and user_id = p_user);
$$;

create or replace function ttc_private.require_member(p_game uuid, p_user uuid)
returns void language plpgsql stable set search_path = '' as $$
begin
  if not ttc_private.is_member(p_game, p_user) then
    perform ttc_private.fail('NOT_GAME_MEMBER', 'Vous n’êtes pas membre de cette partie');
  end if;
end $$;

create or replace function ttc_private.invite_code(p_game uuid)
returns text language sql stable set search_path = '' as $$
  select code from public.game_invites where game_id = p_game order by created_at limit 1;
$$;

create or replace function ttc_private.new_invite_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end $$;

-- Réglages de partie nettoyés (valeurs autorisées uniquement).
create or replace function ttc_private.clean_settings(p_in jsonb, p_base jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_in jsonb := coalesce(p_in, '{}'::jsonb);
  v_base jsonb := coalesce(p_base, '{"maxSpeed":3,"autosave":true,"aiDifficulty":"normal","eventFrequency":"normal","visibility":"private"}'::jsonb);
  v_out jsonb := v_base;
begin
  if v_in ? 'maxSpeed' then
    if jsonb_typeof(v_in -> 'maxSpeed') <> 'number' or (v_in ->> 'maxSpeed') not in ('1', '2', '3') then
      perform ttc_private.fail('VALIDATION_FAILED', 'Vitesse maximale invalide');
    end if;
    v_out := jsonb_set(v_out, '{maxSpeed}', v_in -> 'maxSpeed');
  end if;
  if v_in ? 'autosave' then
    if jsonb_typeof(v_in -> 'autosave') <> 'boolean' then
      perform ttc_private.fail('VALIDATION_FAILED', 'Sauvegarde automatique invalide');
    end if;
    v_out := jsonb_set(v_out, '{autosave}', v_in -> 'autosave');
  end if;
  if v_in ? 'aiDifficulty' then
    if (v_in ->> 'aiDifficulty') not in ('easy', 'normal', 'hard') then
      perform ttc_private.fail('VALIDATION_FAILED', 'Difficulté invalide');
    end if;
    v_out := jsonb_set(v_out, '{aiDifficulty}', v_in -> 'aiDifficulty');
  end if;
  if v_in ? 'eventFrequency' then
    if (v_in ->> 'eventFrequency') not in ('low', 'normal', 'high') then
      perform ttc_private.fail('VALIDATION_FAILED', 'Fréquence des événements invalide');
    end if;
    v_out := jsonb_set(v_out, '{eventFrequency}', v_in -> 'eventFrequency');
  end if;
  if v_in ? 'visibility' then
    if (v_in ->> 'visibility') not in ('private', 'public') then
      perform ttc_private.fail('VALIDATION_FAILED', 'Visibilité invalide');
    end if;
    v_out := jsonb_set(v_out, '{visibility}', v_in -> 'visibility');
  end if;
  return v_out;
end $$;

-- Résumé de partie (forme `GameSummary` de `packages/shared/src/protocol.ts`).
create or replace function ttc_private.summary(p_game public.games, p_user uuid, p_member boolean)
returns jsonb language sql stable set search_path = '' as $$
  with ruler as (
    select p.value as entry
    from public.game_snapshots s, jsonb_array_elements(coalesce(s.meta -> 'players', '[]'::jsonb)) p
    where p_member and p_game.status <> 'lobby' and s.game_id = p_game.id and p.value ->> 'userId' = p_user::text
    order by s.id desc
    limit 1
  )
  select jsonb_build_object(
    'id', p_game.id,
    'name', p_game.name,
    'mode', p_game.mode,
    'status', p_game.status,
    'hostId', p_game.host_id,
    'hostName', coalesce((select username from public.users where id = p_game.host_id), '?'),
    'playerCount', (select count(*) from public.game_players where game_id = p_game.id),
    'maxPlayers', p_game.max_players,
    'visibility', p_game.visibility,
    'inviteCode', case when p_member then ttc_private.invite_code(p_game.id) end,
    'isMember', p_member,
    'rulerName', (select entry ->> 'rulerName' from ruler),
    'rulerCharacterId', (select entry ->> 'characterId' from ruler),
    'gameDate', p_game.game_date,
    'lastSavedAt', p_game.last_saved_at,
    'playedSeconds', p_game.played_seconds,
    'createdAt', p_game.created_at
  );
$$;

-- Salon (forme `LobbyState`) ; « en ligne » = vu dans les 8 dernières secondes.
create or replace function ttc_private.lobby_state(p_game public.games)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'gameId', p_game.id,
    'name', p_game.name,
    'inviteCode', coalesce(ttc_private.invite_code(p_game.id), ''),
    'hostId', p_game.host_id,
    'status', p_game.status,
    'maxPlayers', p_game.max_players,
    'mode', p_game.mode,
    'settings', p_game.settings,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', gp.user_id,
        'displayName', u.username,
        'characterId', gp.character_id,
        'ready', gp.ready,
        'isHost', gp.is_host,
        'online', exists (select 1 from public.web_presence w where w.game_id = gp.game_id and w.user_id = gp.user_id and w.seen_at > now() - interval '8 seconds')
      ) order by gp.joined_at)
      from public.game_players gp join public.users u on u.id = gp.user_id
      where gp.game_id = p_game.id
    ), '[]'::jsonb)
  );
$$;

create or replace function ttc_private.chat_json(p_msg public.chat_messages)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p_msg.id,
    'gameId', p_msg.game_id,
    'userId', p_msg.user_id,
    'displayName', coalesce((select username from public.users where id = p_msg.user_id), '?'),
    'text', p_msg.text,
    'createdAt', p_msg.created_at
  );
$$;

create or replace function ttc_private.chat_history(p_game uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(ttc_private.chat_json(m) order by m.created_at), '[]'::jsonb)
  from (select * from public.chat_messages where game_id = p_game order by created_at desc limit 50) m;
$$;

create or replace function ttc_private.join_game(p_user uuid, p_game uuid, p_code text)
returns void language plpgsql set search_path = '' as $$
declare
  v_game public.games;
begin
  if ttc_private.is_member(p_game, p_user) then
    return;
  end if;
  -- Verrou de ligne : pas de dépassement du nombre de places en cas de jonctions simultanées.
  select * into v_game from public.games where id = p_game for update;
  if v_game.id is null then
    perform ttc_private.fail('GAME_NOT_FOUND', 'Partie introuvable');
  end if;
  if v_game.mode = 'solo' then
    perform ttc_private.fail('FORBIDDEN', 'Partie solo');
  end if;
  if v_game.visibility <> 'public' and upper(coalesce(p_code, '')) is distinct from ttc_private.invite_code(p_game) then
    perform ttc_private.fail('INVALID_INVITE', 'Code d’invitation invalide');
  end if;
  if v_game.status <> 'lobby' then
    perform ttc_private.fail('GAME_ALREADY_STARTED', 'La partie a déjà commencé');
  end if;
  if (select count(*) from public.game_players where game_id = p_game) >= v_game.max_players then
    perform ttc_private.fail('GAME_FULL', 'La partie est complète');
  end if;
  insert into public.game_players (game_id, user_id) values (p_game, p_user) on conflict do nothing;
end $$;

create or replace function ttc_private.require_lobby(p_game public.games)
returns void language plpgsql set search_path = '' as $$
begin
  if p_game.status <> 'lobby' then
    perform ttc_private.fail('GAME_ALREADY_STARTED', 'La partie a déjà commencé');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Comptes
-- -----------------------------------------------------------------------------

create or replace function public.ttc_register(p_email text, p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := regexp_replace(trim(coalesce(p_username, '')), '\s+', ' ', 'g');
  v_ip text := ttc_private.client_ip();
  v_user public.users;
begin
  perform ttc_private.rate_check('register:' || v_ip, 20, interval '1 hour', 'Trop d’inscriptions, réessayez plus tard.');
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform ttc_private.fail('VALIDATION_FAILED', 'Adresse e-mail invalide');
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 24 or v_name ~ '[[:cntrl:]<>&"''/\\@#%{}$]' then
    perform ttc_private.fail('VALIDATION_FAILED', 'Nom : 3 à 24 caractères (lettres, chiffres, espace, _ et -)');
  end if;
  if char_length(coalesce(p_password, '')) < 10 or char_length(p_password) > 200 then
    perform ttc_private.fail('VALIDATION_FAILED', 'Au moins 10 caractères.');
  end if;
  if p_password !~ '[[:alpha:]]' or p_password !~ '[0-9]' then
    perform ttc_private.fail('VALIDATION_FAILED', 'Utilisez des lettres et au moins un chiffre.');
  end if;
  if exists (select 1 from public.users where email = v_email) then
    perform ttc_private.fail('EMAIL_TAKEN', 'Cette adresse est déjà utilisée');
  end if;
  if exists (select 1 from public.users where lower(username) = lower(v_name)) then
    perform ttc_private.fail('USERNAME_TAKEN', 'Ce nom est déjà pris');
  end if;
  perform ttc_private.rate_hit('register:' || v_ip);
  begin
    insert into public.users (email, username, password_hash)
    values (v_email, v_name, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
    returning * into v_user;
  exception when unique_violation then
    perform ttc_private.fail('USERNAME_TAKEN', 'Adresse ou nom déjà utilisé');
  end;
  return jsonb_build_object('token', ttc_private.new_session(v_user.id), 'user', ttc_private.user_json(v_user));
end $$;

create or replace function public.ttc_login(p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip text := ttc_private.client_ip();
  v_user public.users;
  v_ok boolean;
begin
  perform ttc_private.rate_check('login-ip:' || v_ip, 30, interval '10 minutes', 'Trop de tentatives, patientez quelques minutes.');
  perform ttc_private.rate_check('login-email:' || v_email, 8, interval '10 minutes', 'Trop de tentatives, patientez quelques minutes.');
  select * into v_user from public.users where email = v_email;
  if v_user.id is not null and v_user.password_hash like '$2%' then
    v_ok := extensions.crypt(coalesce(p_password, ''), v_user.password_hash) = v_user.password_hash;
  else
    -- Temps de réponse comparable quand l'adresse est inconnue.
    perform extensions.crypt(coalesce(p_password, ''), '$2a$10$ttcdummysaltforequaltimeuu');
    v_ok := false;
  end if;
  if not v_ok then
    perform ttc_private.rate_hit('login-ip:' || v_ip);
    perform ttc_private.rate_hit('login-email:' || v_email);
    delete from public.web_rate_events where at < now() - interval '1 day';
    -- Réponse d'erreur sans exception : les tentatives comptées doivent être validées.
    return jsonb_build_object('error', jsonb_build_object('code', 'INVALID_CREDENTIALS', 'message', 'Adresse ou mot de passe incorrect'));
  end if;
  delete from public.web_rate_events where key = 'login-email:' || v_email;
  update public.users set last_login_at = now() where id = v_user.id;
  return jsonb_build_object('token', ttc_private.new_session(v_user.id), 'user', ttc_private.user_json(v_user));
end $$;

create or replace function public.ttc_session(p_token text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_user public.users;
begin
  select u.* into v_user from public.users u where u.id = ttc_private.try_user(p_token);
  return jsonb_build_object('user', case when v_user.id is null then null else ttc_private.user_json(v_user) end);
end $$;

create or replace function public.ttc_logout(p_token text)
returns jsonb language sql security definer set search_path = '' as $$
  update public.sessions set revoked_at = now() where token_hash = ttc_private.hash_token(p_token) and revoked_at is null;
  select jsonb_build_object('ok', true);
$$;

-- -----------------------------------------------------------------------------
-- Parties et salon
-- -----------------------------------------------------------------------------

create or replace function public.ttc_list_games(p_token text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
begin
  return jsonb_build_object('games', coalesce((
    select jsonb_agg(s.j order by s.o)
    from (
      select ttc_private.summary(g, v_user, true) as j, 1 as grp, row_number() over (order by g.updated_at desc) as o
      from public.games g join public.game_players gp on gp.game_id = g.id and gp.user_id = v_user
      union all
      select ttc_private.summary(g, v_user, false), 2, 1000 + row_number() over (order by g.created_at desc)
      from public.games g
      where g.status = 'lobby' and g.visibility = 'public' and g.mode = 'multiplayer'
        and not ttc_private.is_member(g.id, v_user)
    ) s
    where (s.grp = 1 and s.o <= 50) or (s.grp = 2 and s.o <= 1030)
  ), '[]'::jsonb));
end $$;

create or replace function public.ttc_create_game(p_token text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_name text := trim(coalesce(p_input ->> 'name', ''));
  v_mode text := p_input ->> 'mode';
  v_max int;
  v_char text := nullif(p_input ->> 'characterId', '');
  v_settings jsonb := ttc_private.clean_settings(p_input -> 'settings', null);
  v_game public.games;
begin
  perform ttc_private.rate_check('create:' || v_user, 20, interval '1 hour', 'Trop de parties créées');
  if char_length(v_name) < 3 or char_length(v_name) > 48 then
    perform ttc_private.fail('VALIDATION_FAILED', 'Nom de partie : 3 à 48 caractères');
  end if;
  if v_mode not in ('solo', 'multiplayer') then
    perform ttc_private.fail('VALIDATION_FAILED', 'Mode invalide');
  end if;
  if v_mode = 'solo' and v_char is null then
    perform ttc_private.fail('VALIDATION_FAILED', 'Choisissez un souverain');
  end if;
  if v_char is not null and char_length(v_char) > 64 then
    perform ttc_private.fail('CHARACTER_NOT_PLAYABLE', 'Ce personnage ne peut pas être joué');
  end if;
  v_max := case when v_mode = 'solo' then 1 else least(greatest(coalesce((p_input ->> 'maxPlayers')::int, 8), 2), 8) end;
  perform ttc_private.rate_hit('create:' || v_user);
  -- Une partie solo est « en cours » dès sa création : le navigateur de l'hôte
  -- crée l'état initial et l'enregistre à la première ouverture.
  insert into public.games (name, mode, status, host_id, max_players, visibility, settings, scenario_id, seed, started_at)
  values (v_name, v_mode, case when v_mode = 'solo' then 'running' else 'lobby' end, v_user, v_max, v_settings ->> 'visibility', v_settings,
          'couronne_brisee', 1 + floor(random() * 2147483646)::int, case when v_mode = 'solo' then now() end)
  returning * into v_game;
  insert into public.game_players (game_id, user_id, is_host, character_id, ready)
  values (v_game.id, v_user, true, v_char, v_mode = 'solo');
  insert into public.game_invites (game_id, code, created_by) values (v_game.id, ttc_private.new_invite_code(), v_user);
  return jsonb_build_object('id', v_game.id, 'status', v_game.status);
end $$;

create or replace function public.ttc_join_by_code(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game uuid;
begin
  perform ttc_private.rate_check('join:' || v_user, 30, interval '10 minutes', 'Trop de tentatives, patientez quelques minutes.');
  select game_id into v_game from public.game_invites where code = upper(trim(coalesce(p_code, '')));
  if v_game is null then
    perform ttc_private.rate_hit('join:' || v_user);
    return jsonb_build_object('error', jsonb_build_object('code', 'INVALID_INVITE', 'message', 'Code d’invitation inconnu'));
  end if;
  perform ttc_private.join_game(v_user, v_game, p_code);
  return jsonb_build_object('id', v_game);
end $$;

create or replace function public.ttc_join(p_token text, p_game uuid, p_code text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
begin
  perform ttc_private.join_game(v_user, p_game, p_code);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ttc_game(p_token text, p_game uuid)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
  v_member boolean := ttc_private.is_member(p_game, v_user);
begin
  if not v_member and (v_game.visibility <> 'public' or v_game.status <> 'lobby') then
    perform ttc_private.fail('NOT_GAME_MEMBER', 'Accès refusé');
  end if;
  return jsonb_build_object(
    'game', ttc_private.summary(v_game, v_user, v_member),
    'lobby', case when v_game.status = 'lobby' then ttc_private.lobby_state(v_game) end
  );
end $$;

-- Sondage du salon : état + discussion, et marque le joueur « en ligne ».
create or replace function public.ttc_lobby(p_token text, p_game uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
begin
  perform ttc_private.require_member(p_game, v_user);
  insert into public.web_presence (game_id, user_id, seen_at) values (p_game, v_user, now())
  on conflict (game_id, user_id) do update set seen_at = excluded.seen_at;
  return jsonb_build_object('lobby', ttc_private.lobby_state(v_game), 'chat', ttc_private.chat_history(p_game));
end $$;

create or replace function public.ttc_leave(p_token text, p_game uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
begin
  if v_game.status <> 'lobby' then
    perform ttc_private.fail('GAME_ALREADY_STARTED', 'Impossible de quitter une partie commencée : vous pouvez vous reconnecter à tout moment');
  end if;
  if v_game.host_id = v_user then
    delete from public.games where id = p_game;
  else
    delete from public.game_players where game_id = p_game and user_id = v_user;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ttc_select(p_token text, p_game uuid, p_character text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
begin
  perform ttc_private.require_member(p_game, v_user);
  perform ttc_private.require_lobby(v_game);
  if p_character is not null and (char_length(p_character) = 0 or char_length(p_character) > 64) then
    perform ttc_private.fail('CHARACTER_NOT_PLAYABLE', 'Ce personnage ne peut pas être joué');
  end if;
  begin
    update public.game_players set character_id = p_character, ready = false where game_id = p_game and user_id = v_user;
  exception when unique_violation then
    perform ttc_private.fail('CHARACTER_TAKEN', 'Ce souverain est déjà choisi par un autre joueur');
  end;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ttc_ready(p_token text, p_game uuid, p_ready boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
  v_char text;
begin
  perform ttc_private.require_member(p_game, v_user);
  perform ttc_private.require_lobby(v_game);
  select character_id into v_char from public.game_players where game_id = p_game and user_id = v_user;
  if p_ready and v_char is null then
    perform ttc_private.fail('VALIDATION_FAILED', 'Choisissez d’abord un souverain');
  end if;
  update public.game_players set ready = coalesce(p_ready, false) where game_id = p_game and user_id = v_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ttc_kick(p_token text, p_game uuid, p_target uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
begin
  if v_game.host_id <> v_user then
    perform ttc_private.fail('NOT_HOST', 'Réservé à l’hôte');
  end if;
  if v_game.status <> 'lobby' then
    perform ttc_private.fail('GAME_ALREADY_STARTED', 'Impossible d’expulser après le lancement');
  end if;
  if p_target = v_user then
    perform ttc_private.fail('INVALID_TARGET', 'L’hôte ne peut pas s’expulser');
  end if;
  delete from public.game_players where game_id = p_game and user_id = p_target;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ttc_update_settings(p_token text, p_game uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
  v_settings jsonb;
begin
  if v_game.host_id <> v_user then
    perform ttc_private.fail('NOT_HOST', 'Réservé à l’hôte');
  end if;
  perform ttc_private.require_lobby(v_game);
  v_settings := ttc_private.clean_settings(p_patch, v_game.settings);
  update public.games set settings = v_settings, visibility = v_settings ->> 'visibility', updated_at = now() where id = p_game;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ttc_start(p_token text, p_game uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
begin
  if v_game.host_id <> v_user then
    perform ttc_private.fail('NOT_HOST', 'Seul l’hôte peut lancer la partie');
  end if;
  perform ttc_private.require_lobby(v_game);
  if exists (select 1 from public.game_players where game_id = p_game and (character_id is null or (not ready and not is_host))) then
    perform ttc_private.fail('PLAYERS_NOT_READY', 'Tous les joueurs doivent choisir un souverain et être prêts');
  end if;
  update public.games set status = 'running', started_at = now(), updated_at = now() where id = p_game;
  return jsonb_build_object('ok', true);
end $$;

-- -----------------------------------------------------------------------------
-- Partie en cours : chargement et sauvegarde
-- -----------------------------------------------------------------------------

-- Tout ce qu'il faut pour ouvrir une partie : description, joueurs, dernière sauvegarde.
create or replace function public.ttc_bootstrap(p_token text, p_game uuid, p_with_state boolean default true)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
  v_snap public.game_snapshots;
begin
  perform ttc_private.require_member(p_game, v_user);
  if p_with_state then
    select * into v_snap from public.game_snapshots where game_id = p_game order by id desc limit 1;
  end if;
  return jsonb_build_object(
    'you', v_user,
    'game', jsonb_build_object(
      'id', v_game.id, 'name', v_game.name, 'mode', v_game.mode, 'status', v_game.status, 'hostId', v_game.host_id,
      'seed', v_game.seed, 'scenarioId', v_game.scenario_id, 'settings', v_game.settings, 'speed', v_game.speed,
      'playedSeconds', v_game.played_seconds, 'inviteCode', ttc_private.invite_code(p_game)
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('userId', gp.user_id, 'displayName', u.username, 'characterId', gp.character_id) order by gp.joined_at)
      from public.game_players gp join public.users u on u.id = gp.user_id where gp.game_id = p_game
    ), '[]'::jsonb),
    'snapshot', case when v_snap.id is null then null else jsonb_build_object('id', v_snap.id, 'meta', v_snap.meta, 'state', v_snap.state) end,
    'chat', ttc_private.chat_history(p_game)
  );
end $$;

-- Sauvegarde par l'hôte (seul détenteur de la simulation). Conserve les 4 dernières.
create or replace function public.ttc_save(
  p_token text, p_game uuid, p_state jsonb, p_reason text, p_meta jsonb, p_speed int, p_played int, p_finished boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_game public.games := ttc_private.must_game(p_game);
  v_id bigint;
begin
  if v_game.host_id <> v_user then
    perform ttc_private.fail('NOT_HOST', 'Seul l’hôte enregistre la partie');
  end if;
  if v_game.status = 'lobby' then
    perform ttc_private.fail('GAME_NOT_STARTED', 'La partie n’a pas commencé');
  end if;
  if jsonb_typeof(p_state) <> 'object' or (p_state ->> 'gameId') is distinct from p_game::text then
    perform ttc_private.fail('VALIDATION_FAILED', 'Sauvegarde invalide');
  end if;
  insert into public.game_snapshots (game_id, version, game_date, schema_version, reason, state, meta)
  values (p_game, coalesce((p_state ->> 'version')::int, 0), coalesce((p_state ->> 'date')::int, 0), coalesce((p_state ->> 'schemaVersion')::int, 0),
          left(coalesce(p_reason, 'manual'), 32), p_state, coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;
  update public.games
  set game_date = (p_state ->> 'date')::int, version = coalesce((p_state ->> 'version')::int, 0), last_saved_at = now(), updated_at = now(),
      speed = least(greatest(coalesce(p_speed, 0), 0), 3), played_seconds = greatest(coalesce(p_played, 0), 0),
      status = case when p_finished then 'finished' else status end
  where id = p_game;
  delete from public.game_snapshots where game_id = p_game and id < (
    select min(id) from (select id from public.game_snapshots where game_id = p_game order by id desc limit 4) k
  );
  return jsonb_build_object('id', v_id);
end $$;

-- -----------------------------------------------------------------------------
-- Discussion
-- -----------------------------------------------------------------------------

create or replace function public.ttc_chat_send(p_token text, p_game uuid, p_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := ttc_private.require_user(p_token);
  v_text text := trim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  v_msg public.chat_messages;
begin
  perform ttc_private.must_game(p_game);
  perform ttc_private.require_member(p_game, v_user);
  if v_text = '' then
    perform ttc_private.fail('VALIDATION_FAILED', 'Message vide');
  end if;
  if char_length(v_text) > 500 then
    perform ttc_private.fail('VALIDATION_FAILED', 'Message trop long');
  end if;
  if (select count(*) from public.chat_messages where game_id = p_game and user_id = v_user and created_at > now() - interval '10 seconds') >= 5 then
    perform ttc_private.fail('RATE_LIMITED', 'Vous écrivez trop vite');
  end if;
  insert into public.chat_messages (game_id, user_id, text) values (p_game, v_user, v_text) returning * into v_msg;
  return ttc_private.chat_json(v_msg);
end $$;

-- -----------------------------------------------------------------------------
-- Droits : seul l'API `ttc_*` est accessible au client (clé publique).
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ttc\_%'
  loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    end if;
  end loop;
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'ttc_private'
  loop
    execute format('revoke all on function %s from public', f.sig);
  end loop;
end $$;
