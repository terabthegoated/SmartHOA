import test from 'node:test';
import assert from 'node:assert/strict';
import { billPeriodForDueDate, billPeriodLabel } from '../src/services/billGenerationPeriod.ts';

test('November deadline defaults to November, not the current month', () => {
  assert.equal(billPeriodForDueDate('2026-11-16'), '2026-11');
});
test('changing the deadline always changes the inferred period', () => {
  assert.equal(billPeriodForDueDate('2026-10-16'), '2026-10');
  assert.equal(billPeriodForDueDate('2026-11-16'), '2026-11');
});
test('different dates within November identify the same period', () => {
  assert.equal(billPeriodForDueDate('2026-11-01'), billPeriodForDueDate('2026-11-30'));
});
test('the same month in different years identifies different periods', () => {
  assert.notEqual(billPeriodForDueDate('2026-11-16'), billPeriodForDueDate('2027-11-16'));
});
test('year transitions keep the following year', () => {
  assert.equal(billPeriodForDueDate('2027-01-16'), '2027-01');
});
test('invalid and incomplete deadlines cannot invent a billing month', () => {
  for (const value of ['', '2026-11', '0000-01-16', '2026-13-16', '2026-11-31', '2026-02-29', '2026-11-00', '2026-1-16', '2026-11-16extra']) {
    assert.equal(billPeriodForDueDate(value), '');
  }
});
test('a valid leap-day deadline identifies February', () => {
  assert.equal(billPeriodForDueDate('2028-02-29'), '2028-02');
});
test('labels are calendar-safe and identify the actual selected period', () => {
  assert.equal(billPeriodLabel('2026-11'), 'November 2026');
  assert.equal(billPeriodLabel('2027-01'), 'January 2027');
  assert.equal(billPeriodLabel('invalid'), 'the selected billing month');
});
