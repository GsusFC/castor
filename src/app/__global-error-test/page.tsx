'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function GlobalErrorTestPage() {
  const [shouldThrow, setShouldThrow] = useState(false)

  if (shouldThrow) {
    throw new Error('Global error boundary test (root)')
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-lg font-semibold text-foreground">Global error boundary test</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pulsa el botón para lanzar un error durante el render y comprobar que se muestra
        <span className="font-medium text-foreground"> src/app/global-error.tsx</span>.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShouldThrow(true)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          Provocar error
        </button>

        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Volver
        </Link>
      </div>
    </div>
  )
}
