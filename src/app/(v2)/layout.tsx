import { Suspense } from 'react'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { SelectedAccountProvider } from '@/context/SelectedAccountContext'
import { AiLanguagePreferencesProvider } from '@/context/AiLanguagePreferencesContext'
import { Toaster } from 'sonner'

export default function V2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <SelectedAccountProvider>
          <AiLanguagePreferencesProvider>
            <div className="min-h-screen bg-background text-foreground">
              {/* Background pattern */}
              <div
                className="fixed inset-0 -z-10 bg-background"
                style={{
                  backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  opacity: 0.5,
                }}
              />

              <Suspense fallback={null}>
                {children}
              </Suspense>

              <Toaster position="bottom-right" richColors />
            </div>
          </AiLanguagePreferencesProvider>
        </SelectedAccountProvider>
      </QueryProvider>
    </AuthProvider>
  )
}
