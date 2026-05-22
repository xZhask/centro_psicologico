<?php
namespace Src\Models;

use PDO;
use Src\Core\Database;

class Usuario {

    /**
     * Todos los usuarios con datos de persona.
     * Nunca devuelve password_hash.
     */
    public static function findAll(): array {
        return Database::query(
            "SELECT u.id,
                    u.persona_id,
                    u.rol,
                    u.activo,
                    u.debe_cambiar_password,
                    u.ultimo_acceso,
                    u.created_at,
                    pe.dni,
                    pe.nombres,
                    pe.apellidos,
                    pe.email,
                    pe.telefono
             FROM usuarios u
             JOIN personas pe ON pe.id = u.persona_id
             ORDER BY u.rol, pe.apellidos, pe.nombres"
        )->fetchAll();
    }

    /**
     * Crea una persona y su usuario en una transacción atómica.
     * Lanza excepción si el DNI o email ya existen.
     * Devuelve el nuevo usuario_id.
     */
    public static function create(array $data): int {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            // 1. Insertar persona
            Database::query(
                "INSERT INTO personas (dni, nombres, apellidos, email, telefono)
                 VALUES (?, ?, ?, ?, ?)",
                [
                    trim($data['dni']),
                    trim($data['nombres']),
                    trim($data['apellidos']),
                    !empty($data['email'])    ? trim($data['email'])    : null,
                    !empty($data['telefono']) ? trim($data['telefono']) : null,
                ]
            );
            $personaId = (int) $pdo->lastInsertId();

            // 2. Insertar usuario (contraseña hasheada, fuerza cambio en primer login)
            Database::query(
                "INSERT INTO usuarios
                    (persona_id, password_hash, rol, debe_cambiar_password)
                 VALUES (?, ?, ?, 1)",
                [
                    $personaId,
                    password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]),
                    $data['rol'],
                ]
            );
            $usuarioId = (int) $pdo->lastInsertId();

            $pdo->commit();
            return $usuarioId;

        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Crea un usuario para una persona ya existente.
     * Devuelve el nuevo usuario_id.
     */
    public static function createForExistingPersona(int $personaId, string $password, string $rol): int {
        $pdo = Database::getInstance();
        Database::query(
            "INSERT INTO usuarios
                (persona_id, password_hash, rol, debe_cambiar_password)
             VALUES (?, ?, ?, 1)",
            [
                $personaId,
                password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
                $rol,
            ]
        );
        return (int) $pdo->lastInsertId();
    }

    /**
     * Cambia el rol de un usuario.
     */
    public static function updateRol(int $id, string $rol): bool {
        $stmt = Database::query(
            "UPDATE usuarios SET rol = ? WHERE id = ?",
            [$rol, $id]
        );
        return $stmt->rowCount() > 0;
    }

    /**
     * Activa o desactiva un usuario (alterna el valor actual).
     */
    public static function toggleActivo(int $id): bool {
        $stmt = Database::query(
            "UPDATE usuarios SET activo = NOT activo WHERE id = ?",
            [$id]
        );
        return $stmt->rowCount() > 0;
    }

    /**
     * Cambia la contraseña y limpia el flag debe_cambiar_password.
     */
    public static function cambiarPassword(int $id, string $nuevaPassword): void {
        Database::query(
            "UPDATE usuarios
             SET password_hash = ?, debe_cambiar_password = 0
             WHERE id = ?",
            [password_hash($nuevaPassword, PASSWORD_BCRYPT, ['cost' => 12]), $id]
        );
    }

    public static function findById(int $id): array|false {
        return Database::query(
            "SELECT u.id, u.persona_id, u.rol, u.activo, u.debe_cambiar_password,
                    pe.dni, pe.nombres, pe.apellidos, pe.email, pe.telefono
             FROM usuarios u
             JOIN personas pe ON pe.id = u.persona_id
             WHERE u.id = ?",
            [$id]
        )->fetch();
    }

    /**
     * Actualiza datos de persona y usuario (incluyendo password opcional).
     */
    public static function update(int $usuarioId, array $data): bool {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            $u = self::findById($usuarioId);
            if (!$u) return false;

            // 1. Actualizar persona
            Database::query(
                "UPDATE personas
                 SET dni = ?, nombres = ?, apellidos = ?, email = ?, telefono = ?
                 WHERE id = ?",
                [
                    trim($data['dni']),
                    trim($data['nombres']),
                    trim($data['apellidos']),
                    !empty($data['email'])    ? trim($data['email'])    : null,
                    !empty($data['telefono']) ? trim($data['telefono']) : null,
                    (int) $u['persona_id']
                ]
            );

            // 2. Actualizar usuario
            $fields = "rol = ?";
            $params = [$data['rol']];

            if (!empty($data['password'])) {
                $fields .= ", password_hash = ?, debe_cambiar_password = 1";
                $params[] = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
            }

            $params[] = $usuarioId;
            Database::query("UPDATE usuarios SET $fields WHERE id = ?", $params);

            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}

