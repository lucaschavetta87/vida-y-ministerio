-- ============================================================
--  Migración v11: salidas al ministerio en forma de planilla
--  - tipo:            TERRITORIO (default) o TELEFONICA (sin territorios)
--  - turno:           MANANA o TARDE
--  - es_nota:         la fila ocupa toda la línea (ej: FERIADO NACIONAL)
--  - conductor_texto: para freely written (ej: PRECURSORES, CARTAS)
--  - encabezado_imagen: data URL de la imagen del encabezado
--  Es idempotente: se puede correr más de una vez.
-- ============================================================

alter table public.salidas_ministerio
  add column if not exists tipo text not null default 'TERRITORIO'
    check (tipo in ('TERRITORIO','TELEFONICA'));

alter table public.salidas_ministerio
  add column if not exists turno text not null default 'MANANA'
    check (turno in ('MANANA','TARDE'));

-- fila a lo ancho de toda la planilla (feriados, notas del día)
alter table public.salidas_ministerio
  add column if not exists es_nota boolean not null default false;

-- conductor que no es una persona (ej: PRECURSORES, CARTAS)
alter table public.salidas_ministerio
  add column if not exists conductor_texto text;

-- imagen del encabezado (data URL) — se muestra a la derecha
alter table public.salidas_ministerio_config
  add column if not exists encabezado_imagen text;

comment on column public.salidas_ministerio.tipo is
  'TERRITORIO = salida de territorio · TELEFONICA = solo llamada (sin territorios).';
comment on column public.salidas_ministerio.turno is
  'MANANA o TARDE, para ordenar la planilla.';
comment on column public.salidas_ministerio.es_nota is
  'true = la fila se imprime a lo ancho (feriado, nota del día).';
comment on column public.salidas_ministerio.conductor_texto is
  'Conductor escrito a mano cuando no es una persona (PRECURSORES, CARTAS…).';
comment on column public.salidas_ministerio_config.encabezado_imagen is
  'data URL (base64) de la imagen que se imprime a la derecha del encabezado.';