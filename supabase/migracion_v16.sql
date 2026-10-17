-- ------------------------------------------------------------
-- Rol nuevo: discursos de Seamos mejores maestros
-- Lo pueden dar cualquier hombre, sin importar si es anciano,
-- ministerial o publicador.
-- En la ficha de cada persona se tilda; el buscador de la reunión
-- propone solo los que la tienen.
-- ------------------------------------------------------------
insert into roles (nombre, slug, orden, generos_permitidos, activo)
values (
  'Discursos de Seamos mejores maestros',
  'discursos_seamos',
  11,
  array['HOMBRE']::text[],
  true
)
on conflict (slug) do update
  set nombre = 'Discursos de Seamos mejores maestros',
      generos_permitidos = array['HOMBRE']::text[],
      activo = true;

-- ------------------------------------------------------------
-- Listo. En la app:
--   · En la ficha de todo hombre aparece la casilla nueva.
--   · Los temas "Discurso" de Seamos mejores maestros ya traen ese
--     rol, así que el buscador lista solo los que lo tienen.