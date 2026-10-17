<?php
// Lightweight Render health check. It intentionally exposes no database,
// account, or configuration information.
header('Content-Type: application/json; charset=UTF-8');
$health = [
    'name' => 'SmartHOA API',
    'status' => 'running'
];
// A public commit identifier lets deployment checks verify the running release
// without authenticating or executing a collection-policy run.
$revision = getenv('RENDER_GIT_COMMIT');
if (is_string($revision) && preg_match('/\A[0-9a-f]{40}\z/i', $revision)) {
    $health['revision'] = strtolower($revision);
}
echo json_encode($health);
?>
