-- ============================================================
-- VIDA Y MINISTERIO — Ampliación de informes
-- Pegar en: Supabase > SQL Editor > New query > Run
-- (se puede volver a ejecutar: no rompe nada)
--
--  1) horas_meta: el auxiliar marca a qué meta llegó (15 o 30)
--     y aparte reporta las horas reales, que pueden variar.
--  2) marcas_informe: los que ya cargan su informe en otra web
--     (solo queda la marca en verde, sin datos).
--  3) informes_meses: meses cerrados por la Secretaría
--     (nada se borra, solo dejan de pedirse).
-- ============================================================

-- ------------------------------------------------------------
-- 1) HORAS REALES DEL AUXILIAR
-- ------------------------------------------------------------
alter table informes
  add column if not exists horas_meta integer check (horas_meta in (15, 30));

comment on column informes.horas_meta is
  'Auxiliar: meta alcanzada (15 o 30). Las horas reales van en informes.horas.';

-- ------------------------------------------------------------
-- 2) MARCA DE "YA CARGADO EN OTRA WEB" (por persona y mes)
-- ------------------------------------------------------------
create table if not exists marcas_informe (
  participante_id uuid not null references participantes(id) on delete cascade,
  mes             text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  creado_en       timestamptz not null default now(),
  primary key (participante_id, mes)
);

-- ------------------------------------------------------------
-- 3) MESES CERRADOS POR LA SECRETARÍA
-- ------------------------------------------------------------
create table if not exists informes_meses (
  mes       text primary key check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cerrado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) RLS (acceso anónimo, igual que el resto del proyecto)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['marcas_informe', 'informes_meses'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists p_all on %I', t);
    execute format('create policy p_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;
