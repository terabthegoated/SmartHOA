<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

function legacy_dues_import_headers() {
    if (function_exists('apache_request_headers')) {
        return apache_request_headers();
    }

    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (substr($key, 0, 5) === 'HTTP_') {
            $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
            $headers[$header] = $value;
        }
    }

    return $headers;
}

function legacy_dues_import_normalize($value) {
    $trimmed = trim((string) $value);
    $collapsed = preg_replace('/\s+/', ' ', $trimmed);
    return strtoupper($collapsed ?? '');
}

function legacy_dues_import_amount($value) {
    $raw = trim((string) $value);
    if ($raw === '') {
        return ['kind' => 'empty'];
    }

    $clean = str_replace([',', '₱'], '', $raw);
    if (!preg_match('/^\d+(?:\.\d{1,2})?$/', $clean)) {
        return ['kind' => 'invalid', 'raw' => $raw];
    }

    $amount = (float) $clean;
    if ($amount < 0 || $amount > 100000) {
        return ['kind' => 'invalid', 'raw' => $raw];
    }

    return ['kind' => 'amount', 'amount' => round($amount, 2)];
}

function legacy_dues_import_is_note($value) {
    return preg_match('/\b(MOVE\s*IN|TURN\s*OVER|NEW\s+MOVE\s*IN)\b/i', (string) $value) === 1;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit();
    }

    $headers = legacy_dues_import_headers();
    $authHeader = $headers['Authorization'] ?? '';
    if (!$authHeader || !preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['message' => 'Access denied.']);
        exit();
    }

    $jwtSecret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($matches[1], new Key($jwtSecret, 'HS256'));
    if ($decoded->data->role !== 'Super Administrator' && $decoded->data->role !== 'HOA Officer') {
        http_response_code(403);
        echo json_encode(['message' => 'Unauthorized access.']);
        exit();
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    $records = $payload['records'] ?? null;
    $year = (int) ($payload['year'] ?? 0);

    if (!is_array($records) || count($records) === 0 || count($records) > 1000) {
        http_response_code(400);
        echo json_encode(['message' => 'Upload between 1 and 1,000 HOA dues rows to import payment history.']);
        exit();
    }

    if ($year < 2020 || $year > 2100) {
        http_response_code(400);
        echo json_encode(['message' => 'Choose a valid payment year.']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();

    $propertyStatement = $db->prepare("
        SELECT
            p.property_id,
            p.block,
            p.lot,
            rp.resident_id,
            rp.first_name,
            rp.last_name
        FROM properties p
        LEFT JOIN resident_profiles rp ON rp.property_id = p.property_id
        ORDER BY p.block, p.lot, rp.created_at
    ");
    $propertyStatement->execute();

    $properties = [];
    while ($result = $propertyStatement->fetch(PDO::FETCH_ASSOC)) {
        $propertyKey = legacy_dues_import_normalize($result['block']) . '|' . legacy_dues_import_normalize($result['lot']);
        if (!isset($properties[$propertyKey])) {
            $properties[$propertyKey] = ['residents' => []];
        }

        if (!empty($result['resident_id'])) {
            $properties[$propertyKey]['residents'][] = [
                'resident_id' => $result['resident_id'],
                'first_name' => $result['first_name'],
                'last_name' => $result['last_name'],
            ];
        }
    }

    $paymentTypesStatement = $db->prepare("
        SELECT payment_type_id, LOWER(TRIM(payment_name)) AS normalized_name
        FROM payment_types
        WHERE LOWER(TRIM(payment_name)) IN ('monthly hoa dues', 'monthly hoa dues + penalty')
    ");
    $paymentTypesStatement->execute();
    $paymentTypes = $paymentTypesStatement->fetchAll(PDO::FETCH_KEY_PAIR);
    $monthlyDuesTypeId = null;
    $monthlyDuesPenaltyTypeId = null;
    foreach ($paymentTypes as $paymentTypeId => $normalizedName) {
        if ($normalizedName === 'monthly hoa dues') {
            $monthlyDuesTypeId = $paymentTypeId;
        }
        if ($normalizedName === 'monthly hoa dues + penalty') {
            $monthlyDuesPenaltyTypeId = $paymentTypeId;
        }
    }

    if (!$monthlyDuesTypeId || !$monthlyDuesPenaltyTypeId) {
        http_response_code(400);
        echo json_encode(['message' => 'Monthly HOA Dues and Monthly HOA Dues + Penalty bill types must be available before importing history.']);
        exit();
    }

    $months = [
        'January' => 1, 'February' => 2, 'March' => 3, 'April' => 4,
        'May' => 5, 'June' => 6, 'July' => 7, 'August' => 8,
        'September' => 9, 'October' => 10, 'November' => 11, 'December' => 12,
    ];

    $entries = [];
    $summary = [
        'source_rows' => 0,
        'imported_entries' => 0,
        'duplicate_entries' => 0,
        'review_entries' => 0,
        'imported_amount' => 0.0,
    ];

    foreach ($records as $record) {
        if (!is_array($record)) {
            continue;
        }

        $block = trim((string) ($record['block'] ?? ''));
        $lot = trim((string) ($record['lot'] ?? ''));
        $firstName = trim((string) ($record['first_name'] ?? ''));
        $lastName = trim((string) ($record['last_name'] ?? ''));
        $sourceName = trim($firstName . ' ' . $lastName);
        $monthValues = is_array($record['months'] ?? null) ? $record['months'] : [];
        $issues = [];
        $monthlyEntries = [];
        $monthlyTotal = 0.0;

        foreach ($months as $monthName => $monthNumber) {
            $parsed = legacy_dues_import_amount($monthValues[$monthName] ?? '');
            if ($parsed['kind'] === 'empty') {
                continue;
            }
            if ($parsed['kind'] === 'invalid') {
                if (!legacy_dues_import_is_note($parsed['raw'])) {
                    $issues[] = $monthName . ' has an invalid amount.';
                }
                continue;
            }

            $amount = $parsed['amount'];
            if ($amount === 0.0) {
                continue;
            }
            if ($amount < 325.0) {
                $issues[] = $monthName . ' is below the ₱325 monthly dues amount.';
            }

            $monthlyTotal += $amount;
            $monthlyEntries[] = [
                'month_name' => $monthName,
                'month_number' => $monthNumber,
                'amount' => $amount,
            ];
        }

        if (count($monthlyEntries) === 0) {
            continue;
        }
        $summary['source_rows']++;

        $storedTotal = legacy_dues_import_amount($record['total'] ?? '');
        if ($storedTotal['kind'] === 'invalid') {
            $issues[] = 'The Total column has an invalid amount.';
        } elseif ($storedTotal['kind'] === 'amount' && abs($storedTotal['amount'] - $monthlyTotal) > 0.01) {
            $issues[] = 'The Total column does not match the numeric monthly payments.';
        }

        $resident = null;
        $propertyKey = legacy_dues_import_normalize($block) . '|' . legacy_dues_import_normalize($lot);
        $property = $properties[$propertyKey] ?? null;
        if (!$property) {
            $issues[] = 'No SmartHOA property matches this Block and Lot.';
        } elseif ($sourceName === '') {
            $issues[] = 'The sheet does not provide a resident name to verify.';
        } else {
            $matchingResidents = array_values(array_filter($property['residents'], function ($candidate) use ($firstName, $lastName) {
                return legacy_dues_import_normalize($candidate['first_name']) === legacy_dues_import_normalize($firstName)
                    && legacy_dues_import_normalize($candidate['last_name']) === legacy_dues_import_normalize($lastName);
            }));

            if (count($matchingResidents) === 1) {
                $resident = $matchingResidents[0];
            } elseif (count($property['residents']) === 0) {
                $issues[] = 'This property has no assigned resident in SmartHOA.';
            } else {
                $issues[] = 'The sheet resident does not match the resident assigned to this property.';
            }
        }

        if (count($issues) > 0 || !$resident) {
            $summary['review_entries'] += count($monthlyEntries);
            continue;
        }

        foreach ($monthlyEntries as $monthlyEntry) {
            $entries[] = [
                'resident_id' => $resident['resident_id'],
                'block' => $block,
                'lot' => $lot,
                'month_name' => $monthlyEntry['month_name'],
                'month_number' => $monthlyEntry['month_number'],
                'amount' => $monthlyEntry['amount'],
            ];
        }
    }

    $existingPaymentStatement = $db->prepare("
        SELECT p.payment_id
        FROM payments p
        INNER JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id
        WHERE p.resident_id = ?
          AND p.billing_month = ?
          AND LOWER(TRIM(pt.payment_name)) IN ('monthly hoa dues', 'monthly hoa dues + penalty')
        LIMIT 1
    ");
    $paymentStatement = $db->prepare("
        INSERT INTO payments (resident_id, payment_type_id, billing_month, amount_due, due_date, payment_status)
        VALUES (?, ?, ?, ?, ?, 'Paid')
        RETURNING payment_id
    ");
    $transactionStatement = $db->prepare("
        INSERT INTO payment_transactions (payment_id, amount_paid, payment_date, approved_by, remarks)
        VALUES (?, ?, ?, ?, ?)
    ");

    $db->beginTransaction();
    try {
        foreach ($entries as $entry) {
            $billingMonth = sprintf('%04d-%02d-01', $year, $entry['month_number']);
            $dueDate = sprintf('%04d-%02d-16', $year, $entry['month_number']);

            // A billing period may only have one HOA-dues record per resident.
            // This makes it safe to retry the same CSV without duplicating history.
            $existingPaymentStatement->execute([$entry['resident_id'], $billingMonth]);
            if ($existingPaymentStatement->fetch(PDO::FETCH_ASSOC)) {
                $summary['duplicate_entries']++;
                continue;
            }

            $paymentTypeId = $entry['amount'] > 325.0 ? $monthlyDuesPenaltyTypeId : $monthlyDuesTypeId;
            $paymentStatement->execute([
                $entry['resident_id'],
                $paymentTypeId,
                $billingMonth,
                $entry['amount'],
                $dueDate,
            ]);
            $paymentId = $paymentStatement->fetchColumn();

            $remark = 'Imported from HOA Dues Record ' . $year
                . ' (Blk ' . $entry['block'] . ', Lot ' . $entry['lot'] . ', ' . $entry['month_name'] . '). '
                . 'The source sheet does not provide a payment date; the monthly due date was used for this historical record.';
            $transactionStatement->execute([
                $paymentId,
                $entry['amount'],
                $dueDate,
                $decoded->data->user_id,
                $remark,
            ]);

            $summary['imported_entries']++;
            $summary['imported_amount'] += $entry['amount'];
        }

        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }

    $summary['imported_amount'] = round($summary['imported_amount'], 2);
    echo json_encode([
        'message' => $summary['imported_entries'] > 0
            ? 'Historical dues payments were imported successfully.'
            : 'No new payment entries were imported. Existing entries were skipped or need review.',
        'year' => $year,
        'summary' => $summary,
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'SmartHOA could not import the historical dues records.']);
}
?>
