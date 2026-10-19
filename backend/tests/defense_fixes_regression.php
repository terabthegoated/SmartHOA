<?php
/** CLI fixtures only. Never loads .env or sends requests/notifications. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../helpers/complaint_feedback.php';
require_once __DIR__ . '/../helpers/complaint_upload.php';
require_once __DIR__ . '/../helpers/payment_analytics.php';
function defense_equal($actual, $expected, $label) {
    if (is_numeric($actual) && is_numeric($expected) && (float) $actual === (float) $expected) return;
    if ($actual !== $expected) throw new RuntimeException($label . ': expected ' . json_encode($expected) . ', got ' . json_encode($actual));
}
function defense_reject($fn, $code = 0) {
    try { $fn(); } catch (InvalidArgumentException $error) {
        if ($code) defense_equal($error->getCode(), $code, 'validation code');
        return;
    }
    throw new RuntimeException('Invalid input was not rejected.');
}
function feedback_fixture($status = 'Resolved') {
    $db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec("CREATE TABLE resident_profiles (resident_id TEXT, user_id TEXT);
        INSERT INTO resident_profiles VALUES ('resident', 'owner');
        CREATE TABLE complaints (complaint_id TEXT, resident_id TEXT, complaint_status TEXT);
        CREATE TABLE feedback (feedback_id INTEGER PRIMARY KEY AUTOINCREMENT, complaint_id TEXT, resident_id TEXT,
            rating INTEGER, comment TEXT, submitted_at TEXT DEFAULT CURRENT_TIMESTAMP);");
    $db->prepare("INSERT INTO complaints VALUES ('complaint', 'resident', ?)")->execute([$status]);
    return $db;
}
function analytics_fixture($id, $status = 'Pending', $due = '2026-10-16') {
    return ['payment_id' => $id, 'resident_id' => 'resident', 'billing_month' => '2026-10-01',
        'payment_status' => $status, 'due_date' => $due, 'amount_due' => 325, 'type_name' => 'Monthly HOA Dues'];
}
function image_fixture($bytes, $fn) {
    $path = tempnam(sys_get_temp_dir(), 'smarthoa-image-qa-');
    try { file_put_contents($path, $bytes); $fn(['tmp_name' => $path, 'name' => 'photo.png', 'size' => 1, 'error' => UPLOAD_ERR_OK]); }
    finally { if (is_file($path)) unlink($path); }
}
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lp8AAAAASUVORK5CYII=');
$tests = [
    'resolved complaint saves and updates one feedback record' => function () {
        $db = feedback_fixture();
        save_complaint_feedback($db, 'owner', 'complaint', 5, 'Good resolution');
        save_complaint_feedback($db, 'owner', 'complaint', 4, 'Updated feedback');
        defense_equal((int) $db->query('SELECT COUNT(*) FROM feedback')->fetchColumn(), 1, 'feedback count');
        defense_equal((int) $db->query('SELECT rating FROM feedback')->fetchColumn(), 4, 'updated rating');
    },
    'closed complaint can be rated' => function () {
        $db = feedback_fixture('Closed'); save_complaint_feedback($db, 'owner', 'complaint', 5);
        defense_equal((int) $db->query('SELECT COUNT(*) FROM feedback')->fetchColumn(), 1, 'closed rating');
    },
    'another resident cannot rate the complaint' => function () {
        $db = feedback_fixture(); defense_reject(fn() => save_complaint_feedback($db, 'other', 'complaint', 5), 404);
        defense_equal((int) $db->query('SELECT COUNT(*) FROM feedback')->fetchColumn(), 0, 'no foreign rating');
    },
    'unresolved and missing complaints cannot be rated' => function () {
        foreach (['Submitted', 'Assigned', 'In Progress'] as $status) {
            $db = feedback_fixture($status); defense_reject(fn() => save_complaint_feedback($db, 'owner', 'complaint', 5), 404);
        }
        defense_reject(fn() => save_complaint_feedback(feedback_fixture(), 'owner', 'missing', 5), 404);
    },
    'invalid and fractional ratings are rejected' => function () {
        foreach ([0, 6, -1, 3.5, 'invalid'] as $rating) defense_reject(fn() => save_complaint_feedback(feedback_fixture(), 'owner', 'complaint', $rating), 400);
    },
    'optional missing attachment preserves no-photo complaint flow' => function () {
        defense_equal(validate_complaint_image(null), null, 'optional image');
        defense_equal(validate_complaint_image(['error' => UPLOAD_ERR_NO_FILE]), null, 'no image selected');
    },
    'valid PNG is accepted using content rather than the filename' => function () use ($png) {
        image_fixture($png, function ($file) {
            $file['name'] = 'untrusted-name.php';
            defense_equal(validate_complaint_image($file)['extension'], 'png', 'safe extension');
        });
    },
    'text or executable content disguised as a photo is rejected' => function () {
        image_fixture('<?php echo "not a photo"; ?>', fn($file) => defense_reject(fn() => validate_complaint_image($file)));
    },
    'SVG and zero-byte attachments are rejected' => function () {
        foreach (['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', ''] as $bytes) {
            image_fixture($bytes, fn($file) => defense_reject(fn() => validate_complaint_image($file)));
        }
    },
    'actual size over 5 MB is rejected even if reported size is small' => function () use ($png) {
        image_fixture($png . str_repeat('x', 5 * 1024 * 1024), fn($file) => defense_reject(fn() => validate_complaint_image($file)));
    },
    'upload errors are reported, not silently treated as success' => function () {
        foreach ([UPLOAD_ERR_PARTIAL, UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_CANT_WRITE] as $error) defense_reject(fn() => validate_complaint_image(['error' => $error]));
    },
    'analytics outstanding balance matches the resident bill calculator' => function () {
        $rows = [analytics_fixture('old'), analytics_fixture('new', 'Pending', '2026-10-20')];
        $m = analytics_payment_metrics($rows, '2026-10-19');
        $s = dues_balance_summary(dues_balance_payment_views($rows, '2026-10-19'), '2026-10-19');
        defense_equal($m['outstanding_dues'], $s['amount_due'], 'matching balance');
        defense_equal($m['outstanding_dues'], 682.50, 'interest inclusive');
        defense_equal($m['overdue_amount'], 357.50, 'only overdue portion');
        defense_equal($m['monthly_revenue'][5]['pending'], 682.50, 'matching trend');
    },
    'overdue receipt counts as pending verification, not overdue collection' => function () {
        $row = analytics_fixture('review', 'Overdue'); $row['receipt_submitted_at'] = '2026-10-18T10:00:00+08:00';
        $m = analytics_payment_metrics([$row], '2026-10-19');
        defense_equal($m['pending_verifications'], 1, 'receipt count');
        defense_equal($m['dues_under_verification'], 357.50, 'held balance');
        defense_equal($m['outstanding_dues'], 0, 'not demanded twice');
        defense_equal($m['overdue_accounts'], 0, 'not an overdue follow-up');
        defense_equal($m['payment_compliance'][0]['name'], 'Pending Verification', 'status chart');
    },
    'received interest is included in collections but cannot inflate compliance above 100 percent' => function () {
        $row = analytics_fixture('paid', 'Paid'); $row['recorded_paid_amount'] = '357.50';
        $m = analytics_payment_metrics([$row], '2026-10-19');
        defense_equal($m['total_collected'], 357.50, 'received amount');
        defense_equal($m['current_month_collected'], 325, 'settled principal');
        defense_equal($m['collection_rate'], 100, 'compliance ratio');
        defense_equal($m['monthly_revenue'][5]['collected'], 357.50, 'chart paid amount');
    },
    'non-dues fees stay separate from HOA-dues KPIs' => function () {
        $row = analytics_fixture('fee'); $row['type_name'] = 'Car Sticker'; $row['amount_due'] = 100;
        $m = analytics_payment_metrics([$row], '2026-10-19');
        defense_equal($m['total_outstanding'], 100, 'fee outstanding');
        defense_equal($m['outstanding_dues'], 0, 'no fee in HOA total');
        defense_equal($m['collection_rate'], null, 'no invented dues rate');
    },
    'multiple overdue bills count as one resident account' => function () {
        $m = analytics_payment_metrics([analytics_fixture('a'), analytics_fixture('b')], '2026-10-19');
        defense_equal($m['overdue_accounts'], 1, 'unique resident');
        defense_equal($m['overdue_bill_count'], 2, 'individual bills');
    },
    'cancelled bills and paid receipts do not create pending verifications' => function () {
        $rows = [analytics_fixture('cancelled', 'Cancelled'), analytics_fixture('paid', 'Paid')];
        foreach ($rows as &$row) $row['receipt_submitted_at'] = '2026-10-18'; unset($row);
        $m = analytics_payment_metrics($rows, '2026-10-19');
        defense_equal($m['pending_verifications'], 0, 'verification count');
        defense_equal($m['outstanding_dues'], 0, 'settled balance');
    },
    'empty analytics retains six chronological months and unavailable collection rate' => function () {
        $m = analytics_payment_metrics([], '2026-01-31');
        defense_equal(count($m['monthly_revenue']), 6, 'six months');
        defense_equal($m['monthly_revenue'][0]['month'], '2025-08-01', 'first month');
        defense_equal($m['monthly_revenue'][5]['month'], '2026-01-01', 'last month');
        defense_equal($m['collection_rate'], null, 'no invented rate');
    },
];
foreach ($tests as $name => $test) {
    try { $test(); echo 'PASS: ', $name, PHP_EOL; }
    catch (Throwable $error) { fwrite(STDERR, 'FAIL: ' . $name . ': ' . $error->getMessage() . PHP_EOL); exit(1); }
}
echo count($tests), '/', count($tests), ' isolated defense-fix scenarios passed.', PHP_EOL;
