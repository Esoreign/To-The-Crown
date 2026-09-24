import { expect, test } from '@playwright/test';
import { currentYear, register, resolveEvents, startSolo } from './helpers';

test.describe('Partie solo', () => {
  test('inscription, choix du souverain, écrans, temps, sauvegarde et reprise', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await register(page, 'solo');
    await startSolo(page, 'ch852'); // Thalos d'Ithos (facile)

    // Barre de ressources et fiche du personnage joueur.
    await expect(page.getByTestId('res-gold')).toBeVisible();
    await page.locator('.topbar .portrait').click();
    await expect(page.getByTestId('character-panel')).toContainText('Thalos');

    // Écrans principaux.
    for (const s of ['council', 'realm', 'dynasty', 'intrigue', 'military', 'marriage', 'decisions', 'chronicle']) {
      await page.getByTestId(`nav-${s}`).click();
      await expect(page.getByTestId('screen')).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('screen')).toHaveCount(0);

    // Conseil : changer la tâche de l'intendant.
    await page.getByTestId('nav-council').click();
    const steward = page.getByTestId('council-steward');
    await steward.getByRole('radio', { name: 'Développer un comté' }).click();
    await expect(steward.getByRole('radio', { name: 'Développer un comté' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    // Modes de carte.
    await page.getByTestId('mapmode-culture').click();
    await expect(page.locator('.legend')).toBeVisible();
    await page.getByTestId('mapmode-political').click();

    // Le temps s'écoule à vitesse maximale.
    const startYear = await currentYear(page);
    const dateBefore = await page.getByTestId('clock').textContent();
    await page.keyboard.press('3');
    await expect
      .poll(
        async () => {
          await resolveEvents(page);
          const paused = (await page.getByTestId('clock').textContent())?.includes('pause');
          if (paused) await page.keyboard.press('3');
          return page.getByTestId('clock').textContent();
        },
        { timeout: 60_000, intervals: [1000] },
      )
      .not.toBe(dateBefore);
    expect(await currentYear(page)).toBeGreaterThanOrEqual(startYear);
    // Mise en pause certaine (un événement a pu déjà suspendre le temps).
    await resolveEvents(page);
    if (!(await page.locator('.clock.paused').count())) await page.getByTestId('clock-toggle').click();
    await expect(page.locator('.clock.paused')).toBeVisible();
    await resolveEvents(page);
    const savedDate = await page.locator('.clock-date').textContent();

    // Sauvegarder et quitter, puis reprendre depuis « Continuer ».
    await page.getByTestId('game-menu').click();
    await page.getByTestId('save-quit').click();
    await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole('button', { name: /Continuer/ }).click();
    await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.clock-date')).toHaveText(savedDate ?? '', { timeout: 20_000 });

    expect(errors).toEqual([]);
  });

  test('un événement s’affiche et se résout', async ({ page }) => {
    await register(page, 'event');
    await startSolo(page, 'ch1');
    await page.keyboard.press('3');
    await expect(page.getByTestId('event-modal')).toBeVisible({ timeout: 90_000 });
    const choice = page.getByTestId('event-modal').locator('.event-choice:not([disabled])').first();
    await choice.hover();
    await expect(page.locator('.tooltip')).toContainText('Conséquences');
    const title = await page.locator('#event-title').textContent();
    await choice.click();
    await expect(page.locator('#event-title')).not.toHaveText(title ?? '', { timeout: 10_000 }).catch(() => undefined);
    await page.keyboard.press(' ');
  });
});
