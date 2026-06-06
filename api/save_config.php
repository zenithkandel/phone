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

$fp = fopen($file, 'c+');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to open config file']);
    exit;
}

flock($fp, LOCK_EX);

$config = ['candidate_name' => '', 'opposition_candidates' => []];
if (filesize($file) > 0) {
    $content = stream_get_contents($fp);
    $existing = json_decode($content, true);
    if (is_array($existing)) {
        $config = array_merge($config, $existing);
    }
}

$config = array_merge($config, $input);

fseek($fp, 0);
ftruncate($fp, 0);
fwrite($fp, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['success' => true]);
