module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/search-interface-validation.test.js'
  ],
  verbose: true,
  collectCoverage: false,
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './reports',
      filename: 'test-report.html',
      expand: true
    }]
  ]
};