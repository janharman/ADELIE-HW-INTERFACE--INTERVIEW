<?php

// Example: read MySQL connection parameters from environment variables.
$dbHost = getenv('MYSQL_HOST') ?: '127.0.0.1';
$dbPort = getenv('MYSQL_PORT') ?: '3306';
$dbName = getenv('MYSQL_DATABASE') ?: 'example_db';
$dbUser = getenv('MYSQL_USER') ?: 'example_user';
$dbPass = getenv('MYSQL_PASSWORD') ?: '';

echo date('Y-m-d H:i:s') . " - Hello, World!\n";

echo "MySQL config from env:\n";
echo "  host: {$dbHost}\n";
echo "  port: {$dbPort}\n";
echo "  database: {$dbName}\n";
echo "  user: {$dbUser}\n";
echo "  password: " . ($dbPass !== '' ? '[set]' : '[not set]') . "\n";

?>