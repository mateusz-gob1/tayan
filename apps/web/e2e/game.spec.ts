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

  // a short game: elimination at 3 cards
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
      .locator('[aria-label]')
      .filter({ hasText: /[♣♦♥♠]/ })
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const before = await cards();
  expect(before.length).toBeGreaterThan(0);

  await bob.reload();
  await expect(bob.getByText('Twoje karty')).toBeVisible();
  expect(await cards()).toEqual(before);
  await expect(host.getByText('offline')).toHaveCount(0); // Bob is connected again
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
