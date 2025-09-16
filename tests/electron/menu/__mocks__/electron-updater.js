/**
 * Mock for electron-updater
 */

const autoUpdater = {
  checkForUpdatesAndNotify: jest.fn().mockResolvedValue({
    downloadPromise: Promise.resolve(),
    cancellationToken: {
      cancelled: false,
      cancel: jest.fn()
    }
  }),
  checkForUpdates: jest.fn().mockResolvedValue({
    downloadPromise: Promise.resolve(),
    cancellationToken: {
      cancelled: false,
      cancel: jest.fn()
    }
  }),
  downloadUpdate: jest.fn().mockResolvedValue([]),
  quitAndInstall: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  emit: jest.fn(),
  setFeedURL: jest.fn(),
  getFeedURL: jest.fn().mockReturnValue(''),
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowPrerelease: false,
  fullChangelog: false,
  allowDowngrade: false,
  currentVersion: {
    version: '1.0.0',
    files: []
  }
};

module.exports = {
  autoUpdater
};