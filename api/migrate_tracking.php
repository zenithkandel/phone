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

$trackingFile = __DIR__ . '/../data/tracking.json';
$configFile = __DIR__ . '/../data/config.json';

// ── Step 1: Migrate tracking.json ──────────────────
$tracking = [];
if (file_exists($trackingFile) && filesize($trackingFile) > 0) {
    $tracking = json_decode(file_get_contents($trackingFile), true);
    if (!is_array($tracking)) $tracking = [];
}

$migrated = 0;
$alreadyCorrect = 0;

foreach ($tracking as $voterId => &$entry) {
    // Ensure all required fields exist with proper defaults
    if (!isset($entry['called'])) $entry['called'] = false;
    if (!isset($entry['vote_me'])) $entry['vote_me'] = false;
    if (!isset($entry['vote_opposition'])) $entry['vote_opposition'] = false;
    if (!isset($entry['opposition_candidate'])) $entry['opposition_candidate'] = '';
    if (!isset($entry['call_later'])) $entry['call_later'] = false;

    // Convert "save wala list" entries to call_later
    if ($entry['vote_opposition'] === true && strtolower(trim($entry['opposition_candidate'])) === 'save wala list') {
        $entry['vote_opposition'] = false;
        $entry['opposition_candidate'] = '';
        $entry['call_later'] = true;
        $migrated++;
    } else {
        $alreadyCorrect++;
    }
}
unset($entry);

// Write back tracking.json
$result = file_put_contents($trackingFile, json_encode($tracking, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write tracking data']);
    exit;
}

// ── Step 2: Clean config.json ──────────────────────
$config = [];
if (file_exists($configFile) && filesize($configFile) > 0) {
    $config = json_decode(file_get_contents($configFile), true);
    if (!is_array($config)) $config = [];
}

$removedFromConfig = false;
if (isset($config['opposition_candidates']) && is_array($config['opposition_candidates'])) {
    $original = $config['opposition_candidates'];
    $config['opposition_candidates'] = array_values(array_filter($config['opposition_candidates'], function ($name) {
        return strtolower(trim($name)) !== 'save wala list';
    }));
    if (count($config['opposition_candidates']) !== count($original)) {
        $removedFromConfig = true;
    }
}

// Write back config.json
$result = file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write config data']);
    exit;
}

echo json_encode([
    'success' => true,
    'tracking' => [
        'migrated_to_call_later' => $migrated,
        'already_correct' => $alreadyCorrect,
        'total_entries' => count($tracking)
    ],
    'config' => [
        'removed_save_wala_list' => $removedFromConfig,
        'remaining_opposition_candidates' => $config['opposition_candidates'] ?? []
    ]
]);
