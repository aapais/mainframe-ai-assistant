import { app, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { EventEmitter } from 'events';

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate: string;
  updateSize?: number;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

/**
 * Application Auto-Updater Service
 * Handles checking for updates, downloading, and applying them
 */
export class AppUpdater extends EventEmitter {
  private updateCheckInProgress = false;
  private updateDownloadInProgress = false;
  private silentMode = false;

  constructor() {
    super();
    this.setupAutoUpdater();
  }

  /**
   * Initialize auto-updater configuration
   */
  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // We'll control when to download
    autoUpdater.autoInstallOnAppQuit = true;

    // Set update server URL (configure this for your distribution)
    // autoUpdater.setFeedURL({
    //   provider: 'github',
    //   owner: 'your-org',
    //   repo: 'mainframe-kb-assistant'
    // });

    this.bindAutoUpdaterEvents();
  }

  /**
   * Bind auto-updater events
   */
  private bindAutoUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Checking for application updates...');
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', info => {
      console.log('📦 Update available:', info.version);
      this.updateCheckInProgress = false;
      this.emit('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
        updateSize: info.files?.[0]?.size,
      } as UpdateInfo);

      if (!this.silentMode) {
        this.showUpdateAvailableDialog(info);
      }
    });

    autoUpdater.on('update-not-available', info => {
      console.log('✅ Application is up to date:', info.version);
      this.updateCheckInProgress = false;
      this.emit('update-not-available', info);

      if (!this.silentMode) {
        this.showNoUpdateDialog();
      }
    });

    autoUpdater.on('error', error => {
      console.error('❌ Auto-updater error:', error);
      this.updateCheckInProgress = false;
      this.updateDownloadInProgress = false;
      this.emit('error', error);

      if (!this.silentMode) {
        this.showUpdateErrorDialog(error);
      }
    });

    autoUpdater.on('download-progress', progress => {
      const progressInfo: UpdateProgress = {
        bytesPerSecond: progress.bytesPerSecond,
        percent: Math.round(progress.percent * 100) / 100,
        transferred: progress.transferred,
        total: progress.total,
      };

      console.log(`⬇️ Download progress: ${progressInfo.percent}%`);
      this.emit('download-progress', progressInfo);
    });

    autoUpdater.on('update-downloaded', info => {
      console.log('✅ Update downloaded, ready to install:', info.version);
      this.updateDownloadInProgress = false;
      this.emit('update-downloaded', info);

      this.showUpdateReadyDialog(info);
    });
  }

  /**
   * Check for updates
   */
  async checkForUpdates(silent = false): Promise<void> {
    if (this.updateCheckInProgress) {
      console.log('Update check already in progress');
      return;
    }

    this.silentMode = silent;
    this.updateCheckInProgress = true;

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Error checking for updates:', error);
      this.updateCheckInProgress = false;
      throw error;
    }
  }

  /**
   * Download available update
   */
  async downloadUpdate(): Promise<void> {
    if (this.updateDownloadInProgress) {
      console.log('Update download already in progress');
      return;
    }

    this.updateDownloadInProgress = true;

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      this.updateDownloadInProgress = false;
      throw error;
    }
  }

  /**
   * Install downloaded update and restart application
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  /**
   * Get current application version
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }

  /**
   * Show update available dialog
   */
  private showUpdateAvailableDialog(info: any): void {
    const options = {
      type: 'info' as const,
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: `Current version: ${this.getCurrentVersion()}\nNew version: ${info.version}\n\nWould you like to download and install it?`,
      buttons: ['Download Now', 'Download Later', 'View Release Notes', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
    };

    dialog.showMessageBox(options).then(response => {
      switch (response.response) {
        case 0: // Download Now
          this.downloadUpdate();
          break;
        case 1: // Download Later
          // User chose to skip for now
          break;
        case 2: // View Release Notes
          if (info.releaseNotes) {
            this.showReleaseNotes(info);
          }
          break;
        case 3: // Skip This Version
          // Store version to skip (implement this if needed)
          break;
      }
    });
  }

  /**
   * Show no update available dialog
   */
  private showNoUpdateDialog(): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'No Updates Available',
      message: 'You are running the latest version!',
      detail: `Current version: ${this.getCurrentVersion()}`,
      buttons: ['OK'],
    });
  }

  /**
   * Show update error dialog
   */
  private showUpdateErrorDialog(error: Error): void {
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: `Error: ${error.message}\n\nPlease check your internet connection and try again.`,
      buttons: ['OK'],
    });
  }

  /**
   * Show update ready to install dialog
   */
  private showUpdateReadyDialog(info: any): void {
    const options = {
      type: 'info' as const,
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Version ${info.version} is ready to install.\n\nThe application will restart to complete the update.`,
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1,
    };

    dialog.showMessageBox(options).then(response => {
      if (response.response === 0) {
        this.quitAndInstall();
      }
    });
  }

  /**
   * Show release notes
   */
  private showReleaseNotes(info: any): void {
    if (info.releaseNotes) {
      // For now, show in a simple dialog
      // In a full implementation, you might want to open a proper window
      dialog
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
      // Open release page in browser
      shell.openExternal(
        `https://github.com/your-org/mainframe-kb-assistant/releases/tag/v${info.version}`
      );
    }
  }

  /**
   * Enable/disable silent mode
   */
  setSilentMode(silent: boolean): void {
    this.silentMode = silent;
  }

  /**
   * Check if update check is in progress
   */
  isCheckingForUpdates(): boolean {
    return this.updateCheckInProgress;
  }

  /**
   * Check if update download is in progress
   */
  isDownloadingUpdate(): boolean {
    return this.updateDownloadInProgress;
  }

  /**
   * Configure update server (call this if you want to change the default)
   */
  setUpdateServer(config: {
    provider: 'github' | 'generic';
    owner?: string;
    repo?: string;
    url?: string;
  }): void {
    if (config.provider === 'github' && config.owner && config.repo) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: config.owner,
        repo: config.repo,
      });
    } else if (config.provider === 'generic' && config.url) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: config.url,
      });
    }
  }

  /**
   * Schedule automatic update checks
   */
  scheduleUpdateChecks(intervalHours = 24): void {
    // Check for updates on startup (after a delay)
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 30000); // 30 seconds after startup

    // Schedule periodic checks
    setInterval(
      () => {
        this.checkForUpdates(true);
      },
      intervalHours * 60 * 60 * 1000
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    autoUpdater.removeAllListeners();
    this.removeAllListeners();
  }
}
