import { DashboardHeader } from '@/components/layout/DashboardHeader'
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
          <div className="min-h-screen bg-background text-foreground relative">
            {/* Background pattern */}
            <div className="fixed inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />
            
            {/* Mobile/Tablet Header - hidden on lg+ */}
            <div className="lg:hidden">
              <DashboardHeader />
            </div>

            {/* Main Layout Container */}
            <div className="flex max-w-[1400px] mx-auto">
              {/* Left Sidebar - visible on lg+ */}
              <AppSidebar />

              {/* Content Area */}
              <main className="flex-1 min-h-screen relative z-10 pt-14 lg:pt-0 pb-20 lg:pb-0">
                <div className="py-4 sm:py-6 md:py-8 px-4 sm:px-6 lg:px-8">
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
