# Husky Pre-commit Hooks Setup Guide

## Overview

This project now includes comprehensive pre-commit hooks using Husky, lint-staged, ESLint, Prettier, and commitlint to ensure code quality and enforce conventional commit messages.

## What's Included

### 1. Pre-commit Hook (`.husky/pre-commit`)
Automatically runs before each commit and includes:
- **ESLint**: Lints JavaScript and TypeScript files
- **Prettier**: Formats code according to project standards
- **TypeScript**: Type checking across the entire project
- **Jest Tests**: Runs tests for changed files
- **npm audit**: Security vulnerability check (warning only)

### 2. Commit Message Hook (`.husky/commit-msg`)
Validates commit messages using conventional commit format:
- **Valid formats**: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:`, `revert:`, `security:`, `deps:`
- **Examples**:
  - `feat: add user authentication`
  - `fix: resolve memory leak in cache service`
  - `docs: update API documentation`
  - `feat(auth): implement OAuth2 integration`

### 3. Lint-staged Configuration
Runs specific tools only on staged files for performance:
- **JS/TS files**: ESLint fix + Prettier format
- **JSON/CSS/MD/HTML files**: Prettier format only

## Configuration Files

### ESLint (`.eslintrc.js`)
- **Environment**: Browser, ES2021, Node.js, Jest
- **React**: Latest React rules with hooks support
- **TypeScript**: Basic TypeScript support
- **Custom rules**: Optimized for the project's needs

### Prettier (`.prettierrc.js`)
- **Style**: Single quotes, semicolons, 100 character width
- **Format**: 2-space indentation, LF line endings
- **Special overrides**: Markdown (80 chars), JSON (120 chars)

### Commitlint (`.commitlintrc.js`)
- **Standard**: Conventional commits specification
- **Rules**: Type required, max 100 characters, proper case enforcement
- **Custom types**: Includes `security` and `deps` for project needs

## Scripts Added/Updated

```json
{
  "scripts": {
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx --fix --quiet",
    "typecheck": "tsc --noEmit --skipLibCheck",
    "format": "prettier --write src/**/*.{js,jsx,ts,tsx,json,css,md,html} --ignore-path .gitignore",
    "format:check": "prettier --check src/**/*.{js,jsx,ts,tsx,json,css,md,html} --ignore-path .gitignore",
    "prepare": "npx husky install"
  }
}
```

## Testing the Setup

### Manual Testing
1. **Stage some files**: `git add .`
2. **Try to commit**: `git commit -m "test: verify hooks work"`
3. **Hooks should run automatically**

### Commit Message Testing
```bash
# ✅ Valid commit messages
git commit -m "feat: add new feature"
git commit -m "fix: resolve critical bug"
git commit -m "docs: update documentation"

# ❌ Invalid commit messages (will be rejected)
git commit -m "add new feature"
git commit -m "fixed bug"
git commit -m "update docs"
```

## Troubleshooting

### Common Issues

1. **ESLint errors during commit**
   - Run `npm run lint:fix` to auto-fix issues
   - Manually fix remaining issues

2. **TypeScript errors during commit**
   - Run `npm run typecheck` to see all errors
   - Fix type issues before committing

3. **Test failures during commit**
   - Run `npm test` to see failing tests
   - Fix tests or update code as needed

4. **Prettier formatting issues**
   - Run `npm run format` to format all files
   - Ensure your editor uses the project's Prettier config

### Bypass Hooks (Emergency Only)
```bash
# Skip pre-commit hooks (not recommended)
git commit --no-verify -m "feat: emergency fix"

# Skip commit-msg hook only
git commit --no-verify -m "emergency fix"
```

## Benefits

1. **Code Quality**: Consistent formatting and linting
2. **Type Safety**: TypeScript errors caught before commit
3. **Test Coverage**: Failed tests prevent broken commits
4. **Security**: npm audit warns about vulnerabilities
5. **Git History**: Clean, conventional commit messages
6. **Team Consistency**: Same standards for all developers

## Dependencies Added

- `husky`: Git hooks management
- `lint-staged`: Run linters on staged files only
- `@commitlint/cli`: Commit message linting
- `@commitlint/config-conventional`: Conventional commit rules

## Performance

- **Fast**: Only processes staged files
- **Efficient**: Parallel processing where possible
- **Smart**: Skips hooks when no files are staged
- **Optimized**: Uses `--quiet` flags to reduce output

This setup ensures that all code committed to the repository meets high quality standards while providing helpful feedback to developers.