<?php
// /admin/api/data_handler.php
session_start();

// 1. Security: Check if admin is logged in
if (!isset($_SESSION['isAdmin']) || $_SESSION['isAdmin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized access.']);
    exit;
}

// 2. Define file path
define('JSON_FILE_PATH', '../../data/app_data.json');

header('Content-Type: application/json');

// 3. Handle request
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // --- Load Data (GET) ---
    if (!file_exists(JSON_FILE_PATH)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'JSON file not found.']);
        exit;
    }
    
    $jsonData = file_get_contents(JSON_FILE_PATH);
    if ($jsonData === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Could not read file.']);
        exit;
    }
    
    echo $jsonData;

} 
elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // --- Save Data (POST) ---
    $json_data = file_get_contents('php://input');
    if (!$json_data) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No data received.']);
        exit;
    }
    
    $data = json_decode($json_data);
    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON.']);
        exit;
    }

    try {
        $result = file_put_contents(JSON_FILE_PATH, $json_data, LOCK_EX);
        
        if ($result === false) {
            throw new Exception('Could not write to file. Check /data/ folder permissions.');
        }
        
        echo json_encode(['success' => true, 'message' => 'Data saved.']);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>