# SmartHOA payment reminders

## Before scheduling

Run `database/migrations/20260929_add_payment_reminder_logs.sql` once in the
Supabase SQL Editor. The migration only adds the reminder audit table; it does
not change bills, payment statuses, balances, or account access.

The reminder scheduler works only with real generated bills. Officers must
generate the monthly HOA bill for each active resident; the scheduler will not
create a virtual bill when no payment record exists.

## Reminder stages

All dates use the `Asia/Manila` calendar and are measured from the bill's saved
due date:

| Stage | When it is sent |
| --- | --- |
| Courtesy reminder | Exactly 7 days before the due date |
| Final reminder | Exactly 1 day before the due date |
| First notice | First day after the due date |
| Second notice / demand follow-up | One calendar month and one day after the due date |
| Third notice / hearing review | Two calendar months and one day after the due date |

Courtesy and final reminders are not sent late if a daily job is missed.
Formal notices catch up at the highest eligible stage, with one notification per
resident per run. Submitted payment receipts are excluded while officers verify
them. The process never freezes an account, changes a payment status, or edits
a bill amount.

Every sent reminder is recorded in `payment_reminder_logs`, so repeating a run
does not create duplicate notices. Each successful run writes an in-app Payment
notification and optionally sends FCM if Firebase is configured.

## Run it manually

From the SmartHOA project folder:

```powershell
php .\backend\scripts\run_payment_reminders.php
```

For a controlled test or missed-run recovery, provide a Manila date:

```powershell
php .\backend\scripts\run_payment_reminders.php --date=2026-10-17
```

Use the Officer Payments page’s **Send payment reminders** button for the
normal manual run. Only HOA Officers and Super Administrators can use that API.

## Schedule once daily on Windows

Use Windows Task Scheduler to create a daily task, preferably after 8:00 AM.

- **Program/script:** the full path to `php.exe` (for example,
  `C:\xampp\php\php.exe` if that is the PHP installation being used)
- **Add arguments:** `C:\Users\Jorell\Downloads\SmartHOA-1\backend\scripts\run_payment_reminders.php`
- **Start in:** `C:\Users\Jorell\Downloads\SmartHOA-1`

Confirm the task with the manual command first. The command prints a JSON
summary with the eligible, sent, already-sent, and skipped counts.
