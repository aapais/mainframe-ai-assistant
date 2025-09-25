'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AppUpdater = void 0;
const electron_1 = require('electron');
const electron_updater_1 = require('electron-updater');
const events_1 = require('events');
class AppUpdater extends events_1.EventEmitter {
  updateCheckInProgress = false;
  updateDownloadInProgress = false;
  silentMode = false;
  constructor() {
    super();
    this.setupAutoUpdater();
  }
  setupAutoUpdater() {
    electron_updater_1.autoUpdater.autoDownload = false;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    this.bindAutoUpdaterEvents();
  }
  bindAutoUpdaterEvents() {
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Checking for application updates...');
      this.emit('checking-for-update');
    });
    electron_updater_1.autoUpdater.on('update-available', info => {
      console.log('📦 Update available:', info.version);
      this.updateCheckInProgress = false;
      this.emit('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
        updateSize: info.files?.[0]?.size,
      });
      if (!this.silentMode) {
        this.showUpdateAvailableDialog(info);
      }
    });
    electron_updater_1.autoUpdater.on('update-not-available', info => {
      console.log('✅ Application is up to date:', info.version);
      this.updateCheckInProgress = false;
      this.emit('update-not-available', info);
      if (!this.silentMode) {
        this.showNoUpdateDialog();
      }
    });
    electron_updater_1.autoUpdater.on('error', error => {
      console.error('❌ Auto-updater error:', error);
      this.updateCheckInProgress = false;
      this.updateDownloadInProgress = false;
      this.emit('error', error);
      if (!this.silentMode) {
        this.showUpdateErrorDialog(error);
      }
    });
    electron_updater_1.autoUpdater.on('download-progress', progress => {
      const progressInfo = {
        bytesPerSecond: progress.bytesPerSecond,
        percent: Math.round(progress.percent * 100) / 100,
        transferred: progress.transferred,
        total: progress.total,
      };
      console.log(`⬇️ Download progress: ${progressInfo.percent}%`);
      this.emit('download-progress', progressInfo);
    });
    electron_updater_1.autoUpdater.on('update-downloaded', info => {
      console.log('✅ Update downloaded, ready to install:', info.version);
      this.updateDownloadInProgress = false;
      this.emit('update-downloaded', info);
      this.showUpdateReadyDialog(info);
    });
  }
  async checkForUpdates(silent = false) {
    if (this.updateCheckInProgress) {
      console.log('Update check already in progress');
      return;
    }
    this.silentMode = silent;
    this.updateCheckInProgress = true;
    try {
      await electron_updater_1.autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Error checking for updates:', error);
      this.updateCheckInProgress = false;
      throw error;
    }
  }
  async downloadUpdate() {
    if (this.updateDownloadInProgress) {
      console.log('Update download already in progress');
      return;
    }
    this.updateDownloadInProgress = true;
    try {
      await electron_updater_1.autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      this.updateDownloadInProgress = false;
      throw error;
    }
  }
  quitAndInstall() {
    electron_updater_1.autoUpdater.quitAndInstall();
  }
  getCurrentVersion() {
    return electron_1.app.getVersion();
  }
  showUpdateAvailableDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: `Current version: ${this.getCurrentVersion()}\nNew version: ${info.version}\n\nWould you like to download and install it?`,
      buttons: ['Download Now', 'Download Later', 'View Release Notes', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
    };
    electron_1.dialog.showMessageBox(options).then(response => {
      switch (response.response) {
        case 0:
          this.downloadUpdate();
          break;
        case 1:
          break;
        case 2:
          if (info.releaseNotes) {
            this.showReleaseNotes(info);
          }
          break;
        case 3:
          break;
      }
    });
  }
  showNoUpdateDialog() {
    electron_1.dialog.showMessageBox({
      type: 'info',
      title: 'No Updates Available',
      message: 'You are running the latest version!',
      detail: `Current version: ${this.getCurrentVersion()}`,
      buttons: ['OK'],
    });
  }
  showUpdateErrorDialog(error) {
    electron_1.dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: `Error: ${error.message}\n\nPlease check your internet connection and try again.`,
      buttons: ['OK'],
    });
  }
  showUpdateReadyDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Version ${info.version} is ready to install.\n\nThe application will restart to complete the update.`,
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1,
    };
    electron_1.dialog.showMessageBox(options).then(response => {
      if (response.response === 0) {
        this.quitAndInstall();
      }
    });
  }
  showReleaseNotes(info) {
    if (info.releaseNotes) {
      electron_1.dialog
        .showMessageBox({
          type: 'info',
          title: `Release Notes - Version ${info.version}`,
          message: "What's New",
          detail: info.releaseNotes,
          buttons: ['Close', 'Download Update'],
          defaultId: 0,
        })
        .then(response => {
          if (response.response === 1) {
            this.downloadUpdate();
          }
        });
    } else {
      electron_1.shell.openExternal(
        `https://github.com/your-org/mainframe-kb-assistant/releases/tag/v${info.version}`
      );
    }
  }
  setSilentMode(silent) {
    this.silentMode = silent;
  }
  isCheckingForUpdates() {
    return this.updateCheckInProgress;
  }
  isDownloadingUpdate() {
    return this.updateDownloadInProgress;
  }
  setUpdateServer(config) {
    if (config.provider === 'github' && config.owner && config.repo) {
      electron_updater_1.autoUpdater.setFeedURL({
        provider: 'github',
        owner: config.owner,
        repo: config.repo,
      });
    } else if (config.provider === 'generic' && config.url) {
      electron_updater_1.autoUpdater.setFeedURL({
        provider: 'generic',
        url: config.url,
      });
    }
  }
  scheduleUpdateChecks(intervalHours = 24) {
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 30000);
    setInterval(
      () => {
        this.checkForUpdates(true);
      },
      intervalHours * 60 * 60 * 1000
    );
  }
  destroy() {
    electron_updater_1.autoUpdater.removeAllListeners();
    this.removeAllListeners();
  }
}
exports.AppUpdater = AppUpdater;
//# sourceMappingURL=AppUpdater.js.map
