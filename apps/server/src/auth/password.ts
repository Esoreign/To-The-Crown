/**
 * Hachage des mots de passe : Argon2id (paramètres minimaux OWASP :
 * 19 MiB, 2 itérations, parallélisme 1). Aucun mot de passe en clair n'est
 * jamais stocké ni journalisé.
 */
import { hash, verify, type Algorithm } from '@node-rs/argon2';

/** Algorithm.Argon2id (enum const non accessible avec verbatimModuleSyntax). */
const ARGON2ID = 2 as Algorithm;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password, OPTIONS);
  } catch {
    return false;
  }
}

/** Hash factice pour égaliser le temps de réponse quand l'email est inconnu. */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword('ttc-dummy-password-for-timing');
  return dummy;
}

export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return 'Au moins 10 caractères.';
  if (!/[a-zA-Z\p{L}]/u.test(pw) || !/[0-9]/.test(pw)) return 'Utilisez des lettres et au moins un chiffre.';
  return null;
}
