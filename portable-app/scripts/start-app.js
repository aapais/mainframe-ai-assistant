#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 5000;

// Build the application first
console.log('🔨 Building the application...');
exec('npm run build', { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
  if (error) {
    console.error('Build failed:', error);
    console.error(stderr);

    // Try alternative: serve development files directly
    console.log('📦 Serving development files instead...');

    // Serve static files
    app.use(express.static(path.join(__dirname, '..')));

    // Serve index.html for all routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'index.html'));
    });

    app.listen(PORT, () => {
      console.log(`✨ Development server running at http://localhost:${PORT}`);
      console.log('📁 Serving from:', path.join(__dirname, '..'));
    });
  } else {
    console.log('✅ Build successful!');

    // Serve the built files
    app.use(express.static(path.join(__dirname, '..', 'dist')));

    // Serve index.html for all routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });

    app.listen(PORT, () => {
      console.log(`🚀 Production server running at http://localhost:${PORT}`);
      console.log('📁 Serving from:', path.join(__dirname, '..', 'dist'));
    });
  }
});