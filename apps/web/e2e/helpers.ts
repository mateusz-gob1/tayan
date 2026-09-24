import { expect, type Browser, type Page } from '@playwright/test';

/** A fresh browser context (its own storage, like a separate player). */
export async function newPlayer(browser: Browser, lang: 'pl' | 'en' = 'pl'): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(
    ([l]) => {
      localStorage.setItem('tayan.lang', l as string);
      localStorage.setItem('tayan.muted', '1');
    },
    [lang],
  );
  return context.newPage();
}

export async function createRoom(page: Page, nick: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Twój nick').fill(nick);
  await page.getByRole('button', { name: 'Utwórz pokój' }).click();
  const code = page.getByTestId('room-code');
  await expect(code).toHaveText(/^[A-Z0-9]{5}$/);
  return (await code.textContent())!.trim();
}

export async function joinRoom(page: Page, code: string, nick: string): Promise<void> {
  await page.goto(`/r/${code}`);
  await page.getByLabel('Twój nick').fill(nick);
  await page.getByRole('button', { name: 'Dołącz' }).click();
  await expect(page.getByText('Gracze (')).toBeVisible();
}

/**
 * Plays for a player until the game is over: sometimes checks, otherwise picks the first
 * available declaration in the picker (a small raise), and clicks "Next" on every reveal.
 * Resolves when the winner banner appears.
 */
export async function autoplay(page: Page): Promise<void> {
  const check = page.getByRole('button', { name: 'Sprawdzam' });
  const next = page.getByRole('button', { name: 'Dalej', exact: true });
  const category = page.locator('[data-testid="picker-category"]:not([disabled])');
  const option = page.getByTestId('picker-option');
  const confirm = page.getByTestId('picker-confirm');
  const winner = page.getByText(/^Zwycięzca:/);
  for (;;) {
    if (await winner.isVisible()) return;
    const pickerOpen =
      (await category.count()) + (await option.count()) + (await confirm.count()) > 0;
    if ((await next.count()) && (await next.isEnabled())) await next.click().catch(() => {});
    else if (
      (await check.count()) &&
      (await check.isEnabled()) &&
      (Math.random() < 0.35 || !pickerOpen)
    )
      await check.click().catch(() => {});
    else if (await confirm.count()) await confirm.click().catch(() => {});
    else if (await option.count())
      await option
        .first()
        .click()
        .catch(() => {});
    else if (await category.count())
      await category
        .first()
        .click()
        .catch(() => {});
    await page.waitForTimeout(150);
  }
}
