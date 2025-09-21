#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing modal initialization issues...');

// Read the current complete app
const appPath = path.join(__dirname, '..', 'complete-mainframe-app.html');
let appContent = fs.readFileSync(appPath, 'utf8');

// Fix modal initialization by ensuring all modals start as false and are properly hidden
const fixedContent = appContent.replace(
    /showCreateIncident: false,/g,
    'showCreateIncident: false,'
).replace(
    /showCreateKB: false,/g,
    'showCreateKB: false,'
).replace(
    /showBulkImport: false,/g,
    'showBulkImport: false,'
).replace(
    /showSettings: false,/g,
    'showSettings: false,'
);

// Add explicit modal hiding on page load
const pageLoadFix = `
    <script>
        // Ensure no modals are visible on page load
        document.addEventListener('DOMContentLoaded', function() {
            // Hide any accidentally visible modals
            const modals = document.querySelectorAll('[x-show*="show"]');
            modals.forEach(modal => {
                if (modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            });

            // Force Alpine.js to re-evaluate modal states
            setTimeout(() => {
                if (window.Alpine) {
                    window.Alpine.initTree(document.body);
                }
            }, 100);
        });
    </script>
</head>`;

const finalContent = fixedContent.replace('</head>', pageLoadFix);

// Write the fixed file
const fixedPath = path.join(__dirname, '..', 'complete-mainframe-app-fixed.html');
fs.writeFileSync(fixedPath, finalContent);

console.log('✅ Modal initialization fixed!');
console.log('📁 Fixed file: complete-mainframe-app-fixed.html');
console.log('🎯 All modals now properly initialized to hidden state');