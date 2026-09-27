import { ratAdd, ratFromBigInt, ratMul, ZERO, type Rational } from './probability';

/**
 * How many rounds a whole game spends at each pool size `N` (the total cards held by every
 * active player at the start of a round). Computed exactly, by forward propagation over a Markov
 * chain with no cycles (a monotonically increasing "points" total), not by simulation.
 * Implements `docs/ranking-algorithm.md` section 3 (`tayan-lab`): state = the sorted card counts
 * of the active players; each round, one active player is picked uniformly at random to lose and
 * gains a card, dropping out on reaching `eliminationLimit`.
 */
export function poolSizeDistribution(
  players: number,
  startingCards: number,
  eliminationLimit: number,
): { roundsByN: Map<number, Rational>; expectedRounds: Rational } {
  const roundsByN = new Map<number, Rational>();
  let expectedRounds: Rational = ZERO;

  // A state is a sorted array of active players' card counts; keyed by its comma-joined string so
  // equal states (however reached) accumulate one combined probability instead of being revisited.
  let frontier = new Map<string, { counts: number[]; prob: Rational }>();
  const initialCounts = Array(players).fill(startingCards);
  frontier.set(initialCounts.join(','), { counts: initialCounts, prob: ratFromBigInt(1n) });

  while (frontier.size > 0) {
    const next = new Map<string, { counts: number[]; prob: Rational }>();
    for (const { counts, prob } of frontier.values()) {
      if (counts.length < 2) continue; // the game is already over: no round is played here

      const N = counts.reduce((a, b) => a + b, 0);
      roundsByN.set(N, ratAdd(roundsByN.get(N) ?? ZERO, prob));
      expectedRounds = ratAdd(expectedRounds, prob);

      // Group by distinct card count: players sharing a count lead to the same next state, so
      // their probabilities of losing this round are combined instead of tracked one by one.
      const active = counts.length;
      const byValue = new Map<number, number>(); // value -> how many players hold it
      for (const c of counts) byValue.set(c, (byValue.get(c) ?? 0) + 1);

      for (const [value, count] of byValue) {
        const pLose = ratFromBigInt(BigInt(count), BigInt(active));
        const rest = counts.filter((c) => c !== value);
        const grown = Array(count - 1).fill(value); // the players at `value` who did not lose
        if (value + 1 < eliminationLimit) grown.push(value + 1); // the loser, still in
        const nextCounts = [...rest, ...grown].sort((a, b) => a - b);
        const key = nextCounts.join(',');
        const existing = next.get(key);
        const contributed = ratMul(prob, pLose);
        next.set(key, {
          counts: nextCounts,
          prob: existing ? ratAdd(existing.prob, contributed) : contributed,
        });
      }
    }
    frontier = next;
  }

  return { roundsByN, expectedRounds };
}
