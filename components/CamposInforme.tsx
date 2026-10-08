"use client";

import { Check } from "lucide-react";
import { Campo, Input, Select, Textarea } from "@/components/ui";
import {
  BORRADOR_VACIO,
  HORAS_AUXILIAR,
  TIPOS_INFORME,
  type BorradorFormulario,
  type Coincidencia,
  type ErroresInforme,
  type TipoInforme,
} from "@/lib/informes";

import { cn } from "@/lib/utils";

export { BORRADOR_VACIO };

interface Props {
  borrador: BorradorFormulario;
  onChange: (borrador: BorradorFormulario) => void;
  errores?: ErroresInforme;
  persona?: Coincidencia | null;
  deshabilitado?: boolean;
}

function Opcion({
  elegida,
  titulo,
  detalle,
  onClick,
  deshabilitado,
}: {
  elegida: boolean;
  titulo: string;
  detalle?: string;
  onClick: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={elegida}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        elegida
          ? "border-teal bg-teal/5"
          : "border-linea bg-tarjeta2 hover:border-borde",
        deshabilitado && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2",
          elegida ? "border-teal bg-teal" : "border-borde",
        )}
      >
        {elegida && <Check size={11} strokeWidth={4} className="text-white" />}
      </span>
      <span>
        <span className="block text-sm font-bold text-texto">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-xs text-suave">{detalle}</span>}
      </span>
    </button>
  );
}

export default function CamposInforme({
  borrador,
  onChange,
  errores,
  persona,
  deshabilitado,
}: Props) {
  const set = (cambio: Partial<BorradorFormulario>) => onChange({ ...borrador, ...cambio });

  const elegirTipo = (tipo: TipoInforme) => {
    if (tipo === borrador.tipo) return;
    // al cambiar de tipo se limpian los campos que no corresponden
    set({ tipo, horas: null, horas_meta: tipo === "AUXILIAR" ? borrador.horas_meta : null, participo: null });
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="mb-2 block text-[11px] font-bold tracking-widest text-suave uppercase">
          ¿Cómo fue tu mes?
        </span>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {TIPOS_INFORME.map(({ valor, texto }) => (
            <Opcion
              key={valor}
              elegida={borrador.tipo === valor}
              titulo={texto}
              detalle={
                valor === "PRECURSOR"
                  ? "Reportás las horas del mes"
                  : valor === "AUXILIAR"
                    ? "Reportás la meta y las horas"
                    : "Contás si participaste"
              }
              onClick={() => elegirTipo(valor)}
              deshabilitado={deshabilitado}
            />
          ))}
        </div>
        {persona?.clasificacion === "PRECURSOR_REGULAR" ||
        persona?.clasificacion === "PRECURSOR_ESPECIAL" ? (
          <p className="mt-2 text-xs text-suave">
            Según tu ficha sos {persona.clasificacion === "PRECURSOR_REGULAR" ? "Precursor Regular" : "Precursor Especial"}.
            Si este mes no fuiste precursor, elegí la opción que corresponda.
          </p>
        ) : null}
        {errores?.tipo && <p className="mt-2 text-sm font-semibold text-rojo">{errores.tipo}</p>}
      </div>

      {borrador.tipo === "PRECURSOR" && (
        <Campo label="Horas que hiciste este mes" hint="Ej: 70">
          <Input
            type="number"
            min={0}
            max={999}
            inputMode="numeric"
            value={borrador.horas ?? ""}
            onChange={(e) => set({ horas: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="0"
            disabled={deshabilitado}
          />
          {errores?.horas && (
            <span className="mt-1 block text-xs font-semibold text-rojo">{errores.horas}</span>
          )}
        </Campo>
      )}

      {borrador.tipo === "AUXILIAR" && (
        <>
          <Campo label="¿A qué meta llegaste?" hint="La meta de auxiliar es de 15 o de 30 horas.">
            <Select
              value={borrador.horas_meta ?? ""}
              onChange={(e) =>
                set({ horas_meta: e.target.value === "" ? null : Number(e.target.value) })
              }
              disabled={deshabilitado}
            >
              <option value="">Elegí...</option>
              {HORAS_AUXILIAR.map((h) => (
                <option key={h} value={h}>
                  Meta de {h} horas
                </option>
              ))}
            </Select>
            {errores?.horas_meta && (
              <span className="mt-1 block text-xs font-semibold text-rojo">
                {errores.horas_meta}
              </span>
            )}
          </Campo>

          <Campo
            label="Horas que hiciste este mes"
            hint="Escribí las horas que hiciste de verdad, pueden ser más o menos que la meta."
          >
            <Input
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              value={borrador.horas ?? ""}
              onChange={(e) =>
                set({ horas: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="Ej: 22"
              disabled={deshabilitado}
            />
            {errores?.horas && (
              <span className="mt-1 block text-xs font-semibold text-rojo">{errores.horas}</span>
            )}
          </Campo>
        </>
      )}

      {borrador.tipo === "PUBLICADOR" && (
        <div>
          <span className="mb-2 block text-[11px] font-bold tracking-widest text-suave uppercase">
            ¿Participaste en la reunión este mes?
          </span>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Opcion
              elegida={borrador.participo === true}
              titulo="Sí participé"
              onClick={() => set({ participo: true })}
              deshabilitado={deshabilitado}
            />
            <Opcion
              elegida={borrador.participo === false}
              titulo="No participé"
              onClick={() => set({ participo: false })}
              deshabilitado={deshabilitado}
            />
          </div>
          {errores?.participo && (
            <p className="mt-2 text-sm font-semibold text-rojo">{errores.participo}</p>
          )}
        </div>
      )}

      <Campo label="Estudios bíblicos que reportaste" hint="Todos pueden reportar estudios. Si no tuviste, escribí 0.">
        <Input
          type="number"
          min={0}
          max={999}
          inputMode="numeric"
          value={borrador.estudios_biblicos ?? ""}
          onChange={(e) =>
            set({ estudios_biblicos: e.target.value === "" ? 0 : Number(e.target.value) })
          }
          disabled={deshabilitado}
        />
        {errores?.estudios_biblicos && (
          <span className="mt-1 block text-xs font-semibold text-rojo">
            {errores.estudios_biblicos}
          </span>
        )}
      </Campo>

      <Campo label="Observaciones" hint="Si necesitás escribir algo, podés hacerlo acá.">
        <Textarea
          rows={3}
          value={borrador.observaciones ?? ""}
          onChange={(e) => set({ observaciones: e.target.value })}
          placeholder="Ej: no pude_predicar por salud."
          disabled={deshabilitado}
        />
        {errores?.observaciones && (
          <span className="mt-1 block text-xs font-semibold text-rojo">
            {errores.observaciones}
          </span>
        )}
      </Campo>
    </div>
  );
}

