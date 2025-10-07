/**
 * Additional webpack optimizations for production builds
 * Supplements the CRACO configuration for maximum performance
 */

const path = require('path');

module.exports = {
  // Optimize dependency parsing
  resolve: {
    // Prefer ES modules for better tree shaking
    mainFields: ['es2015', 'module', 'main'],
    
    // Add resolve aliases for commonly used paths
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'),
    }
  },

  // Optimize build performance
  optimization: {
    // More aggressive minification
    minimize: true,
    
    // Better chunk splitting strategy
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 250000,
      cacheGroups: {
        // Three.js and related 3D libraries
        threejs: {
          test: /[\\/]node_modules[\\/](three|@three)[\\/]/,
          name: 'threejs',
          priority: 20,
          chunks: 'all',
        },
        
        // DnD Kit for drag and drop functionality
        dndkit: {
          test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
          name: 'dndkit',
          priority: 15,
          chunks: 'async', // Only load when needed (Advanced Mode)
        },
        
        // React and related libraries
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'react-vendor',
          priority: 10,
          chunks: 'all',
        },
        
        // Utilities and smaller dependencies
        utils: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor-utils',
          priority: 5,
          chunks: 'all',
          minChunks: 2,
        },
      },
    },
    
    // Enable module concatenation (scope hoisting) for smaller bundles
    concatenateModules: true,
    
    // Remove unused exports
    usedExports: true,
    sideEffects: false,
  },

  // Performance hints
  performance: {
    maxAssetSize: 300000, // 300KB warning threshold
    maxEntrypointSize: 300000,
    hints: 'warning',
  },

  // Module rules for better optimization
  module: {
    rules: [
      // Optimize imports
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  modules: false, // Keep ES modules for tree shaking
                  useBuiltIns: 'entry',
                  corejs: 3,
                }],
                '@babel/preset-react'
              ],
              plugins: [
                // Remove unused imports
                'babel-plugin-transform-remove-unused-imports',
                // Transform dynamic imports
                '@babel/plugin-syntax-dynamic-import',
              ]
            }
          }
        ]
      }
    ]
  }
};