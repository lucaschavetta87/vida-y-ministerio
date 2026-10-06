import { NextResponse } from "next/server";
import { estadoDe, mesDelFormulario } from "@/lib/informes-servidor";
import { etiquetaMes } from "@/lib/informes";

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

  if (!estado.esPublicador) {
    return NextResponse.json(
      { error: "Esa persona no está marcada como publicador: no informa. Comunicate con la Secretaría." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    enviado: estado.enviado,
    nombre: estado.nombre,
    mes,
    etiqueta: etiquetaMes(mes),
  });
}
