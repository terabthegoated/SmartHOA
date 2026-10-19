<?php
/** Read-only balance projections. Original bills and transactions are never rewritten. */
function dues_balance_date($date = null) {
    $zone = new DateTimeZone('Asia/Manila');
    return ($date instanceof DateTimeInterface
        ? DateTimeImmutable::createFromInterface($date)->setTimezone($zone)
        : new DateTimeImmutable($date ?: 'today', $zone))->setTimezone($zone)->setTime(0, 0);
}

function dues_balance_is_monthly($name) {
    return in_array(strtolower(trim((string) $name)), ['monthly hoa dues', 'monthly hoa dues + penalty'], true);
}

function dues_balance_notice_date($dueDate, $cycle) {
    $first = dues_balance_date($dueDate)->modify('+1 day');
    if ($cycle === 1) return $first;
    return $first->modify('first day of this month')->modify('+' . ($cycle - 1) . ' months')->modify('+16 days');
}

/**
 * Charge each eligible bill once per calendar cycle, not once per bill/due-date
 * group. Subsequent cycles use the Board's monthly cutoff. Existing later due
 * dates are respected: no charge before the recorded payment window closes.
 * Monthly interest is rounded on the account total, then allocated in cents so
 * all bill totals add up exactly to the dashboard (including rounding).
 */
function dues_balance_payment_views(array $rows, $asOf = null) {
    $today = dues_balance_date($asOf);
    $views = [];
    $groups = [];
    $monthCounts = [];
    foreach ($rows as $row) {
        if (dues_balance_is_monthly($row['type_name'] ?? '') && $row['payment_status'] !== 'Cancelled' && !empty($row['billing_month'])) {
            $key = ($row['resident_id'] ?? 'resident') . ':' . substr($row['billing_month'], 0, 7);
            $monthCounts[$key] = ($monthCounts[$key] ?? 0) + 1;
        }
    }
    foreach ($rows as $index => $row) {
        $principal = max(0, (int) round((float) $row['amount_due'] * 100));
        $status = $row['payment_status'];
        $receiptDate = !empty($row['receipt_submitted_at']) ? dues_balance_date($row['receipt_submitted_at']) : null;
        $review = !in_array($status, ['Paid', 'Cancelled'], true) && $receiptDate !== null;
        $cutoff = $review && $receiptDate < $today ? $receiptDate : $today;
        $due = dues_balance_date($row['due_date']);
        $monthly = dues_balance_is_monthly($row['type_name'] ?? '');
        $open = in_array($status, ['Pending', 'Overdue'], true);
        $view = $row;
        $view['recorded_payment_status'] = $status;
        $view['has_receipt'] = $receiptDate !== null || !empty($row['has_receipt']);
        $view['awaiting_verification'] = $review;
        $view['principal_amount'] = $principal / 100;
        $view['interest_amount'] = 0.0;
        $view['balance_due'] = $principal / 100;
        $view['balance_as_of'] = $cutoff->format('Y-m-d');
        $view['months_overdue'] = 0;
        $view['is_monthly_dues'] = $monthly;
        $monthKey = ($row['resident_id'] ?? 'resident') . ':' . substr($row['billing_month'] ?? '', 0, 7);
        $view['same_month_dues_count'] = $monthly ? ($monthCounts[$monthKey] ?? 1) : 1;
        if ($status === 'Paid' && isset($row['recorded_paid_amount'])) {
            // Preserve what was actually recorded; do not retrospectively charge paid bills.
            $view['balance_due'] = (float) $row['recorded_paid_amount'];
        }
        if ($open && !$review) {
            $view['payment_status'] = $due < $today ? 'Overdue' : 'Pending';
        }
        $views[$index] = $view;
        if (!$monthly || !$open || $principal === 0) continue;
        $group = (string) ($row['resident_id'] ?? 'resident');
        $groups[$group][$index] = [
            'cents' => $principal, 'due' => $due, 'cutoff' => $cutoff,
            'key' => (string) ($row['payment_id'] ?? $index),
        ];
    }
    foreach ($groups as $bills) {
        $firstMonth = $today->modify('first day of this month');
        foreach ($bills as $bill) {
            $month = $bill['due']->modify('first day of this month');
            if ($month < $firstMonth) $firstMonth = $month;
        }
        for ($month = $firstMonth; $month <= $today; $month = $month->modify('+1 month')) {
            $eligible = [];
            foreach ($bills as $index => $bill) {
                if ($month->format('Y-m') < $bill['due']->format('Y-m')) continue;
                // A month-end due date can roll its first charge into the next
                // month. Do not assess that bill twice in that calendar month.
                if ($month->format('Y-m') !== $bill['due']->format('Y-m')
                    && $month->format('Y-m') <= $bill['due']->modify('+1 day')->format('Y-m')) continue;
                $chargeDate = $month->format('Y-m') === $bill['due']->format('Y-m')
                    ? $bill['due']->modify('+1 day') : $month->setDate((int) $month->format('Y'), (int) $month->format('m'), 17);
                if ($chargeDate > $bill['cutoff']) continue;
                $eligible[$index] = $bill;
            }
            $total = array_sum(array_column($eligible, 'cents'));
            $remaining = (int) round($total / 10);
            $charges = [];
            foreach ($eligible as $index => $bill) {
                $charges[$index] = intdiv($bill['cents'], 10);
                $remaining -= $charges[$index];
            }
            uasort($eligible, function ($a, $b) {
                return ($b['cents'] % 10 <=> $a['cents'] % 10) ?: strcmp($a['key'], $b['key']);
            });
            foreach ($eligible as $index => $bill) {
                if ($remaining > 0) { $charges[$index]++; $remaining--; }
                $bills[$index]['cents'] += $charges[$index];
                $views[$index]['months_overdue']++;
            }
        }
        foreach ($bills as $index => $bill) {
            $views[$index]['balance_due'] = $bill['cents'] / 100;
            $views[$index]['interest_amount'] = round($views[$index]['balance_due'] - $views[$index]['principal_amount'], 2);
        }
    }
    return array_values($views);
}

function dues_balance_summary(array $views, $asOf = null) {
    $today = dues_balance_date($asOf);
    $summary = ['amount_due' => 0.0, 'base_dues' => 0.0, 'penalty_amount' => 0.0,
        'overdue_amount' => 0.0, 'upcoming_amount' => 0.0, 'under_review_amount' => 0.0,
        'months_overdue' => 0, 'due_date' => null, 'as_of_date' => $today->format('Y-m-d')];
    $oldest = null;
    $next = null;
    $hasRecord = false;
    foreach ($views as $view) {
        if (empty($view['is_monthly_dues'])) continue;
        $hasRecord = true;
        if (!in_array($view['recorded_payment_status'], ['Pending', 'Overdue'], true)) continue;
        if ($view['awaiting_verification']) {
            $summary['under_review_amount'] += $view['balance_due'];
            continue;
        }
        $summary['amount_due'] += $view['balance_due'];
        $summary['base_dues'] += $view['principal_amount'];
        $summary['penalty_amount'] += $view['interest_amount'];
        $due = dues_balance_date($view['due_date']);
        if ($due < $today) {
            $summary['overdue_amount'] += $view['balance_due'];
            $summary['months_overdue'] = max($summary['months_overdue'], $view['months_overdue']);
            if ($oldest === null || $due < $oldest) $oldest = $due;
        } else {
            $summary['upcoming_amount'] += $view['balance_due'];
            if ($next === null || $due < $next) $next = $due;
        }
    }
    foreach (['amount_due', 'base_dues', 'penalty_amount', 'overdue_amount', 'upcoming_amount', 'under_review_amount'] as $key) {
        $summary[$key] = round($summary[$key], 2);
    }
    $summary['due_date'] = ($oldest ?? $next)?->format('Y-m-d');
    $summary['status'] = $summary['overdue_amount'] > 0 ? 'Overdue' : ($summary['amount_due'] > 0 ? 'Due'
        : ($summary['under_review_amount'] > 0 ? 'Under review' : ($hasRecord ? 'Paid' : 'Awaiting bill')));
    $summary['billing_label'] = 'Outstanding HOA dues';
    $months = $summary['months_overdue'];
    $summary['collection_stage'] = $months >= 3 ? 'Third Notice - Hearing required' : ($months === 2
        ? 'Second Notice - Demand letter' : ($months === 1 ? 'First Notice' : ''));
    $summary['message'] = $oldest
        ? 'The oldest overdue bill was due on ' . $oldest->format('M j, Y') . '. Interest is calculated monthly, not daily. Officers confirm formal notices and any hearing.'
        : ($summary['amount_due'] > 0 ? 'Pay each bill on or before its listed due date. Interest is calculated monthly, not daily.'
            : ($summary['under_review_amount'] > 0 ? 'Your submitted receipt is awaiting officer verification. It is not marked paid until approved.'
                : ($hasRecord ? 'No outstanding monthly HOA dues are recorded.' : 'No monthly HOA dues bill has been issued to your account yet.')));
    return $summary;
}
