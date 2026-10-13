"use client";

import { useState } from "react";
import { Loader2, Save, Trash2, X } from "lucide-react";
import CamposInforme from "@/components/CamposInforme";
import { Boton, Campo, Etiqueta, Panel, Select } from "@/components/ui";
import {
  BORRADOR_VACIO,
  etiquetaMes,
  validarInforme,
  type BorradorFormulario,
  type BorradorInforme,
  type ErroresInforme,
  type Informe,
} from "@/lib/informes";
import { textoClasificacion, type Participante } from "@/lib/tipos";

interface Props {
  participantes: Participante[];
  participanteId: string;
  informe: Informe | null;
  /** false cuando se edita desde la ficha de esa misma persona */
  mostrarSelector?: boolean;
  /** mes que se está cargando (YYYY-MM), cuando todavía no hay informe */
  mes?: string;
  onCambiarPersona: (id: string) => void;
  onCancelar: () => void;
  onGuardar: (borrador: BorradorInforme) => Promise<void>;
  onEliminar: () => Promise<void>;
  guardando: boolean;
}

function aBorrador(informe: Informe | null): BorradorFormulario {
  if (!informe) return BORRADOR_VACIO;
  return {
    tipo: informe.tipo,
    horas: informe.horas,
    horas_meta: informe.horas_meta,
    participo: informe.participo,
    estudios_biblicos: informe.estudios_biblicos,
    observaciones: informe.observaciones,
  };
}

export default function EditorInforme({
  participantes,
  participanteId,
  informe,
  mostrarSelector = true,
  mes,
  onCambiarPersona,
  onCancelar,
  onGuardar,
  onEliminar,
  guardando,
}: Props) {
  const [borrador, setBorrador] = useState<BorradorFormulario>(aBorrador(informe));
  const [errores, setErrores] = useState<ErroresInforme>({});
  const [aviso, setAviso] = useState("");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const persona = participantes.find((p) => p.id === participanteId) || null;

  const cambiar = (nuevo: BorradorFormulario) => {
    setBorrador(nuevo);
    setErrores({});
  };

  const guardar = async () => {
    setAviso("");
    const validado = validarInforme(borrador);
    if ("errores" in validado) {
      setErrores(validado.errores);
      return;
    }
    await onGuardar(validado.datos);
  };

  const eliminar = async () => {
    if (!confirmandoBorrado) {
      setConfirmandoBorrado(true);
      return;
    }
    await onEliminar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-texto/40 p-4 backdrop-blur-sm">
      <Panel className="my-6 w-full max-w-2xl p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">
              {informe ? "Editar informe" : "Cargar informe"}
            </h2>
            <p className="text-xs text-suave">
              {informe
                ? `${etiquetaMes(informe.mes)} · ${informe.origen === "formulario" ? "lo cargó la persona" : "cargado por Secretaría"}`
                : mes
                  ? `${etiquetaMes(mes)} · cargá el informe a mano (la persona no lo envió)`
                  : "Cargá el informe a mano (la persona no lo envió)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="cursor-pointer rounded-lg p-1.5 text-suave transition-colors hover:bg-tarjeta2 hover:text-texto"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {mostrarSelector ? (
            <Campo label="Participante">
              <Select
                value={participanteId}
                onChange={(e) => onCambiarPersona(e.target.value)}
                disabled={Boolean(informe)}
              >
                {participantes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_completo}
                  </option>
                ))}
              </Select>
            </Campo>
          ) : (
            <p className="text-sm font-bold">{persona?.nombre_completo || "Participante"}</p>
          )}

          {(persona?.clasificacion || []).length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] tracking-widest text-suave uppercase">Ficha:</span>
              {persona!.clasificacion!.map((c) => (
                <Etiqueta key={c} tono="teal">
                  {textoClasificacion(c)}
                </Etiqueta>
              ))}
            </span>
          )}

          <CamposInforme
            borrador={borrador}
            onChange={cambiar}
            errores={errores}
            persona={
              persona
                ? {
                    id: persona.id,
                    nombre: persona.nombre_completo,
                    genero: persona.genero,
                    edad: persona.edad,
                    clasificacion: persona.clasificacion,
                    puntaje: 100,
                  }
                : null
            }
          />

          {aviso && <p className="text-sm font-semibold text-rojo">{aviso}</p>}

          <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-4">
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar informe
            </Boton>
            <Boton variante="secundario" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </Boton>
            {informe && (
              <Boton variante="peligro" onClick={eliminar} disabled={guardando} className="ml-auto">
                <Trash2 size={16} />
                {confirmandoBorrado ? "¿Seguro? Tocá otra vez" : "Borrar informe"}
              </Boton>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
