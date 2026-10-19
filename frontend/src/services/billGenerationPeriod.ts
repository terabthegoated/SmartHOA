const isValidBillMonth = (month: string) => /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month);

/** Used for form validation and labels only; the server derives the saved period. */
export function billPeriodForDueDate(dueDate: string) {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(dueDate)) return '';
  const date = new Date(`${dueDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dueDate) return '';
  return dueDate.slice(0, 7);
}

export function billPeriodLabel(month: string) {
  if (!isValidBillMonth(month)) return 'the selected billing month';
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}
