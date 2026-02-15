/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['mongodb', 'pdf-parse', 'pdfjs-dist'],
  allowedDevOrigins: [
    'localhost:3000',
    '*.localhost',
    // Preview domains for testing
    'careergpt-final.preview.emergentagent.com',
    'careergpt-final.cluster-0.preview.emergentcf.cloud',
    'careergpt-final.cluster-10.preview.emergentcf.cloud',
    '*.preview.emergentagent.com',
    '*.emergentcf.cloud',
    '*.preview.emergentcf.cloud',
  ],
  turbopack: {},
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
