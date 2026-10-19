export interface BillPeriodSelection {
  month: string;
  explicit: boolean;
}

export const isValidBillMonth = (month: string) => /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month);

export function billPeriodForDueDate(selection: BillPeriodSelection, dueDate: string): BillPeriodSelection {
  if (selection.explicit && isValidBillMonth(selection.month)) return selection;
  const month = dueDate.slice(0, 7);
  return { month: isValidBillMonth(month) ? month : '', explicit: false };
}

export function billPeriodPayload(month: string) {
  if (!isValidBillMonth(month)) throw new Error('Choose a valid billing month.');
  return `${month}-01`;
}

export function billPeriodLabel(month: string) {
  if (!isValidBillMonth(month)) return 'the selected billing month';
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}
