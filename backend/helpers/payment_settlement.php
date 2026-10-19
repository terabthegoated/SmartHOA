<?php
require_once __DIR__ . '/dues_balances.php';

/** The same resident lock serializes bill creation, uploads and approvals. */
function dues_balance_lock_resident(PDO $db, $residentId) {
    $sql = 'SELECT resident_id FROM resident_profiles WHERE resident_id = ?';
    if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql') $sql .= ' FOR UPDATE';
    $stmt = $db->prepare($sql);
    $stmt->execute([$residentId]);
    if (!$stmt->fetchColumn()) throw new RuntimeException('Resident not found.');
    $stmt->closeCursor();
}

function dues_balance_monthly_bill_exists(PDO $db, $residentId, $billingMonth) {
    $stmt = $db->prepare("SELECT 1 FROM payments p JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id
        WHERE p.resident_id = ? AND p.billing_month = ? AND p.payment_status <> 'Cancelled'
        AND LOWER(TRIM(pt.payment_name)) IN ('monthly hoa dues', 'monthly hoa dues + penalty') LIMIT 1");
    $stmt->execute([$residentId, $billingMonth]);
    return (bool) $stmt->fetchColumn();
}

/** Full-bill settlement only; officer must verify the receipt covers the displayed total. */
function approve_recorded_payment(PDO $db, $paymentId, $officerId, $confirmedAmount, $asOf = null) {
    $db->beginTransaction();
    try {
        $lookup = $db->prepare('SELECT resident_id FROM payments WHERE payment_id = ?');
        $lookup->execute([$paymentId]);
        $residentId = $lookup->fetchColumn();
        if (!$residentId) throw new RuntimeException('Payment not found.', 404);
        dues_balance_lock_resident($db, $residentId);
        $query = $db->prepare("SELECT p.*, pt.payment_name AS type_name, rp.user_id,
            (SELECT MIN(r.uploaded_at) FROM payment_receipts r WHERE r.payment_id = p.payment_id) AS receipt_submitted_at
            FROM payments p JOIN resident_profiles rp ON rp.resident_id = p.resident_id
            LEFT JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id
            WHERE p.resident_id = ? ORDER BY p.payment_id");
        $query->execute([$residentId]);
        $selected = null;
        foreach (dues_balance_payment_views($query->fetchAll(PDO::FETCH_ASSOC), $asOf) as $view) {
            if ((string) $view['payment_id'] === (string) $paymentId) $selected = $view;
        }
        if (!$selected) throw new RuntimeException('Payment not found.', 404);
        if ($selected['recorded_payment_status'] === 'Paid') {
            $db->commit();
            return ['message' => 'This payment was already approved.', 'already_approved' => true];
        }
        if (!in_array($selected['recorded_payment_status'], ['Pending', 'Overdue'], true)
            || !$selected['awaiting_verification']) {
            throw new RuntimeException('Only an unpaid bill with a submitted receipt can be approved.', 409);
        }
        $total = $selected['balance_due'];
        if (!is_numeric($confirmedAmount) || (int) round((float) $confirmedAmount * 100) !== (int) round($total * 100)) {
            throw new RuntimeException('Refresh the bill and verify that the receipt covers the full displayed amount, including interest.', 409);
        }
        $existing = $db->prepare('SELECT 1 FROM payment_transactions WHERE payment_id = ? LIMIT 1');
        $existing->execute([$paymentId]);
        if ($existing->fetchColumn()) throw new RuntimeException('A transaction is already recorded for this bill. Ask an officer to reconcile it before approval.', 409);
        $db->prepare("UPDATE payments SET payment_status = 'Paid', updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?")
            ->execute([$paymentId]);
        $remarks = 'Officer verified full bill: principal ' . number_format($selected['principal_amount'], 2, '.', '')
            . ', interest ' . number_format($selected['interest_amount'], 2, '.', '') . '; balance as of ' . $selected['balance_as_of'];
        $db->prepare('INSERT INTO payment_transactions (payment_id, amount_paid, payment_date, approved_by, remarks) VALUES (?, ?, ?, ?, ?)')
            ->execute([$paymentId, $total, dues_balance_date($asOf)->format('Y-m-d'), $officerId, $remarks]);
        $title = 'Payment Approved';
        $message = 'Your payment of ₱' . number_format($total, 2) . ' for ' . $selected['type_name'] . ' has been verified and approved.';
        $db->prepare("INSERT INTO notifications (recipient_id, title, message, notification_type) VALUES (?, ?, ?, 'Payment')")
            ->execute([$selected['user_id'], $title, $message]);
        $db->commit();
        return ['message' => 'Payment successfully approved.', 'already_approved' => false,
            'amount_paid' => $total, 'recipient_id' => $selected['user_id'], 'title' => $title, 'notification_message' => $message];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}
