-- ============================================================
-- VIDA Y MINISTERIO — Cargar la asistencia del S-88 a mano
-- Pegar en: Supabase > SQL Editor > New query > Run
-- DESPUÉS de correr migracion_v9.sql.
--
-- Son los meses que en la app no se cargaron reunión por reunión:
--   · el año de servicio 2025/2026 (el S-88 lo llama "2026")
--   · septiembre de 2026, del año de servicio en curso ("2027")
--
-- El promedio NO se carga: la app lo calcula como
-- total ÷ reuniones, igual que el S-88.
--
-- Para corregir un valor, cambiá las dos columnas y volvé a
-- pegar este script (el on conflict lo actualiza), o mejor,
-- corregilo desde la app en Secretaría > Asistencias.
-- ============================================================

insert into asistencias_resumen (mes, tipo, reuniones, total) values
  -- =========================================================
  -- AÑO DE SERVICIO 2025/2026 (sept 2025 → ago 2026)
  -- =========================================================
  ('2025-12', 'entre-semana', 4, 402),
  ('2025-12', 'fin-de-semana', 4, 401),
  ('2026-01', 'entre-semana', 4, 379),
  ('2026-01', 'fin-de-semana', 4, 318),
  ('2026-02', 'entre-semana', 4, 347),
  ('2026-02', 'fin-de-semana', 4, 346),
  ('2026-03', 'entre-semana', 3, 279),
  ('2026-03', 'fin-de-semana', 4, 376),
  ('2026-04', 'entre-semana', 3, 291),
  ('2026-04', 'fin-de-semana', 3, 277),
  ('2026-05', 'entre-semana', 4, 393),
  ('2026-05', 'fin-de-semana', 5, 484),
  ('2026-06', 'entre-semana', 4, 353),
  ('2026-06', 'fin-de-semana', 4, 333),
  ('2026-07', 'entre-semana', 4, 389),
  ('2026-07', 'fin-de-semana', 3, 259),
  ('2026-08', 'entre-semana', 4, 385),
  ('2026-08', 'fin-de-semana', 5, 420),

  -- =========================================================
  -- AÑO DE SERVICIO 2026/2027 (en curso) — septiembre
  -- (octubre ya se carga reunión por reunión desde la app)
  -- =========================================================
  ('2026-09', 'entre-semana', 5, 448),
  ('2026-09', 'fin-de-semana', 4, 319)

on conflict (mes, tipo) do update
   set reuniones      = excluded.reuniones,
       total          = excluded.total,
       actualizado_en = now();

-- ------------------------------------------------------------
-- Cómo debería quedar (comparar con el S-88):
--
-- Entre semana 2025/2026 → promedio de asistencia mensual 94.67
-- Fin de semana  2025/2026 → promedio de asistencia mensual 89.22
--
-- select tipo, round(avg(promedio)::numeric, 2) as promedio_mensual
--   from (
--     select r.tipo, r.mes, r.total::numeric / nullif(r.reuniones, 0) as promedio
--       from asistencias_resumen r
--      where r.mes between '2025-09' and '2026-08'
--   ) t
--  where promedio is not null
--  group by tipo;
-- =========================================================