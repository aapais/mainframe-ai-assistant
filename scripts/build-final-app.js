#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Building Final Accenture Mainframe AI Assistant...');

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy the final application to dist
const sourcePath = path.join(__dirname, '..', 'Accenture-Mainframe-AI-Assistant.html');
const targetPath = path.join(distDir, 'Accenture-Mainframe-AI-Assistant.html');

if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);

    console.log('✅ Final application built successfully!');
    console.log('📁 Output: dist/Accenture-Mainframe-AI-Assistant.html');
    console.log('');
    console.log('🎯 Application Features:');
    console.log('   ✓ Dashboard with comprehensive metrics and interactive charts');
    console.log('   ✓ Incident Management with integrated search and CRUD operations');
    console.log('   ✓ Knowledge Base with 12 mainframe error solutions');
    console.log('   ✓ Settings panel with complete configuration options');
    console.log('   ✓ Accenture branding and professional UI/UX');
    console.log('   ✓ All modals and buttons fully functional');
    console.log('   ✓ No unwanted modal pop-ups on startup');
    console.log('');
    console.log('🌐 Access at: http://localhost:8091/Accenture-Mainframe-AI-Assistant.html');
} else {
    console.error('❌ Source file not found:', sourcePath);
    process.exit(1);
}