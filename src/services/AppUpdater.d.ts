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
export declare class AppUpdater extends EventEmitter {
  private updateCheckInProgress;
  private updateDownloadInProgress;
  private silentMode;
  constructor();
  private setupAutoUpdater;
  private bindAutoUpdaterEvents;
  checkForUpdates(silent?: boolean): Promise<void>;
  downloadUpdate(): Promise<void>;
  quitAndInstall(): void;
  getCurrentVersion(): string;
  private showUpdateAvailableDialog;
  private showNoUpdateDialog;
  private showUpdateErrorDialog;
  private showUpdateReadyDialog;
  private showReleaseNotes;
  setSilentMode(silent: boolean): void;
  isCheckingForUpdates(): boolean;
  isDownloadingUpdate(): boolean;
  setUpdateServer(config: {
    provider: 'github' | 'generic';
    owner?: string;
    repo?: string;
    url?: string;
  }): void;
  scheduleUpdateChecks(intervalHours?: number): void;
  destroy(): void;
}
//# sourceMappingURL=AppUpdater.d.ts.map
