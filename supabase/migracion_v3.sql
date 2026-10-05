-- ============================================================
-- VIDA Y MINISTERIO — MIGRACIÓN v3
-- (lector del Estudio bíblico de la congregación)
--
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- Idempotente: se puede pegar más de una vez sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) El Estudio bíblico de la congregación tiene DOS asignaciones:
--    el participante (que dirige) y el Lector (que lee).
--    Guardamos al Lector en su propia columna.
-- ------------------------------------------------------------
alter table reunion_partes
  add column if not exists lector_id uuid;

-- ------------------------------------------------------------
-- 2) Si se borra un participante, lo sacamos también del cargo
--    de Lector para no dejar ids huérfanos
-- ------------------------------------------------------------
create or replace function vm_limpiar_asignaciones() returns trigger as $$
begin
  update reunion_partes
     set participante_ids = array_remove(participante_ids, old.id),
         lector_id        = case when lector_id = old.id then null else lector_id end
   where old.id = any (participante_ids)
      or lector_id = old.id;
  return old;
end;
$$ language plpgsql;

-- (el trigger ya existe y sigue apuntando a esta misma función)

-- ------------------------------------------------------------
-- Listo. En la app debería verse:
--   · En el Estudio bíblico, debajo del participante, un campo
--     "Lector" para elegir quién lee.
--   · Ese Lector aparece en el PDF, debajo del tema.
-- ------------------------------------------------------------
