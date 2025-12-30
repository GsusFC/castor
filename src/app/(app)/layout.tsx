import dynamic from 'next/dynamic'
import { MobileNav } from '@/components/layout/MobileNav'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SelectedAccountProvider } from '@/context/SelectedAccountContext'
import { AiLanguagePreferencesProvider } from '@/context/AiLanguagePreferencesContext'
import { TickerDrawerProvider } from '@/context/TickerDrawerContext'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { NotificationsProvider } from '@/components/providers/NotificationsProvider'
import { SearchProvider } from '@/context/SearchContext'
import { Toaster } from 'sonner'

// Lazy load large drawers (client-only components)
const NotificationsDrawer = dynamic(
  () => import('@/components/feed/NotificationsDrawer').then(mod => ({ default: mod.NotificationsDrawer }))
)

const SearchDrawer = dynamic(
  () => import('@/components/feed/SearchDrawer').then(mod => ({ default: mod.SearchDrawer }))
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <SelectedAccountProvider>
          <AiLanguagePreferencesProvider>
            <NotificationsProvider>
              <SearchProvider>
                <TickerDrawerProvider>
                  <div className="min-h-screen bg-background text-foreground">
                    {/* Background pattern */}
                    <div className="fixed inset-0 -z-10 bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

                    {/* Layout container */}
                    <div className="flex max-w-[1400px] mx-auto">
                      {/* Left Sidebar - sticky, desktop only */}
                      <AppSidebar />

                      {/* Main content */}
                      <main className="flex-1 min-w-0 px-2 sm:px-4 lg:px-6 py-4 lg:py-6 pb-24 lg:pb-6">
                        {children}
                      </main>
                    </div>

                    {/* Mobile Bottom Nav */}
                    <MobileNav />

                    <NotificationsDrawer />
                    <SearchDrawer />
                    <Toaster position="bottom-right" richColors />
                  </div>
                </TickerDrawerProvider>
              </SearchProvider>
            </NotificationsProvider>
          </AiLanguagePreferencesProvider>
        </SelectedAccountProvider>
      </QueryProvider>
    </AuthProvider>
  )
}
