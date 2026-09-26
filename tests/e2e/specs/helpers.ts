import { expect, type Page } from '@playwright/test';

let counter = 0;

/** Identifiants uniques par exécution (la base de développement peut être partagée). */
export function uniqueUser(prefix: string) {
  counter++;
  const tag = `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e4)}`;
  return {
    email: `${prefix}.${tag}@e2e.tothecrown.local`,
    username: `${prefix}${tag}`.slice(0, 24),
    password: 'couronne-e2e-2026',
  };
}

export async function register(page: Page, prefix: string) {
  const u = uniqueUser(prefix);
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.fill('#auth-email', u.email);
  await page.fill('#auth-name', u.username);
  await page.fill('#auth-pass', u.password);
  await page.getByRole('button', { name: 'Fonder ma lignée' }).click();
  await expect(page.getByRole('button', { name: /Déconnexion/ })).toBeVisible();
  return u;
}

/** Lance une partie solo avec le souverain recommandé de l'entité indiquée (ex. 'fra', 'ott'). */
export async function startSolo(page: Page, polity?: string) {
  await page.getByRole('button', { name: 'Nouvelle partie' }).click();
  await expect(page.getByTestId('start-game')).toBeVisible();
  if (polity) await page.locator(`.start-list [data-polity="${polity}"]`).click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('outliner')).toBeVisible();
  const skip = page.getByTestId('tutorial-skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

/** Ferme les fenêtres d'événement qui s'ouvrent automatiquement en choisissant la première option. */
export async function resolveEvents(page: Page, max = 5) {
  for (let i = 0; i < max; i++) {
    const modal = page.getByTestId('event-modal');
    if (!(await modal.isVisible().catch(() => false))) return;
    const choice = modal.locator('.event-choice:not([disabled])').first();
    // La fenêtre peut être remplacée par l'événement suivant pendant le clic : on réessaie au tour suivant.
    await choice.click({ timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

/** Centre de la caméra de la carte de jeu [lon, lat] (attribut posé après chaque déplacement). */
export async function mapCenter(page: Page): Promise<[number, number]> {
  const raw = (await page.locator('.game-map').getAttribute('data-center')) ?? '';
  const [lon, lat] = raw.split(',').map(Number);
  return [lon ?? NaN, lat ?? NaN];
}

/** Longitude ramenée dans [-180, 180[. */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Met la partie en pause (sans la relancer si un événement l'a déjà suspendue). */
export async function pause(page: Page) {
  if (!(await page.locator('.clock.paused').count())) await page.keyboard.press(' ');
  await expect(page.locator('.clock.paused')).toBeVisible();
}

export async function currentYear(page: Page): Promise<number> {
  return Number(await page.getByTestId('clock-year').textContent());
}
