import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Base configuration
    root: '.',
    base: '/',
    publicDir: 'public',

    // Plugin configuration
    plugins: [
      react({
        // Enable Fast Refresh for React components
        fastRefresh: true,
        // Include JSX runtime for React 18
        jsxRuntime: 'automatic',
        // Babel configuration for JSX
        babel: {
          plugins: [
            // Add any required Babel plugins here
          ],
        },
      }),
    ],

    // Development server configuration
    server: {
      port: 3000,
      host: true,
      open: false,
      cors: true,
      strictPort: false,
      // File system configuration for better module resolution
      fs: {
        strict: false,
        allow: ['..'],
      },
      // Watch configuration
      watch: {
        usePolling: false,
        interval: 100,
        binaryInterval: 300,
        ignored: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      },
    },

    // Module resolution configuration
    resolve: {
      alias: {
        // Path aliases matching tsconfig.json
        '@': path.resolve(__dirname, './src'),
        '@main': path.resolve(__dirname, './src/main'),
        '@renderer': path.resolve(__dirname, './src/renderer'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@database': path.resolve(__dirname, './src/database'),
        '@services': path.resolve(__dirname, './src/services'),
        '@components': path.resolve(__dirname, './src/renderer/components'),
        '@hooks': path.resolve(__dirname, './src/renderer/hooks'),
        '@utils': path.resolve(__dirname, './src/shared/utils'),
        '@types': path.resolve(__dirname, './src/types'),
        '@assets': path.resolve(__dirname, './assets'),

        // Fix problematic module resolution
        'class-variance-authority': path.resolve(__dirname, 'node_modules/class-variance-authority/dist/index.js'),
        'clsx': path.resolve(__dirname, 'node_modules/clsx/dist/clsx.js'),
        'tailwind-merge': path.resolve(__dirname, 'node_modules/tailwind-merge/dist/bundle-mjs.mjs'),

        // React aliases for consistent imports
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
      },

      // File extensions to resolve
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],

      // Conditions for package.json exports field
      conditions: ['import', 'module', 'browser', 'default'],

      // Main fields to check in package.json
      mainFields: ['browser', 'module', 'main'],

      // Preserve symlinks
      preserveSymlinks: false,
    },

    // Dependency optimization
    optimizeDeps: {
      // Pre-bundle these dependencies
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'lucide-react',
        'clsx',
        'class-variance-authority',
        'tailwind-merge',
        'zod',
      ],

      // Exclude these from pre-bundling
      exclude: [
        'electron',
        'better-sqlite3',
        '@electron/*',
        'node:*',
      ],

      // ESBuild options for dependency optimization
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true,
        },
      },

      // Force re-optimization of specific packages
      force: false,
    },

    // Build configuration
    build: {
      target: 'esnext',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,

      // Rollup options
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },

        // External dependencies for Electron
        external: [
          'electron',
          'better-sqlite3',
          'fs',
          'path',
          'os',
          'crypto',
          'buffer',
          'stream',
          'util',
          'events',
          'url',
          'assert',
          'http',
          'https',
          'zlib',
          'child_process',
        ],

        output: {
          // Code splitting configuration
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['lucide-react', 'clsx', 'class-variance-authority', 'tailwind-merge'],
            'utility-vendor': ['zod'],
          },

          // Asset naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },

      // Build optimizations
      cssCodeSplit: true,
      cssMinify: mode === 'production',
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,

      // Clear output directory before build
      emptyOutDir: true,
    },

    // CSS configuration
    css: {
      devSourcemap: mode === 'development',
      modules: {
        scopeBehaviour: 'local',
        generateScopedName: mode === 'production'
          ? '[hash:base64:5]'
          : '[name]__[local]___[hash:base64:5]',
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
    },

    // Environment variables
    define: {
      __DEV__: mode === 'development',
      __PROD__: mode === 'production',
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },

    // Electron-specific configuration
    base: command === 'serve' ? '/' : './',

    // Clear screen in development
    clearScreen: false,

    // Log level
    logLevel: 'info',

    // Preview server configuration (for production builds)
    preview: {
      port: 4173,
      host: true,
      cors: true,
    },

    // Worker configuration
    worker: {
      format: 'es',
      plugins: [react()],
    },

    // JSON configuration
    json: {
      namedExports: true,
      stringify: false,
    },

    // ESBuild configuration
    esbuild: {
      target: 'esnext',
      logOverride: {
        'this-is-undefined-in-esm': 'silent',
      },
      supported: {
        'top-level-await': true,
      },
    },

    // Experimental features
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === 'js') {
          return { js: `"./${filename}"` };
        } else {
          return { relative: true };
        }
      },
    },
  };
});