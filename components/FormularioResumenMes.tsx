"use client";

import { useState } from "react";
import { Hand, Loader2, Trash2 } from "lucide-react";
import { Boton, Campo, Etiqueta, Input, Select } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import {
  TIPOS_REUNION,
  etiquetaTipo,
  numeroPromedio,
  validarResumen,
  type ErroresResumen,
  type ResumenManual,
  type TipoReunion,
} from "@/lib/asistencia";
import { MESES, etiquetaMes } from "@/lib/informes";

/**
 * Carga (o corrección) de un mes completo de asistencia, para los meses que
 * no se cargaron reunión por reunión. El promedio se calcula solo.
 *
 * Si cambian `resumen`/`mesPorDefecto`, el que lo usa debe cambiar la `key`
 * para que el formulario se vuelva a armar con los valores nuevos.
 */
export default function FormularioResumenMes({
  mesPorDefecto,
  tipoPorDefecto,
  resumen,
  onGuardado,
  onCancelar,
  compacto = false,
}: {
  /** Mes que viene elegido en la pantalla. */
  mesPorDefecto: string;
  tipoPorDefecto?: TipoReunion;
  /** Si viene, se está corrigiendo ese resumen. */
  resumen?: ResumenManual | null;
  onGuardado: () => Promise<void> | void;
  onCancelar?: () => void;
  /** Versión chica, para abrirla sobre la lista del año. */
  compacto?: boolean;
}) {
  const [mes, setMes] = useState(resumen?.mes || mesPorDefecto);
  const [tipo, setTipo] = useState<TipoReunion>(resumen?.tipo || tipoPorDefecto || "entre-semana");
  const [reuniones, setReuniones] = useState(resumen ? String(resumen.reuniones) : "");
  const [total, setTotal] = useState(resumen ? String(resumen.total) : "");
  const [errores, setErrores] = useState<ErroresResumen>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  /** Lo que se ve mientras escribe, sin validar. */
  const promedio = promedioEnVivo(reuniones, total);

  const guardar = async () => {
    const validado = validarResumen({ mes, tipo, reuniones, total });
    if ("errores" in validado) {
      setErrores(validado.errores);
      return;
    }
    setErrores({});
    setGuardando(true);
    const respuesta = await supabase
      .from("asistencias_resumen")
      .upsert({ ...validado.datos, actualizado_en: new Date().toISOString() }, { onConflict: "mes,tipo" });
    setGuardando(false);
    if (respuesta.error) {
      setAviso(
        respuesta.error.message.includes("asistencias_resumen")
          ? `No se pudo guardar: falta la tabla. Pegá supabase/migracion_v9.sql en Supabase.`
          : `No se pudo guardar: ${respuesta.error.message}`,
      );
      return;
    }
    await onGuardado();
  };

  const borrar = async () => {
    if (!resumen) return;
    if (!window.confirm(`¿Borrar el resumen a mano de ${etiquetaTipo(resumen.tipo)} de ${etiquetaMes(resumen.mes)}?\n\nEse mes vuelve a calcularse con las cargas día por día.`))
      return;
    setGuardando(true);
    const respuesta = await supabase
      .from("asistencias_resumen")
      .delete()
      .eq("mes", resumen.mes)
      .eq("tipo", resumen.tipo);
    setGuardando(false);
    if (respuesta.error) {
      setAviso(`No se pudo borrar: ${respuesta.error.message}`);
      return;
    }
    await onGuardado();
  };

  return (
    <div className={compacto ? "" : "flex flex-col gap-4"}>
      {!compacto && (
        <p className="text-sm text-suave">
          Para los meses que no se cargaron reunión por reunión. Se anota cuántas reuniones hubo y
          la asistencia total; el <strong>promedio se calcula solo</strong> (total ÷ reuniones), igual
          que en el S-88.
        </p>
      )}

      {aviso && (
        <p className="rounded-xl border border-rojo/40 bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {aviso}
        </p>
      )}

      <div className={compacto ? "grid gap-3" : "grid gap-4 sm:grid-cols-2"}>
        <Campo label="Mes">
          <Select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Elegir mes…</option>
            {MESES_DEL_ANIO.map((m) => (
              <option key={m.clave} value={m.clave}>
                {m.etiqueta}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Tipo de reunión">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoReunion)}>
            {TIPOS_REUNION.map((t) => (
              <option key={t} value={t}>
                {etiquetaTipo(t)}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Número de reuniones">
          <Input
            type="number"
            min={0}
            value={reuniones}
            onChange={(e) => setReuniones(e.target.value)}
            placeholder="Ej: 4"
          />
        </Campo>
        <Campo label="Asistencia total del mes">
          <Input
            type="number"
            min={0}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="Ej: 402"
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-3">
        <Etiqueta tono="teal">
          Promedio: {promedio === null ? "—" : numeroPromedio(promedio)}
        </Etiqueta>
        <div className="flex flex-wrap gap-2">
          {resumen && (
            <Boton variante="peligro" onClick={borrar} disabled={guardando}>
              <Trash2 size={15} /> Borrar
            </Boton>
          )}
          {onCancelar && (
            <Boton variante="fantasma" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </Boton>
          )}
          <Boton onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Hand size={15} />}
            {resumen ? "Guardar cambios" : "Guardar resumen"}
          </Boton>
        </div>
      </div>

      {(errores.mes || errores.tipo || errores.reuniones || errores.total) && (
        <div className="space-y-1 text-xs text-rojo">
          {errores.mes && <p>{errores.mes}</p>}
          {errores.tipo && <p>{errores.tipo}</p>}
          {errores.reuniones && <p>{errores.reuniones}</p>}
          {errores.total && <p>{errores.total}</p>}
        </div>
      )}
    </div>
  );
}

/** 12 meses hacia atrás desde hoy, para elegir el del resumen. */
const MESES_DEL_ANIO = (() => {
  const lista: { clave: string; etiqueta: string }[] = [];
  const hoy = new Date();
  let a = hoy.getFullYear();
  let m = hoy.getMonth();
  for (let i = 0; i < 24; i += 1) {
    lista.push({
      clave: `${a}-${String(m + 1).padStart(2, "0")}`,
      etiqueta: `${MESES[m]} de ${a}`,
    });
    m -= 1;
    if (m < 0) {
      m = 11;
      a -= 1;
    }
  }
  return lista;
})();

/** promedio que se ve mientras se escribe (sin validar). */
function promedioEnVivo(reuniones: string, total: string): number | null {
  const r = Number(reuniones);
  const t = Number(total);
  if (
    reuniones === "" ||
    total === "" ||
    !Number.isInteger(r) ||
    !Number.isInteger(t) ||
    r <= 0 ||
    t < 0
  ) {
    return null;
  }
  return Math.round((t / r) * 100) / 100;
}
