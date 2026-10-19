<?php
require_once __DIR__ . '/dues_balances.php';

function analytics_payment_rows(PDO $db) {
    return $db->query("SELECT p.payment_id, p.resident_id, p.billing_month, p.due_date, p.amount_due, p.payment_status,
        pt.payment_name AS type_name,
        (SELECT MIN(r.uploaded_at) FROM payment_receipts r WHERE r.payment_id = p.payment_id) AS receipt_submitted_at,
        (SELECT MAX(t.amount_paid) FROM payment_transactions t WHERE t.payment_id = p.payment_id) AS recorded_paid_amount
        FROM payments p LEFT JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id
        ORDER BY p.payment_id")->fetchAll(PDO::FETCH_ASSOC);
}

/** Read-only metrics; share the bill calculator and never post charges. */
function analytics_payment_metrics(array $rows, $asOf = null) {
    $today = dues_balance_date($asOf);
    $currentMonth = $today->format('Y-m-01');
    $views = dues_balance_payment_views($rows, $today);
    $dues = dues_balance_summary($views, $today);
    $metrics = ['total_billed' => 0.0, 'total_collected' => 0.0, 'total_outstanding' => 0.0,
        'outstanding_dues' => $dues['amount_due'], 'outstanding_dues_interest' => $dues['penalty_amount'],
        'dues_under_verification' => $dues['under_review_amount'], 'pending_verifications' => 0,
        'current_month_billed' => 0.0, 'current_month_collected' => 0.0,
        'current_month_received' => 0.0, 'overdue_amount' => $dues['overdue_amount'],
        'overdue_accounts' => 0, 'overdue_bill_count' => 0];
    $overdueResidents = [];
    $duesStatuses = []; $allStatuses = [];
    $months = []; $duesMonths = [];
    $monthStart = $today->modify('first day of this month');
    for ($ago = 5; $ago >= 0; $ago--) {
        $month = $monthStart->modify('-' . $ago . ' months');
        $entry = ['name' => $month->format('M Y'), 'month' => $month->format('Y-m-01'),
            'billed' => 0.0, 'collected' => 0.0, 'pending' => 0.0,
            'under_review' => 0.0, 'overdue_amount' => 0.0, 'paid_principal' => 0.0];
        $months[$entry['month']] = $entry;
        $duesMonths[$entry['month']] = $entry;
    }
    foreach ($views as $view) {
        $status = $view['payment_status'];
        $recorded = $view['recorded_payment_status'];
        $monthly = $view['is_monthly_dues'];
        $review = $view['awaiting_verification'] && in_array($recorded, ['Pending', 'Overdue'], true);
        $open = in_array($recorded, ['Pending', 'Overdue'], true);
        $cancelled = $recorded === 'Cancelled';
        $paid = $recorded === 'Paid';
        $principal = $view['principal_amount'];
        $total = $view['balance_due'];
        $month = substr($view['billing_month'], 0, 7) . '-01';
        $label = $review ? 'Pending Verification' : $status;
        $allStatuses[$label] = ($allStatuses[$label] ?? 0) + 1;
        if ($monthly) $duesStatuses[$label] = ($duesStatuses[$label] ?? 0) + 1;
        if ($review) $metrics['pending_verifications']++;
        if (!$cancelled) $metrics['total_billed'] += $principal;
        if ($paid) $metrics['total_collected'] += $total;
        if ($open && !$review) $metrics['total_outstanding'] += $total;
        if ($monthly && $open && !$review && $status === 'Overdue') {
            $metrics['overdue_bill_count']++;
            $overdueResidents[$view['resident_id']] = true;
        }
        if ($monthly && $month === $currentMonth && !$cancelled) {
            $metrics['current_month_billed'] += $principal;
            if ($paid) {
                // Compliance remains a principal-settlement ratio, not cash / principal.
                $metrics['current_month_collected'] += $principal;
                $metrics['current_month_received'] += $total;
            }
        }
        if (isset($months[$month])) {
            foreach ([false, true] as $duesOnly) {
                if ($duesOnly && !$monthly) continue;
                $bucket = $duesOnly ? $duesMonths[$month] : $months[$month];
                if (!$cancelled) $bucket['billed'] += $principal;
                if ($paid) { $bucket['collected'] += $total; $bucket['paid_principal'] += $principal; }
                if ($review) $bucket['under_review'] += $total;
                if ($open && !$review) {
                    $bucket['pending'] += $total;
                    if ($status === 'Overdue') $bucket['overdue_amount'] += $total;
                }
                if ($duesOnly) $duesMonths[$month] = $bucket; else $months[$month] = $bucket;
            }
        }
    }
    foreach ($metrics as $key => $value) {
        if (is_float($value)) $metrics[$key] = round($value, 2);
    }
    $metrics['overdue_accounts'] = count($overdueResidents);
    $metrics['collection_rate'] = $metrics['current_month_billed'] > 0
        ? round(100 * $metrics['current_month_collected'] / $metrics['current_month_billed'], 1) : null;
    $metrics['current_month_outstanding'] = round($metrics['current_month_billed'] - $metrics['current_month_collected'], 2);
    $finishMonths = function ($entries) {
        foreach ($entries as &$entry) {
            foreach ($entry as $key => $value) if (is_float($value)) $entry[$key] = round($value, 2);
            $entry['outstanding'] = $entry['pending'];
            $entry['collection_rate'] = $entry['billed'] > 0 ? round(100 * $entry['paid_principal'] / $entry['billed'], 1) : null;
        }
        return array_values($entries);
    };
    $toChart = function ($counts) {
        ksort($counts);
        $result = [];
        foreach ($counts as $name => $value) $result[] = ['name' => $name, 'value' => $value];
        return $result;
    };
    $metrics['payment_compliance'] = $toChart($duesStatuses);
    $metrics['payment_status_distribution'] = $toChart($allStatuses);
    $metrics['monthly_revenue'] = $finishMonths($months);
    $metrics['monthly_payment_trends'] = $metrics['monthly_revenue'];
    $metrics['monthly_dues_compliance'] = $finishMonths($duesMonths);
    $metrics['payment_trend_basis'] = 'Billing month, not cash-flow date. Paid totals use recorded verified payments. Outstanding includes calculated interest and excludes receipts awaiting verification.';
    $metrics['overdue_amount_basis'] = 'Live overdue HOA-dues balance including calculated interest; excludes receipts awaiting verification.';
    $metrics['collection_rate_basis'] = 'Share of current-month original HOA-dues principal on bills marked Paid; interest receipts do not inflate this ratio.';
    $metrics['balance_as_of'] = $today->format('Y-m-d');
    return $metrics;
}
