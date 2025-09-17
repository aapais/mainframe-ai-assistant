import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: './dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
      output: {
        // Optimize chunk splitting for lazy loading
        manualChunks: {
          // Core React libraries
          'vendor-react': ['react', 'react-dom'],

          // Form-related components (heavy with validation)
          'forms': [
            './src/renderer/components/SimpleAddEntryForm',
            './src/renderer/components/forms/KBEntryForm',
            './src/renderer/components/forms/EditEntryForm'
          ],

          // Search and analytics features
          'search-features': [
            './src/renderer/components/search/SearchAnalytics',
            './src/renderer/components/search/SearchHistory',
            './src/renderer/components/search/PerformanceIndicator'
          ],

          // Dashboard and metrics (heavy components)
          'dashboard': [
            './src/renderer/components/MetricsDashboard',
            './src/renderer/components/ui/DataDisplay'
          ],

          // UI library components
          'ui-library': [
            './src/renderer/components/ui/Modal',
            './src/renderer/components/ui/Layout',
            './src/renderer/components/ui/Typography',
            './src/renderer/components/ui/Button',
            './src/renderer/components/ui/Input',
            './src/renderer/components/ui/Card'
          ],

          // Accessibility features
          'accessibility': [
            './src/renderer/components/accessibility/AccessibilityChecker',
            './src/renderer/components/accessibility/AriaPatterns',
            './src/renderer/components/KeyboardHelp'
          ],

          // Navigation and routing
          'navigation': [
            './src/renderer/routes/AppRouter',
            './src/renderer/routes/KBRoutes',
            './src/renderer/components/navigation/KBNavigation'
          ]
        },

        // Optimize chunk names for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ?
            chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '') :
            'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },

        // Optimize asset names
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const extType = info[info.length - 1];

          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
            return `images/[name]-[hash][extname]`;
          }

          if (/\.(css)$/i.test(assetInfo.name || '')) {
            return `css/[name]-[hash][extname]`;
          }

          return `assets/[name]-[hash][extname]`;
        }
      }
    },

    // Optimize for Electron renderer
    target: 'electron-renderer',

    // Enable source maps for debugging
    sourcemap: true,

    // Optimize chunk sizes
    chunkSizeWarningLimit: 1000, // 1MB warning limit

    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log'] : []
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  publicDir: path.resolve(__dirname, 'assets'),

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom'
    ],
    exclude: [
      // Exclude components that should be lazy-loaded
      './src/renderer/components/MetricsDashboard',
      './src/renderer/components/SimpleAddEntryForm'
    ]
  }
});