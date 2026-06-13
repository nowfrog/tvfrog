<?php
// /admin/api/auth.php
session_start();

// Load config
$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server not configured. Visit /admin/api/setup.php']);
    exit;
}
require_once $configPath;
define('ADMIN_PASSWORD_HASH', $adminPasswordHash);

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if ($action === 'login') {
        $password = $input['password'] ?? '';

        if (password_verify($password, ADMIN_PASSWORD_HASH)) {
            $_SESSION['isAdmin'] = true;
            echo json_encode(['success' => true, 'message' => 'Login successful.']);
        } else {
            sleep(2); // Rate limit brute force
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid password.']);
        }
    } 
    elseif ($action === 'logout') {
        session_unset();
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Logout successful.']);
    }
    else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
    }

} 
elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Check session status
    $isAuthenticated = isset($_SESSION['isAdmin']) && $_SESSION['isAdmin'] === true;
    echo json_encode(['authenticated' => $isAuthenticated]);
}
?>