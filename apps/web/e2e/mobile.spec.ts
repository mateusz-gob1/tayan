import { expect, test, type Page } from '@playwright/test';

// A phone held sideways and upright. The game must fit the screen without scrolling sideways and
// without scrolling the table or the reveal, and the buttons a player needs must be on screen.
const PHONES = [
  { name: 'sideways', width: 812, height: 375 },
  { name: 'upright', width: 390, height: 844 },
] as const;

/**
 * Whether the element is fully inside the visible screen. Answers at once from one look at the
 * page ('missing' if the screen has just changed), so the game moving on cannot make it hang.
 */
async function onScreen(page: Page, selector: string): Promise<'on' | 'off' | 'missing'> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth
      ? 'on'
      : 'off';
  }, selector);
}

async function noScroll(page: Page, where: string): Promise<void> {
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    sh: document.documentElement.scrollHeight,
    ih: innerHeight,
  }));
  expect(size.sw, `${where}: sideways scroll`).toBeLessThanOrEqual(size.iw);
  expect(size.sh, `${where}: page scroll`).toBeLessThanOrEqual(size.ih);
}

for (const phone of PHONES) {
  test(`a game against bots fits a phone held ${phone.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript(() => {
      localStorage.setItem('tayan.lang', 'pl');
      localStorage.setItem('tayan.muted', '1');
    });
    const page = await context.newPage();
    await page.goto('/');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'start screen: sideways scroll',
    ).toBe(true);
    await page.getByLabel('Twój nick').fill('Ala');
    await page.getByRole('button', { name: 'Utwórz pokój' }).click();
    await expect(page.getByTestId('room-code')).toHaveText(/^[A-Z0-9]{5}$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'lobby: sideways scroll',
    ).toBe(true);
    await page.getByRole('button', { name: 'Graj z botami' }).click();
    await expect(page.getByText('Twoje karty')).toBeVisible();

    const check = page.getByRole('button', { name: 'Sprawdzam' });
    const next = page.getByRole('button', { name: 'Dalej', exact: true });
    const category = page.locator('[data-testid="picker-category"]:not([disabled])');
    const option = page.getByTestId('picker-option');
    const confirm = page.getByTestId('picker-confirm');
    const click = { timeout: 1000 };
    let sawMyTurn = false;
    let sawReveal = false;

    // play on until both screens were seen: the bots sometimes end a round before my turn comes
    for (let i = 0; i < 1200 && !(sawReveal && sawMyTurn); i++) {
      if (await next.count()) {
        // the reveal: nothing scrolls and "Next" is on screen
        await page.waitForTimeout(500);
        await noScroll(page, 'reveal');
        const nextButton = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(
            (x) => x.textContent?.trim() === 'Dalej',
          );
          if (!b) return 'missing';
          const r = b.getBoundingClientRect();
          return r.bottom <= innerHeight && r.right <= innerWidth ? 'on' : 'off';
        });
        if (nextButton === 'missing') continue; // the screen has just changed
        expect(nextButton, 'reveal: Next on screen').toBe('on');
        sawReveal = true;
        await next.click(click).catch(() => {});
        continue;
      }
      if (await category.count()) {
        // my turn: the hand, the turn status and the first row of hands are all on screen
        if (!sawMyTurn) await page.waitForTimeout(1600); // the cards are still being dealt
        await noScroll(page, 'table');
        const picker = await onScreen(page, '[data-testid="picker-category"]');
        const hand = await onScreen(page, 'img[alt]:not([alt=""])');
        if (picker === 'missing' || hand === 'missing') continue; // the screen has just changed
        expect(picker, 'picker on screen').toBe('on');
        expect(hand, 'hand on screen').toBe('on');
        sawMyTurn = true;
        if ((await check.count()) && (await check.isEnabled().catch(() => false)))
          await check.click(click).catch(() => {});
        else
          await category
            .first()
            .click(click)
            .catch(() => {});
      } else if (await confirm.count()) await confirm.click(click).catch(() => {});
      else if (await option.count())
        await option
          .first()
          .click(click)
          .catch(() => {});
      await page.waitForTimeout(150);
    }
    expect(sawMyTurn, 'it was my turn at some point').toBe(true);
    expect(sawReveal, 'reached a reveal').toBe(true);
    await context.close();
  });
}
