<?php
/**
 * Optional PHP endpoint for direct configuration saving
 * Place this file in the app/ directory and ensure PHP server supports PUT requests
 * 
 * Security: This is a development tool - DO NOT use in production without proper authentication!
 */

// Enable CORS for local development
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get the filename from the URL path
$path = $_SERVER['REQUEST_URI'];
$filename = basename($path);

// Validate filename (only allow .yaml files)
if (!preg_match('/^[a-zA-Z0-9\s\-_äöüÄÖÜß]+\.yaml$/', $filename)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid filename']);
    exit;
}

// Read the content from the request body
$content = file_get_contents('php://input');

if (empty($content)) {
    http_response_code(400);
    echo json_encode(['error' => 'No content provided']);
    exit;
}

// Ensure formulare directory exists
$formulareDir = __DIR__ . '/formulare';
if (!is_dir($formulareDir)) {
    mkdir($formulareDir, 0755, true);
}

// Write the file
$filepath = $formulareDir . '/' . $filename;
$result = file_put_contents($filepath, $content);

if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => "Configuration $filename saved successfully",
    'bytes' => $result
]);
?>