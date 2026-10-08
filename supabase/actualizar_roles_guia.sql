-- ============================================================
-- VIDA Y MINISTERIO — ROLES DE LA GUÍA EN PDF
--
-- Pegar en: Supabase > SQL Editor > New query > Run
-- Idempotente: se puede pegar más de una vez sin romper nada.
--
-- Qué hace:
--   1) Los Micrófonos también los pueden pasar los niños (no las niñas).
--   2) Nuevo rol "Haga discípulos" (participan hombres, mujeres y niños).
--   3) Deja anotado que "Explique sus creencias" es un tema de Seamos
--      mejores maestros sin rol específico (se puede elegir en la app).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Micrófonos: hombres y niños
-- ------------------------------------------------------------
update roles
   set generos_permitidos = array['HOMBRE','NIÑO']::text[]
 where slug = 'microfonos';

-- ------------------------------------------------------------
-- 2) Rol nuevo: Haga discípulos
-- ------------------------------------------------------------
insert into roles (nombre, slug, orden, generos_permitidos, activo)
values (
  'Haga discípulos',
  'discipulos',
  8,
  array['HOMBRE','MUJER','NIÑO','NIÑA']::text[],
  true
)
on conflict (slug) do update
  set generos_permitidos = array['HOMBRE','MUJER','NIÑO','NIÑA']::text[],
      activo = true;

-- "¿Qué diría?" pasa después de "Haga discípulos"
update roles set orden = 9 where slug = 'que-diria';
update roles set orden = 10 where slug = 'discursos';
update roles set orden = 11 where slug = 'estudio';

-- ------------------------------------------------------------
-- Listo. En la app debería verse:
--   · En "Gestionar roles", "Haga discípulos" con los cuatro géneros.
--   · En la ficha de cada niño se puede tildar "Micrófonos".
--   · Al subir el PDF de la guía, los temas "Haga discípulos" ya
--     traen ese rol y el desplegable lista a los aprobados.
-- ============================================================
