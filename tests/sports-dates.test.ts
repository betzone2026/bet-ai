/**
 * Date handling for the admin sync selector.
 *
 * The picker, the route and the sync service all validate the same value, so
 * the rule is asserted once against the module all three import. `now` is
 * injected everywhere, which is what keeps these assertions from expiring.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SYNC_DATE_OFFSET_DAYS,
  daysBetween,
  isIsoDate,
  syncDateBounds,
  todayIso,
  validateSyncDate,
} from '../src/lib/sports/dates.ts';

const NOW = new Date('2026-08-15T09:30:00.000Z');

describe('date selection', () => {
  it('defaults to today when the admin chose nothing', () => {
    assert.deepEqual(validateSyncDate(undefined, NOW), { ok: true, date: '2026-08-15' });
    assert.deepEqual(validateSyncDate(null, NOW), { ok: true, date: '2026-08-15' });
    assert.deepEqual(validateSyncDate('', NOW), { ok: true, date: '2026-08-15' });
  });

  it('accepts a date the admin picked instead of today', () => {
    assert.deepEqual(validateSyncDate('2026-08-22', NOW), { ok: true, date: '2026-08-22' });
    assert.deepEqual(validateSyncDate('2026-05-01', NOW), { ok: true, date: '2026-05-01' });
  });

  it('formats today in UTC regardless of the clock time', () => {
    // A date is a label for a day, so the same day must come back from any
    // instant inside it — otherwise a late-evening sync would fetch tomorrow.
    assert.equal(todayIso(new Date('2026-08-15T00:00:00.000Z')), '2026-08-15');
    assert.equal(todayIso(new Date('2026-08-15T23:59:59.999Z')), '2026-08-15');
  });

  it('offers picker bounds that match what the validator accepts', () => {
    const bounds = syncDateBounds(NOW);
    assert.equal(daysBetween(bounds.min, '2026-08-15'), -MAX_SYNC_DATE_OFFSET_DAYS);
    assert.equal(daysBetween(bounds.max, '2026-08-15'), MAX_SYNC_DATE_OFFSET_DAYS);
    assert.equal(validateSyncDate(bounds.min, NOW).ok, true);
    assert.equal(validateSyncDate(bounds.max, NOW).ok, true);
  });
});

describe('invalid date', () => {
  it('rejects anything that is not YYYY-MM-DD', () => {
    for (const value of ['15-08-2026', '2026/08/15', '2026-8-5', 'today', '20260815', ' 2026-08-15']) {
      const result = validateSyncDate(value, NOW);
      assert.equal(result.ok, false, `${value} must be rejected`);
      assert.match(result.ok ? '' : result.reason, /YYYY-MM-DD/);
    }
  });

  it('rejects a date that looks well formed but does not exist', () => {
    // The failure this guards is silent: `new Date` rolls 30 February forward
    // to 2 March and the sync fetches a day nobody asked for.
    assert.equal(isIsoDate('2026-02-30'), false);
    assert.equal(isIsoDate('2026-13-01'), false);
    assert.equal(isIsoDate('2026-00-10'), false);
    assert.equal(validateSyncDate('2026-02-30', NOW).ok, false);
  });

  it('accepts a real leap day and rejects one in a non-leap year', () => {
    assert.equal(isIsoDate('2028-02-29'), true);
    assert.equal(isIsoDate('2026-02-29'), false);
  });

  it('rejects non-strings outright', () => {
    for (const value of [20260815, {}, [], true]) {
      assert.equal(validateSyncDate(value, NOW).ok, false);
    }
  });

  it('rejects a date far enough away to be a typo', () => {
    const result = validateSyncDate('2062-08-15', NOW);
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.reason, /within 400 days/);

    // One day past the window either side, to pin the boundary itself.
    assert.equal(validateSyncDate('2027-09-19', NOW).ok, true);
    assert.equal(validateSyncDate('2027-09-20', NOW).ok, false);
    assert.equal(validateSyncDate('2025-07-11', NOW).ok, true);
    assert.equal(validateSyncDate('2025-07-10', NOW).ok, false);
  });
});
