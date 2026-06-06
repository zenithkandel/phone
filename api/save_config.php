<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$file = __DIR__ . '/../data/config.json';

$config = ['candidate_name' => '', 'opposition_candidates' => []];
if (file_exists($file) && filesize($file) > 0) {
    $content = file_get_contents($file);
    $existing = json_decode($content, true);
    if (is_array($existing)) {
        $config = array_merge($config, $existing);
    }
}

$config = array_merge($config, $input);

$result = file_put_contents($file, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write config data']);
    exit;
}

echo json_encode(['success' => true]);
