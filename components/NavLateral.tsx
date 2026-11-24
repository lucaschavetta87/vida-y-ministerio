"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Users,
  CalendarDays,
  ClipboardList,
  Wrench,
  X,
  MapPin,
  KeyRound,
} from "lucide-react";
import Salir from "@/components/Salir";
import { cn } from "@/lib/utils";
import type { Sesion } from "@/lib/auth";

const enlaces = [
  {
    href: "/participantes",
    texto: "Personas de la congregación",
    Icono: Users,
    permiso: "participantes",
  },
  {
    href: "/reunion",
    texto: "Vida y Ministerio",
    Icono: CalendarDays,
    permiso: "reunion",
  },
  {
    href: "/asignaciones-mecanicas",
    texto: "Asignaciones Mecánicas",
    Icono: Wrench,
    permiso: "asignaciones",
  },
  { href: "/servicio", texto: "Servicio", Icono: MapPin, permiso: "servicio" },
  {
    href: "/secretaria",
    texto: "Secretaría",
    Icono: ClipboardList,
    permiso: "secretaria",
  },
  {
    href: "/usuarios",
    texto: "Usuarios",
    Icono: KeyRound,
    permiso: "usuarios",
  },
  { href: "/mi-espacio", texto: "Mi espacio", Icono: KeyRound, permiso: "mi" },
] as const;

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal font-black text-fondo transition-transform group-hover:scale-105">
        VM
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-black tracking-wide">
          ESTE LAS HERAS
        </span>
        <span
          className={cn(
            "block text-[10px] tracking-[0.25em] text-suave",
            compacta && "hidden xl:block",
          )}
        >
        </span>
      </span>
    </Link>
  );
}

export default function NavLateral({ sesion }: { sesion: Sesion | null }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const autenticado = !!sesion;

  const items = sesion
    ? enlaces
        .filter(({ href, permiso }) => {
          if (sesion.admin) return true;
          // usuarios personales: respetar permisos asignados
          if (sesion.participanteId) {
            if (href === "/mi-espacio") return true;
            return sesion.permisos.includes(permiso);
          }
          return sesion.permisos.includes(permiso);
        })
        .map(({ href, texto, Icono }) => {
        const activa = ruta === href || ruta.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setAbierto(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              activa
                ? "bg-teal text-white"
                : "text-suave hover:bg-tarjeta2 hover:text-texto",
            )}
          >
            <Icono size={17} />
            {texto}
          </Link>
          );
        })
    : [];

  return (
    <>
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-linea bg-tarjeta px-3 py-5 lg:flex">
        <div className="px-2">
          <Marca />
        </div>

        <nav className="mt-8 flex flex-col gap-1">{items}</nav>

        <div className="mt-auto flex flex-col gap-2 px-2">
          {autenticado && <Salir />}
          <p className="pb-1 text-[10px] leading-relaxed text-suave">
            ESTE LAS HERAS · Uso interno de la congregación
          </p>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-50 border-b border-linea bg-fondo/90 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Marca compacta />
          {autenticado && (
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className="rounded-lg border border-linea p-2 text-suave transition-colors hover:text-texto"
              aria-label="Abrir menú"
            >
              {abierto ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>

        {abierto && autenticado && (
          <nav className="flex flex-col gap-1 border-t border-linea bg-tarjeta px-3 py-3">
            {items}
            <div className="mt-1 border-t border-linea pt-2">
              <Salir />
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
