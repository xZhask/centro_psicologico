<?php
return [
    'dsn'      => 'mysql:host=' . ($_ENV['DB_HOST'] ?? 'localhost')
                . ';dbname=' . ($_ENV['DB_NAME'] ?? 'centro_psicologico')
                . ';charset=utf8mb4',
    'user'     => $_ENV['DB_USER'] ?? 'root',
    'password' => $_ENV['DB_PASS'] ?? '',
];
