/**
 * Window Database Service - Enhanced Database Support for Window Management
 *
 * Extends the main DatabaseService to provide specialized window state management
 * functionality with proper error handling and recovery mechanisms
 */

import { DatabaseService } from './DatabaseService';
import { ServiceContext, ServiceHealth } from './ServiceManager';
import {
  WindowState,
  WindowInstance,
  WindowWorkspace,
  WindowHealth,
  WindowEventData,
  WindowIPCMessage,
} from '../windows/types/WindowTypes';

interface WindowDatabaseStats {
  totalWindows: number;
  activeWindows: number;
  workspaces: number;
  healthyWindows: number;
  recentEvents: number;
  ipcMessages: number;
}

/**
 * Window Database Service provides specialized database operations
 * for window management with proper error handling and recovery
 */
export class WindowDatabaseService extends DatabaseService {
  public readonly name = 'WindowDatabaseService';
  public readonly version = '1.0.0';
  public readonly dependencies = ['ConfigService'];

  private windowStateCache = new Map<string, WindowState>();
  private cacheTimeout = 30000; // 30 seconds
  private lastCacheUpdate = 0;

  constructor(context: ServiceContext) {
    super(context);
  }

  async initialize(context: ServiceContext): Promise<void> {
    await super.initialize(context);

    // Run window management schema migration
    await this.runWindowMigrations();

    // Initialize cache
    await this.refreshWindowStateCache();

    context.logger.info('Window Database Service initialized');
  }

  async healthCheck(): Promise<ServiceHealth> {
    const baseHealth = await super.healthCheck();

    try {
      // Additional window-specific health checks
      const stats = await this.getWindowStats();
      const recentErrors = await this.getRecentWindowErrors();

      const healthy = baseHealth.healthy && recentErrors.length < 10;

      return {
        ...baseHealth,
        healthy,
        details: {
          ...baseHealth.details,
          windowStats: stats,
          recentErrors: recentErrors.length,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: `Window health check failed: ${error.message}`,
        lastCheck: new Date(),
        responseTime: 0,
      };
    }
  }

  // ===== WINDOW STATE MANAGEMENT =====

  async saveWindowState(windowState: WindowState): Promise<void> {
    const startTime = Date.now();

    try {
      const db = await this.getDatabase();

      await db.run(
        `INSERT OR REPLACE INTO window_states (
          id, window_type, bounds_x, bounds_y, bounds_width, bounds_height,
          maximized, minimized, visible, focused, display_id, z_index,
          workspace_id, custom_data, last_saved, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          windowState.id,
          windowState.type,
          windowState.bounds.x,
          windowState.bounds.y,
          windowState.bounds.width,
          windowState.bounds.height,
          windowState.maximized ? 1 : 0,
          windowState.minimized ? 1 : 0,
          windowState.visible ? 1 : 0,
          windowState.focused ? 1 : 0,
          windowState.displayId || null,
          windowState.zIndex || null,
          windowState.workspace || null,
          JSON.stringify(windowState.customData || {}),
          new Date().toISOString(),
        ]
      );

      // Update cache
      this.windowStateCache.set(windowState.id, windowState);

      this.context.metrics.histogram('window.database.save_state', Date.now() - startTime);
      this.context.logger.debug(`Saved window state: ${windowState.id}`);
    } catch (error) {
      this.context.metrics.increment('window.database.save_state_error');
      this.context.logger.error(`Failed to save window state: ${windowState.id}`, error);
      throw error;
    }
  }

  async loadWindowState(windowId: string): Promise<WindowState | null> {
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.isWindowCacheValid() && this.windowStateCache.has(windowId)) {
        this.context.metrics.increment('window.database.cache_hit');
        return this.windowStateCache.get(windowId) || null;
      }

      const db = await this.getDatabase();

      const row = await db.get(`SELECT * FROM window_states WHERE id = ?`, [windowId]);

      if (!row) {
        this.context.metrics.increment('window.database.state_not_found');
        return null;
      }

      const windowState: WindowState = {
        id: row.id,
        type: row.window_type,
        bounds: {
          x: row.bounds_x,
          y: row.bounds_y,
          width: row.bounds_width,
          height: row.bounds_height,
        },
        maximized: Boolean(row.maximized),
        minimized: Boolean(row.minimized),
        visible: Boolean(row.visible),
        focused: Boolean(row.focused),
        displayId: row.display_id,
        zIndex: row.z_index,
        workspace: row.workspace_id,
        customData: row.custom_data ? JSON.parse(row.custom_data) : {},
        lastSaved: new Date(row.last_saved),
      };

      // Cache the result
      this.windowStateCache.set(windowId, windowState);

      this.context.metrics.histogram('window.database.load_state', Date.now() - startTime);
      return windowState;
    } catch (error) {
      this.context.metrics.increment('window.database.load_state_error');
      this.context.logger.error(`Failed to load window state: ${windowId}`, error);
      throw error;
    }
  }

  async deleteWindowState(windowId: string): Promise<void> {
    try {
      const db = await this.getDatabase();

      await db.run(`DELETE FROM window_states WHERE id = ?`, [windowId]);

      // Remove from cache
      this.windowStateCache.delete(windowId);

      this.context.logger.debug(`Deleted window state: ${windowId}`);
    } catch (error) {
      this.context.logger.error(`Failed to delete window state: ${windowId}`, error);
      throw error;
    }
  }

  async getAllWindowStates(): Promise<WindowState[]> {
    try {
      const db = await this.getDatabase();

      const rows = await db.all(`
        SELECT * FROM window_states 
        ORDER BY last_saved DESC
      `);

      return rows.map(row => ({
        id: row.id,
        type: row.window_type,
        bounds: {
          x: row.bounds_x,
          y: row.bounds_y,
          width: row.bounds_width,
          height: row.bounds_height,
        },
        maximized: Boolean(row.maximized),
        minimized: Boolean(row.minimized),
        visible: Boolean(row.visible),
        focused: Boolean(row.focused),
        displayId: row.display_id,
        zIndex: row.z_index,
        workspace: row.workspace_id,
        customData: row.custom_data ? JSON.parse(row.custom_data) : {},
        lastSaved: new Date(row.last_saved),
      }));
    } catch (error) {
      this.context.logger.error('Failed to load all window states', error);
      throw error;
    }
  }

  // ===== WORKSPACE MANAGEMENT =====

  async saveWorkspace(workspace: WindowWorkspace): Promise<void> {
    try {
      const db = await this.getDatabase();

      // Start transaction
      await db.run('BEGIN TRANSACTION');

      try {
        // Save workspace
        await db.run(
          `INSERT OR REPLACE INTO workspaces (
            id, name, description, mvp_level, layout_type, layout_config, active, last_used
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            workspace.id,
            workspace.name,
            workspace.description || null,
            workspace.mvpLevel,
            workspace.layout.type,
            JSON.stringify(workspace.layout),
            workspace.active ? 1 : 0,
            workspace.lastUsed ? workspace.lastUsed.toISOString() : null,
          ]
        );

        // Delete existing workspace windows
        await db.run(`DELETE FROM workspace_windows WHERE workspace_id = ?`, [workspace.id]);

        // Save workspace windows
        for (let i = 0; i < workspace.windows.length; i++) {
          const windowConfig = workspace.windows[i];
          await db.run(
            `INSERT INTO workspace_windows (
              id, workspace_id, window_type, required, auto_create, position_type,
              bounds_x, bounds_y, bounds_width, bounds_height, order_index, config_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `${workspace.id}-${windowConfig.type}-${i}`,
              workspace.id,
              windowConfig.type,
              windowConfig.required ? 1 : 0,
              windowConfig.autoCreate ? 1 : 0,
              windowConfig.position,
              windowConfig.x || null,
              windowConfig.y || null,
              windowConfig.width || null,
              windowConfig.height || null,
              i,
              JSON.stringify(windowConfig),
            ]
          );
        }

        await db.run('COMMIT');

        this.context.logger.info(`Saved workspace: ${workspace.name}`);
      } catch (error) {
        await db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      this.context.logger.error(`Failed to save workspace: ${workspace.name}`, error);
      throw error;
    }
  }

  async loadWorkspace(workspaceId: string): Promise<WindowWorkspace | null> {
    try {
      const db = await this.getDatabase();

      const workspaceRow = await db.get(`SELECT * FROM workspaces WHERE id = ?`, [workspaceId]);

      if (!workspaceRow) {
        return null;
      }

      const windowRows = await db.all(
        `SELECT * FROM workspace_windows WHERE workspace_id = ? ORDER BY order_index`,
        [workspaceId]
      );

      const workspace: WindowWorkspace = {
        id: workspaceRow.id,
        name: workspaceRow.name,
        description: workspaceRow.description,
        mvpLevel: workspaceRow.mvp_level,
        layout: workspaceRow.layout_config
          ? JSON.parse(workspaceRow.layout_config)
          : { type: 'grid' },
        active: Boolean(workspaceRow.active),
        created: new Date(workspaceRow.created_at),
        lastUsed: workspaceRow.last_used ? new Date(workspaceRow.last_used) : undefined,
        windows: windowRows.map(row => JSON.parse(row.config_data)),
      };

      return workspace;
    } catch (error) {
      this.context.logger.error(`Failed to load workspace: ${workspaceId}`, error);
      throw error;
    }
  }

  async getAllWorkspaces(): Promise<WindowWorkspace[]> {
    try {
      const db = await this.getDatabase();

      const rows = await db.all(`
        SELECT w.*, COUNT(ww.id) as window_count
        FROM workspaces w
        LEFT JOIN workspace_windows ww ON w.id = ww.workspace_id
        GROUP BY w.id
        ORDER BY w.last_used DESC, w.name
      `);

      const workspaces = [];

      for (const row of rows) {
        const workspace = await this.loadWorkspace(row.id);
        if (workspace) {
          workspaces.push(workspace);
        }
      }

      return workspaces;
    } catch (error) {
      this.context.logger.error('Failed to load all workspaces', error);
      throw error;
    }
  }

  // ===== WINDOW HEALTH TRACKING =====

  async updateWindowHealth(windowId: string, health: WindowHealth): Promise<void> {
    try {
      const db = await this.getDatabase();

      await db.run(
        `INSERT OR REPLACE INTO window_health (
          window_id, responsive, memory_usage, cpu_usage, error_count, 
          warning_count, last_health_check
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          windowId,
          health.responsive ? 1 : 0,
          health.memoryUsage || null,
          health.cpuUsage || null,
          health.errors.length,
          health.warnings.length,
        ]
      );

      // Store recent errors and warnings in event log
      if (health.errors.length > 0) {
        for (const error of health.errors.slice(-5)) {
          // Keep last 5 errors
          await this.logWindowEvent({
            windowId,
            windowType: 'unknown',
            event: 'unresponsive',
            timestamp: new Date(),
            data: { error },
          });
        }
      }
    } catch (error) {
      this.context.logger.error(`Failed to update window health: ${windowId}`, error);
      throw error;
    }
  }

  async getWindowHealth(windowId: string): Promise<WindowHealth | null> {
    try {
      const db = await this.getDatabase();

      const row = await db.get(`SELECT * FROM window_health WHERE window_id = ?`, [windowId]);

      if (!row) {
        return null;
      }

      // Get recent errors from event log
      const errorEvents = await db.all(
        `
        SELECT event_data FROM window_events 
        WHERE window_id = ? AND event_type = 'unresponsive' 
        ORDER BY timestamp DESC LIMIT 10
      `,
        [windowId]
      );

      const errors = errorEvents
        .map(e => (e.event_data ? JSON.parse(e.event_data).error : 'Unknown error'))
        .filter(Boolean);

      return {
        responsive: Boolean(row.responsive),
        memoryUsage: row.memory_usage,
        cpuUsage: row.cpu_usage,
        lastHealthCheck: new Date(row.last_health_check),
        errors: errors,
        warnings: [], // Could be implemented similarly
      };
    } catch (error) {
      this.context.logger.error(`Failed to get window health: ${windowId}`, error);
      return null;
    }
  }

  // ===== EVENT LOGGING =====

  async logWindowEvent(eventData: WindowEventData): Promise<void> {
    try {
      const db = await this.getDatabase();

      await db.run(
        `INSERT INTO window_events (window_id, window_type, event_type, event_data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [
          eventData.windowId,
          eventData.windowType,
          eventData.event,
          JSON.stringify(eventData.data || {}),
          eventData.timestamp.toISOString(),
        ]
      );
    } catch (error) {
      // Don't throw on event logging errors to avoid cascading failures
      this.context.logger.warn(`Failed to log window event: ${eventData.event}`, error);
    }
  }

  async logIPCMessage(message: WindowIPCMessage): Promise<void> {
    try {
      const db = await this.getDatabase();

      await db.run(
        `INSERT INTO ipc_messages (
          id, source_window_id, target_window_id, channel, message_data, 
          priority, requires_response, response_timeout, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.sourceWindowId,
          message.targetWindowId || null,
          message.channel,
          JSON.stringify(message.data),
          message.priority,
          message.requiresResponse ? 1 : 0,
          message.responseTimeout || null,
          'sent',
          message.timestamp.toISOString(),
        ]
      );
    } catch (error) {
      this.context.logger.warn(`Failed to log IPC message: ${message.channel}`, error);
    }
  }

  // ===== ANALYTICS AND STATS =====

  async getWindowStats(): Promise<WindowDatabaseStats> {
    try {
      const db = await this.getDatabase();

      const [totalWindows, activeWindows, workspaces, healthyWindows, recentEvents, ipcMessages] =
        await Promise.all([
          db.get(`SELECT COUNT(*) as count FROM window_states`),
          db.get(`SELECT COUNT(*) as count FROM window_states WHERE visible = 1`),
          db.get(`SELECT COUNT(*) as count FROM workspaces`),
          db.get(`SELECT COUNT(*) as count FROM window_health WHERE responsive = 1`),
          db.get(
            `SELECT COUNT(*) as count FROM window_events WHERE timestamp > datetime('now', '-24 hours')`
          ),
          db.get(
            `SELECT COUNT(*) as count FROM ipc_messages WHERE created_at > datetime('now', '-24 hours')`
          ),
        ]);

      return {
        totalWindows: totalWindows?.count || 0,
        activeWindows: activeWindows?.count || 0,
        workspaces: workspaces?.count || 0,
        healthyWindows: healthyWindows?.count || 0,
        recentEvents: recentEvents?.count || 0,
        ipcMessages: ipcMessages?.count || 0,
      };
    } catch (error) {
      this.context.logger.error('Failed to get window stats', error);
      throw error;
    }
  }

  async getRecentWindowErrors(): Promise<string[]> {
    try {
      const db = await this.getDatabase();

      const rows = await db.all(`
        SELECT event_data FROM window_events 
        WHERE event_type = 'unresponsive' 
        AND timestamp > datetime('now', '-1 hour')
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      return rows
        .map(row => {
          try {
            const data = JSON.parse(row.event_data);
            return data.error || 'Unknown error';
          } catch {
            return 'Parse error in event data';
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.context.logger.error('Failed to get recent window errors', error);
      return [];
    }
  }

  // ===== MAINTENANCE =====

  async cleanupOldData(): Promise<void> {
    try {
      const db = await this.getDatabase();

      // Clean up old events (keep last 30 days)
      await db.run(`
        DELETE FROM window_events 
        WHERE timestamp < datetime('now', '-30 days')
      `);

      // Clean up old IPC messages (keep last 7 days)
      await db.run(`
        DELETE FROM ipc_messages 
        WHERE created_at < datetime('now', '-7 days')
      `);

      // Clean up old display configurations (keep last 10)
      await db.run(`
        DELETE FROM display_configurations 
        WHERE id NOT IN (
          SELECT id FROM display_configurations 
          ORDER BY recorded_at DESC 
          LIMIT 10
        )
      `);

      this.context.logger.info('Window database cleanup completed');
    } catch (error) {
      this.context.logger.error('Failed to cleanup old window data', error);
      throw error;
    }
  }

  // ===== PRIVATE HELPERS =====

  private async runWindowMigrations(): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      const migrationPath = path.join(
        __dirname,
        '../../database/migrations/mvp-upgrades/001_window_management_schema.sql'
      );

      try {
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        const db = await this.getDatabase();
        await db.exec(migrationSQL);

        this.context.logger.info('Window management schema migration completed');
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.context.logger.warn('Window management migration file not found, skipping');
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.context.logger.error('Failed to run window migrations', error);
      throw error;
    }
  }

  private async refreshWindowStateCache(): Promise<void> {
    try {
      const states = await this.getAllWindowStates();
      this.windowStateCache.clear();

      for (const state of states) {
        this.windowStateCache.set(state.id, state);
      }

      this.lastCacheUpdate = Date.now();
      this.context.logger.debug(`Refreshed window state cache with ${states.length} entries`);
    } catch (error) {
      this.context.logger.warn('Failed to refresh window state cache', error);
    }
  }

  private isWindowCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheTimeout;
  }
}
