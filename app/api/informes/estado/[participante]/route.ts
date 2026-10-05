import { NextResponse } from "next/server";
import { estadoDe, mesDelFormulario } from "@/lib/informes-servidor";
import { etiquetaMes, textoTipo } from "@/lib/informes";

/** GET /api/informes/estado/[participante] -> ¿ya envió el informe del mes? */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ participante: string }> },
) {
  const { participante } = await ctx.params;
  const mes = mesDelFormulario();
  const estado = await estadoDe(participante, mes);

  if (!estado.nombre) {
    return NextResponse.json({ error: "Ese nombre no está en la congregación." }, { status: 404 });
  }

  const informe = estado.informe;
  return NextResponse.json({
    enviado: estado.enviado,
    nombre: estado.nombre,
    mes,
    etiqueta: etiquetaMes(mes),
    resumen: informe
      ? {
          tipo: textoTipo(informe.tipo),
          horas: informe.horas,
          horas_meta: informe.horas_meta,
          participo: informe.participo,
          estudios_biblicos: informe.estudios_biblicos,
          observaciones: informe.observaciones,
        }
      : null,
  });
}
