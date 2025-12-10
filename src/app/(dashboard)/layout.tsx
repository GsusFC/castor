import { MobileNav } from '@/components/layout/MobileNav'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SelectedAccountProvider } from '@/context/SelectedAccountContext'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <SelectedAccountProvider>
          <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
            {/* Background pattern */}
            <div className="fixed inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

            {/* Main Layout Container */}
            <div className="flex w-full max-w-[1400px] mx-auto">
              {/* Left Sidebar - visible on lg+ */}
              <AppSidebar />

              {/* Content Area */}
              <main className="flex-1 min-w-0 w-full min-h-screen relative z-10 pb-20 lg:pb-0 overflow-x-hidden">
                <div className="py-4 px-4 lg:px-8 w-full max-w-full">
                  {children}
                </div>
              </main>
            </div>

            {/* Mobile Bottom Nav - hidden on lg+ */}
            <MobileNav />
          </div>
        </SelectedAccountProvider>
      </QueryProvider>
    </AuthProvider>
  )
}
