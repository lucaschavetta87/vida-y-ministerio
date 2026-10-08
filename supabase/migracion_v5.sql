-- ============================================================
-- VIDA Y MINISTERIO — Migración v5
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (es idempotente: se puede volver a ejecutar sin romper nada)
--
--  1) Asignaciones Mecánicas: "Audio y Video" deja de ser un solo
--     campo y pasan a ser dos personas: Audio y Video, por separado
--     (entre semana y fin de semana). El dato viejo NO se migra:
--     las columnas nuevas arrancan vacías.
--  2) Orden del cierre: "Palabras de conclusión" va antes que la
--     canción y la oración (en las semanas ya sincronizadas con el
--     PDF están al revés).
-- ============================================================

-- ------------------------------------------------------------
-- 1) AUDIO Y VIDEO POR SEPARADO (entre semana y fin de semana)
-- ------------------------------------------------------------
alter table reunion_asignaciones_mecanicas
  add column if not exists audio_id    uuid references participantes(id) on delete set null,
  add column if not exists video_id    uuid references participantes(id) on delete set null,
  add column if not exists audio_fs_id uuid references participantes(id) on delete set null,
  add column if not exists video_fs_id uuid references participantes(id) on delete set null;

comment on column reunion_asignaciones_mecanicas.audio_id is
  'Audio de la reunión de entre semana (antes estaba todo junto en audio_video_id).';
comment on column reunion_asignaciones_mecanicas.video_id is
  'Video de la reunión de entre semana.';
comment on column reunion_asignaciones_mecanicas.audio_fs_id is
  'Audio de la reunión de fin de semana.';
comment on column reunion_asignaciones_mecanicas.video_fs_id is
  'Video de la reunión de fin de semana.';

-- Las columnas viejas (audio_video_id / audio_video_fs_id) ya no se
-- usan ni se copian: quedan sin tocar. Si preferís que no quede nada
-- guardado ahí, descomentá:
--
-- update reunion_asignaciones_mecanicas
--    set audio_video_id = null, audio_video_fs_id = null;

-- ------------------------------------------------------------
-- 2) ORDEN DEL CIERRE: primero las palabras de conclusión y
--    después la canción y la oración.
--    Solo cambia los dos `orden` de cada reunión, y solo si están
--    al revés (en las creadas desde la plantilla ya están bien).
-- ------------------------------------------------------------
with par as (
  select c.reunion_id,
         min(c.id) filter (where c.titulo ilike 'palabras de conclusi%') as id_concl,
         min(c.orden) filter (where c.titulo ilike 'palabras de conclusi%') as ord_concl,
         min(c.id) filter (where c.titulo ~* 'canci|oraci') as id_cancion,
         min(c.orden) filter (where c.titulo ~* 'canci|oraci') as ord_cancion
    from reunion_partes c
   where c.seccion = 'CIERRE'
   group by c.reunion_id
  having count(*) filter (where c.titulo ilike 'palabras de conclusi%') = 1
     and count(*) filter (where c.titulo ~* 'canci|oraci') = 1
)
update reunion_partes p
   set orden = case
         when p.id = par.id_concl then par.ord_cancion
         else par.ord_concl
       end
  from par
 where par.id_concl is not null
   and par.id_cancion is not null
   and par.ord_concl > par.ord_cancion
   and p.id in (par.id_concl, par.id_cancion);
