-- Migración: índice FULLTEXT para búsqueda de diagnósticos CIE-10
-- Ejecutar una sola vez en la base de datos del proyecto.
-- Requiere MySQL 5.6+ con InnoDB (soporta FULLTEXT desde esa versión).

ALTER TABLE cie10
    ADD FULLTEXT INDEX ft_cie10_descripcion (descripcion, descripcion_corta);
