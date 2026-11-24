-- Migración v18: archivos de salida por semana/mes
create table if not exists salidas_archivos (
  clave text primary key,
  archivo_url text not null,
  registrado_por uuid references participantes(id) on delete set null,
  actualizado_en timestamptz not null default now()
);

alter table salidas_archivos enable row level security;
drop policy if exists p_all on salidas_archivos;
create policy p_all on salidas_archivos for all using (true) with check (true);