/**
 * CI/CD Pipeline Integration
 * Integrates performance regression testing into continuous integration pipelines
 */

const fs = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');

class PipelineIntegration {
  constructor(config = {}) {
    this.config = {
      // CI/CD platform configurations
      platforms: {
        github: {
          enabled: config.github?.enabled || false,
          workflowsDir: config.github?.workflowsDir || '.github/workflows',
          secrets: config.github?.secrets || [
            'PERFORMANCE_WEBHOOK_URL',
            'SLACK_WEBHOOK_URL',
            'SMTP_PASSWORD'
          ]
        },
        gitlab: {
          enabled: config.gitlab?.enabled || false,
          configFile: config.gitlab?.configFile || '.gitlab-ci.yml'
        },
        jenkins: {
          enabled: config.jenkins?.enabled || false,
          configFile: config.jenkins?.configFile || 'Jenkinsfile'
        },
        azure: {
          enabled: config.azure?.enabled || false,
          configFile: config.azure?.configFile || 'azure-pipelines.yml'
        }
      },
      
      // Test execution configuration
      execution: {
        triggers: config.triggers || ['pull_request', 'push', 'schedule', 'manual'],
        environments: config.environments || ['staging', 'production'],
        parallelJobs: config.parallelJobs || 4,
        timeout: config.timeout || '30m',
        retryAttempts: config.retryAttempts || 2
      },
      
      // Failure handling
      failureHandling: {
        failOnRegression: config.failureHandling?.failOnRegression !== false,
        failOnCritical: config.failureHandling?.failOnCritical !== false,
        commentOnPR: config.failureHandling?.commentOnPR !== false,
        createIssue: config.failureHandling?.createIssue || false
      },
      
      // Artifact management
      artifacts: {
        retentionDays: config.artifacts?.retentionDays || 30,
        uploadReports: config.artifacts?.uploadReports !== false,
        uploadBaselines: config.artifacts?.uploadBaselines !== false
      },
      
      ...config
    };
  }

  /**
   * Generate CI/CD configurations for all enabled platforms
   */
  async generateAllConfigurations() {
    const results = {};
    
    if (this.config.platforms.github.enabled) {
      results.github = await this.generateGitHubWorkflows();
    }
    
    if (this.config.platforms.gitlab.enabled) {
      results.gitlab = await this.generateGitLabCI();
    }
    
    if (this.config.platforms.jenkins.enabled) {
      results.jenkins = await this.generateJenkinsfile();
    }
    
    if (this.config.platforms.azure.enabled) {
      results.azure = await this.generateAzurePipelines();
    }
    
    return results;
  }

  /**
   * Generate GitHub Actions workflows
   */
  async generateGitHubWorkflows() {
    const workflows = {
      'performance-regression.yml': this.createGitHubPerformanceWorkflow(),
      'performance-baseline.yml': this.createGitHubBaselineWorkflow(),
      'performance-report.yml': this.createGitHubReportWorkflow()
    };
    
    const workflowsDir = this.config.platforms.github.workflowsDir;
    await fs.mkdir(workflowsDir, { recursive: true });
    
    const generatedFiles = [];
    
    for (const [filename, content] of Object.entries(workflows)) {
      const filePath = path.join(workflowsDir, filename);
      await fs.writeFile(filePath, yaml.dump(content, { indent: 2 }));
      generatedFiles.push(filePath);
    }
    
    return {
      platform: 'github',
      files: generatedFiles,
      workflows: Object.keys(workflows)
    };
  }

  /**
   * Create GitHub Actions performance regression workflow
   */
  createGitHubPerformanceWorkflow() {
    return {
      name: 'Performance Regression Testing',
      
      on: {
        pull_request: {
          branches: ['main', 'master', 'develop']
        },
        push: {
          branches: ['main', 'master']
        },
        schedule: [{
          cron: '0 2 * * *' // Run daily at 2 AM
        }],
        workflow_dispatch: {
          inputs: {
            environment: {
              description: 'Environment to test',
              required: false,
              default: 'staging',
              type: 'choice',
              options: ['staging', 'production', 'all']
            },
            test_suite: {
              description: 'Specific test suite to run',
              required: false,
              default: 'all'
            }
          }
        }
      },
      
      env: {
        NODE_VERSION: '18',
        PERFORMANCE_TIMEOUT: this.config.execution.timeout
      },
      
      jobs: {
        'performance-test': {
          'runs-on': 'ubuntu-latest',
          
          strategy: {
            matrix: {
              environment: this.config.execution.environments
            },
            'fail-fast': false
          },
          
          steps: [
            {
              name: 'Checkout code',
              uses: 'actions/checkout@v4',
              with: {
                'fetch-depth': 0
              }
            },
            
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': '${{ env.NODE_VERSION }}',
                cache: 'npm'
              }
            },
            
            {
              name: 'Install dependencies',
              run: 'npm ci'
            },
            
            {
              name: 'Download baseline artifacts',
              uses: 'actions/download-artifact@v4',
              with: {
                name: 'performance-baselines-${{ matrix.environment }}',
                path: './baselines'
              },
              'continue-on-error': true
            },
            
            {
              name: 'Run performance tests',
              run: |
                npm run test:performance -- \
                  --environment=${{ matrix.environment }} \
                  --timeout=${{ env.PERFORMANCE_TIMEOUT }} \
                  --retries=${{ env.RETRY_ATTEMPTS || 2 }} \
                  --reporter=json
              env: {
                ENVIRONMENT: '${{ matrix.environment }}',
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
                PERFORMANCE_WEBHOOK_URL: '${{ secrets.PERFORMANCE_WEBHOOK_URL }}',
                SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}'
              }
            },
            
            {
              name: 'Generate performance report',
              run: |
                npm run performance:report -- \
                  --input=./results \
                  --output=./reports \
                  --format=html,json,markdown
              'if': 'always()'
            },
            
            {
              name: 'Upload test results',
              uses: 'actions/upload-artifact@v4',
              with: {
                name: 'performance-results-${{ matrix.environment }}',
                path: |
                  ./results/
                  ./reports/
                'retention-days': this.config.artifacts.retentionDays
              },
              'if': 'always()'
            },
            
            {
              name: 'Upload baselines',
              uses: 'actions/upload-artifact@v4',
              with: {
                name: 'performance-baselines-${{ matrix.environment }}',
                path: './baselines/',
                'retention-days': this.config.artifacts.retentionDays
              },
              'if': 'success()'
            },
            
            {
              name: 'Comment PR with results',
              uses: 'actions/github-script@v7',
              with: {
                script: |
                  const fs = require('fs');
                  const path = require('path');
                  
                  try {
                    const reportPath = './reports/report.md';
                    if (fs.existsSync(reportPath)) {
                      const report = fs.readFileSync(reportPath, 'utf8');
                      
                      const comment = `## Performance Test Results - ${{ matrix.environment }}\n\n${report}`;
                      
                      if (context.payload.pull_request) {
                        github.rest.issues.createComment({
                          issue_number: context.payload.pull_request.number,
                          owner: context.repo.owner,
                          repo: context.repo.repo,
                          body: comment
                        });
                      }
                    }
                  } catch (error) {
                    console.error('Failed to comment on PR:', error);
                  }
              },
              'if': "always() && github.event_name == 'pull_request'"
            },
            
            {
              name: 'Check for regressions',
              run: |
                if [ -f "./results/regression-analysis.json" ]; then
                  CRITICAL_REGRESSIONS=$(jq '.summary.criticalRegressions' ./results/regression-analysis.json)
                  if [ "$CRITICAL_REGRESSIONS" -gt 0 ]; then
                    echo "Critical performance regressions detected!"
                    exit 1
                  fi
                fi
              'if': this.config.failureHandling.failOnCritical
            }
          ]
        },
        
        'consolidate-results': {
          'runs-on': 'ubuntu-latest',
          needs: ['performance-test'],
          'if': 'always()',
          
          steps: [
            {
              name: 'Download all artifacts',
              uses: 'actions/download-artifact@v4',
              with: {
                path: './all-results'
              }
            },
            
            {
              name: 'Consolidate reports',
              run: |
                npm run performance:consolidate -- \
                  --input=./all-results \
                  --output=./consolidated-report
            },
            
            {
              name: 'Upload consolidated report',
              uses: 'actions/upload-artifact@v4',
              with: {
                name: 'consolidated-performance-report',
                path: './consolidated-report/',
                'retention-days': this.config.artifacts.retentionDays
              }
            }
          ]
        }
      }
    };
  }

  /**
   * Create GitHub Actions baseline update workflow
   */
  createGitHubBaselineWorkflow() {
    return {
      name: 'Update Performance Baselines',
      
      on: {
        workflow_dispatch: {
          inputs: {
            environment: {
              description: 'Environment to update baselines for',
              required: true,
              type: 'choice',
              options: this.config.execution.environments
            },
            force_update: {
              description: 'Force update even if regressions detected',
              required: false,
              default: false,
              type: 'boolean'
            }
          }
        },
        schedule: [{
          cron: '0 4 * * 0' // Weekly on Sunday at 4 AM
        }]
      },
      
      jobs: {
        'update-baselines': {
          'runs-on': 'ubuntu-latest',
          
          steps: [
            {
              name: 'Checkout code',
              uses: 'actions/checkout@v4'
            },
            
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': '18',
                cache: 'npm'
              }
            },
            
            {
              name: 'Install dependencies',
              run: 'npm ci'
            },
            
            {
              name: 'Run baseline tests',
              run: |
                npm run test:performance:baseline -- \
                  --environment=${{ github.event.inputs.environment || 'staging' }} \
                  --samples=20 \
                  --force=${{ github.event.inputs.force_update || 'false' }}
            },
            
            {
              name: 'Commit updated baselines',
              run: |
                git config --local user.email "action@github.com"
                git config --local user.name "GitHub Action"
                git add baselines/
                git diff --staged --quiet || git commit -m "chore: update performance baselines for ${{ github.event.inputs.environment || 'staging' }}"
                git push
            }
          ]
        }
      }
    };
  }

  /**
   * Create GitHub Actions report workflow
   */
  createGitHubReportWorkflow() {
    return {
      name: 'Performance Report Dashboard',
      
      on: {
        workflow_run: {
          workflows: ['Performance Regression Testing'],
          types: ['completed']
        }
      },
      
      jobs: {
        'generate-dashboard': {
          'runs-on': 'ubuntu-latest',
          
          steps: [
            {
              name: 'Checkout code',
              uses: 'actions/checkout@v4'
            },
            
            {
              name: 'Download performance results',
              uses: 'actions/download-artifact@v4',
              with: {
                name: 'consolidated-performance-report',
                path: './reports'
              }
            },
            
            {
              name: 'Generate dashboard',
              run: |
                npm run performance:dashboard -- \
                  --input=./reports \
                  --output=./dashboard
            },
            
            {
              name: 'Deploy to GitHub Pages',
              uses: 'peaceiris/actions-gh-pages@v3',
              with: {
                github_token: '${{ secrets.GITHUB_TOKEN }}',
                publish_dir: './dashboard'
              },
              'if': "github.ref == 'refs/heads/main'"
            }
          ]
        }
      }
    };
  }

  /**
   * Generate GitLab CI configuration
   */
  async generateGitLabCI() {
    const config = {
      stages: ['test', 'report', 'deploy'],
      
      variables: {
        NODE_VERSION: '18',
        PERFORMANCE_TIMEOUT: this.config.execution.timeout
      },
      
      cache: {
        paths: ['node_modules/', '.npm/'],
        key: {
          files: ['package-lock.json']
        }
      },
      
      before_script: [
        'npm ci --cache .npm --prefer-offline'
      ],
      
      '.performance_template': {
        stage: 'test',
        script: [
          'npm run test:performance -- --environment=$ENVIRONMENT --reporter=json',
          'npm run performance:report -- --input=./results --output=./reports'
        ],
        artifacts: {
          when: 'always',
          expire_in: `${this.config.artifacts.retentionDays} days`,
          paths: ['results/', 'reports/', 'baselines/'],
          reports: {
            junit: 'results/junit.xml'
          }
        },
        retry: this.config.execution.retryAttempts
      }
    };
    
    // Add jobs for each environment
    this.config.execution.environments.forEach(env => {
      config[`performance:${env}`] = {
        extends: '.performance_template',
        variables: {
          ENVIRONMENT: env
        },
        rules: [
          {
            if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
          },
          {
            if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "master"'
          },
          {
            if: '$CI_PIPELINE_SOURCE == "schedule"'
          }
        ]
      };
    });
    
    // Add consolidation job
    config['consolidate:reports'] = {
      stage: 'report',
      script: [
        'npm run performance:consolidate -- --input=./results --output=./consolidated'
      ],
      dependencies: this.config.execution.environments.map(env => `performance:${env}`),
      artifacts: {
        expire_in: `${this.config.artifacts.retentionDays} days`,
        paths: ['consolidated/']
      }
    };
    
    const filePath = this.config.platforms.gitlab.configFile;
    await fs.writeFile(filePath, yaml.dump(config, { indent: 2 }));
    
    return {
      platform: 'gitlab',
      file: filePath,
      jobs: Object.keys(config).filter(key => !key.startsWith('.') && !['stages', 'variables', 'cache', 'before_script'].includes(key))
    };
  }

  /**
   * Generate Jenkins pipeline
   */
  async generateJenkinsfile() {
    const jenkinsfile = `
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: [${this.config.execution.environments.map(env => `'${env}'`).join(', ')}],
            description: 'Environment to test'
        )
        booleanParam(
            name: 'FORCE_BASELINE_UPDATE',
            defaultValue: false,
            description: 'Force update baselines even if regressions detected'
        )
    }
    
    environment {
        NODE_VERSION = '18'
        PERFORMANCE_TIMEOUT = '${this.config.execution.timeout}'
    }
    
    stages {
        stage('Setup') {
            steps {
                checkout scm
                sh 'npm ci'
            }
        }
        
        stage('Performance Tests') {
            parallel {
${this.config.execution.environments.map(env => `
                stage('Test ${env}') {
                    steps {
                        script {
                            try {
                                sh """
                                    npm run test:performance -- \
                                        --environment=${env} \
                                        --timeout=\$PERFORMANCE_TIMEOUT \
                                        --reporter=json
                                """
                                sh """
                                    npm run performance:report -- \
                                        --input=./results \
                                        --output=./reports-${env}
                                """
                            } catch (Exception e) {
                                currentBuild.result = 'UNSTABLE'
                                echo "Performance tests failed for ${env}: \${e.getMessage()}"
                            }
                        }
                    }
                    post {
                        always {
                            archiveArtifacts(
                                artifacts: 'results/**, reports-${env}/**',
                                allowEmptyArchive: true
                            )
                        }
                    }
                }`).join('')}
            }
        }
        
        stage('Consolidate Results') {
            steps {
                sh """
                    npm run performance:consolidate -- \
                        --input=./reports-* \
                        --output=./consolidated-report
                """
            }
            post {
                always {
                    archiveArtifacts(
                        artifacts: 'consolidated-report/**',
                        allowEmptyArchive: true
                    )
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'consolidated-report',
                        reportFiles: 'report.html',
                        reportName: 'Performance Report'
                    ])
                }
            }
        }
        
        stage('Check Regressions') {
            when {
                expression { params.FORCE_BASELINE_UPDATE == false }
            }
            steps {
                script {
                    def regressionFile = 'consolidated-report/regression-analysis.json'
                    if (fileExists(regressionFile)) {
                        def analysis = readJSON file: regressionFile
                        if (analysis.summary.criticalRegressions > 0) {
                            error "Critical performance regressions detected: \${analysis.summary.criticalRegressions}"
                        }
                        if (analysis.summary.regressionCount > 0) {
                            currentBuild.result = 'UNSTABLE'
                            echo "Performance regressions detected: \${analysis.summary.regressionCount}"
                        }
                    }
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        failure {
            emailext(
                subject: "Performance Test Failed: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: "Performance regression testing failed. Check console output at \${env.BUILD_URL}",
                to: "\${env.PERFORMANCE_ALERT_EMAIL}"
            )
        }
        unstable {
            emailext(
                subject: "Performance Regressions Detected: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: "Performance regressions detected. Review report at \${env.BUILD_URL}",
                to: "\${env.PERFORMANCE_ALERT_EMAIL}"
            )
        }
    }
}
    `;
    
    const filePath = this.config.platforms.jenkins.configFile;
    await fs.writeFile(filePath, jenkinsfile);
    
    return {
      platform: 'jenkins',
      file: filePath
    };
  }

  /**
   * Generate Azure Pipelines configuration
   */
  async generateAzurePipelines() {
    const config = {
      trigger: {
        branches: {
          include: ['main', 'master', 'develop']
        }
      },
      
      pr: {
        branches: {
          include: ['main', 'master']
        }
      },
      
      schedules: [{
        cron: '0 2 * * *',
        displayName: 'Daily performance tests',
        branches: {
          include: ['main']
        },
        always: true
      }],
      
      variables: {
        nodeVersion: '18',
        performanceTimeout: this.config.execution.timeout
      },
      
      pool: {
        vmImage: 'ubuntu-latest'
      },
      
      stages: [
        {
          stage: 'PerformanceTests',
          displayName: 'Performance Testing',
          jobs: this.config.execution.environments.map(env => ({
            job: `Performance_${env}`,
            displayName: `Performance Tests - ${env}`,
            steps: [
              {
                task: 'NodeTool@0',
                inputs: {
                  versionSpec: '$(nodeVersion)'
                },
                displayName: 'Setup Node.js'
              },
              {
                script: 'npm ci',
                displayName: 'Install dependencies'
              },
              {
                script: `
                  npm run test:performance -- \
                    --environment=${env} \
                    --timeout=$(performanceTimeout) \
                    --reporter=json
                `,
                displayName: `Run performance tests - ${env}`,
                env: {
                  ENVIRONMENT: env,
                  PERFORMANCE_WEBHOOK_URL: '$(PERFORMANCE_WEBHOOK_URL)',
                  SLACK_WEBHOOK_URL: '$(SLACK_WEBHOOK_URL)'
                }
              },
              {
                script: `
                  npm run performance:report -- \
                    --input=./results \
                    --output=./reports-${env}
                `,
                displayName: 'Generate performance report',
                condition: 'always()'
              },
              {
                task: 'PublishTestResults@2',
                inputs: {
                  testResultsFormat: 'JUnit',
                  testResultsFiles: 'results/junit.xml',
                  mergeTestResults: true,
                  testRunTitle: `Performance Tests - ${env}`
                },
                condition: 'always()'
              },
              {
                task: 'PublishBuildArtifacts@1',
                inputs: {
                  pathToPublish: `reports-${env}`,
                  artifactName: `performance-report-${env}`
                },
                condition: 'always()'
              }
            ]
          }))
        },
        
        {
          stage: 'ConsolidateResults',
          displayName: 'Consolidate Results',
          dependsOn: 'PerformanceTests',
          condition: 'always()',
          jobs: [{
            job: 'ConsolidateReports',
            displayName: 'Consolidate Performance Reports',
            steps: [
              {
                task: 'DownloadBuildArtifacts@0',
                inputs: {
                  buildType: 'current',
                  downloadType: 'all',
                  downloadPath: '$(System.ArtifactsDirectory)'
                },
                displayName: 'Download all artifacts'
              },
              {
                script: `
                  npm run performance:consolidate -- \
                    --input=$(System.ArtifactsDirectory) \
                    --output=./consolidated-report
                `,
                displayName: 'Consolidate reports'
              },
              {
                task: 'PublishBuildArtifacts@1',
                inputs: {
                  pathToPublish: 'consolidated-report',
                  artifactName: 'consolidated-performance-report'
                },
                displayName: 'Publish consolidated report'
              }
            ]
          }]
        }
      ]
    };
    
    const filePath = this.config.platforms.azure.configFile;
    await fs.writeFile(filePath, yaml.dump(config, { indent: 2 }));
    
    return {
      platform: 'azure',
      file: filePath,
      stages: config.stages.length
    };
  }

  /**
   * Generate package.json scripts for performance testing
   */
  async generatePackageScripts() {
    const scripts = {
      'test:performance': 'node tests/performance-regression/runner.js',
      'test:performance:baseline': 'node tests/performance-regression/baseline-runner.js',
      'performance:report': 'node tests/performance-regression/report-generator.js',
      'performance:consolidate': 'node tests/performance-regression/consolidator.js',
      'performance:dashboard': 'node tests/performance-regression/dashboard-generator.js',
      'performance:analyze': 'node tests/performance-regression/analyzer.js'
    };
    
    return scripts;
  }

  /**
   * Generate environment-specific configuration files
   */
  async generateEnvironmentConfigs() {
    const configs = {};
    
    for (const env of this.config.execution.environments) {
      configs[env] = {
        environment: env,
        baseUrl: process.env[`${env.toUpperCase()}_BASE_URL`] || `https://${env}.example.com`,
        timeout: this.config.execution.timeout,
        retries: this.config.execution.retryAttempts,
        thresholds: {
          performance: {
            warning: env === 'production' ? 10 : 15,
            critical: env === 'production' ? 20 : 30
          },
          memory: {
            warning: 15,
            critical: 30
          }
        },
        notifications: {
          slack: {
            enabled: true,
            channel: `#performance-${env}`
          },
          email: {
            enabled: env === 'production',
            recipients: process.env[`${env.toUpperCase()}_ALERT_EMAILS`]?.split(',') || []
          }
        }
      };
    }
    
    return configs;
  }

  /**
   * Validate CI/CD configuration
   */
  validateConfiguration() {
    const errors = [];
    const warnings = [];
    
    // Check required environment variables
    const requiredEnvVars = [
      'NODE_ENV',
      'PERFORMANCE_WEBHOOK_URL'
    ];
    
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        warnings.push(`Environment variable ${envVar} is not set`);
      }
    });
    
    // Validate platform configurations
    const enabledPlatforms = Object.entries(this.config.platforms)
      .filter(([_, config]) => config.enabled)
      .map(([platform, _]) => platform);
    
    if (enabledPlatforms.length === 0) {
      errors.push('No CI/CD platforms are enabled');
    }
    
    // Validate execution configuration
    if (this.config.execution.environments.length === 0) {
      errors.push('No test environments configured');
    }
    
    if (this.config.execution.parallelJobs < 1 || this.config.execution.parallelJobs > 10) {
      warnings.push('Parallel jobs should be between 1 and 10');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      enabledPlatforms
    };
  }

  /**
   * Generate setup instructions
   */
  generateSetupInstructions() {
    const enabledPlatforms = Object.entries(this.config.platforms)
      .filter(([_, config]) => config.enabled)
      .map(([platform, _]) => platform);
    
    return {
      overview: 'Performance regression testing CI/CD integration setup',
      
      requirements: [
        'Node.js 18 or higher',
        'npm or yarn package manager',
        'Access to CI/CD platform administration'
      ],
      
      environmentVariables: {
        required: [
          'PERFORMANCE_WEBHOOK_URL - Webhook URL for performance alerts',
          'NODE_ENV - Environment identifier'
        ],
        optional: [
          'SLACK_WEBHOOK_URL - Slack notifications',
          'SMTP_* - Email notifications',
          'GITHUB_TOKEN - GitHub API access'
        ]
      },
      
      steps: [
        'Run generateAllConfigurations() to create CI/CD files',
        'Commit generated configuration files to repository',
        'Configure environment variables in CI/CD platform',
        'Set up artifact storage and retention policies',
        'Configure notification channels (Slack, email)',
        'Test configuration with a manual trigger',
        'Schedule regular performance monitoring'
      ],
      
      platforms: enabledPlatforms.map(platform => ({
        platform,
        files: this.getPlatformFiles(platform),
        additionalSteps: this.getPlatformSpecificSteps(platform)
      }))
    };
  }

  getPlatformFiles(platform) {
    const files = {
      github: ['.github/workflows/*.yml'],
      gitlab: ['.gitlab-ci.yml'],
      jenkins: ['Jenkinsfile'],
      azure: ['azure-pipelines.yml']
    };
    
    return files[platform] || [];
  }

  getPlatformSpecificSteps(platform) {
    const steps = {
      github: [
        'Enable GitHub Actions in repository settings',
        'Configure secrets in repository settings',
        'Enable GitHub Pages for report hosting (optional)'
      ],
      gitlab: [
        'Configure CI/CD variables in GitLab project settings',
        'Enable GitLab Pages for report hosting (optional)',
        'Set up GitLab runners if using self-hosted'
      ],
      jenkins: [
        'Install required plugins (NodeJS, Pipeline, HTML Publisher)',
        'Configure global tools (Node.js)',
        'Set up environment variables in Jenkins configuration'
      ],
      azure: [
        'Configure pipeline variables in Azure DevOps',
        'Set up service connections if needed',
        'Configure build artifact retention policies'
      ]
    };
    
    return steps[platform] || [];
  }
}

module.exports = PipelineIntegration;