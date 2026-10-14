"use client";

import { useEffect } from "react";

/**
 * Cierra la sesión cuando se recarga la página, se cierra la pestaña
 * o se cierra el navegador: así siempre hay que volver a poner usuario
 * y contraseña.
 *
 * Se manda un "beacon" porque el pagehide no espera respuestas.
 */
export default function CerrarAlSalir() {
  useEffect(() => {
    const cerrar = () => {
      try {
        navigator.sendBeacon(
          "/api/logout",
          new Blob([""], { type: "text/plain" }),
        );
      } catch {
        // si no se puede, no hace nada
      }
    };

    // pagehide cubre recarga, atrás/adelante y cierre de pestaña
    window.addEventListener("pagehide", cerrar);
    window.addEventListener("beforeunload", cerrar);

    return () => {
      window.removeEventListener("pagehide", cerrar);
      window.removeEventListener("beforeunload", cerrar);
    };
  }, []);

  return null;
}