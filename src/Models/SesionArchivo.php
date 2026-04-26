<?php
namespace Src\Models;

use Src\Core\Database;

class SesionArchivo {

    const TIPOS_PERMITIDOS = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
    ];
    const MAX_TAMANO_BYTES       = 10 * 1024 * 1024; // 10 MB
    const MAX_ARCHIVOS_POR_SESION = 5;

    private static function storagePath(): string {
        return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'sesiones' . DIRECTORY_SEPARATOR;
    }

    public static function subir(
        array $archivo,
        ?int  $sesionId,
        ?int  $sesionGrupoId,
        int   $subidoPor
    ): array|false {
        // 1. Validar tipo MIME
        if (!in_array($archivo['type'], self::TIPOS_PERMITIDOS, true)) {
            return false;
        }

        // 2. Validar tamaño
        if ($archivo['size'] > self::MAX_TAMANO_BYTES) {
            return false;
        }

        // 3. Validar cantidad máxima por sesión
        $count = (int) Database::query(
            "SELECT COUNT(*) FROM sesion_archivos WHERE sesion_id <=> ? AND sesion_grupo_id <=> ?",
            [$sesionId, $sesionGrupoId]
        )->fetchColumn();

        if ($count >= self::MAX_ARCHIVOS_POR_SESION) {
            return false;
        }

        // Generar nombre único y mover el archivo
        $ext          = strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION));
        $nombreGuardado = bin2hex(random_bytes(16)) . '.' . $ext;
        $destino      = self::storagePath() . $nombreGuardado;

        if (!move_uploaded_file($archivo['tmp_name'], $destino)) {
            return false;
        }

        // Insertar registro en BD
        Database::query(
            "INSERT INTO sesion_archivos
                (sesion_id, sesion_grupo_id, nombre_original, nombre_guardado, tipo_mime, tamano_bytes, subido_por)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $sesionId,
                $sesionGrupoId,
                $archivo['name'],
                $nombreGuardado,
                $archivo['type'],
                $archivo['size'],
                $subidoPor,
            ]
        );

        $id = (int) Database::getInstance()->lastInsertId();
        return self::findById($id);
    }

    public static function findBySesion(?int $sesionId, ?int $sesionGrupoId): array {
        return Database::query(
            "SELECT id, sesion_id, sesion_grupo_id, nombre_original, nombre_guardado,
                    tipo_mime, tamano_bytes, subido_por, created_at
             FROM sesion_archivos
             WHERE sesion_id <=> ? AND sesion_grupo_id <=> ?
             ORDER BY created_at ASC",
            [$sesionId, $sesionGrupoId]
        )->fetchAll();
    }

    public static function findById(int $id): array|false {
        return Database::query(
            "SELECT id, sesion_id, sesion_grupo_id, nombre_original, nombre_guardado,
                    tipo_mime, tamano_bytes, subido_por, created_at
             FROM sesion_archivos WHERE id = ?",
            [$id]
        )->fetch() ?: false;
    }

    public static function eliminar(int $id): bool {
        $registro = self::findById($id);
        if (!$registro) {
            return false;
        }

        $ruta = self::storagePath() . $registro['nombre_guardado'];
        if (file_exists($ruta)) {
            unlink($ruta);
        }

        Database::query("DELETE FROM sesion_archivos WHERE id = ?", [$id]);
        return true;
    }
}
