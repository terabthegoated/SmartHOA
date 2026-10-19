import test from 'node:test';
import assert from 'node:assert/strict';
import { billPeriodForDueDate, billPeriodLabel, billPeriodPayload, isValidBillMonth } from '../src/services/billGenerationPeriod.ts';

test('November deadline defaults to November, not the current month', () => {
  assert.deepEqual(billPeriodForDueDate({ month: '', explicit: false }, '2026-11-16'), { month: '2026-11', explicit: false });
});
test('an automatic period follows subsequent deadline changes', () => {
  assert.deepEqual(billPeriodForDueDate({ month: '2026-10', explicit: false }, '2026-11-16'), { month: '2026-11', explicit: false });
});
test('an explicitly chosen billing month is distinct from the deadline', () => {
  assert.deepEqual(billPeriodForDueDate({ month: '2026-10', explicit: true }, '2026-11-16'), { month: '2026-10', explicit: true });
});
test('clearing the override allows the next deadline change to set the period', () => {
  assert.deepEqual(billPeriodForDueDate({ month: '', explicit: false }, '2026-12-16'), { month: '2026-12', explicit: false });
});
test('year transitions keep the following year', () => {
  assert.deepEqual(billPeriodForDueDate({ month: '2026-12', explicit: false }, '2027-01-16'), { month: '2027-01', explicit: false });
});
test('the request sends the first day of the selected period', () => {
  assert.equal(billPeriodPayload('2026-11'), '2026-11-01');
  for (const value of ['', '2026-00', '2026-13', '2026-1', '0000-01', '2026-11-16']) {
    assert.equal(isValidBillMonth(value), false);
    assert.throws(() => billPeriodPayload(value), /valid billing month/);
  }
});
test('a missing deadline does not invent an automatic billing month', () => {
  assert.deepEqual(billPeriodForDueDate({ month: '2026-11', explicit: false }, ''), { month: '', explicit: false });
});
test('labels are calendar-safe and identify the actual selected period', () => {
  assert.equal(billPeriodLabel('2026-11'), 'November 2026');
  assert.equal(billPeriodLabel('2027-01'), 'January 2027');
  assert.equal(billPeriodLabel('invalid'), 'the selected billing month');
});
