import { expect, test } from '@playwright/test';
import { register, resolveEvents, startSolo } from './helpers';

test('guerre : lever l’ost, suivre la guerre en cours, déplacer une armée', async ({ page }) => {
  await register(page, 'guerre');
  await startSolo(page, 'ch733'); // Altani de Kharzul : la guerre a déjà commencé

  // La guerre de départ apparaît dans l'aperçu et s'ouvre dans un panneau.
  await expect(page.getByTestId('outliner')).toContainText('Guerres');
  await page.getByTestId('outliner').locator('.outliner-row', { hasText: '⚔' }).first().click();
  await expect(page.getByTestId('war-panel')).toBeVisible();
  await expect(page.locator('.warscore')).toBeVisible();

  // Lever l'ost depuis l'écran militaire.
  await page.getByTestId('nav-military').click();
  await page.getByRole('button', { name: /Lever l’ost/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('outliner-army').first()).toBeVisible({ timeout: 20_000 });

  // Sélectionner l'armée puis la déplacer d'un clic droit sur la carte.
  await page.getByTestId('outliner-army').first().click();
  await expect(page.getByTestId('army-panel')).toBeVisible();
  const box = await page.locator('.game-map canvas').boundingBox();
  if (!box) throw new Error('Carte absente');
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45, { button: 'right' });
  await page.waitForTimeout(800);

  // Le temps passe : l'armée marche ou combat, la simulation ne plante pas.
  await page.keyboard.press('3');
  await page.waitForTimeout(6000);
  await resolveEvents(page);
  await page.keyboard.press(' ');
  await expect(page.getByTestId('game-screen')).toBeVisible();
});

test('déclaration de guerre : la fenêtre présente casus belli ou raison', async ({ page }) => {
  await register(page, 'cb');
  await startSolo(page, 'ch320'); // Torvald, empereur de Hrovmark
  await page.getByTestId('nav-realm').click();
  await page.getByRole('button', { name: 'Titres à fonder' }).click();
  await page.keyboard.press('Escape');
  // Recherche d'un souverain étranger et ouverture de sa fiche.
  await page.keyboard.press('f');
  await page.getByTestId('search-input').fill('Aélis');
  await page.locator('.title-row', { hasText: 'Aélis' }).first().click();
  await expect(page.getByTestId('character-panel')).toContainText('Aélis');
  const war = page.getByTestId('interact-war');
  await expect(war).toBeVisible();
  if (await war.isEnabled()) {
    await war.click();
    await expect(page.locator('.war-dialog')).toBeVisible();
    await expect(page.locator('.cb-option').first()).toBeVisible();
  }
});
