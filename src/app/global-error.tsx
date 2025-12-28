'use client'

import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              La aplicación encontró un error crítico. Puedes reintentar o volver al inicio.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reintentar
              </button>

              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Ir al inicio
              </Link>
            </div>

            <details className="mt-5 rounded-xl border border-border bg-background/40 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Detalles técnicos
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto text-[11px] leading-4 text-muted-foreground">
                {error?.message}
              </pre>
            </details>
          </div>
        </div>
      </body>
    </html>
  )
}
