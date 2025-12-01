import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Castor - Farcaster Scheduler',
  description: 'Programa y gestiona tus casts de Farcaster',
  icons: {
    icon: '/brand/logo.png',
    apple: '/brand/logo.png',
  },
  openGraph: {
    title: 'Castor - Farcaster Scheduler',
    description: 'La herramienta definitiva para programar y gestionar tus casts de Farcaster',
    images: ['/brand/logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Special+Gothic+Expanded+One&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
