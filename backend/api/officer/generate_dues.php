<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/fcm.php';
require_once __DIR__ . '/../../helpers/payment_settlement.php';
require_once __DIR__ . '/../../helpers/bill_billing_month.php';
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

if (!function_exists('apache_request_headers')) {
    function apache_request_headers() {
        $headers = array();
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) == 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}

$headers = apache_request_headers();
$authHeader = $headers['Authorization'] ?? '';

if ($authHeader) {
    list($jwt) = sscanf($authHeader, 'Bearer %s');
    if ($jwt) {
        try {
            $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
            $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
            
            if ($decoded->data->role !== 'Super Administrator' && $decoded->data->role !== 'HOA Officer') {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized access."));
                exit();
            }

            $data = json_decode(file_get_contents("php://input"), true);

            if (!is_array($data)) {
                http_response_code(400);
                echo json_encode(array("message" => "Please provide valid bill details."));
                exit();
            }

            $residentId = trim((string) ($data['resident_id'] ?? ''));
            $paymentTypeId = trim((string) ($data['payment_type_id'] ?? ''));
            $amountInput = $data['amount_due'] ?? null;
            $dueDate = trim((string) ($data['due_date'] ?? ''));
            $billingMonthInput = trim((string) ($data['billing_month'] ?? ''));

            if ($residentId === '' || $paymentTypeId === '' || $dueDate === '' || $amountInput === null) {
                http_response_code(400);
                echo json_encode(array("message" => "Resident, bill type, amount, and due date are required."));
                exit();
            }

            if (!is_numeric($amountInput) || (float) $amountInput <= 0) {
                http_response_code(400);
                echo json_encode(array("message" => "Amount must be greater than zero."));
                exit();
            }

            $dueDateObject = DateTimeImmutable::createFromFormat('!Y-m-d', $dueDate);
            $dueDateErrors = DateTimeImmutable::getLastErrors();
            if ($dueDateObject === false || ($dueDateErrors !== false && ($dueDateErrors['warning_count'] > 0 || $dueDateErrors['error_count'] > 0))) {
                http_response_code(400);
                echo json_encode(array("message" => "Due date must use the YYYY-MM-DD format."));
                exit();
            }

            try {
                // Respect an explicitly selected period. For older clients,
                // infer the period from the due date, never the creation month.
                $billingMonth = bill_billing_month($billingMonthInput, $dueDateObject);
            } catch (InvalidArgumentException $error) {
                http_response_code(400);
                echo json_encode(['message' => $error->getMessage()]);
                exit();
            }
            $billingLabel = (new DateTimeImmutable($billingMonth))->format('F Y');

            $database = new Database();
            $db = $database->getConnection();

            // A selected resident must exist. This protects against bills
            // being attached to an arbitrary or deleted profile ID.
            $residentStatement = $db->prepare("
                SELECT resident_id, user_id, first_name, last_name
                FROM resident_profiles
                WHERE resident_id = ?
                LIMIT 1
            ");
            $residentStatement->execute([$residentId]);
            $resident = $residentStatement->fetch(PDO::FETCH_ASSOC);
            if (!$resident) {
                http_response_code(400);
                echo json_encode(array("message" => "The selected resident could not be found."));
                exit();
            }

            // Retired types remain linked to old payments but cannot be used
            // when an officer generates a new bill.
            $typeStatement = $db->prepare("
                SELECT payment_type_id, payment_name
                FROM payment_types
                WHERE payment_type_id = ? AND is_active = TRUE
                LIMIT 1
            ");
            $typeStatement->execute([$paymentTypeId]);
            $paymentType = $typeStatement->fetch(PDO::FETCH_ASSOC);
            if (!$paymentType) {
                http_response_code(400);
                echo json_encode(array("message" => "Please choose an active bill type."));
                exit();
            }

            $amountDue = round((float) $amountInput, 2);
            $formattedDueDate = $dueDateObject->format('M j, Y');
            $recipientUserId = $resident['user_id'] ?? null;

            // The bill and its in-app notification are one atomic action. This
            // prevents a resident from receiving a notice if bill creation fails.
            $db->beginTransaction();
            try {
                dues_balance_lock_resident($db, $residentId);
                if (dues_balance_is_monthly($paymentType['payment_name']) && dues_balance_monthly_bill_exists($db, $residentId, $billingMonth)) {
                    $db->rollBack();
                    http_response_code(409);
                    echo json_encode([
                        'message' => 'This resident already has an HOA dues bill for ' . $billingLabel . '. Review the existing bill instead of creating another.',
                        'billing_month' => $billingMonth, 'billing_label' => $billingLabel,
                    ]);
                    exit();
                }
                $query = "
                    INSERT INTO payments (resident_id, payment_type_id, amount_due, due_date, billing_month, payment_status)
                    VALUES (?, ?, ?, ?, ?, 'Pending')
                ";
                
                $stmt = $db->prepare($query);
                $stmt->execute([
                    $residentId,
                    $paymentTypeId,
                    $amountDue,
                    $dueDateObject->format('Y-m-d'),
                    $billingMonth
                ]);

                $notificationCreated = false;
                if (!empty($recipientUserId)) {
                    $notificationTitle = 'New bill awaiting payment';
                    $notificationMessage = $paymentType['payment_name']
                        . ' for ' . $billingLabel
                        . ' of ₱' . number_format($amountDue, 2)
                        . ' has been added to your account and is due on ' . $formattedDueDate . '.';
                    $notificationStatement = $db->prepare("
                        INSERT INTO notifications (recipient_id, title, message, notification_type)
                        VALUES (?, ?, ?, 'Payment')
                    ");
                    $notificationStatement->execute([
                        $recipientUserId,
                        $notificationTitle,
                        $notificationMessage
                    ]);
                    $notificationCreated = true;
                }

                $db->commit();

                // Native push is optional: the durable in-app notification above
                // remains available even if Firebase has not been configured yet.
                if ($notificationCreated) {
                    send_fcm_push(
                        $db,
                        [$recipientUserId],
                        $notificationTitle,
                        $notificationMessage,
                        'Payment',
                        '/my-payments'
                    );
                }

                echo json_encode(array(
                    "message" => "Bill generated successfully.",
                    "billing_month" => $billingMonth,
                    "billing_label" => $billingLabel,
                    "notification_created" => $notificationCreated
                ));
            } catch (Exception $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $e;
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(array("message" => "Failed to generate bill.", "error" => $e->getMessage()));
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
