import { cookies } from "next/headers";
import { SESSION_COOKIE, leerToken } from "@/lib/auth";
import NavLateral from "@/components/NavLateral";
import CerrarAlSalir from "@/components/CerrarAlSalir";

/** Todo lo interno de la congregación: siempre con menú lateral y sesión abierta. */
export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const sesion = await leerToken(store.get(SESSION_COOKIE)?.value);

  return (
    <>
      <NavLateral sesion={sesion} />
      <CerrarAlSalir />

      <div className="contenedor lg:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>

        <footer className="no-print border-t border-linea py-8 text-center text-xs text-suave">
          Congregación de Este Las Heras · Uso interno de la congregación
        </footer>
      </div>
    </>
  );
}
