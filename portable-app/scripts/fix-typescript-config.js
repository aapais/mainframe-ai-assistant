const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing TypeScript Configuration Files...');

// Fix tsconfig.main.json
const mainConfigPath = path.join(__dirname, '../config/typescript/tsconfig.main.json');
if (fs.existsSync(mainConfigPath)) {
    const config = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8'));

    // Fix paths
    config.extends = '../../tsconfig.json';
    config.include = ['../../src/main/**/*'];
    config.exclude = [
        '../../src/renderer/**/*',
        '../../src/components/**/*',
        '../../tests/**/*',
        '../../node_modules'
    ];

    if (config.compilerOptions) {
        config.compilerOptions.outDir = '../../dist/main';
        config.compilerOptions.rootDir = '../../src/main';
    }

    fs.writeFileSync(mainConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ Fixed tsconfig.main.json');
}

// Fix tsconfig.renderer.json
const rendererConfigPath = path.join(__dirname, '../config/typescript/tsconfig.renderer.json');
if (fs.existsSync(rendererConfigPath)) {
    const config = JSON.parse(fs.readFileSync(rendererConfigPath, 'utf8'));

    // Fix paths
    config.extends = '../../tsconfig.json';
    config.include = [
        '../../src/renderer/**/*',
        '../../src/components/**/*',
        '../../src/hooks/**/*',
        '../../src/shared/**/*',
        '../../src/types/**/*'
    ];
    config.exclude = [
        '../../src/main/**/*',
        '../../tests/**/*',
        '../../node_modules'
    ];

    if (config.compilerOptions) {
        config.compilerOptions.outDir = '../../dist/renderer';
        config.compilerOptions.rootDir = '../../src';
    }

    fs.writeFileSync(rendererConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ Fixed tsconfig.renderer.json');
}

// Create a backup of the main tsconfig.json
const mainTsConfigPath = path.join(__dirname, '../tsconfig.json');
if (fs.existsSync(mainTsConfigPath)) {
    const config = JSON.parse(fs.readFileSync(mainTsConfigPath, 'utf8'));

    // Ensure proper compiler options
    if (!config.compilerOptions) {
        config.compilerOptions = {};
    }

    // Add essential options if missing
    const defaults = {
        target: 'ES2022',
        module: 'commonjs',
        lib: ['ES2022', 'DOM'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        isolatedModules: true,
        moduleResolution: 'node'
    };

    config.compilerOptions = { ...defaults, ...config.compilerOptions };

    fs.writeFileSync(mainTsConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ Updated main tsconfig.json');
}

console.log('🎉 TypeScript configuration fix complete!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Run: npm run build');
console.log('3. If errors persist, run: npm run fix:all');