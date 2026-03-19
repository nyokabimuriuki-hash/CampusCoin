<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/api', PHP_URL_PATH) ?: '/api';
$apiPosition = strpos($path, '/api');
$apiPath = $apiPosition === false ? '/' : substr($path, $apiPosition + 4);
$apiPath = $apiPath === '' ? '/' : $apiPath;

if ($method === 'GET' && $apiPath === '/health') {
    jsonResponse(200, [
        'ok' => true,
        'service' => 'CampusCoin API',
    ]);
}

if ($method === 'POST' && $apiPath === '/users/sync') {
    $body = readJsonBody();
    $firebaseUid = trim((string) ($body['firebaseUid'] ?? ''));
    $fullName = trim((string) ($body['fullName'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));

    if ($firebaseUid === '' || $email === '') {
        jsonResponse(400, ['error' => 'firebaseUid and email are required.']);
    }

    $user = findUserByFirebaseUid($firebaseUid);

    if ($user === null) {
        $statement = db()->prepare(
            'INSERT INTO users (firebase_uid, full_name, email, role) VALUES (:firebase_uid, :full_name, :email, :role)'
        );
        $statement->execute([
            'firebase_uid' => $firebaseUid,
            'full_name' => $fullName !== '' ? $fullName : 'Student',
            'email' => $email,
            'role' => 'student',
        ]);

        $user = findUserByFirebaseUid($firebaseUid);
    } else {
        $statement = db()->prepare(
            'UPDATE users SET full_name = :full_name, email = :email WHERE firebase_uid = :firebase_uid'
        );
        $statement->execute([
            'firebase_uid' => $firebaseUid,
            'full_name' => $fullName !== '' ? $fullName : $user['fullName'],
            'email' => $email,
        ]);

        $user = findUserByFirebaseUid($firebaseUid);
    }

    jsonResponse(200, ['user' => $user]);
}

if ($method === 'GET' && $apiPath === '/records') {
    $user = requireUser();

    $incomeStatement = db()->prepare(
        'SELECT id, "Income" AS type, category, amount, 0 AS budget, DATE_FORMAT(income_date, "%Y-%m-%d") AS date
         FROM income
         WHERE user_id = :user_id'
    );
    $incomeStatement->execute(['user_id' => (int) $user['id']]);

    $expenseStatement = db()->prepare(
        'SELECT id, "Expenditure" AS type, category, amount, budget, DATE_FORMAT(expense_date, "%Y-%m-%d") AS date
         FROM expenses
         WHERE user_id = :user_id'
    );
    $expenseStatement->execute(['user_id' => (int) $user['id']]);

    $records = array_merge($incomeStatement->fetchAll(), $expenseStatement->fetchAll());

    usort($records, static function (array $first, array $second): int {
        return strcmp((string) $second['date'], (string) $first['date']);
    });

    jsonResponse(200, ['records' => $records]);
}

if ($method === 'POST' && $apiPath === '/records') {
    $body = readJsonBody();
    $firebaseUid = trim((string) ($body['firebaseUid'] ?? ''));
    $type = trim((string) ($body['type'] ?? ''));
    $category = trim((string) ($body['category'] ?? ''));
    $date = trim((string) ($body['date'] ?? ''));
    $amount = isset($body['amount']) ? (float) $body['amount'] : null;
    $budget = isset($body['budget']) ? (float) $body['budget'] : 0.0;

    if ($firebaseUid === '' || $type === '' || $category === '' || $date === '' || $amount === null) {
        jsonResponse(400, ['error' => 'firebaseUid, type, category, amount, and date are required.']);
    }

    $user = findUserByFirebaseUid($firebaseUid);
    if ($user === null) {
        jsonResponse(404, ['error' => 'User not found.']);
    }

    if ($type === 'Income') {
        $statement = db()->prepare(
            'INSERT INTO income (user_id, category, amount, income_date)
             VALUES (:user_id, :category, :amount, :income_date)'
        );
        $statement->execute([
            'user_id' => (int) $user['id'],
            'category' => $category,
            'amount' => $amount,
            'income_date' => $date,
        ]);
    } else {
        $statement = db()->prepare(
            'INSERT INTO expenses (user_id, category, amount, budget, expense_date)
             VALUES (:user_id, :category, :amount, :budget, :expense_date)'
        );
        $statement->execute([
            'user_id' => (int) $user['id'],
            'category' => $category,
            'amount' => $amount,
            'budget' => $budget,
            'expense_date' => $date,
        ]);
    }

    jsonResponse(201, ['message' => 'Record created successfully.']);
}

if ($method === 'DELETE' && preg_match('#^/records/(\d+)$#', $apiPath, $matches) === 1) {
    $user = requireUser();
    $recordId = (int) $matches[1];

    $lookup = db()->prepare(
        'SELECT id, user_id, "Income" AS type FROM income WHERE id = :id
         UNION ALL
         SELECT id, user_id, "Expenditure" AS type FROM expenses WHERE id = :id
         LIMIT 1'
    );
    $lookup->execute(['id' => $recordId]);
    $record = $lookup->fetch();

    if (!$record) {
        jsonResponse(404, ['error' => 'Record not found.']);
    }

    if ((int) $record['user_id'] !== (int) $user['id'] && ($user['role'] ?? '') !== 'admin') {
        jsonResponse(403, ['error' => 'You cannot delete this record.']);
    }

    $delete = db()->prepare($record['type'] === 'Income'
        ? 'DELETE FROM income WHERE id = :id'
        : 'DELETE FROM expenses WHERE id = :id');
    $delete->execute(['id' => $recordId]);

    jsonResponse(200, ['message' => 'Record deleted successfully.']);
}

if ($method === 'GET' && $apiPath === '/admin/users') {
    requireAdmin();

    $statement = db()->query(
        'SELECT firebase_uid AS firebaseUid, full_name AS fullName, email, role
         FROM users
         ORDER BY id DESC'
    );

    jsonResponse(200, ['users' => $statement->fetchAll()]);
}

if ($method === 'GET' && $apiPath === '/admin/records') {
    requireAdmin();

    $income = db()->query(
        'SELECT income.id, users.firebase_uid AS userId, "Income" AS type, income.category, income.amount, 0 AS budget,
                DATE_FORMAT(income.income_date, "%Y-%m-%d") AS date
         FROM income
         INNER JOIN users ON users.id = income.user_id'
    )->fetchAll();

    $expenses = db()->query(
        'SELECT expenses.id, users.firebase_uid AS userId, "Expenditure" AS type, expenses.category, expenses.amount, expenses.budget,
                DATE_FORMAT(expenses.expense_date, "%Y-%m-%d") AS date
         FROM expenses
         INNER JOIN users ON users.id = expenses.user_id'
    )->fetchAll();

    $records = array_merge($income, $expenses);

    usort($records, static function (array $first, array $second): int {
        return strcmp((string) $second['date'], (string) $first['date']);
    });

    jsonResponse(200, ['records' => $records]);
}

if ($method === 'GET' && $apiPath === '/admin/summary') {
    requireAdmin();

    $incomeCount = (int) db()->query('SELECT COUNT(*) AS count FROM income')->fetch()['count'];
    $expenseCount = (int) db()->query('SELECT COUNT(*) AS count FROM expenses')->fetch()['count'];

    jsonResponse(200, [
        'totalRecords' => $incomeCount + $expenseCount,
        'incomeCount' => $incomeCount,
        'expenseCount' => $expenseCount,
    ]);
}

jsonResponse(404, ['error' => 'API route not found.']);
