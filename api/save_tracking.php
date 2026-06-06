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
if (!$input || !isset($input['voter_id']) || !isset($input['field']) || !isset($input['value'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: voter_id, field, value']);
    exit;
}

$voter_id = (string) $input['voter_id'];
$field = $input['field'];
$value = $input['value'];

$allowed_fields = ['called', 'vote_me', 'vote_opposition', 'opposition_candidate'];
if (!in_array($field, $allowed_fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid field. Allowed: ' . implode(', ', $allowed_fields)]);
    exit;
}

$file = __DIR__ . '/../data/tracking.json';

$tracking = [];
if (file_exists($file) && filesize($file) > 0) {
    $content = file_get_contents($file);
    $tracking = json_decode($content, true);
    if (!is_array($tracking)) {
        $tracking = [];
    }
}

if (!isset($tracking[$voter_id])) {
    $tracking[$voter_id] = [
        'called' => false,
        'vote_me' => false,
        'vote_opposition' => false,
        'opposition_candidate' => '',
    ];
}

$tracking[$voter_id][$field] = $value;

$result = file_put_contents($file, json_encode($tracking, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write tracking data']);
    exit;
}

echo json_encode(['success' => true]);
