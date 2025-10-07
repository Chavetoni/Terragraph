/**
 * Express server for production with optimized caching and compression
 * Run with: node server.js
 */

const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip compression
app.use(compression());

// Serve static files with proper caching
app.use('/static', express.static(path.join(__dirname, 'build/static'), {
  maxAge: '1y',
  immutable: true,
  etag: false
}));

// Serve other assets with moderate caching
app.use(express.static(path.join(__dirname, 'build'), {
  maxAge: '1h',
  setHeaders: (res, filepath) => {
    // Don't cache HTML files
    if (filepath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    // Cache images for 30 days
    else if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(filepath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
    // Cache fonts for 1 year
    else if (/\.(woff|woff2|ttf|eot)$/i.test(filepath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy (adjust as needed)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self';"
  );
  
  next();
});

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Compression: enabled`);
  console.log(`💾 Caching: optimized`);
  console.log(`🔒 Security headers: enabled`);
});