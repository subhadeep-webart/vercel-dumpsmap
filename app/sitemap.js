import { MetadataRoute } from 'next'

/**
 * Static sitemap for the public marketing surface. Dynamic content (community
 * posts, jobs, listings) is intentionally NOT enumerated here — those are
 * indexed when crawlers follow links from the public feed.
 */
export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://dumpmaps.org'
  const now = new Date()
  const routes = [
    { url: '/', changeFrequency: 'daily', priority: 1.0 },
    { url: '/community', changeFrequency: 'hourly', priority: 0.9 },
    { url: '/community/guidelines', changeFrequency: 'monthly', priority: 0.5 },
    { url: '/community/groups', changeFrequency: 'daily', priority: 0.6 },
    { url: '/recommendations', changeFrequency: 'weekly', priority: 0.7 },
    { url: '/donate', changeFrequency: 'weekly', priority: 0.6 },
  ]
  return routes.map((r) => ({
    url: `${base}${r.url}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
