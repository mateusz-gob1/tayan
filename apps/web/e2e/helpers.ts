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
  await page.getByPlaceholder('np. Ania').fill(nick);
  await page.getByRole('button', { name: 'Utwórz pokój' }).click();
  const code = page.getByTestId('room-code');
  await expect(code).toHaveText(/^[A-Z0-9]{5}$/);
  return (await code.textContent())!.trim();
}

export async function joinRoom(page: Page, code: string, nick: string): Promise<void> {
  await page.goto(`/r/${code}`);
  await page.getByPlaceholder('np. Ania').fill(nick);
  await page.getByRole('button', { name: 'Dołącz' }).click();
  await expect(page.getByText('Gracze (')).toBeVisible();
}

/**
 * Plays for a player until the game is over: bids the minimum raise, sometimes checks, and
 * clicks "Next" on every reveal. Resolves when the winner banner appears.
 */
export async function autoplay(page: Page): Promise<void> {
  const raise = page.getByRole('button', { name: /^Minimalne przebicie/ });
  const check = page.getByRole('button', { name: 'Sprawdzam' });
  const next = page.getByRole('button', { name: 'Dalej', exact: true });
  const winner = page.getByText(/^Zwycięzca:/);
  for (;;) {
    if (await winner.isVisible()) return;
    if ((await next.count()) && (await next.isEnabled())) await next.click().catch(() => {});
    else if (
      (await check.count()) &&
      (await check.isEnabled()) &&
      (Math.random() < 0.35 || !(await raise.count()))
    )
      await check.click().catch(() => {});
    else if (await raise.count()) await raise.click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
