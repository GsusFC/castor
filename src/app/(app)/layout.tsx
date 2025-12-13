import { MobileNav } from '@/components/layout/MobileNav'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NotificationsDrawer } from '@/components/feed/NotificationsDrawer'
import { SelectedAccountProvider } from '@/context/SelectedAccountContext'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { NotificationsProvider } from '@/components/providers/NotificationsProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <SelectedAccountProvider>
          <NotificationsProvider>
            <div className="min-h-screen bg-background text-foreground">
              {/* Background pattern */}
              <div className="fixed inset-0 -z-10 bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

              {/* Layout container */}
              <div className="flex max-w-[1400px] mx-auto">
                {/* Left Sidebar - sticky, desktop only */}
                <AppSidebar />
 
                 {/* Main content */}
                 <main className="flex-1 min-w-0 px-4 py-6 lg:px-8 pb-24 lg:pb-6">
                   {children}
                 </main>
               </div>

               {/* Mobile Bottom Nav */}
               <MobileNav />
             </div>

             <NotificationsDrawer />
           </NotificationsProvider>
         </SelectedAccountProvider>
       </QueryProvider>
     </AuthProvider>
  )
}
