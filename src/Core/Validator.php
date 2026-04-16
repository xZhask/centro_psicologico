<?php
namespace Src\Core;

class Validator {

    /**
     * Verifica que todos los campos requeridos existan y no sean vacíos en $data.
     *
     * @param  array    $data    Datos recibidos del request (json/POST).
     * @param  string[] $campos  Nombres de los campos obligatorios.
     * @throws \InvalidArgumentException  Lista de campos faltantes.
     */
    public static function required(array $data, array $campos): void {
        $faltantes = [];

        foreach ($campos as $campo) {
            $valor = $data[$campo] ?? null;
            if ($valor === null || $valor === '') {
                $faltantes[] = $campo;
            }
        }

        if (!empty($faltantes)) {
            throw new \InvalidArgumentException(
                'Campos requeridos faltantes: ' . implode(', ', $faltantes)
            );
        }
    }
}
