/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron compatibility
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },

  // Disable static optimization for Electron
  experimental: {
    esmExternals: false,
  },

  // Asset prefix for file:// protocol in Electron
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',

  // Webpack configuration for Electron
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle Electron's Node.js APIs in renderer
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    return config;
  },

  // TypeScript configuration
  typescript: {
    tsconfigPath: './app/tsconfig.json',
  },

  // ESLint configuration
  eslint: {
    dirs: ['app', 'src'],
  },

  // Build directory
  distDir: 'app/.next',

  // Disable telemetry
  telemetry: false,

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;