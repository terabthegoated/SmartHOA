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

function demo_data_headers() {
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

function demo_data_find_or_create_property($db, $block, $lot, $propertyUse, &$createdProperties) {
    $find = $db->prepare('SELECT property_id FROM properties WHERE block = ? AND lot = ? LIMIT 1');
    $find->execute([$block, $lot]);
    $propertyId = $find->fetchColumn();

    if ($propertyId) {
        return $propertyId;
    }

    $create = $db->prepare("\n        INSERT INTO properties (block, lot, property_status, property_use)\n        VALUES (?, ?, 'Occupied', ?)\n        RETURNING property_id\n    ");
    $create->execute([$block, $lot, $propertyUse]);
    $createdProperties++;
    return $create->fetchColumn();
}

function demo_data_find_or_create_user($db, $roleId, $email, $passwordHash, &$createdUsers) {
    $find = $db->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
    $find->execute([$email]);
    $userId = $find->fetchColumn();

    if ($userId) {
        return $userId;
    }

    $create = $db->prepare("\n        INSERT INTO users (role_id, email, password_hash, is_verified, account_status)\n        VALUES (?, ?, ?, TRUE, 'Active')\n        RETURNING user_id\n    ");
    $create->execute([$roleId, $email, $passwordHash]);
    $createdUsers++;
    return $create->fetchColumn();
}

function demo_data_find_or_create_resident($db, $userId, $propertyId, $firstName, $lastName, $residentType, $contactNumber, &$createdResidents) {
    $find = $db->prepare('SELECT resident_id FROM resident_profiles WHERE user_id = ? LIMIT 1');
    $find->execute([$userId]);
    $residentId = $find->fetchColumn();

    if ($residentId) {
        return $residentId;
    }

    $create = $db->prepare("\n        INSERT INTO resident_profiles\n            (user_id, property_id, first_name, last_name, contact_number, resident_type, resident_status, move_in_date)\n        VALUES (?, ?, ?, ?, ?, ?, 'Active', CURRENT_DATE - INTERVAL '90 days')\n        RETURNING resident_id\n    ");
    $create->execute([$userId, $propertyId, $firstName, $lastName, $contactNumber, $residentType]);
    $createdResidents++;
    return $create->fetchColumn();
}

function demo_data_find_or_create_category($db, $name, $description) {
    $find = $db->prepare('SELECT category_id FROM complaint_categories WHERE category_name = ? LIMIT 1');
    $find->execute([$name]);
    $categoryId = $find->fetchColumn();

    if ($categoryId) {
        return $categoryId;
    }

    $create = $db->prepare('INSERT INTO complaint_categories (category_name, description) VALUES (?, ?) RETURNING category_id');
    $create->execute([$name, $description]);
    return $create->fetchColumn();
}

function demo_data_find_or_create_bill($db, $residentId, $typeId, $billingMonth, $amountDue, $dueDate, $status, $approvedBy, $remarks, &$createdBills) {
    $find = $db->prepare("\n        SELECT payment_id\n        FROM payments\n        WHERE resident_id = ? AND payment_type_id = ? AND billing_month = ? AND amount_due = ?\n        LIMIT 1\n    ");
    $find->execute([$residentId, $typeId, $billingMonth, $amountDue]);
    $paymentId = $find->fetchColumn();

    if ($paymentId) {
        return $paymentId;
    }

    $create = $db->prepare("\n        INSERT INTO payments (resident_id, payment_type_id, billing_month, amount_due, due_date, payment_status)\n        VALUES (?, ?, ?, ?, ?, ?)\n        RETURNING payment_id\n    ");
    $create->execute([$residentId, $typeId, $billingMonth, $amountDue, $dueDate, $status]);
    $paymentId = $create->fetchColumn();
    $createdBills++;

    if ($status === 'Paid') {
        $transaction = $db->prepare("\n            INSERT INTO payment_transactions (payment_id, amount_paid, payment_date, approved_by, remarks)\n            VALUES (?, ?, ?, ?, ?)\n        ");
        $transaction->execute([$paymentId, $amountDue, $billingMonth, $approvedBy, $remarks]);
    }

    return $paymentId;
}

function demo_data_create_notification($db, $recipientId, $title, $message, $type, &$createdNotifications) {
    $find = $db->prepare('SELECT notification_id FROM notifications WHERE recipient_id = ? AND title = ? AND message = ? LIMIT 1');
    $find->execute([$recipientId, $title, $message]);
    if ($find->fetchColumn()) {
        return;
    }

    $create = $db->prepare('INSERT INTO notifications (recipient_id, title, message, notification_type) VALUES (?, ?, ?, ?)');
    $create->execute([$recipientId, $title, $message, $type]);
    $createdNotifications++;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit();
    }

    $headers = demo_data_headers();
    $authHeader = $headers['Authorization'] ?? '';
    if (!$authHeader || !preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['message' => 'Access denied.']);
        exit();
    }

    $jwtSecret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($matches[1], new Key($jwtSecret, 'HS256'));
    if (($decoded->data->role ?? '') !== 'Super Administrator') {
        http_response_code(403);
        echo json_encode(['message' => 'Only a Super Administrator can create test data.']);
        exit();
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload) || ($payload['confirmation'] ?? '') !== 'CREATE_DEMO_DATA') {
        http_response_code(400);
        echo json_encode(['message' => 'Type the confirmation phrase before creating demo records.']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $db->beginTransaction();

    try {
        $roleStatement = $db->query("SELECT role_id, role_name FROM roles WHERE role_name IN ('Homeowner', 'Renter')");
        $roles = $roleStatement->fetchAll(PDO::FETCH_KEY_PAIR);
        $homeownerRoleId = array_search('Homeowner', $roles, true);
        $renterRoleId = array_search('Renter', $roles, true);
        if (!$homeownerRoleId || !$renterRoleId) {
            throw new RuntimeException('Homeowner and Renter roles must be available before creating demo records.');
        }

        $typeStatement = $db->prepare("\n            SELECT payment_type_id, payment_name\n            FROM payment_types\n            WHERE payment_name IN ('Monthly HOA Dues', 'Monthly HOA Dues + Penalty')\n        ");
        $typeStatement->execute();
        $paymentTypes = $typeStatement->fetchAll(PDO::FETCH_KEY_PAIR);
        $duesTypeId = array_search('Monthly HOA Dues', $paymentTypes, true);
        $penaltyTypeId = array_search('Monthly HOA Dues + Penalty', $paymentTypes, true);
        if (!$duesTypeId || !$penaltyTypeId) {
            throw new RuntimeException('Monthly HOA Dues and Monthly HOA Dues + Penalty bill types must be available before creating demo records.');
        }

        $createdUsers = 0;
        $createdResidents = 0;
        $createdProperties = 0;
        $createdBills = 0;
        $createdNotifications = 0;
        $createdComplaints = 0;
        $createdAnnouncements = 0;
        $demoPassword = 'DemoPass2026!';
        $passwordHash = password_hash($demoPassword, PASSWORD_BCRYPT);

        $demoResidents = [
            [
                'email' => 'demo.homeowner@smarthoa.test',
                'role_id' => $homeownerRoleId,
                'first_name' => 'Avery',
                'last_name' => 'Santos',
                'resident_type' => 'Homeowner',
                'contact' => '0999 000 0101',
                'block' => 'DEMO-1',
                'lot' => '101',
                'property_use' => 'Homeowner',
            ],
            [
                'email' => 'demo.renter@smarthoa.test',
                'role_id' => $renterRoleId,
                'first_name' => 'Mika',
                'last_name' => 'Reyes',
                'resident_type' => 'Renter',
                'contact' => '0999 000 0102',
                'block' => 'DEMO-1',
                'lot' => '102',
                'property_use' => 'Renter',
            ],
            [
                'email' => 'demo.airbnb.host@smarthoa.test',
                'role_id' => $homeownerRoleId,
                'first_name' => 'Noah',
                'last_name' => 'Cruz',
                'resident_type' => 'Homeowner',
                'contact' => '0999 000 0201',
                'block' => 'DEMO-2',
                'lot' => '201',
                'property_use' => 'Airbnb',
            ],
        ];

        $residentIds = [];
        $userIds = [];
        $propertyIds = [];
        foreach ($demoResidents as $demoResident) {
            $propertyId = demo_data_find_or_create_property(
                $db,
                $demoResident['block'],
                $demoResident['lot'],
                $demoResident['property_use'],
                $createdProperties
            );
            $userId = demo_data_find_or_create_user($db, $demoResident['role_id'], $demoResident['email'], $passwordHash, $createdUsers);
            $residentId = demo_data_find_or_create_resident(
                $db,
                $userId,
                $propertyId,
                $demoResident['first_name'],
                $demoResident['last_name'],
                $demoResident['resident_type'],
                $demoResident['contact'],
                $createdResidents
            );
            $residentIds[$demoResident['email']] = $residentId;
            $userIds[$demoResident['email']] = $userId;
            $propertyIds[$demoResident['email']] = $propertyId;
        }

        $airbnbFind = $db->prepare('SELECT airbnb_property_id FROM airbnb_host_properties WHERE property_id = ? LIMIT 1');
        $airbnbFind->execute([$propertyIds['demo.airbnb.host@smarthoa.test']]);
        if (!$airbnbFind->fetchColumn()) {
            $airbnbCreate = $db->prepare("\n                INSERT INTO airbnb_host_properties (property_id, host_resident_id, listing_status, max_guests)\n                VALUES (?, ?, 'Active', 4)\n            ");
            $airbnbCreate->execute([
                $propertyIds['demo.airbnb.host@smarthoa.test'],
                $residentIds['demo.airbnb.host@smarthoa.test'],
            ]);
        }

        $currentMonth = new DateTimeImmutable('first day of this month');
        $previousMonth = $currentMonth->modify('-1 month');
        $twoMonthsAgo = $currentMonth->modify('-2 months');
        $currentMonthKey = $currentMonth->format('Y-m-d');
        $previousMonthKey = $previousMonth->format('Y-m-d');
        $twoMonthsAgoKey = $twoMonthsAgo->format('Y-m-d');
        $currentDueDate = $currentMonth->format('Y-m-16');
        $previousDueDate = $previousMonth->format('Y-m-16');
        $twoMonthsAgoDueDate = $twoMonthsAgo->format('Y-m-16');
        $approvedBy = $decoded->data->user_id;

        demo_data_find_or_create_bill(
            $db, $residentIds['demo.homeowner@smarthoa.test'], $duesTypeId,
            $twoMonthsAgoKey, 325.00, $twoMonthsAgoDueDate, 'Paid', $approvedBy,
            'DEMO DATA ONLY — sample verified monthly HOA dues payment.', $createdBills
        );
        demo_data_find_or_create_bill(
            $db, $residentIds['demo.homeowner@smarthoa.test'], $duesTypeId,
            $currentMonthKey, 325.00, $currentDueDate, 'Pending', $approvedBy,
            '', $createdBills
        );
        demo_data_find_or_create_bill(
            $db, $residentIds['demo.renter@smarthoa.test'], $duesTypeId,
            $previousMonthKey, 325.00, $previousDueDate, 'Overdue', $approvedBy,
            '', $createdBills
        );
        demo_data_find_or_create_bill(
            $db, $residentIds['demo.renter@smarthoa.test'], $duesTypeId,
            $twoMonthsAgoKey, 325.00, $twoMonthsAgoDueDate, 'Paid', $approvedBy,
            'DEMO DATA ONLY — sample verified monthly HOA dues payment.', $createdBills
        );
        demo_data_find_or_create_bill(
            $db, $residentIds['demo.airbnb.host@smarthoa.test'], $penaltyTypeId,
            $previousMonthKey, 357.50, $previousDueDate, 'Overdue', $approvedBy,
            '', $createdBills
        );

        demo_data_create_notification(
            $db, $userIds['demo.homeowner@smarthoa.test'], 'DEMO: Bill awaiting payment',
            'A sample Monthly HOA Dues bill of ₱325.00 is ready for you to review.', 'Payment', $createdNotifications
        );
        demo_data_create_notification(
            $db, $userIds['demo.renter@smarthoa.test'], 'DEMO: Payment reminder',
            'A sample overdue Monthly HOA Dues bill of ₱325.00 is included for testing.', 'Payment', $createdNotifications
        );
        demo_data_create_notification(
            $db, $userIds['demo.airbnb.host@smarthoa.test'], 'DEMO: Payment reminder',
            'A sample overdue HOA dues balance with penalty is included for testing.', 'Payment', $createdNotifications
        );

        $maintenanceCategoryId = demo_data_find_or_create_category($db, 'Maintenance', 'Facilities and common-area maintenance concerns.');
        $securityCategoryId = demo_data_find_or_create_category($db, 'Security', 'Safety and security concerns within the community.');
        $noiseCategoryId = demo_data_find_or_create_category($db, 'Noise', 'Noise concerns that may affect residents.');

        $demoComplaints = [
            [
                'resident_id' => $residentIds['demo.homeowner@smarthoa.test'],
                'category_id' => $maintenanceCategoryId,
                'title' => 'DEMO ONLY — Broken streetlight near the clubhouse',
                'description' => 'Sample complaint used to demonstrate a High-priority maintenance case. No real issue is being reported.',
                'status' => 'In Progress',
                'priority' => 'High',
                'rule' => 'SAFETY_INFRASTRUCTURE',
                'reason' => 'A lighting outage in a shared area can affect nighttime safety and requires prompt attention.',
            ],
            [
                'resident_id' => $residentIds['demo.renter@smarthoa.test'],
                'category_id' => $securityCategoryId,
                'title' => 'DEMO ONLY — Unsecured pedestrian gate',
                'description' => 'Sample complaint used to demonstrate a Critical security case. No real issue is being reported.',
                'status' => 'Submitted',
                'priority' => 'Critical',
                'rule' => 'SECURITY_ACCESS_RISK',
                'reason' => 'An unsecured entry point is treated as an immediate community security risk.',
            ],
            [
                'resident_id' => $residentIds['demo.airbnb.host@smarthoa.test'],
                'category_id' => $noiseCategoryId,
                'title' => 'DEMO ONLY — Evening noise concern',
                'description' => 'Sample complaint used to demonstrate a Low-priority resolved case. No real issue is being reported.',
                'status' => 'Resolved',
                'priority' => 'Low',
                'rule' => 'STANDARD_SERVICE_REQUEST',
                'reason' => 'This concern is documented for follow-up but has no reported safety or service interruption.',
            ],
        ];

        foreach ($demoComplaints as $demoComplaint) {
            $find = $db->prepare('SELECT complaint_id FROM complaints WHERE resident_id = ? AND title = ? LIMIT 1');
            $find->execute([$demoComplaint['resident_id'], $demoComplaint['title']]);
            $complaintId = $find->fetchColumn();
            if (!$complaintId) {
                $create = $db->prepare("\n                    INSERT INTO complaints\n                        (resident_id, category_id, assigned_officer, title, description, complaint_status, priority_level,\n                         priority_recommendation, priority_rule_code, priority_reason, created_at, updated_at)\n                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP)\n                    RETURNING complaint_id\n                ");
                $create->execute([
                    $demoComplaint['resident_id'], $demoComplaint['category_id'], $approvedBy,
                    $demoComplaint['title'], $demoComplaint['description'], $demoComplaint['status'],
                    $demoComplaint['priority'], $demoComplaint['priority'], $demoComplaint['rule'], $demoComplaint['reason'],
                ]);
                $complaintId = $create->fetchColumn();
                $createdComplaints++;

                $update = $db->prepare('INSERT INTO complaint_updates (complaint_id, officer_id, status, remarks) VALUES (?, ?, ?, ?)');
                $update->execute([$complaintId, $approvedBy, $demoComplaint['status'], 'DEMO DATA ONLY — sample officer review for capstone testing.']);
            }
        }

        $announcementTitle = 'DEMO ONLY — Community maintenance reminder';
        $announcementFind = $db->prepare('SELECT announcement_id FROM announcements WHERE title = ? LIMIT 1');
        $announcementFind->execute([$announcementTitle]);
        if (!$announcementFind->fetchColumn()) {
            $announcementCreate = $db->prepare("\n                INSERT INTO announcements (created_by, title, content, publish_date, expiration_date)\n                VALUES (?, ?, ?, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')\n            ");
            $announcementCreate->execute([
                $approvedBy,
                $announcementTitle,
                'This fictional announcement exists only to demonstrate the dashboard and notification flow during capstone testing.',
            ]);
            $createdAnnouncements++;
        }

        $db->commit();
        echo json_encode([
            'message' => 'Demo data is ready. Only fictional records marked DEMO were added.',
            'created' => [
                'users' => $createdUsers,
                'residents' => $createdResidents,
                'properties' => $createdProperties,
                'bills' => $createdBills,
                'complaints' => $createdComplaints,
                'notifications' => $createdNotifications,
                'announcements' => $createdAnnouncements,
            ],
            'credentials' => [
                'password' => $demoPassword,
                'accounts' => [
                    ['label' => 'Demo homeowner', 'email' => 'demo.homeowner@smarthoa.test'],
                    ['label' => 'Demo renter', 'email' => 'demo.renter@smarthoa.test'],
                    ['label' => 'Demo Airbnb host', 'email' => 'demo.airbnb.host@smarthoa.test'],
                ],
            ],
        ]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
} catch (RuntimeException $e) {
    http_response_code(400);
    echo json_encode(['message' => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Unable to create demo data. Please check that the database has been seeded.', 'error' => $e->getMessage()]);
}
?>
