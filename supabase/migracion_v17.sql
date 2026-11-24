-- Migración v17: auditoría de quién carga asistencias/salidas
alter table territorios_salidas
  add column if not exists registrado_por uuid references participantes(id) on delete set null;

alter table salidas_ministerio
  add column if not exists registrado_por uuid references participantes(id) on delete set null;

create index if not exists idx_territorios_salidas_registrado on territorios_salidas (registrado_por);
create index if not exists idx_salidas_ministerio_registrado on salidas_ministerio (registrado_por);