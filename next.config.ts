import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "/api/generate": [
      "./assets/**/*",
      "./node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff",
    ],
  },
};

export default nextConfig;
