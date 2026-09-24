import { expect, test, type Page } from '@playwright/test';
import { register, resolveEvents } from './helpers';

/**
 * Propre au mode sans serveur (`playwright.supabase.config.ts`) : la
 * simulation tourne dans la page de l'hôte, les commandes des invités passent
 * par elle, et son départ met la partie en attente.
 */
test.skip(!process.env.E2E_BROWSER_HOST, 'Mode sans serveur uniquement');

async function skipTutorial(p: Page) {
  await p.bringToFront();
  const skip = p.getByTestId('tutorial-skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('hôte navigateur : commande d’un invité, départ et retour de l’hôte', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  await register(host, 'hote');
  await register(guest, 'invite');

  await host.getByRole('button', { name: 'Multijoueur' }).click();
  await host.getByTestId('create-lobby').click();
  const code = (await host.getByTestId('invite-code').textContent())?.trim() ?? '';
  await guest.getByRole('button', { name: 'Multijoueur' }).click();
  await guest.getByTestId('invite-input').fill(code);
  await guest.getByTestId('invite-join').click();
  await expect(host.locator('.lobby-player')).toHaveCount(2);
  await host.bringToFront();
  await host.locator('.lobby-picker .start-card').nth(0).click();
  await host.getByTestId('lobby-select').click();
  await host.getByTestId('lobby-ready').click();
  await guest.bringToFront();
  await guest.locator('.lobby-picker .start-card').nth(2).click();
  await guest.getByTestId('lobby-select').click();
  await guest.getByTestId('lobby-ready').click();
  await host.bringToFront();
  await host.getByTestId('lobby-start').click();
  await expect(host.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });
  await expect(guest.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });
  await skipTutorial(host);
  await skipTutorial(guest);

  // L'invité lève son ost : la commande est exécutée par l'hôte et l'armée apparaît chez les deux.
  await resolveEvents(guest);
  await guest.getByTestId('nav-military').click();
  await guest.getByRole('button', { name: /Lever l’ost/ }).click();
  await guest.keyboard.press('Escape');
  await expect(guest.getByTestId('outliner-army').first()).toBeVisible({ timeout: 20_000 });

  // L'hôte quitte : l'invité voit la partie en attente, et ses commandes sont refusées proprement.
  await host.goto('/');
  await guest.bringToFront();
  await expect(guest.getByTestId('clock')).toContainText('En attente de l’hôte', { timeout: 30_000 });

  // L'hôte revient : la partie reprend là où elle était.
  await host.goto(guest.url());
  await expect(host.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });
  await host.bringToFront();
  await resolveEvents(host);
  const before = await guest.locator('.clock-date').textContent();
  await host.keyboard.press('3');
  await expect(guest.locator('.clock-date')).not.toHaveText(before ?? '', { timeout: 30_000 });
  await expect(guest.getByTestId('outliner-army').first()).toBeVisible();

  await hostCtx.close();
  await guestCtx.close();
});
