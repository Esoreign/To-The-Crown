import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('multijoueur : salon, code d’invitation, choix, lancement et discussion', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await register(host, 'hote');
  const guestUser = await register(guest, 'invite');

  // L'hôte crée un salon.
  await host.getByRole('button', { name: 'Multijoueur' }).click();
  await host.getByTestId('create-lobby').click();
  const code = (await host.getByTestId('invite-code').textContent())?.trim() ?? '';
  expect(code.length).toBeGreaterThanOrEqual(4);

  // L'invité rejoint avec le code.
  await guest.getByRole('button', { name: 'Multijoueur' }).click();
  await guest.getByTestId('invite-input').fill(code);
  await guest.getByTestId('invite-join').click();
  await expect(guest.getByTestId('invite-code')).toHaveText(code);
  await expect(host.locator('.lobby-player')).toHaveCount(2);
  await expect(host.locator('.lobby-players')).toContainText(guestUser.username);

  // Chacun choisit un souverain différent puis se déclare prêt.
  // (Une page en arrière-plan ne rafraîchit plus ses images : on la ramène au premier plan.)
  await host.bringToFront();
  await host.locator('.lobby-picker .start-card').nth(0).click();
  await host.getByTestId('lobby-select').click();
  await host.getByTestId('lobby-ready').click();
  await guest.bringToFront();
  await guest.locator('.lobby-picker .start-card').nth(2).click();
  await guest.getByTestId('lobby-select').click();
  await guest.getByTestId('lobby-ready').click();

  // Lancement par l'hôte : les deux joueurs arrivent en jeu.
  await host.bringToFront();
  await expect(host.getByTestId('lobby-start')).toBeEnabled();
  await host.getByTestId('lobby-start').click();
  await expect(host.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });
  await expect(guest.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });

  for (const p of [host, guest]) {
    await p.bringToFront();
    const skip = p.getByTestId('tutorial-skip');
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }

  // Seul l'hôte règle la vitesse ; l'invité voit le temps avancer.
  const before = await guest.locator('.clock-date').textContent();
  await host.bringToFront();
  await host.keyboard.press('2');
  await expect(guest.locator('.clock-date')).not.toHaveText(before ?? '', { timeout: 30_000 });
  await host.getByTestId('clock-toggle').click();

  // Discussion.
  await host.getByTestId('nav-chat').click();
  await host.getByTestId('chat-input').fill('Salut, cousin. La paix ?');
  await host.getByTestId('chat-input').press('Enter');
  await guest.bringToFront();
  await guest.getByTestId('nav-chat').click();
  await expect(guest.getByTestId('chat-panel')).toContainText('La paix ?');

  // Reconnexion de l'invité : il retrouve sa partie.
  await guest.reload();
  await expect(guest.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });

  await hostCtx.close();
  await guestCtx.close();
});
