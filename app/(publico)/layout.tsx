/** Páginas públicas: sin menú lateral, sin datos de la congregación. */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">{children}</div>
  );
}
