import { expect, test } from '@playwright/test';
import { mapCenter, normalizeLon, register, startSolo } from './helpers';

/**
 * Navigation sur la carte du monde : royaume du joueur (H), recherche
 * mondiale, royaume à cheval sur l'antiméridien, historique de caméra.
 */
test('navigation : royaume du joueur, recherche et royaume de bord (antiméridien)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await register(page, 'nav');
  await startSolo(page, 'fra');

  // H : cadrage sur le royaume de France.
  await page.keyboard.press('h');
  await expect
    .poll(async () => normalizeLon((await mapCenter(page))[0]), { timeout: 20_000 })
    .toBeGreaterThan(-6);
  const [lonFr, latFr] = await mapCenter(page);
  expect(normalizeLon(lonFr)).toBeLessThan(10);
  expect(latFr).toBeGreaterThan(40);
  expect(latFr).toBeLessThan(52);

  // SELECT EDGE REALM : Tonga s'étend de part et d'autre de l'antiméridien (Samoa, Fidji).
  await page.keyboard.press('Control+f');
  await page.getByTestId('search-input').fill('Tonga');
  await page.locator('.title-row', { hasText: 'Tonga' }).first().click();
  await expect
    .poll(async () => Math.abs(normalizeLon((await mapCenter(page))[0])), { timeout: 20_000 })
    .toBeGreaterThan(165);
  const [, latTo] = await mapCenter(page);
  expect(latTo).toBeLessThan(-5);
  expect(latTo).toBeGreaterThan(-30);
  // Le cadrage ne doit pas dézoomer sur la planète entière (emprise déroulée correctement).
  expect(Number(await page.locator('.game-map').getAttribute('data-zoom'))).toBeGreaterThan(3);

  // Alt+← : retour à la vue précédente (France).
  await page.keyboard.press('Alt+ArrowLeft');
  await expect
    .poll(async () => normalizeLon((await mapCenter(page))[0]), { timeout: 20_000 })
    .toBeGreaterThan(-10);
  expect(normalizeLon((await mapCenter(page))[0])).toBeLessThan(15);

  expect(errors).toEqual([]);
});
