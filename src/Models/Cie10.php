<?php
namespace Src\Models;

use Src\Core\Database;

class Cie10 {

    /**
     * Búsqueda FULLTEXT en descripcion y descripcion_corta.
     * Solo devuelve niveles >= 3 (categorías y subcategorías).
     * El término se convierte a BOOLEAN MODE con prefijo + y wildcard *.
     */
    public static function buscar(string $q): array {
        $q = trim($q);
        if ($q === '') return [];

        // Limpiar operadores especiales de BOOLEAN MODE para evitar errores de sintaxis
        $q = preg_replace('/[+\-><\(\)~"@]+/', ' ', $q);
        $words = array_values(array_filter(array_map('trim', explode(' ', $q))));
        if (empty($words)) return [];

        // Cada palabra: obligatoria (+) y con prefijo (*) para coincidencia parcial
        $boolQ = implode(' ', array_map(fn(string $w): string => '+' . $w . '*', $words));

        return Database::query(
            "SELECT codigo, descripcion_corta, descripcion
             FROM cie10
             WHERE nivel >= 3
               AND MATCH(descripcion, descripcion_corta) AGAINST(? IN BOOLEAN MODE)
             LIMIT 10",
            [$boolQ]
        )->fetchAll();
    }
}
