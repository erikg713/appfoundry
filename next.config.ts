import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Optimization & Performance */
  swcMinify: true, // Faster minification via SWC
  poweredByHeader: false, // Security: hide Next.js version
  compress: true, // Enable Gzip compression by default
  
  /* Image Optimization */
  images: {
    remotePatterns: [
      // Add trusted image domains as you expand (Cloudflare R2, etc.)
    ],
    formats: ["image/avif", "image/webp"], // Modern formats for better compression
    minimumCacheTTL: 31536000, // Cache optimized images for 1 year
  },

  /* TypeScript & Linting */
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },

  /* React & Rendering */
  reactStrictMode: true, // Catch common issues in development
  
  /* Environment & Build */
  env: {
    NEXT_PUBLIC_APP_NAME: "AppFoundry",
    NEXT_PUBLIC_APP_DESCRIPTION: "Build apps with AI. Own them completely.",
  },

  /* Headers & Security */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  /* Redirects for Auth Flow */
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/projects",
        permanent: true,
      },
    ];
  },

  /* Experimental Features (Next.js 15) */
  experimental: {
    optimizePackageImports: ["@radix-ui/react-*", "lucide-react"],
  },
