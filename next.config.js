// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Typecheck and lint run in the Next process and exhaust a ~256MB server heap.
  // Run `./node_modules/.bin/tsc --noEmit` locally before deploying.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig