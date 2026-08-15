/**
 * Odds are stored as history, not as a current value.
 *
 * The rule these tests pin down: a price that changed produces a new row, a
 * price that did not is ignored, and nothing ever overwrites an earlier
 * observation. Line movement, closing-line comparison and backtesting all
 * depend on the earlier rows still being there.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isValidDecimalOdds,
  latestByKey,
  oddsKey,
  selectNewSnapshots,
} from '../src/lib/sports/odds.ts';
import type { OddsSnapshot } from '../src/lib/sports/types.ts';

function snapshot(overrides: Partial<OddsSnapshot> = {}): OddsSnapshot {
  return {
    fixtureId: 'af-1035037',
    provider: 'api-football',
    bookmaker: 'Bet365',
    market: 'Match Winner',
    selection: 'Home',
    decimalOdds: 2.1,
    capturedAt: '2026-08-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('price validation', () => {
  it('accepts a decimal price inside the plausible range', () => {
    assert.equal(isValidDecimalOdds(1.01), true);
    assert.equal(isValidDecimalOdds(2.5), true);
    assert.equal(isValidDecimalOdds(1000), true);
  });

  it('rejects anything that is not a usable price', () => {
    assert.equal(isValidDecimalOdds(1), false, 'a price below 1.01 pays nothing');
    assert.equal(isValidDecimalOdds(0), false);
    assert.equal(isValidDecimalOdds(-2), false);
    assert.equal(isValidDecimalOdds(5000), false);
    assert.equal(isValidDecimalOdds('2.10'), false);
    assert.equal(isValidDecimalOdds(Number.NaN), false);
    assert.equal(isValidDecimalOdds(null), false);
  });
});

describe('line identity', () => {
  it('keys a price by bookmaker, market and selection', () => {
    assert.equal(
      oddsKey(snapshot()),
      oddsKey(snapshot({ decimalOdds: 3.4, capturedAt: '2026-08-16T12:00:00.000Z' })),
      'the same line keeps its key as the price moves',
    );
    assert.notEqual(oddsKey(snapshot()), oddsKey(snapshot({ selection: 'Away' })));
    assert.notEqual(oddsKey(snapshot()), oddsKey(snapshot({ bookmaker: 'Pinnacle' })));
  });

  it('resolves a line to its most recent observation', () => {
    const history = [
      snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T12:00:00.000Z' }),
      snapshot({ decimalOdds: 2.4, capturedAt: '2026-08-15T18:00:00.000Z' }),
      snapshot({ decimalOdds: 2.2, capturedAt: '2026-08-15T15:00:00.000Z' }),
    ];
    const latest = latestByKey(history);
    assert.equal(latest.size, 1);
    assert.equal(latest.get(oddsKey(snapshot()))?.decimalOdds, 2.4);
  });
});

describe('appending snapshots', () => {
  it('stores every line the first time it is seen', () => {
    const incoming = [
      snapshot({ selection: 'Home', decimalOdds: 2.1 }),
      snapshot({ selection: 'Draw', decimalOdds: 3.4 }),
      snapshot({ selection: 'Away', decimalOdds: 3.6 }),
    ];
    assert.equal(selectNewSnapshots([], incoming).length, 3);
  });

  it('appends a new row when the price moves, keeping the earlier one', () => {
    const previous = [snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T12:00:00.000Z' })];
    const incoming = [snapshot({ decimalOdds: 1.95, capturedAt: '2026-08-15T18:00:00.000Z' })];

    const selected = selectNewSnapshots(previous, incoming);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.decimalOdds, 1.95);
    assert.equal(
      previous[0]?.decimalOdds,
      2.1,
      'the earlier observation is untouched — history is never overwritten',
    );
  });

  it('ignores an unchanged price so the history is not padded', () => {
    const previous = [snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T12:00:00.000Z' })];
    const incoming = [snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T18:00:00.000Z' })];
    assert.deepEqual(selectNewSnapshots(previous, incoming), []);
  });

  it('records a price that moves and comes back', () => {
    const history = [
      snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T09:00:00.000Z' }),
      snapshot({ decimalOdds: 1.95, capturedAt: '2026-08-15T12:00:00.000Z' }),
    ];
    const selected = selectNewSnapshots(history, [
      snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T18:00:00.000Z' }),
    ]);
    assert.equal(selected.length, 1, 'a return to a former price is still a movement');
  });

  it('drops an invalid price rather than storing noise', () => {
    const selected = selectNewSnapshots([], [
      snapshot({ selection: 'Home', decimalOdds: 0 }),
      snapshot({ selection: 'Draw', decimalOdds: 3.4 }),
    ]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.selection, 'Draw');
  });

  it('keeps only the later capture when one payload repeats a line', () => {
    const selected = selectNewSnapshots([], [
      snapshot({ decimalOdds: 2.1, capturedAt: '2026-08-15T12:00:00.000Z' }),
      snapshot({ decimalOdds: 2.2, capturedAt: '2026-08-15T12:00:05.000Z' }),
    ]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.decimalOdds, 2.2);
  });

  it('treats each fixture and bookmaker independently', () => {
    const previous = [snapshot({ decimalOdds: 2.1 })];
    const selected = selectNewSnapshots(previous, [
      snapshot({ bookmaker: 'Pinnacle', decimalOdds: 2.1 }),
      snapshot({ market: 'Over/Under', selection: 'Over 2.5', decimalOdds: 2.1 }),
    ]);
    assert.equal(selected.length, 2);
  });
});
