/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: process.env.NEXT_ALLOWED_ORIGINS
        ? process.env.NEXT_ALLOWED_ORIGINS.split(',')
        : ['localhost:3000'],
    },
  },
}

export default nextConfig
