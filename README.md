# vida-y-ministerio

Webapp interna de la congregación para armar la reunión **Vida y Ministerio**:
participantes, roles y la asignación de personas a cada parte de la guía.

## Qué hace

- **Participantes**: alta/baja, datos básicos, parentesco con un mayor ya cargado
  y roles tildados por persona (géneros `HOMBRE`/`MUJER`/`NIÑO`/`NIÑA`; los niños
  van sin roles).
- **Reunión**: la guía de la semana **copiada del PDF** que trae la reunión de
  dos meses (títulos, duraciones, canciones, párrafos e ilustraciones). El botón
  «Subir PDF» crea todas las semanas del archivo de una.
- **Asignaciones**: una sola persona por parte; en **Lectura de la Biblia** y
  **Seamos mejores maestros** van **Titular** y **Ayudante**, con un botón **+**
  para agregar un acompañante más. En cada desplegable se ve la última vez que
  participó cada persona y de qué tema; un atajo **Presidente** arriba que llena *Palabras de
  introducción* y *Palabras de conclusión*; en el **Estudio bíblico de la
  congregación**, debajo del participante, un **Lector**.
- **Historial**: en el desplegable de cada parte se ve la última participación
  ("Últ. … · hace X" o "Nunca participó"), ordenado por quien hace más tiempo
  sin participar.
- **Asignaciones Mecánicas**: por tarea solo se listan los que ya tienen ese rol
  aprobado en su ficha. Si alguien ya tiene un tema en la reunión de la semana
  aparece avisado (se puede poner igual). Acomodadores, microfónistas, audio y
  video, plataforma y limpieza se repiten de entre semana a fin de semana con el
  botón **Repetir de entre semana**.
- **PDF**: vista imprimible con el estilo de la guía (subtítulos con su color,
  un tema debajo del otro, duración y participantes, sin imágenes) →
  *Guardar como PDF*.
- **Informes de actividad**: formulario público en **`/informes`** (sin usuario y
  contraseña, es la única parte abierta de la web) para que cada publicador mande
  su informe del mes anterior. Se escribe **una parte del nombre** —sin acentos,
  sin el apellido completo, en cualquier orden— y el servidor devuelve las 4
  coincidencias más parecidas (la lista de la congregación nunca se muestra).
  Según el caso pide: horas del mes (precursor), **meta de 15 o 30 + las horas
  reales** (auxiliar, que pueden no coincidir con la meta) o si participó
  (publicador), más estudios bíblicos y observaciones. Un informe por persona y
  por mes: si ya envió, no puede reenviar y la Secretaría lo corrige. Solo
  aparecen los tildados como **Es publicador** en su ficha (por defecto todos
  están tildados; los que no informan se destildan y quedan afuera).
- **Secretaría**: en `/secretaria` (con usuario y contraseña) hay dos pestañas.
  - **Informes**: los informes del mes, agrupados en precursores, auxiliares y
    publicadores, con las horas, los estudios y las observaciones de cada uno; la
    lista de quienes **faltan enviar** con buscador, y botones para **cargar**,
    **editar** o **borrar** cualquier informe. El mes siempre es el anterior al
    actual (se puede cambiar para ver el historial).
    - **Cargado en verde**: marca para quienes ya cargaron su informe en la otra
      web (queda solo la marca, sin datos; esos meses no cuentan como faltantes).
    - **Cerrar el mes**: deja de pedir los que faltan y deja auditable el mes. No
      borra nada; se puede reabrir.
  - **Asistencias a las reuniones**: lista cada día con auditorio, zoom y el
    total (que se suma solo), con resumen del mes, cierre de mes y PDF.
- **Formulario de acomodadores**: público en **`/asistencia`**, igual que el de
  informes se busca el nombre y solo quien tiene la asignación de **Acomodador**
  puede pasar. Carga el **día de la reunión** y los asistentes en **auditorio**
  y **Zoom**; el total se calcula solo.
- **Participantes**: además del buscador hay filtros **INACTIVOS** (los dados de
  baja) e **IRREGULARES** (publicadores sin informe del mes anterior).
- **Actividad del Año** (en la ficha de cada participante): mes a mes, con horas,
  estudios y observaciones, botón **Editar/Cargar** de cada mes, resumen del año y
  un cartel **IRREGULAR** si no informó el último mes, con botones para pasarlo a
  **inactivo** o reactivarlo.
- **PDF de auditoría**: `/secretaria/informes/pdf` lista toda la congregación
  ordenada por apellido, con una columna por mes, totales y estado
  (irregular/al día) → *Imprimir / Guardar como PDF*.

## Stack

Next.js 16 (App Router + `proxy.ts`) · React · Tailwind v4 · Supabase (Postgres
con RLS). Login con una única cuenta guardada en `.env.local`:

```
APP_USER=este
APP_PASSWORD=1914
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Base de datos

- `supabase/schema.sql` — esquema completo de referencia.
- `supabase/migracion_v2.sql` — `participante_ids uuid[]` (multi‑participante) +
  `reuniones.wol_doc_id` / `sincronizado_en`.
- `supabase/migracion_v3.sql` — `reunion_partes.lector_id` (Lector del estudio).
- `supabase/actualizar_roles_guia.sql` — Micrófonos habilita a los niños y crea el
  rol «Haga discípulos» (los temas que trae el PDF).
- `supabase/informes.sql` — tabla `informes` (uno por persona y mes) + vista
  `vw_informes`.
- `supabase/informes_ampliacion.sql` — `informes.horas_meta` (meta 15/30 del
  auxiliar), tabla `marcas_informe` (cargado en otra web) y `informes_meses`
  (meses cerrados).
- `supabase/migracion_v4.sql` — `participantes.es_publicador` (quién llena el
  informe, por defecto todos tildados), tablas `asistencias` y
  `asistencias_meses`, y el rol «Acomodador» para `/asistencia`.

Se pegan en **Supabase → SQL Editor → Run**; son idempotentes.

## Rutas

| Ruta | Acceso | Para qué |
| --- | --- | --- |
| `/informes` | público | mandar el informe de actividad del mes |
| `/asistencia` | público (acomodadores) | cargar la asistencia de un día |
| `/` | con sesión | inicio (o login) |
| `/participantes` | con sesión | fichas y roles |
| `/reunion` | con sesión | armar la reunión |
| `/asignaciones-mecanicas` | con sesión | tareas mecánicas |
| `/secretaria` | con sesión | informes y asistencias del mes |
| `/secretaria/informes/pdf` | con sesión | PDF de auditoría del año |
| `/secretaria/asistencias/pdf/[mes]` | con sesión | PDF de asistencias del mes |

Lo protege `proxy.ts` (si no hay sesión, vuelve a `/`). El formulario público usa
los endpoints `/api/informes` desde el servidor: nunca expone la llave de Supabase
ni devuelve la lista de participantes.

## PDF de la guía

La app lee la guía en PDF (el archivo `mwb_...pdf` que trae dos meses de
reuniones) en el navegador, con `pdfjs-dist`:

- `lib/leer-pdf.ts` — saca el texto con posición, las fuentes (para saber qué
  va en negrita) y los rectángulos de las ilustraciones.
- `lib/pdf.ts` — arma las semanas: fechas, cita bíblica, secciones, temas,
  duraciones, párrafos e imágenes.

Para probarlo sin subir nada:

```bash
npm run probar:guia -- ruta/al/archivo.pdf
```

## Correr

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```
