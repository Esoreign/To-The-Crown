import { expect, type Page } from '@playwright/test';

let counter = 0;

/** Identifiants uniques par exécution (la base de développement peut être partagée). */
export function uniqueUser(prefix: string) {
  counter++;
  const tag = `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e4)}`;
  return { email: `${prefix}.${tag}@e2e.tothecrown.local`, username: `${prefix}${tag}`.slice(0, 24), password: 'couronne-e2e-2026' };
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

/** Lance une partie solo avec le souverain recommandé indiqué. */
export async function startSolo(page: Page, characterId?: string) {
  await page.getByRole('button', { name: 'Nouvelle partie' }).click();
  await expect(page.getByTestId('start-game')).toBeVisible();
  if (characterId) await page.getByTestId(`start-${characterId}`).click();
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
    await modal.locator('.event-choice:not([disabled])').first().click();
    await page.waitForTimeout(400);
  }
}

export async function currentYear(page: Page): Promise<number> {
  return Number(await page.getByTestId('clock-year').textContent());
}
