/**
 * robots.txt route handler. Tells crawlers what's safe to index and points
 * them at the sitemap.
 */
export default function robots() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://dumpmaps.org'
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/community',
          '/community/groups',
          '/community/posts/',
          '/community/guidelines',
          '/facilities/',
          '/jobs/',
          '/marketplace/',
          '/donate',
          '/recommendations',
        ],
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/inbox',
          '/inbox/',
          '/settings',
          '/settings/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
