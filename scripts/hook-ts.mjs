/* Permite que los scripts de prueba importen los .ts del proyecto
   (Node no resuelve "./pdf" -> "./pdf.ts" por su cuenta). */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      try {
        return await next(`${specifier}.ts`, context);
      } catch {
        /* seguimos con el error original */
      }
    }
    throw error;
  }
}
