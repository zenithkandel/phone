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
if (!$input || !isset($input['voter_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required field: voter_id']);
    exit;
}

$voter_id = (int) $input['voter_id'];
$file = __DIR__ . '/../data/voters.json';

$voters = [];
if (file_exists($file) && filesize($file) > 0) {
    $content = file_get_contents($file);
    $voters = json_decode($content, true);
    if (!is_array($voters)) {
        $voters = [];
    }
}

$found = false;
foreach ($voters as &$voter) {
    if ((int) $voter['id'] === $voter_id) {
        if (isset($input['name'])) $voter['name'] = $input['name'];
        if (isset($input['title'])) $voter['title'] = $input['title'];
        if (isset($input['phone'])) $voter['phone'] = $input['phone'];
        $found = true;
        break;
    }
}
unset($voter);

if (!$found) {
    http_response_code(404);
    echo json_encode(['error' => 'Voter not found']);
    exit;
}

$result = file_put_contents($file, json_encode($voters, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write voter data']);
    exit;
}

echo json_encode(['success' => true]);
