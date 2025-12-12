import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { WebVitalsProvider } from '@/components/providers/WebVitalsProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  metadataBase: new URL('https://castorapp.xyz'),
  title: {
    default: 'Castor - Farcaster Scheduler',
    template: '%s | Castor',
  },
  description: 'Schedule and manage your Farcaster casts',
  keywords: ['Farcaster', 'scheduler', 'social media', 'casts', 'schedule', 'threads'],
  authors: [{ name: 'Castor Team' }],
  creator: 'Castor',
  icons: {
    icon: '/brand/logo.png',
    apple: '/brand/logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://castorapp.xyz',
    siteName: 'Castor',
    title: 'Castor - Farcaster Scheduler',
    description: 'The ultimate tool to schedule and manage your Farcaster casts',
    images: [
      {
        url: '/brand/logo.png',
        width: 512,
        height: 512,
        alt: 'Castor Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Castor - Farcaster Scheduler',
    description: 'The ultimate tool to schedule and manage your Farcaster casts',
    images: ['/brand/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#AE997A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Special+Gothic+Expanded+One&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider>
          <WebVitalsProvider>
            {children}
          </WebVitalsProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
