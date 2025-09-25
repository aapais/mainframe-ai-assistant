/**
 * Window State Manager - Progressive Persistence System
 *
 * Manages window state persistence, restoration, and workspace management
 * with progressive enhancement across MVP levels
 */

import { BrowserWindow, Rectangle, screen } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ServiceContext } from '../services/ServiceManager';
import {
  WindowState,
  WindowInstance,
  WindowWorkspace,
  WorkspaceLayout,
  WindowType,
} from './types/WindowTypes';

interface PersistedSession {
  version: string;
  mvpLevel: number;
  timestamp: Date;
  mainWindow?: WindowState;
  windows: WindowState[];
  activeWorkspace?: string;
  workspaces: WindowWorkspace[];
  displayConfiguration: DisplayConfig;
}

interface DisplayConfig {
  displays: Array<{
    id: number;
    bounds: Rectangle;
    workArea: Rectangle;
    primary: boolean;
  }>;
  timestamp: Date;
}

/**
 * Window State Manager handles:
 * MVP1: Basic window position/size persistence
 * MVP2: Multi-window state management
 * MVP3: Code window context persistence
 * MVP4: Full workspace management with layouts
 * MVP5: Advanced workspace templates and AI-driven layouts
 */
export class WindowStateManager {
  private stateFile: string;
  private workspaceDir: string;
  private currentSession: PersistedSession | null = null;
  private autoSaveEnabled = true;
  private autoSaveInterval: ReturnType<typeof setTimeout> | null = null;

  private config = {
    autoSaveInterval: 30000, // 30 seconds
    maxBackups: 5,
    compactThreshold: 100, // Compact when more than 100 windows in history
    enableMultiDisplay: true,
    validateBeforeRestore: true,
  };

  constructor(private context: ServiceContext) {
    const userDataPath = context.paths?.userData || './data';
    this.stateFile = join(userDataPath, 'window-state.json');
    this.workspaceDir = join(userDataPath, 'workspaces');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await this.ensureDirectories();

      // Load existing session
      await this.loadSession();

      // Start auto-save if enabled
      if (this.autoSaveEnabled) {
        this.startAutoSave();
      }

      this.context.logger.info('Window State Manager initialized');
    } catch (error) {
      this.context.logger.error('Failed to initialize Window State Manager', error);

      // Create default session if load fails
      this.currentSession = this.createDefaultSession();
    }
  }

  async shutdown(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Final save
    if (this.currentSession) {
      await this.saveSession();
    }

    this.context.logger.info('Window State Manager shut down');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if state file is accessible
      await fs.access(this.stateFile);

      // Verify workspace directory
      await fs.access(this.workspaceDir);

      // Check current session validity
      return this.currentSession !== null;
    } catch (error) {
      return false;
    }
  }

  // Window State Management

  async saveWindowState(windowInstance: WindowInstance): Promise<void> {
    if (!windowInstance.window || windowInstance.window.isDestroyed()) {
      return;
    }

    try {
      const bounds = windowInstance.window.getBounds();
      const display = screen.getDisplayMatching(bounds);

      const windowState: WindowState = {
        id: windowInstance.id,
        type: windowInstance.type,
        bounds,
        maximized: windowInstance.window.isMaximized(),
        minimized: windowInstance.window.isMinimized(),
        visible: windowInstance.window.isVisible(),
        focused: windowInstance.window.isFocused(),
        workspace: windowInstance.config.workspace,
        displayId: display.id,
        customData: windowInstance.metadata,
        lastSaved: new Date(),
      };

      await this.updateWindowInSession(windowState);

      this.context.logger.debug(`Saved state for window: ${windowInstance.type}`);
    } catch (error) {
      this.context.logger.error(`Failed to save window state: ${windowInstance.id}`, error);
    }
  }

  async getMainWindowState(): Promise<WindowState | null> {
    if (!this.currentSession) {
      return null;
    }

    return this.currentSession.mainWindow || null;
  }

  async getWindowState(windowId: string): Promise<WindowState | null> {
    if (!this.currentSession) {
      return null;
    }

    return this.currentSession.windows.find(w => w.id === windowId) || null;
  }

  async restoreWindowState(windowInstance: WindowInstance): Promise<boolean> {
    const savedState = await this.getWindowState(windowInstance.id);
    if (!savedState) {
      return false;
    }

    try {
      const window = windowInstance.window;

      // Validate bounds are still valid (display might have changed)
      if (this.config.enableMultiDisplay && !this.isDisplayValid(savedState.displayId)) {
        this.context.logger.warn(
          `Display ${savedState.displayId} no longer available, using primary display`
        );
        return false;
      }

      // Restore bounds
      if (this.config.validateBeforeRestore && !this.isBoundsValid(savedState.bounds)) {
        this.context.logger.warn('Invalid bounds detected, skipping restoration');
        return false;
      }

      window.setBounds(savedState.bounds);

      // Restore window state
      if (savedState.maximized) {
        window.maximize();
      } else if (savedState.minimized) {
        window.minimize();
      }

      if (!savedState.visible) {
        window.hide();
      }

      this.context.logger.debug(`Restored state for window: ${windowInstance.type}`);
      return true;
    } catch (error) {
      this.context.logger.error(`Failed to restore window state: ${windowInstance.id}`, error);
      return false;
    }
  }

  // Session Management

  async restoreSession(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    try {
      // Update display configuration
      await this.updateDisplayConfiguration();

      // Session restored successfully
      // Note: Actual window restoration is handled by WindowManager
      // This just prepares the state data

      this.context.logger.info('Session restoration prepared');
      return true;
    } catch (error) {
      this.context.logger.error('Failed to restore session', error);
      return false;
    }
  }

  async saveSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      // Update timestamp
      this.currentSession.timestamp = new Date();

      // Update display configuration
      await this.updateDisplayConfiguration();

      // Create backup before saving
      await this.createBackup();

      // Save current session
      await fs.writeFile(this.stateFile, JSON.stringify(this.currentSession, null, 2), 'utf8');

      this.context.logger.debug('Session saved successfully');
    } catch (error) {
      this.context.logger.error('Failed to save session', error);
    }
  }

  // Workspace Management (MVP4+)

  async createWorkspace(name: string, config: Partial<WindowWorkspace>): Promise<WindowWorkspace> {
    const workspace: WindowWorkspace = {
      id: `workspace-${Date.now()}`,
      name,
      description: config.description || '',
      windows: config.windows || [],
      layout: config.layout || this.createDefaultLayout(),
      created: new Date(),
      active: false,
      mvpLevel: this.getMVPLevel(),
    };

    // Save workspace file
    const workspaceFile = join(this.workspaceDir, `${workspace.id}.json`);
    await fs.writeFile(workspaceFile, JSON.stringify(workspace, null, 2), 'utf8');

    // Add to session
    if (this.currentSession) {
      this.currentSession.workspaces.push(workspace);
    }

    this.context.logger.info(`Created workspace: ${name}`);
    return workspace;
  }

  async loadWorkspace(name: string): Promise<WindowWorkspace | null> {
    if (!this.currentSession) {
      return null;
    }

    const workspace = this.currentSession.workspaces.find(w => w.name === name);
    if (workspace) {
      // Load from memory
      return workspace;
    }

    // Try loading from file
    try {
      const workspaceFiles = await fs.readdir(this.workspaceDir);
      for (const file of workspaceFiles) {
        if (file.endsWith('.json')) {
          const filePath = join(this.workspaceDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const workspaceData = JSON.parse(content) as WindowWorkspace;

          if (workspaceData.name === name) {
            return workspaceData;
          }
        }
      }
    } catch (error) {
      this.context.logger.error(`Failed to load workspace: ${name}`, error);
    }

    return null;
  }

  async saveWorkspace(workspace: WindowWorkspace): Promise<void> {
    try {
      workspace.lastUsed = new Date();

      const workspaceFile = join(this.workspaceDir, `${workspace.id}.json`);
      await fs.writeFile(workspaceFile, JSON.stringify(workspace, null, 2), 'utf8');

      // Update in session
      if (this.currentSession) {
        const index = this.currentSession.workspaces.findIndex(w => w.id === workspace.id);
        if (index >= 0) {
          this.currentSession.workspaces[index] = workspace;
        } else {
          this.currentSession.workspaces.push(workspace);
        }
      }

      this.context.logger.debug(`Saved workspace: ${workspace.name}`);
    } catch (error) {
      this.context.logger.error(`Failed to save workspace: ${workspace.name}`, error);
    }
  }

  async listWorkspaces(): Promise<WindowWorkspace[]> {
    if (!this.currentSession) {
      return [];
    }

    return [...this.currentSession.workspaces];
  }

  async deleteWorkspace(name: string): Promise<boolean> {
    try {
      if (!this.currentSession) {
        return false;
      }

      // Remove from session
      const index = this.currentSession.workspaces.findIndex(w => w.name === name);
      if (index >= 0) {
        const workspace = this.currentSession.workspaces[index];
        this.currentSession.workspaces.splice(index, 1);

        // Delete workspace file
        const workspaceFile = join(this.workspaceDir, `${workspace.id}.json`);
        await fs.unlink(workspaceFile);

        this.context.logger.info(`Deleted workspace: ${name}`);
        return true;
      }

      return false;
    } catch (error) {
      this.context.logger.error(`Failed to delete workspace: ${name}`, error);
      return false;
    }
  }

  // Layout Management

  async applyLayout(workspace: WindowWorkspace, windows: WindowInstance[]): Promise<void> {
    const layout = workspace.layout;

    switch (layout.type) {
      case 'grid':
        await this.applyGridLayout(layout, windows);
        break;
      case 'stack':
        await this.applyStackLayout(layout, windows);
        break;
      case 'cascade':
        await this.applyCascadeLayout(layout, windows);
        break;
      case 'custom':
        await this.applyCustomLayout(layout, windows);
        break;
    }
  }

  // Private Implementation

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async loadSession(): Promise<void> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf8');
      this.currentSession = JSON.parse(content);

      // Validate session version
      if (!this.currentSession?.version || this.currentSession.version !== '2.0.0') {
        this.context.logger.warn('Session version mismatch, creating new session');
        this.currentSession = this.createDefaultSession();
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create default
        this.currentSession = this.createDefaultSession();
      } else {
        throw error;
      }
    }
  }

  private createDefaultSession(): PersistedSession {
    return {
      version: '2.0.0',
      mvpLevel: this.getMVPLevel(),
      timestamp: new Date(),
      windows: [],
      workspaces: [],
      displayConfiguration: {
        displays: [],
        timestamp: new Date(),
      },
    };
  }

  private async updateWindowInSession(windowState: WindowState): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    if (windowState.type === 'main') {
      this.currentSession.mainWindow = windowState;
    } else {
      const index = this.currentSession.windows.findIndex(w => w.id === windowState.id);
      if (index >= 0) {
        this.currentSession.windows[index] = windowState;
      } else {
        this.currentSession.windows.push(windowState);
      }
    }
  }

  private async updateDisplayConfiguration(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const displays = screen.getAllDisplays().map(display => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      primary: display === screen.getPrimaryDisplay(),
    }));

    this.currentSession.displayConfiguration = {
      displays,
      timestamp: new Date(),
    };
  }

  private isDisplayValid(displayId: number): boolean {
    const displays = screen.getAllDisplays();
    return displays.some(display => display.id === displayId);
  }

  private isBoundsValid(bounds: Rectangle): boolean {
    const displays = screen.getAllDisplays();

    // Check if bounds intersect with any display
    for (const display of displays) {
      const workArea = display.workArea;
      if (
        bounds.x < workArea.x + workArea.width &&
        bounds.x + bounds.width > workArea.x &&
        bounds.y < workArea.y + workArea.height &&
        bounds.y + bounds.height > workArea.y
      ) {
        return true;
      }
    }

    return false;
  }

  private createDefaultLayout(): WorkspaceLayout {
    return {
      type: 'grid',
      columns: 2,
      rows: 2,
      margin: 10,
      distribution: 'equal',
    };
  }

  private async applyGridLayout(layout: WorkspaceLayout, windows: WindowInstance[]): Promise<void> {
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;

    const cols = layout.columns || 2;
    const rows = layout.rows || 2;
    const margin = layout.margin || 10;

    const windowWidth = Math.floor((workArea.width - margin * (cols + 1)) / cols);
    const windowHeight = Math.floor((workArea.height - margin * (rows + 1)) / rows);

    windows.forEach((windowInstance, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = workArea.x + margin + col * (windowWidth + margin);
      const y = workArea.y + margin + row * (windowHeight + margin);

      windowInstance.window.setBounds({
        x,
        y,
        width: windowWidth,
        height: windowHeight,
      });
    });
  }

  private async applyStackLayout(
    layout: WorkspaceLayout,
    windows: WindowInstance[]
  ): Promise<void> {
    // Stack windows on top of each other with slight offset
    const offset = 30;
    let baseX = 100;
    let baseY = 100;

    windows.forEach((windowInstance, index) => {
      windowInstance.window.setBounds({
        x: baseX + index * offset,
        y: baseY + index * offset,
        width: 1000,
        height: 700,
      });
    });
  }

  private async applyCascadeLayout(
    layout: WorkspaceLayout,
    windows: WindowInstance[]
  ): Promise<void> {
    // Similar to stack but with larger offsets
    const offsetX = 50;
    const offsetY = 40;
    let baseX = 50;
    let baseY = 50;

    windows.forEach((windowInstance, index) => {
      windowInstance.window.setBounds({
        x: baseX + index * offsetX,
        y: baseY + index * offsetY,
        width: 1200,
        height: 800,
      });
    });
  }

  private async applyCustomLayout(
    layout: WorkspaceLayout,
    windows: WindowInstance[]
  ): Promise<void> {
    if (!layout.customPositions) {
      return;
    }

    windows.forEach(windowInstance => {
      const position = layout.customPositions!.find(p => p.windowType === windowInstance.type);
      if (position) {
        windowInstance.window.setBounds(position.bounds);
      }
    });
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      await this.saveSession();
    }, this.config.autoSaveInterval);
  }

  private async createBackup(): Promise<void> {
    try {
      const backupFile = `${this.stateFile}.backup.${Date.now()}`;

      if (await this.fileExists(this.stateFile)) {
        await fs.copyFile(this.stateFile, backupFile);

        // Clean up old backups
        await this.cleanupOldBackups();
      }
    } catch (error) {
      this.context.logger.error('Failed to create backup', error);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const dir = require('path').dirname(this.stateFile);
      const files = await fs.readdir(dir);
      const backups = files
        .filter(file => file.includes('.backup.'))
        .map(file => ({
          name: file,
          path: join(dir, file),
          timestamp: parseInt(file.split('.backup.')[1]),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Keep only the most recent backups
      for (let i = this.config.maxBackups; i < backups.length; i++) {
        await fs.unlink(backups[i].path);
      }
    } catch (error) {
      this.context.logger.error('Failed to cleanup old backups', error);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getMVPLevel(): number {
    return parseInt(process.env.MVP_LEVEL || '1');
  }
}
