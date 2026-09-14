/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    // Production build MUST fail on type errors. Do not disable.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Production build MUST fail on lint errors. Do not disable.
    ignoreDuringBuilds: false,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
