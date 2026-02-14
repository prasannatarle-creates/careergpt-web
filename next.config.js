const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['mongodb'],
  allowedDevOrigins: [
    'https://interview-prep-97.preview.emergentagent.com',
    'https://interview-prep-97.cluster-10.preview.emergentcf.cloud',
    'http://interview-prep-97.preview.emergentagent.com',
    'http://interview-prep-97.cluster-10.preview.emergentcf.cloud',
    'http://localhost:3000',
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
