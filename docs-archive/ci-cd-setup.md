# CI/CD Pipeline Documentation

## Overview

This project uses a comprehensive CI/CD pipeline built with GitHub Actions to ensure code quality, security, and reliable deployments across multiple platforms.

## Pipeline Architecture

### Main CI Pipeline (`ci.yml`)

The main CI pipeline runs on every push and pull request to main branches and includes:

1. **Security Audit** - npm audit, vulnerability scanning, license compliance
2. **Lint & Format** - ESLint, Prettier, TypeScript checking
3. **Build Matrix** - Cross-platform builds (Windows, macOS, Linux) with Node.js 18/20
4. **Test Suite** - Unit, integration, and performance tests
5. **Code Coverage** - Coverage reporting with Codecov integration
6. **Electron Build** - Platform-specific Electron application builds
7. **Bundle Analysis** - Bundle size analysis and budget checking
8. **Performance Testing** - Performance benchmarks and quality gates

### Deployment Pipeline (`deploy.yml`)

The deployment pipeline handles releases and deployments:

1. **Pre-deployment Validation** - Environment and version determination
2. **Build for Deployment** - Production builds for all platforms
3. **Security Scan** - Artifact security scanning
4. **Staging Deployment** - Automated staging environment deployment
5. **Production Deployment** - Production deployment with validation
6. **GitHub Release** - Automated release creation with artifacts
7. **Post-deployment Monitoring** - Health checks and monitoring setup

### Additional Workflows

- **Security Scan** (`security-scan.yml`) - Daily security scans, CodeQL analysis
- **CodeQL Analysis** (`codeql.yml`) - Code security analysis
- **Cache Cleanup** (`cache-cleanup.yml`) - Weekly cache maintenance

## Features

### ✅ Cross-Platform Support
- **Operating Systems**: Ubuntu, Windows, macOS
- **Node.js Versions**: 18.x, 20.x
- **Architecture**: x64, ARM64 (macOS)

### ✅ Comprehensive Testing
- **Unit Tests**: Jest with jsdom environment
- **Integration Tests**: Cross-component testing
- **Performance Tests**: Benchmark and load testing
- **E2E Tests**: Playwright integration
- **Coverage**: 85% threshold with detailed reporting

### ✅ Security Features
- **Dependency Scanning**: npm audit with configurable thresholds
- **Code Analysis**: GitHub CodeQL security analysis
- **Secrets Detection**: Gitleaks integration
- **Vulnerability Management**: Dependabot automation
- **License Compliance**: Automated license checking

### ✅ Performance Optimization
- **Caching**: Node modules, dependencies, build artifacts
- **Parallel Execution**: Matrix builds and parallel jobs
- **Bundle Analysis**: Size monitoring and budget enforcement
- **Memory Management**: Optimized Node.js settings

### ✅ Quality Assurance
- **Code Style**: ESLint + Prettier enforcement
- **Type Safety**: TypeScript strict checking
- **Commit Standards**: Conventional commits with commitlint
- **PR Templates**: Structured pull request reviews

## Configuration Files

### Core Configuration
- `.audit-ci.json` - npm audit configuration
- `.codecov.yml` - Code coverage settings
- `.commitlintrc.json` - Commit message standards
- `.github/dependabot.yml` - Dependency update automation

### GitHub Templates
- `.github/ISSUE_TEMPLATE/bug_report.yml` - Bug report template
- `.github/pull_request_template.md` - PR template

## Environment Variables

### Required Secrets
```bash
GITHUB_TOKEN          # GitHub API access (auto-provided)
CODECOV_TOKEN         # Codecov integration (optional)
GITLEAKS_LICENSE      # Gitleaks license (optional)
```

### Staging Environment
```bash
STAGING_URL           # Staging deployment URL
STAGING_API_KEY       # Staging API access
```

### Production Environment
```bash
PRODUCTION_URL        # Production deployment URL
PRODUCTION_API_KEY    # Production API access
SIGNING_CERT          # Code signing certificate
```

## Usage

### Triggering CI Pipeline

The CI pipeline runs automatically on:
- Push to `main`, `master`, or `develop` branches
- Pull requests to `main` or `master`
- Manual workflow dispatch

### Triggering Deployment

Deployments are triggered by:
- **Staging**: Push to `main`/`master` branch
- **Production**: Git tags starting with `v` (e.g., `v1.0.0`)
- **Manual**: Workflow dispatch with environment selection

### Creating a Release

1. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The deployment pipeline will:
   - Build for all platforms
   - Run security scans
   - Deploy to production
   - Create GitHub release with artifacts

## Quality Gates

### Code Coverage
- **Global Threshold**: 85% (branches, functions, lines, statements)
- **Critical Components**: 90% threshold
- **Reports**: HTML, LCOV, JSON formats

### Security Thresholds
- **High/Critical Vulnerabilities**: ❌ Pipeline fails
- **Moderate Vulnerabilities**: ⚠️  Warning only
- **License Compliance**: ✅ Required

### Performance Budgets
- **Bundle Size**: < 1MB limit
- **Build Time**: < 10 minutes per platform
- **Test Execution**: < 5 minutes

### Build Requirements
- **All Platforms**: Must build successfully
- **All Node Versions**: Must pass tests
- **TypeScript**: Zero type errors
- **Linting**: Zero ESLint errors

## Monitoring and Notifications

### Build Status
- GitHub commit status checks
- PR comment updates
- Branch protection rules

### Coverage Tracking
- Codecov integration
- Coverage trend analysis
- PR coverage reports

### Security Monitoring
- Daily security scans
- Dependabot alerts
- CodeQL findings

## Troubleshooting

### Common Issues

**Build Failures on Windows**
- Ensure windows-build-tools are installed
- Check Node.js version compatibility
- Verify Python/Visual Studio dependencies

**macOS Code Signing**
- Verify Xcode command line tools
- Check certificate configuration
- Ensure proper entitlements

**Test Timeouts**
- Increase Jest timeout values
- Check resource constraints
- Review async operation handling

**Coverage Threshold Failures**
- Add missing test cases
- Remove excluded files from coverage
- Update threshold values if appropriate

### Debug Commands

```bash
# Local CI simulation
npm run ci:full

# Coverage analysis
npm run test:coverage

# Build validation
npm run build:validate

# Security scan
npm run scan:security

# Performance check
npm run performance:quality-gates
```

## Best Practices

### Commit Messages
Follow conventional commit format:
```
feat(core): add new search functionality
fix(ui): resolve button alignment issue
docs(ci): update pipeline documentation
```

### Branch Strategy
- `main`/`master`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature development
- `hotfix/*`: Critical fixes

### Testing Strategy
- Write tests before implementation (TDD)
- Maintain high coverage (>85%)
- Include edge cases and error scenarios
- Test cross-platform compatibility

### Security Practices
- Regular dependency updates
- Security-first development
- Secrets management
- Vulnerability response process

## Maintenance

### Weekly Tasks
- Review Dependabot PRs
- Check security scan results
- Monitor performance trends
- Update documentation

### Monthly Tasks
- Analyze build performance
- Review quality metrics
- Update CI/CD configurations
- Security audit review

### Quarterly Tasks
- Node.js version updates
- Tool chain updates
- Performance optimization
- Security policy review

## Support

For CI/CD pipeline issues:
1. Check GitHub Actions logs
2. Review configuration files
3. Test locally with debug commands
4. Create issue with reproduction steps

For more information, see:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [Electron Builder](https://www.electron.build/)
- [ESLint Configuration](https://eslint.org/)