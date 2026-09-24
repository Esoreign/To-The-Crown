/**
 * Accès Supabase du mode sans serveur : appels RPC `ttc_*` (PostgREST) et
 * client Realtime. Le jeton de session (opaque, révocable) est gardé dans le
 * stockage local du navigateur ; seule son empreinte est en base.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiFailure } from '../failure';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? '';
const TOKEN_KEY = 'ttc.session';

let memoryToken: string | null = null;
let client: SupabaseClient | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible (navigation privée stricte) : jeton en mémoire.
  }
}

export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Battements de cœur dans un worker : la connexion tient même onglet en arrière-plan.
    realtime: { worker: true, heartbeatIntervalMs: 20_000 },
  });
  return client;
}

interface PgError {
  code?: string;
  message?: string;
  hint?: string | null;
}

/**
 * Appelle une fonction `ttc_*`. `rawArgs` permet d'envoyer un corps déjà
 * sérialisé (sauvegardes volumineuses, sans double conversion).
 */
export async function rpc<T>(fn: string, args: Record<string, unknown>, rawArgs?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, 'content-type': 'application/json' },
      body: rawArgs ?? JSON.stringify(args),
    });
  } catch {
    throw new ApiFailure(0, 'NETWORK', 'Serveur injoignable');
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiFailure(res.status, 'INTERNAL', 'Réponse illisible');
  }
  if (!res.ok) {
    const err = (data ?? {}) as PgError;
    const code =
      err.hint && /^[A-Z_]+$/.test(err.hint) ? err.hint : res.status === 429 ? 'RATE_LIMITED' : 'INTERNAL';
    throw new ApiFailure(res.status, code, err.message ?? res.statusText);
  }
  const failure = (data as { error?: { code?: string; message?: string } } | null)?.error;
  if (failure && typeof failure === 'object' && failure.code)
    throw new ApiFailure(400, failure.code, failure.message ?? failure.code);
  return data as T;
}

/** Appel authentifié : ajoute le jeton de session. */
export function rpcAuth<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return rpc<T>(fn, { p_token: getToken() ?? '', ...args });
}
