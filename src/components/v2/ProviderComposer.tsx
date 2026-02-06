'use client'

import React from 'react'

type Provider = React.ComponentType<{ children: React.ReactNode }>

interface ProviderComposerProps {
  providers: Provider[]
  children: React.ReactNode
}

/**
 * Flattens deeply nested providers into a readable list.
 *
 * Before:
 *   <A><B><C><D>{children}</D></C></B></A>
 *
 * After:
 *   <ProviderComposer providers={[A, B, C, D]}>{children}</ProviderComposer>
 */
export function ProviderComposer({ providers, children }: ProviderComposerProps) {
  return providers.reduceRight<React.ReactNode>(
    (kids, Provider) => <Provider>{kids}</Provider>,
    children
  ) as React.ReactElement
}
