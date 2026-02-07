import { Suspense } from 'react'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { NotificationsProvider } from '@/components/providers/NotificationsProvider'
import { AiLanguagePreferencesProvider } from '@/context/AiLanguagePreferencesContext'
import { SearchProvider } from '@/context/SearchContext'
import { ProviderComposer } from '@/components/v2/ProviderComposer'
import { SearchDrawer } from '@/components/feed/SearchDrawer'
import { NotificationsDrawer } from '@/components/feed/NotificationsDrawer'
import { Toaster } from 'sonner'

/**
 * V2 Layout — uses ProviderComposer to flatten provider nesting.
 *
 * Includes SearchProvider + NotificationsProvider so SearchDrawer and
 * NotificationsDrawer work across all v2 pages.
 *
 * Note: SelectedAccountV2Provider is NOT here because it needs the defaultAccountId
 * from the server (accounts data). Each page that needs it wraps its own content
 * with <SelectedAccountV2Provider defaultAccountId={...}>.
 */
export default function V2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProviderComposer
      providers={[
        AuthProvider,
        QueryProvider,
        NotificationsProvider,
        SearchProvider,
        AiLanguagePreferencesProvider,
      ]}
    >
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

        {/* Global drawers — available on all v2 pages */}
        <SearchDrawer />
        <NotificationsDrawer />

        <Toaster position="bottom-right" richColors />
      </div>
    </ProviderComposer>
  )
}
