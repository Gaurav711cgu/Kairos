/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/orchestrator/:path*',
        destination: `${process.env.ORCHESTRATOR_URL || 'http://localhost:8090'}/:path*`,
      },
    ];
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
