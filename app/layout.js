import './globals.css'
import { Suspense } from 'react'
import { Poppins } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import TopProgressBar from '@/components/TopProgressBar'
import GlobalNotificationsMount from '@/components/messaging/GlobalNotificationsMount'
import { ViewModeProvider } from '@/lib/view-mode'
import { LayoutModeProvider } from '@/lib/layout-mode'
import { AuthProvider } from '@/components/AuthContext'
import FieldOnboardingDialog from '@/components/field/FieldOnboardingDialog'
import FieldModeRoot from '@/components/field/FieldModeRoot'
import VersionWatcher from '@/components/VersionWatcher'
import AppFooter from '@/components/AppFooter'
import GlobalMobileNav from '@/components/GlobalMobileNav'
import GlobalFab from '@/components/GlobalFab'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
})

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://dumpmaps.org'
const OG_IMAGE = `${SITE_URL}/og-image.png`

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DumpMaps — Find, Dump, Recycle, Donate & Reuse Faster',
    template: '%s · DumpMaps',
  },
  description:
    'DumpMaps helps haulers, contractors, recyclers, facilities, and communities find disposal sites, donation centers, recycling locations, live wait times, hot spots, jobs, and reuse opportunities — all in one place.',
  applicationName: 'DumpMaps',
  keywords: [
    'dump maps', 'dumpmaps', 'recycling centers', 'donation centers', 'junk removal',
    'transfer stations', 'CRV buyback', 'scrap yards', 'dump locations', 'haulers',
    'contractors', 'e-waste', 'reuse marketplace', 'illegal dumping', 'cleanup jobs',
    'facility wait times', 'hot spots', 'reuse', 'recycling near me', 'donation near me',
  ],
  authors: [{ name: 'DumpMaps' }],
  creator: 'DumpMaps',
  publisher: 'DumpMaps',
  formatDetection: { email: false, telephone: false, address: false },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'DumpMaps',
    title: 'DumpMaps — Find, Dump, Recycle, Donate & Reuse Faster',
    description:
      'Operational intelligence for cleanup, hauling, recycling, reuse, and contractor coordination. Live feed of nearby facilities, hot spots, free items, and jobs.',
    url: SITE_URL,
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'DumpMaps — find, dump, recycle, donate, reuse',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DumpMaps — Find, Dump, Recycle, Donate & Reuse Faster',
    description:
      'Operational intelligence for cleanup, hauling, recycling, reuse, and contractor coordination.',
    images: [OG_IMAGE],
    creator: '@dumpmaps',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  category: 'environment',
}

export const viewport = {
  themeColor: '#0B4DBA',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);',
          }}
        />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
      </head>
      <body className="bg-background text-foreground antialiased">
        {/* Global top navigation progress bar. Wrapped in Suspense because it
            reads useSearchParams(), which would otherwise force the whole tree
            into client-side rendering. */}
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <AuthProvider>
          <ViewModeProvider>
            <LayoutModeProvider>
              <div className="dm-app-shell flex min-h-[100dvh] flex-col">
                <div className="flex-1">{children}</div>
                <GlobalMobileNav />
                <AppFooter />
              </div>
              <Toaster richColors position="top-right" />
              <GlobalNotificationsMount />
              <FieldOnboardingDialog />
              <FieldModeRoot />
              <VersionWatcher />
              {/* Suspense for the same reason as TopProgressBar above: the FAB
                  reads useSearchParams() to hide itself on the group chat tab. */}
              <Suspense fallback={null}>
                <GlobalFab />
              </Suspense>
            </LayoutModeProvider>
          </ViewModeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
