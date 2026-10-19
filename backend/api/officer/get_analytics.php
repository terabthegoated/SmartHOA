<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/payment_analytics.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// Load the same environment file as the database connection before checking
// the token. Without this, a locally configured JWT secret could be ignored.
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

if (!function_exists('apache_request_headers')) {
    function apache_request_headers() {
        $headers = array();
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}

$authenticatedOfficer = false;

try {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? '';
    list($jwt) = sscanf($authHeader, 'Bearer %s');

    if (!$jwt) {
        throw new Exception('Access denied.');
    }

    $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));

    if (!in_array($decoded->data->role, ['Super Administrator', 'HOA Officer'], true)) {
        http_response_code(403);
        echo json_encode(array('message' => 'Unauthorized access.'));
        exit();
    }
    $authenticatedOfficer = true;

    $database = new Database();
    $db = $database->getConnection();
    $response = array();

    // Community size and financial position. A resident profile is more
    // complete than role filtering because it also covers Airbnb hosts. Keep
    // these related values in one result instead of making five sequential
    // database requests during dashboard startup.
    $communityMetrics = $db->query("
        SELECT
            (SELECT COUNT(*) FROM resident_profiles WHERE resident_status = 'Active') AS total_residents,
            (SELECT COUNT(*) FROM properties) AS total_properties,
            (SELECT COUNT(*) FROM properties WHERE property_use = 'Airbnb') AS airbnb_properties,
            (SELECT COUNT(*) FROM properties WHERE property_use = 'Renter') AS renter_properties
    ")->fetch(PDO::FETCH_ASSOC) ?: array();
    $response['total_residents'] = (int) ($communityMetrics['total_residents'] ?? 0);
    $response['total_properties'] = (int) ($communityMetrics['total_properties'] ?? 0);
    $response['airbnb_properties'] = (int) ($communityMetrics['airbnb_properties'] ?? 0);
    $response['renter_properties'] = (int) ($communityMetrics['renter_properties'] ?? 0);

    $response = array_merge($response, analytics_payment_metrics(analytics_payment_rows($db)));

    // Complaint workload and service quality. The first Resolved/Closed update
    // is used when available, rather than a later edit to the complaint record.
    $stmt = $db->prepare("
        SELECT
            COUNT(*) AS total_complaints,
            COUNT(*) FILTER (WHERE c.complaint_status NOT IN ('Resolved', 'Closed')) AS open_complaints,
            COUNT(*) FILTER (WHERE c.complaint_status IN ('Resolved', 'Closed')) AS resolved_complaints,
            COUNT(*) FILTER (
                WHERE c.complaint_status NOT IN ('Resolved', 'Closed')
                  AND c.priority_level IN ('High', 'Critical')
            ) AS high_priority_complaints,
            COUNT(*) FILTER (
                WHERE c.complaint_status NOT IN ('Resolved', 'Closed')
                  AND c.created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
            ) AS aged_complaints,
            AVG(
                EXTRACT(EPOCH FROM (COALESCE(resolution_event.resolved_at, c.updated_at) - c.created_at)) / 86400.0
            ) FILTER (WHERE c.complaint_status IN ('Resolved', 'Closed')) AS average_resolution_days
        FROM complaints c
        LEFT JOIN LATERAL (
            SELECT MIN(updated_at) AS resolved_at
            FROM complaint_updates
            WHERE complaint_id = c.complaint_id
              AND status IN ('Resolved', 'Closed')
        ) AS resolution_event ON TRUE
    ");
    $stmt->execute();
    $complaintMetrics = $stmt->fetch(PDO::FETCH_ASSOC) ?: array();
    $response['total_complaints'] = (int) ($complaintMetrics['total_complaints'] ?? 0);
    $response['open_complaints'] = (int) ($complaintMetrics['open_complaints'] ?? 0);
    $response['resolved_complaints'] = (int) ($complaintMetrics['resolved_complaints'] ?? 0);
    $response['high_priority_complaints'] = (int) ($complaintMetrics['high_priority_complaints'] ?? 0);
    $response['aged_complaints'] = (int) ($complaintMetrics['aged_complaints'] ?? 0);
    $response['average_resolution_days'] = ($complaintMetrics['average_resolution_days'] ?? null) !== null ? round((float) $complaintMetrics['average_resolution_days'], 1) : null;

    $stmt = $db->prepare("SELECT COUNT(*) AS response_count, AVG(rating) AS average_rating FROM feedback");
    $stmt->execute();
    $satisfaction = $stmt->fetch(PDO::FETCH_ASSOC) ?: array();
    $response['satisfaction_response_count'] = (int) ($satisfaction['response_count'] ?? 0);
    $response['average_satisfaction'] = ($satisfaction['average_rating'] ?? null) !== null ? round((float) $satisfaction['average_rating'], 1) : null;

    // Community analytics charts.
    $stmt = $db->prepare("
        SELECT cc.category_name AS name, COUNT(c.complaint_id) AS value
        FROM complaint_categories cc
        INNER JOIN complaints c ON c.category_id = cc.category_id
        GROUP BY cc.category_id, cc.category_name
        ORDER BY value DESC, name ASC
    ");
    $stmt->execute();
    $response['complaints_by_category'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($response['complaints_by_category'] as &$category) {
        $category['value'] = (int) $category['value'];
    }
    unset($category);

    $stmt = $db->prepare("
        WITH statuses(status_order, name) AS (
            VALUES
                (1, 'Submitted'::text),
                (2, 'Assigned'::text),
                (3, 'In Progress'::text),
                (4, 'Resolved'::text),
                (5, 'Closed'::text)
        )
        SELECT statuses.name, COUNT(c.complaint_id) AS value
        FROM statuses
        LEFT JOIN complaints c ON c.complaint_status::text = statuses.name
        GROUP BY statuses.status_order, statuses.name
        ORDER BY statuses.status_order
    ");
    $stmt->execute();
    $response['complaints_by_status'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($response['complaints_by_status'] as &$status) {
        $status['value'] = (int) $status['value'];
    }
    unset($status);
    $response['complaint_status_distribution'] = $response['complaints_by_status'];

    $stmt = $db->prepare("
        WITH priorities(priority_order, name) AS (
            VALUES
                (1, 'Low'::text),
                (2, 'Medium'::text),
                (3, 'High'::text),
                (4, 'Critical'::text)
        )
        SELECT priorities.name, COUNT(c.complaint_id) AS value
        FROM priorities
        LEFT JOIN complaints c ON c.priority_level::text = priorities.name
        GROUP BY priorities.priority_order, priorities.name
        ORDER BY priorities.priority_order
    ");
    $stmt->execute();
    $response['priority_distribution'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($response['priority_distribution'] as &$priority) {
        $priority['value'] = (int) $priority['value'];
    }
    unset($priority);
    // Keep a descriptive API name for the dashboard chart while retaining
    // the older aliases used by any existing analytics consumers.
    $response['complaints_by_priority'] = $response['priority_distribution'];
    $response['complaint_priority_distribution'] = $response['priority_distribution'];

    $stmt = $db->prepare("
        SELECT cc.category_name, COUNT(*) AS complaint_count
        FROM complaints c
        INNER JOIN complaint_categories cc ON cc.category_id = c.category_id
        WHERE c.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY cc.category_id, cc.category_name
        HAVING COUNT(*) >= 3
        ORDER BY complaint_count DESC, cc.category_name ASC
        LIMIT 1
    ");
    $stmt->execute();
    $recurringCategory = $stmt->fetch(PDO::FETCH_ASSOC);

    // Explainable, rule-based DSS recommendations: trigger, evidence, action.
    $insights = array();
    if ($response['collection_rate'] !== null && $response['collection_rate'] < 80) {
        $insights[] = array('severity' => 'high', 'title' => 'Collection rate needs attention', 'evidence' => number_format($response['collection_rate'], 1) . '% of this month\'s billed dues has been collected.', 'recommendation' => 'Send payment reminders and follow up with overdue households.', 'action_url' => '/payments');
    }
    if ($response['overdue_accounts'] > 0) {
        $insights[] = array('severity' => 'high', 'rule_code' => 'OVERDUE_DUES_PRESENT', 'title' => 'Overdue accounts require follow-up', 'evidence' => $response['overdue_accounts'] . ' household(s) have ₱' . number_format($response['overdue_amount'], 2) . ' in overdue dues including calculated interest (receipts under verification excluded).', 'recommendation' => 'Review overdue accounts and send targeted payment reminders.', 'action_url' => '/payments');
    }
    if ($response['high_priority_complaints'] > 0) {
        $insights[] = array('severity' => 'high', 'title' => 'High-priority complaints are still open', 'evidence' => $response['high_priority_complaints'] . ' high- or critical-priority complaint(s) are unresolved.', 'recommendation' => 'Assign an officer and set an immediate resolution plan.', 'action_url' => '/complaints');
    }
    if ($response['aged_complaints'] > 0) {
        $insights[] = array('severity' => 'medium', 'title' => 'Complaint queue is aging', 'evidence' => $response['aged_complaints'] . ' open complaint(s) have been waiting for more than seven days.', 'recommendation' => 'Review the oldest cases and publish status updates for residents.', 'action_url' => '/complaints');
    }
    if ($response['average_resolution_days'] !== null && $response['average_resolution_days'] > 7) {
        $insights[] = array('severity' => 'medium', 'title' => 'Resolution time is above the seven-day target', 'evidence' => 'Resolved complaints average ' . number_format($response['average_resolution_days'], 1) . ' days.', 'recommendation' => 'Review officer workload and prioritize the most delayed categories.', 'action_url' => '/complaints');
    }
    if ($response['average_satisfaction'] !== null && $response['average_satisfaction'] < 3.5) {
        $insights[] = array('severity' => 'medium', 'title' => 'Resident satisfaction is below target', 'evidence' => 'Residents rated resolved complaints ' . number_format($response['average_satisfaction'], 1) . ' out of 5.', 'recommendation' => 'Review feedback comments and improve the resolution process.', 'action_url' => '/complaints');
    }
    if ($recurringCategory && (int) $recurringCategory['complaint_count'] >= 3) {
        $insights[] = array('severity' => 'medium', 'title' => 'A recurring community issue was detected', 'evidence' => $recurringCategory['complaint_count'] . ' ' . $recurringCategory['category_name'] . ' complaints were submitted in the last 30 days.', 'recommendation' => 'Schedule a targeted inspection or preventive action for this issue.', 'action_url' => '/complaints');
    }
    if (count($insights) === 0) {
        $insights[] = array('severity' => 'positive', 'title' => 'Community operations are on track', 'evidence' => 'No current rule has triggered an urgent intervention.', 'recommendation' => 'Continue monitoring collections and complaint updates.', 'action_url' => '/officer-dashboard');
    }

    $response['dss_insights'] = $insights;
    $response['generated_at'] = gmdate('c');

    http_response_code(200);
    echo json_encode($response);
} catch (Throwable $e) {
    // Token failures remain 401; database/query errors after authorization are
    // reported accurately without exposing connection or schema details.
    http_response_code($authenticatedOfficer ? 500 : 401);
    error_log('SmartHOA analytics error: ' . $e->getMessage());
    echo json_encode(array(
        'message' => $authenticatedOfficer
            ? 'Unable to load community analytics right now.'
            : 'Access denied.'
    ));
}
?>
