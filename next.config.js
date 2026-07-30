const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Next 15: moved out of `experimental` (was experimental.serverComponentsExternalPackages).
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // Two distinct header blocks:
    //   1. /api/*  → CORS open for our SPA + safe defaults (no clickjacking-style flags)
    //   2. everything else (HTML pages) → strict, AV-friendly security headers
    // This eliminates the wildcard X-Frame-Options: ALLOWALL + frame-ancestors *
    // pattern that AV heuristic engines (AVG, Avast, ESET, Bitdefender) flag as
    // clickjacking/phishing template, while keeping the public API CORS-open
    // for the front-end JS to talk to /api/* normally.
    return [
      {
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "X-Content-Type-Options",       value: "nosniff" },
          { key: "Referrer-Policy",              value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/((?!api).*)",
        headers: [
          { key: "Content-Security-Policy",      value: "frame-ancestors 'self' https://*.emergentagent.com;" },
          { key: "X-Content-Type-Options",       value: "nosniff" },
          { key: "Referrer-Policy",              value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",           value: "geolocation=(self), camera=(), microphone=(), payment=(self)" },
          { key: "Strict-Transport-Security",    value: "max-age=63072000; includeSubDomains; preload" },
          // CRITICAL: prevent mobile browsers from caching stale HTML.
          // Without this, iOS Safari + Android Chrome aggressively cache the
          // top-level HTML doc which embeds the JS chunk references — leaving
          // users on the previous build's chunks after a deploy. The Next.js
          // _next/static/* assets are already content-hashed and stay
          // immutable; only the HTML wrapper needs to be no-store.
          { key: "Cache-Control",                value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma",                       value: "no-cache" },
          { key: "Expires",                      value: "0" },
        ],
      },
      // Hashed JS/CSS chunks: keep immutable so they cache long-term.
      // (Next.js already sets these by default but we make it explicit.)
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/support',              destination: '/donate' },
      { source: '/support-the-mission',  destination: '/donate' },
    ];
  },
};

module.exports = nextConfig;
