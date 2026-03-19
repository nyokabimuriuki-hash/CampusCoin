<?php

declare(strict_types=1);

function config(): array
{
    static $config = null;

    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }

    return $config;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $database = config()['database'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $database['host'],
        $database['port'],
        $database['name'],
        $database['charset']
    );

    $pdo = new PDO(
        $dsn,
        $database['username'],
        $database['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    return $pdo;
}

function jsonResponse(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        jsonResponse(400, ['error' => 'Request body must be valid JSON.']);
    }

    return $data;
}

function findUserByFirebaseUid(string $firebaseUid): ?array
{
    $statement = db()->prepare(
        'SELECT id, firebase_uid AS firebaseUid, full_name AS fullName, email, role FROM users WHERE firebase_uid = :firebase_uid LIMIT 1'
    );
    $statement->execute(['firebase_uid' => $firebaseUid]);
    $user = $statement->fetch();

    return $user ?: null;
}

function requireUser(): array
{
    $firebaseUid = trim((string) ($_GET['firebaseUid'] ?? ''));
    if ($firebaseUid === '') {
        jsonResponse(400, ['error' => 'firebaseUid is required.']);
    }

    $user = findUserByFirebaseUid($firebaseUid);
    if ($user === null) {
        jsonResponse(404, ['error' => 'User not found.']);
    }

    return $user;
}

function requireAdmin(): array
{
    $user = requireUser();
    if (($user['role'] ?? '') !== 'admin') {
        jsonResponse(403, ['error' => 'Admin access is required.']);
    }

    return $user;
}
