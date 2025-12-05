import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SelectedAccountProvider } from '@/context/SelectedAccountContext'
import { AuthProvider } from '@/components/providers/AuthProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <SelectedAccountProvider>
        <div className="min-h-screen bg-background text-foreground relative">
          <div className="fixed inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />
          <DashboardHeader />
          <main className="min-h-screen relative z-10 pt-14 sm:pt-16">
            <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto safe-x safe-bottom">{children}</div>
          </main>
        </div>
      </SelectedAccountProvider>
    </AuthProvider>
  )
}
