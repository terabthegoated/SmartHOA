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

// The token is checked before the Database class is created, so load the
// project's environment values here as well.
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

function request_headers_for_dues_preview() {
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

function dues_preview_normalize($value) {
    $trimmed = trim((string)$value);
    $collapsed = preg_replace('/\s+/', ' ', $trimmed);
    return strtoupper($collapsed ?? '');
}

function dues_preview_parse_amount($value) {
    $raw = trim((string)$value);
    if ($raw === '') {
        return ['kind' => 'empty'];
    }

    $clean = str_replace([',', '₱'], '', $raw);
    if (!preg_match('/^\d+(?:\.\d{1,2})?$/', $clean)) {
        return ['kind' => 'invalid', 'raw' => $raw];
    }

    $amount = (float)$clean;
    if ($amount < 0 || $amount > 100000) {
        return ['kind' => 'invalid', 'raw' => $raw];
    }

    return ['kind' => 'amount', 'amount' => round($amount, 2)];
}

function dues_preview_is_note($value) {
    return preg_match('/\b(MOVE\s*IN|TURN\s*OVER|NEW\s+MOVE\s*IN)\b/i', (string)$value) === 1;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit();
    }

    $headers = request_headers_for_dues_preview();
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
    $year = (int)($payload['year'] ?? 0);

    if (!is_array($records) || count($records) === 0 || count($records) > 1000) {
        http_response_code(400);
        echo json_encode(['message' => 'Upload between 1 and 1,000 HOA dues rows to create a preview.']);
        exit();
    }

    if ($year < 2020 || $year > 2100) {
        http_response_code(400);
        echo json_encode(['message' => 'Choose a valid payment year.']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();

    $propertyStatement = $db->prepare("\n        SELECT\n            p.property_id,\n            p.block,\n            p.lot,\n            rp.resident_id,\n            rp.first_name,\n            rp.last_name,\n            rp.resident_status\n        FROM properties p\n        LEFT JOIN resident_profiles rp ON rp.property_id = p.property_id\n        ORDER BY p.block, p.lot, rp.created_at\n    ");
    $propertyStatement->execute();

    $properties = [];
    while ($result = $propertyStatement->fetch(PDO::FETCH_ASSOC)) {
        $propertyKey = dues_preview_normalize($result['block']) . '|' . dues_preview_normalize($result['lot']);
        if (!isset($properties[$propertyKey])) {
            $properties[$propertyKey] = [
                'property_id' => $result['property_id'],
                'residents' => [],
            ];
        }

        if ($result['resident_id']) {
            $properties[$propertyKey]['residents'][] = [
                'resident_id' => $result['resident_id'],
                'first_name' => $result['first_name'],
                'last_name' => $result['last_name'],
                'resident_status' => $result['resident_status'],
            ];
        }
    }

    $months = [
        'January' => 1, 'February' => 2, 'March' => 3, 'April' => 4,
        'May' => 5, 'June' => 6, 'July' => 7, 'August' => 8,
        'September' => 9, 'October' => 10, 'November' => 11, 'December' => 12,
    ];

    $previewRows = [];
    $summary = [
        'source_rows' => 0,
        'payment_rows' => 0,
        'payment_entries' => 0,
        'ready_entries' => 0,
        'review_entries' => 0,
        'total_amount_paid' => 0.0,
        'total_regular_dues' => 0.0,
        'total_penalties' => 0.0,
    ];

    foreach ($records as $record) {
        if (!is_array($record)) {
            continue;
        }

        $block = trim((string)($record['block'] ?? ''));
        $lot = trim((string)($record['lot'] ?? ''));
        $firstName = trim((string)($record['first_name'] ?? ''));
        $lastName = trim((string)($record['last_name'] ?? ''));
        $sourceName = trim($firstName . ' ' . $lastName);
        $monthValues = is_array($record['months'] ?? null) ? $record['months'] : [];
        $issues = [];
        $notes = [];
        $paymentCount = 0;
        $amountPaid = 0.0;
        $regularDues = 0.0;
        $penaltyAmount = 0.0;
        $monthlyTotal = 0.0;

        $hasSourceContent = $block !== '' || $lot !== '' || $sourceName !== '' || trim((string)($record['total'] ?? '')) !== '';
        foreach ($months as $monthName => $monthNumber) {
            $rawValue = $monthValues[$monthName] ?? '';
            if (trim((string)$rawValue) !== '') {
                $hasSourceContent = true;
            }

            $parsed = dues_preview_parse_amount($rawValue);
            if ($parsed['kind'] === 'empty') {
                continue;
            }
            if ($parsed['kind'] === 'invalid') {
                if (dues_preview_is_note($parsed['raw'])) {
                    $notes[] = $monthName . ': ' . $parsed['raw'];
                } else {
                    $issues[] = $monthName . ' has an invalid amount (' . $parsed['raw'] . ').';
                }
                continue;
            }

            $amount = $parsed['amount'];
            if ($amount === 0.0) {
                continue;
            }

            $paymentCount++;
            $monthlyTotal += $amount;
            $amountPaid += $amount;
            $regularDues += min($amount, 325.0);
            $penaltyAmount += max($amount - 325.0, 0.0);

            if ($amount < 325.0) {
                $issues[] = $monthName . ' is below the ₱325 monthly dues amount.';
            }
        }

        if (!$hasSourceContent) {
            continue;
        }

        $summary['source_rows']++;
        $storedTotal = dues_preview_parse_amount($record['total'] ?? '');
        if ($storedTotal['kind'] === 'invalid') {
            $issues[] = 'The Total column has an invalid amount.';
        } elseif ($storedTotal['kind'] === 'amount' && abs($storedTotal['amount'] - $monthlyTotal) > 0.01) {
            $issues[] = 'The Total column does not match the numeric monthly payments.';
        }

        $systemResidentName = null;
        if ($paymentCount > 0) {
            $propertyKey = dues_preview_normalize($block) . '|' . dues_preview_normalize($lot);
            $property = $properties[$propertyKey] ?? null;

            if (!$property) {
                $issues[] = 'No SmartHOA property matches this Block and Lot.';
            } elseif ($sourceName === '') {
                $issues[] = 'The sheet does not provide a resident name to verify.';
            } else {
                $matchingResidents = array_values(array_filter($property['residents'], function ($resident) use ($firstName, $lastName) {
                    return dues_preview_normalize($resident['first_name']) === dues_preview_normalize($firstName)
                        && dues_preview_normalize($resident['last_name']) === dues_preview_normalize($lastName);
                }));

                if (count($matchingResidents) === 1) {
                    $systemResidentName = trim($matchingResidents[0]['first_name'] . ' ' . $matchingResidents[0]['last_name']);
                } elseif (count($property['residents']) === 0) {
                    $issues[] = 'This property has no assigned resident in SmartHOA.';
                } elseif (count($property['residents']) === 1) {
                    $systemResidentName = trim($property['residents'][0]['first_name'] . ' ' . $property['residents'][0]['last_name']);
                    $issues[] = 'The sheet resident does not match the resident assigned to this property.';
                } elseif (count($matchingResidents) > 1) {
                    $issues[] = 'More than one resident profile matches this property.';
                } else {
                    $issues[] = 'The sheet resident does not match the resident assigned to this property.';
                }
            }
        }

        $status = $paymentCount === 0 ? 'No payment' : (count($issues) > 0 ? 'Review' : 'Ready');
        if ($paymentCount > 0) {
            $summary['payment_rows']++;
            $summary['payment_entries'] += $paymentCount;
            $summary['total_amount_paid'] += $amountPaid;
            $summary['total_regular_dues'] += $regularDues;
            $summary['total_penalties'] += $penaltyAmount;
            if ($status === 'Ready') {
                $summary['ready_entries'] += $paymentCount;
            } else {
                $summary['review_entries'] += $paymentCount;
            }
        }

        $previewRows[] = [
            'source_row' => (int)($record['source_row'] ?? 0),
            'block' => $block,
            'lot' => $lot,
            'source_resident_name' => $sourceName,
            'system_resident_name' => $systemResidentName,
            'status' => $status,
            'payment_count' => $paymentCount,
            'amount_paid' => round($amountPaid, 2),
            'regular_dues' => round($regularDues, 2),
            'penalty_amount' => round($penaltyAmount, 2),
            'issues' => array_values(array_unique($issues)),
            'notes' => array_values(array_unique($notes)),
        ];
    }

    $summary['total_amount_paid'] = round($summary['total_amount_paid'], 2);
    $summary['total_regular_dues'] = round($summary['total_regular_dues'], 2);
    $summary['total_penalties'] = round($summary['total_penalties'], 2);

    echo json_encode([
        'year' => $year,
        'summary' => $summary,
        'rows' => $previewRows,
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'SmartHOA could not create the dues preview.']);
}
?>
