

const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Optimize production build
      if (webpackConfig.mode === 'production') {
        // Enhanced minification
        webpackConfig.optimization.minimizer = [
          new TerserPlugin({
            terserOptions: {
              parse: {
                ecma: 8,
              },
              compress: {
                ecma: 5,
                warnings: false,
                comparisons: false,
                inline: 2,
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug'],
              },
              mangle: {
                safari10: true,
              },
              output: {
                ecma: 5,
                comments: false,
                ascii_only: true,
              },
            },
            parallel: true,
          }),
        ];

        // Optimize chunk splitting
        webpackConfig.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
          
            three: {
              test: /[\\/]node_modules[\\/]three[\\/]/,
              name: 'three',
              priority: 10,
            },
            
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-scripts)[\\/]/,
              name: 'react',
              priority: 9,
            },
            // Vendor chunk for other dependencies
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 8,
            },
            // Common chunk for shared code
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        };

        // Add compression plugin for gzip
        webpackConfig.plugins.push(
          new CompressionPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,
            threshold: 8192,
            minRatio: 0.8,
          })
        );

        // Enable module concatenation (scope hoisting)
        webpackConfig.optimization.concatenateModules = true;
        
        // Use content hash for better caching
        webpackConfig.output.filename = 'static/js/[name].[contenthash:8].js';
        webpackConfig.output.chunkFilename = 'static/js/[name].[contenthash:8].chunk.js';
      }

      return webpackConfig;
    },
  }
};