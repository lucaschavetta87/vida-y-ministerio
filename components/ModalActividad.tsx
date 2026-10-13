"use client";

import { useState } from "react";
import { Pencil, Eye } from "lucide-react";
import ActividadDelAnio from "@/components/ActividadDelAnio";
import { Boton, Modal } from "@/components/ui";
import type { Participante } from "@/lib/tipos";

/**
 * Modal con el año de servicio de una persona. Arriba abre en modo ver;
 * con "Editar actividad" se puede corregir mes por mes sin salir del modal.
 */
export default function ModalActividad({
  participante,
  onCerrar,
  onCambiarActivo,
  onCambiarInforme,
  accionExtra,
}: {
  participante: Participante;
  onCerrar: () => void;
  /** Refleja el cambio de activo/inactivo en la pantalla de detrás. */
  onCambiarActivo: (activo: boolean) => Promise<void> | void;
  /** Se llama cuando se guarda o borra un informe desde el modal. */
  onCambiarInforme?: () => Promise<void> | void;
  /** Botón extra, por ejemplo el que abre la ficha completa. */
  accionExtra?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <Modal
      titulo={participante.nombre_completo}
      subtitulo={
        editando
          ? "Actividad del año de servicio · tocá Cargar o Editar en el mes que quieras corregir"
          : "Año de servicio: de septiembre a agosto"
      }
      onCerrar={onCerrar}
    >
      <ActividadDelAnio
        key={editando ? "editando" : "viendo"}
        participante={participante}
        soloLectura={!editando}
        onCambiarActivo={async (activo) => {
          await onCambiarActivo(activo);
        }}
        onCambiarInforme={onCambiarInforme}
      />
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
        {accionExtra}
        <Boton
          variante={editando ? "fantasma" : "secundario"}
          onClick={() => setEditando((v) => !v)}
        >
          {editando ? <Eye size={15} /> : <Pencil size={15} />}
          {editando ? "Terminar de editar" : "Editar actividad"}
        </Boton>
      </div>
    </Modal>
  );
}