<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
$file = __DIR__ . '/../data/tracking.json';
if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    echo '{}';
}
