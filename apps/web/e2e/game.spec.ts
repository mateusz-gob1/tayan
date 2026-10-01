import { expect, test } from '@playwright/test';
import { autoplay, createRoom, joinRoom, newPlayer } from './helpers';

test('three players play a whole game and start a rematch', async ({ browser }) => {
  const host = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const cyd = await newPlayer(browser);

  const code = await createRoom(host, 'Ala');
  await joinRoom(bob, code, 'Bob');
  await joinRoom(cyd, code, 'Cyd');
  await expect(host.getByText('Gracze (3)')).toBeVisible();

  // a short game: elimination at 3 cards (the elimination limit lives in the collapsed
  // "Game settings" section)
  await host.getByRole('button', { name: 'Ustawienia gry' }).click();
  await bob.getByRole('button', { name: 'Ustawienia gry' }).click();
  await host.getByLabel('Limit eliminacji').selectOption('3');
  await expect(bob.getByLabel('Limit eliminacji')).toHaveValue('3');

  await host.getByRole('button', { name: 'Start' }).click();
  for (const p of [host, bob, cyd]) await expect(p.getByText('Twoje karty')).toBeVisible();

  await Promise.all([autoplay(host), autoplay(bob), autoplay(cyd)]);
  for (const p of [host, bob, cyd]) {
    await expect(p.getByText(/^Zwycięzca:/)).toBeVisible();
    await expect(p.getByText('Kolejność odpadania')).toBeVisible();
  }

  await host.getByRole('button', { name: 'Rewanż' }).click();
  for (const p of [host, bob, cyd]) await expect(p.getByText('Gracze (3)')).toBeVisible();
});

test('a refreshed page returns to the same game with the same cards', async ({ browser }) => {
  const host = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const code = await createRoom(host, 'Ala');
  await joinRoom(bob, code, 'Bob');
  await host.getByRole('button', { name: 'Start' }).click();
  await expect(bob.getByText('Twoje karty')).toBeVisible();

  const cards = () =>
    bob
      .locator('img[alt]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('alt')).filter(Boolean));
  const before = await cards();
  expect(before.length).toBeGreaterThan(0);

  await bob.reload();
  await expect(bob.getByText('Twoje karty')).toBeVisible();
  expect(await cards()).toEqual(before);
  await expect(host.getByText('offline')).toHaveCount(0); // Bob is connected again
});

test('an invite to a different room is not overridden by a saved session', async ({ browser }) => {
  const host = await newPlayer(browser);
  const codeA = await createRoom(host, 'Ala'); // host now has a saved session for room A

  const otherHost = await newPlayer(browser);
  const codeB = await createRoom(otherHost, 'Bob');

  // host's browser still holds room A's session when it follows a link to room B
  await host.goto(`/r/${codeB}`);
  await expect(host.getByText(`Zaproszenie do pokoju ${codeB}`)).toBeVisible();
  expect(host.url()).toContain(`/r/${codeB}`);
  expect(host.url()).not.toContain(`/r/${codeA}`);

  // accepting the invite actually joins room B, not silently room A
  await host.getByRole('button', { name: 'Dołącz' }).click();
  await expect(host.getByText('Gracze (2)')).toBeVisible();
});

test('language switch and help panel', async ({ browser }) => {
  const page = await newPlayer(browser);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Utwórz pokój' })).toBeVisible();
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.getByRole('button', { name: 'Create room' })).toBeVisible();

  await page.keyboard.press('h');
  await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
  await expect(page.getByText('Straight flush', { exact: false }).first()).toBeVisible();
  await page.keyboard.press('h');
  await expect(page.getByRole('heading', { name: 'Help' })).toBeHidden();
});

test('a lone player can add bots in the lobby and play against them', async ({ browser }) => {
  const host = await newPlayer(browser);
  await createRoom(host, 'Ala');
  await host.getByRole('button', { name: 'Graj z botami' }).click();
  await expect(host.getByText('Twoje karty')).toBeVisible();
  await host.getByText('Bot 1').first().waitFor();
});

test('the round info never overlaps a seat on a short, wide window', async ({ browser }) => {
  // a laptop with limited vertical room (browser chrome eats into a ~768px screen); a 2-player
  // duel is the tightest case since the opponent's seat sits directly above the centre text
  const context = await browser.newContext({ viewport: { width: 1366, height: 660 } });
  await context.addInitScript(() => {
    localStorage.setItem('tayan.lang', 'pl');
    localStorage.setItem('tayan.muted', '1');
  });
  const page = await context.newPage();
  await createRoom(page, 'Ala');
  await page.getByRole('button', { name: 'Graj z botami' }).click();
  await expect(page.getByText('Twoje karty')).toBeVisible();
  // declare on our own turn (the bot declares on its own) until a "X zadeklarował" byline shows,
  // so the centre text is at its tallest — a category name plus a two-line hand like "Poker do asa"
  const category = page.locator('[data-testid="picker-category"]:not([disabled])');
  const option = page.getByTestId('picker-option');
  const confirm = page.getByTestId('picker-confirm');
  const byline = page.getByText(/zadeklarował/);
  for (let i = 0; i < 50 && !(await byline.isVisible()); i++) {
    if (await confirm.count()) await confirm.click({ timeout: 1000 }).catch(() => {});
    else if (await option.count())
      await option
        .last()
        .click({ timeout: 1000 })
        .catch(() => {});
    else if (await category.count())
      await category
        .last()
        .click({ timeout: 1000 })
        .catch(() => {});
    await page.waitForTimeout(200);
  }
  await expect(byline).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);

  const centre = await page.getByTestId('centre-info').boundingBox();
  const seats = await page.locator('.plaque, .plaque-active').all();
  expect(centre).not.toBeNull();
  for (const seat of seats) {
    const box = await seat.boundingBox();
    if (!box || !centre) continue;
    const overlapsX = centre.x < box.x + box.width && centre.x + centre.width > box.x;
    const overlapsY = centre.y < box.y + box.height && centre.y + centre.height > box.y;
    expect(
      overlapsX && overlapsY,
      `seat ${JSON.stringify(box)} overlaps centre info ${JSON.stringify(centre)}`,
    ).toBe(false);
  }
});
