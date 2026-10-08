import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESTE LAS HERAS",
  description:
    "Gestión de participantes y asignaciones de la reunión Vida y Ministerio, Asiganciones Mecanicas y Secretaría.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
