/**
 * Mode sans serveur : les chemins REST de l'interface sont traduits en appels
 * RPC Supabase (`database/supabase/web_mode.sql`). Les écrans n'ont donc pas
 * à connaître le mode réseau.
 */
import { getScenario } from '@ttc/content';
import { isPlayableCharacter } from '@ttc/game-core';
import {
  ErrorCodes,
  createGameSchema,
  joinGameSchema,
  kickSchema,
  loginSchema,
  readySchema,
  registerSchema,
  selectCharacterSchema,
  updateSettingsSchema,
} from '@ttc/shared';
import type { z } from 'zod';
import { ApiFailure } from '../failure';
import { getToken, rpc, rpcAuth, setToken } from './supabase';
import { pokeLobby } from './lobby';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body ?? {});
  if (!r.success)
    throw new ApiFailure(400, ErrorCodes.VALIDATION_FAILED, r.error.issues[0]?.message ?? 'Requête invalide');
  return r.data;
}

function assertPlayable(characterId: string | null | undefined): void {
  if (characterId && !isPlayableCharacter(getScenario('couronne_brisee'), characterId)) {
    throw new ApiFailure(400, ErrorCodes.CHARACTER_NOT_PLAYABLE, 'Ce personnage ne peut pas être joué');
  }
}

function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Au moins 10 caractères.';
  if (!/\p{L}/u.test(pw) || !/[0-9]/.test(pw)) return 'Utilisez des lettres et au moins un chiffre.';
  return null;
}

async function lobbyCall<T>(fn: string, gameId: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await rpcAuth<T>(fn, { p_game: gameId, ...args });
  pokeLobby(gameId);
  return res;
}

export async function browserApi<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const route = `${method} ${path.replace(/\/[0-9a-f-]{36}(?=\/|$)/i, '/:id')}`;
  const id = /\/([0-9a-f-]{36})(?=\/|$)/i.exec(path)?.[1] ?? '';
  switch (route) {
    case 'GET /api/auth/session':
    case 'GET /api/auth/me': {
      if (!getToken()) return { user: null } as T;
      const r = await rpcAuth<{ user: unknown }>('ttc_session');
      if (!r.user) setToken(null);
      return r as T;
    }
    case 'POST /api/auth/login': {
      const b = parse(loginSchema, body);
      const r = await rpc<{ token: string; user: unknown }>('ttc_login', {
        p_email: b.email,
        p_password: b.password,
      });
      setToken(r.token);
      return { user: r.user } as T;
    }
    case 'POST /api/auth/register': {
      const b = parse(registerSchema, body);
      const problem = passwordProblem(b.password);
      if (problem) throw new ApiFailure(400, ErrorCodes.VALIDATION_FAILED, problem);
      const r = await rpc<{ token: string; user: unknown }>('ttc_register', {
        p_email: b.email,
        p_username: b.username,
        p_password: b.password,
      });
      setToken(r.token);
      return { user: r.user } as T;
    }
    case 'POST /api/auth/logout': {
      const token = getToken();
      setToken(null);
      if (token) await rpc('ttc_logout', { p_token: token }).catch(() => undefined);
      return { ok: true } as T;
    }
    case 'GET /api/games':
      return rpcAuth<T>('ttc_list_games');
    case 'POST /api/games': {
      const b = parse(createGameSchema, body);
      assertPlayable(b.characterId);
      return rpcAuth<T>('ttc_create_game', { p_input: b });
    }
    case 'POST /api/games/join': {
      const code = String((body as { inviteCode?: unknown } | undefined)?.inviteCode ?? '').trim();
      return rpcAuth<T>('ttc_join_by_code', { p_code: code });
    }
    case 'GET /api/games/:id':
      return rpcAuth<T>('ttc_game', { p_game: id });
    case 'POST /api/games/:id/join':
      return lobbyCall<T>('ttc_join', id, { p_code: parse(joinGameSchema, body).inviteCode ?? null });
    case 'POST /api/games/:id/leave':
      return lobbyCall<T>('ttc_leave', id);
    case 'POST /api/games/:id/select': {
      const b = parse(selectCharacterSchema, body);
      assertPlayable(b.characterId);
      return lobbyCall<T>('ttc_select', id, { p_character: b.characterId });
    }
    case 'POST /api/games/:id/ready':
      return lobbyCall<T>('ttc_ready', id, { p_ready: parse(readySchema, body).ready });
    case 'POST /api/games/:id/kick':
      return lobbyCall<T>('ttc_kick', id, { p_target: parse(kickSchema, body).userId });
    case 'PATCH /api/games/:id/settings':
      return lobbyCall<T>('ttc_update_settings', id, { p_patch: parse(updateSettingsSchema, body) });
    case 'POST /api/games/:id/start':
      return lobbyCall<T>('ttc_start', id);
    default:
      throw new ApiFailure(404, ErrorCodes.NOT_FOUND, 'Introuvable');
  }
}
