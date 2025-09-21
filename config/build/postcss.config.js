module.exports = {
  plugins: {
    // Import support for CSS imports
    'postcss-import': {},

    // Tailwind CSS processing
    tailwindcss: {
      config: './tailwind.config.js'
    },

    // Autoprefixer for vendor prefixes
    autoprefixer: {
      grid: true,
      flexbox: 'no-2009',
    },

    // Production optimizations
    ...(process.env.NODE_ENV === 'production' ? {
      // CSS optimization and minification
      cssnano: {
        preset: [
          'default',
          {
            discardComments: {
              removeAll: true,
            },
            reduceIdents: false, // Keep CSS custom properties intact
            zindex: false, // Don't optimize z-index to prevent conflicts
          }
        ]
      }
    } : {})
  }
}