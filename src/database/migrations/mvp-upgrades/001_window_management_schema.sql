-- Window Management Database Schema
-- Version: 1.0 
-- MVP Level: All (progressive enhancement)
-- Support for window state persistence, workspaces, and multi-window coordination

-- Enable foreign keys and performance optimizations
PRAGMA foreign_keys = ON;

-- ===== WINDOW STATE MANAGEMENT =====

-- Window state persistence table
CREATE TABLE IF NOT EXISTS window_states (
    id TEXT PRIMARY KEY,                      -- Window ID
    window_type TEXT NOT NULL,                -- WindowType enum value
    bounds_x INTEGER,                         -- Window position X
    bounds_y INTEGER,                         -- Window position Y  
    bounds_width INTEGER,                     -- Window width
    bounds_height INTEGER,                    -- Window height
    maximized BOOLEAN DEFAULT FALSE,          -- Is maximized
    minimized BOOLEAN DEFAULT FALSE,          -- Is minimized
    visible BOOLEAN DEFAULT TRUE,             -- Is visible
    focused BOOLEAN DEFAULT FALSE,            -- Is focused
    display_id INTEGER,                       -- Monitor/display ID
    z_index INTEGER,                          -- Stacking order
    workspace_id TEXT,                        -- Associated workspace
    custom_data TEXT,                         -- JSON for additional state
    last_saved DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (window_type IN (
        'main', 'pattern-dashboard', 'alert', 'pattern-viewer',
        'code-viewer', 'debug-context', 'code-search', 
        'project-workspace', 'template-editor', 'export-manager', 'import-wizard',
        'analytics-dashboard', 'ai-assistant', 'auto-resolution-monitor', 'predictive-dashboard'
    ))
);

-- ===== WORKSPACE MANAGEMENT (MVP4+) =====

-- Workspace definitions
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    mvp_level INTEGER DEFAULT 1,
    layout_type TEXT DEFAULT 'grid' CHECK(layout_type IN ('grid', 'stack', 'cascade', 'custom')),
    layout_config TEXT,                      -- JSON configuration for layout
    active BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    use_count INTEGER DEFAULT 0
);

-- Workspace window configurations
CREATE TABLE IF NOT EXISTS workspace_windows (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    window_type TEXT NOT NULL,
    required BOOLEAN DEFAULT FALSE,           -- Must be open in workspace
    auto_create BOOLEAN DEFAULT FALSE,        -- Create automatically
    position_type TEXT DEFAULT 'relative' CHECK(position_type IN ('relative', 'absolute')),
    bounds_x INTEGER,
    bounds_y INTEGER,
    bounds_width INTEGER,
    bounds_height INTEGER,
    order_index INTEGER DEFAULT 0,
    config_data TEXT,                         -- JSON for additional config
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    
    CHECK (window_type IN (
        'main', 'pattern-dashboard', 'alert', 'pattern-viewer',
        'code-viewer', 'debug-context', 'code-search', 
        'project-workspace', 'template-editor', 'export-manager', 'import-wizard',
        'analytics-dashboard', 'ai-assistant', 'auto-resolution-monitor', 'predictive-dashboard'
    ))
);

-- Window relationships (parent-child, modal, etc.)
CREATE TABLE IF NOT EXISTS window_relationships (
    source_window_id TEXT NOT NULL,
    target_window_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN ('parent', 'child', 'sibling', 'modal')),
    constraint_type TEXT CHECK(constraint_type IN ('position', 'size', 'visibility', 'focus')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (source_window_id, target_window_id, relationship_type),
    FOREIGN KEY (source_window_id) REFERENCES window_states(id) ON DELETE CASCADE,
    FOREIGN KEY (target_window_id) REFERENCES window_states(id) ON DELETE CASCADE
);

-- ===== DISPLAY CONFIGURATION TRACKING =====

-- Track display configurations for multi-monitor support
CREATE TABLE IF NOT EXISTS display_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_id INTEGER NOT NULL,
    bounds_x INTEGER NOT NULL,
    bounds_y INTEGER NOT NULL,
    bounds_width INTEGER NOT NULL,
    bounds_height INTEGER NOT NULL,
    work_area_x INTEGER NOT NULL,
    work_area_y INTEGER NOT NULL,
    work_area_width INTEGER NOT NULL,
    work_area_height INTEGER NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    scale_factor REAL DEFAULT 1.0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== WINDOW HEALTH AND METRICS =====

-- Window health tracking
CREATE TABLE IF NOT EXISTS window_health (
    window_id TEXT PRIMARY KEY,
    responsive BOOLEAN DEFAULT TRUE,
    memory_usage INTEGER,                     -- In bytes
    cpu_usage REAL,                          -- Percentage
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    last_health_check DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (window_id) REFERENCES window_states(id) ON DELETE CASCADE
);

-- Window events log
CREATE TABLE IF NOT EXISTS window_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_id TEXT NOT NULL,
    window_type TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'created', 'destroyed', 'focused', 'blurred', 'minimized', 'maximized', 
        'restored', 'moved', 'resized', 'closed', 'hidden', 'shown', 
        'ready-to-show', 'unresponsive', 'responsive'
    )),
    event_data TEXT,                          -- JSON for additional event data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (window_id) REFERENCES window_states(id) ON DELETE CASCADE
);

-- ===== IPC MESSAGE TRACKING =====

-- IPC message history (for debugging and analytics)
CREATE TABLE IF NOT EXISTS ipc_messages (
    id TEXT PRIMARY KEY,
    source_window_id TEXT,
    target_window_id TEXT,
    channel TEXT NOT NULL,
    message_data TEXT,                        -- JSON message content
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'critical')),
    requires_response BOOLEAN DEFAULT FALSE,
    response_timeout INTEGER,
    status TEXT DEFAULT 'sent' CHECK(status IN ('queued', 'sent', 'delivered', 'failed', 'timeout')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    
    INDEX (source_window_id, created_at),
    INDEX (target_window_id, created_at),
    INDEX (channel, created_at),
    INDEX (status, created_at)
);

-- ===== SESSION MANAGEMENT =====

-- Window sessions for state restoration
CREATE TABLE IF NOT EXISTS window_sessions (
    id TEXT PRIMARY KEY,
    session_name TEXT,
    mvp_level INTEGER DEFAULT 1,
    main_window_state TEXT,                  -- JSON state for main window
    active_workspace_id TEXT,
    display_config TEXT,                     -- JSON display configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_restored DATETIME,
    restore_count INTEGER DEFAULT 0,
    
    FOREIGN KEY (active_workspace_id) REFERENCES workspaces(id)
);

-- ===== PERFORMANCE INDEXES =====

-- Window state indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_window_states_type ON window_states(window_type, last_saved DESC);
CREATE INDEX IF NOT EXISTS idx_window_states_workspace ON window_states(workspace_id, window_type);
CREATE INDEX IF NOT EXISTS idx_window_states_display ON window_states(display_id, visible);
CREATE INDEX IF NOT EXISTS idx_window_states_focused ON window_states(focused DESC, last_saved DESC);

-- Workspace indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(active, last_used DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_mvp ON workspaces(mvp_level, name);

-- Workspace window indexes
CREATE INDEX IF NOT EXISTS idx_workspace_windows_workspace ON workspace_windows(workspace_id, order_index);
CREATE INDEX IF NOT EXISTS idx_workspace_windows_type ON workspace_windows(window_type, workspace_id);

-- Health monitoring indexes
CREATE INDEX IF NOT EXISTS idx_window_health_responsive ON window_health(responsive, last_health_check DESC);
CREATE INDEX IF NOT EXISTS idx_window_health_errors ON window_health(error_count DESC, warning_count DESC);

-- Event tracking indexes
CREATE INDEX IF NOT EXISTS idx_window_events_window ON window_events(window_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_window_events_type ON window_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_window_events_recent ON window_events(timestamp DESC) WHERE timestamp > datetime('now', '-1 day');

-- Display configuration indexes
CREATE INDEX IF NOT EXISTS idx_display_configs_recorded ON display_configurations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_display_configs_display ON display_configurations(display_id, recorded_at DESC);

-- ===== VIEWS FOR COMMON QUERIES =====

-- View for active windows with health status
CREATE VIEW IF NOT EXISTS v_active_windows AS
SELECT 
    ws.id,
    ws.window_type,
    ws.workspace_id,
    ws.bounds_x,
    ws.bounds_y,
    ws.bounds_width,
    ws.bounds_height,
    ws.maximized,
    ws.minimized,
    ws.visible,
    ws.focused,
    ws.display_id,
    wh.responsive,
    wh.memory_usage,
    wh.error_count,
    wh.warning_count,
    wh.last_health_check,
    ws.last_saved
FROM window_states ws
LEFT JOIN window_health wh ON ws.id = wh.window_id
WHERE ws.visible = TRUE 
ORDER BY ws.focused DESC, ws.last_saved DESC;

-- View for workspace summary
CREATE VIEW IF NOT EXISTS v_workspace_summary AS
SELECT 
    w.id,
    w.name,
    w.description,
    w.mvp_level,
    w.layout_type,
    w.active,
    COUNT(ww.id) as window_count,
    COUNT(CASE WHEN ww.required = TRUE THEN 1 END) as required_windows,
    w.last_used,
    w.use_count
FROM workspaces w
LEFT JOIN workspace_windows ww ON w.id = ww.workspace_id
GROUP BY w.id, w.name, w.description, w.mvp_level, w.layout_type, w.active, w.last_used, w.use_count
ORDER BY w.active DESC, w.last_used DESC;

-- View for window health summary
CREATE VIEW IF NOT EXISTS v_window_health_summary AS
SELECT 
    COUNT(*) as total_windows,
    COUNT(CASE WHEN wh.responsive = TRUE THEN 1 END) as responsive_windows,
    COUNT(CASE WHEN wh.responsive = FALSE THEN 1 END) as unresponsive_windows,
    COUNT(CASE WHEN wh.error_count > 0 THEN 1 END) as windows_with_errors,
    COUNT(CASE WHEN wh.warning_count > 0 THEN 1 END) as windows_with_warnings,
    AVG(wh.memory_usage) as avg_memory_usage,
    MAX(wh.memory_usage) as max_memory_usage,
    MAX(wh.last_health_check) as last_health_check
FROM window_states ws
LEFT JOIN window_health wh ON ws.id = wh.window_id
WHERE ws.visible = TRUE;

-- View for recent window events
CREATE VIEW IF NOT EXISTS v_recent_window_events AS
SELECT 
    we.window_id,
    ws.window_type,
    we.event_type,
    we.timestamp,
    we.event_data,
    ws.workspace_id
FROM window_events we
JOIN window_states ws ON we.window_id = ws.id
WHERE we.timestamp > datetime('now', '-24 hours')
ORDER BY we.timestamp DESC;

-- ===== TRIGGERS FOR DATA CONSISTENCY =====

-- Update window state timestamp on changes
CREATE TRIGGER IF NOT EXISTS tr_window_state_updated
AFTER UPDATE ON window_states
FOR EACH ROW
BEGIN
    UPDATE window_states 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Update workspace last_used on window activity
CREATE TRIGGER IF NOT EXISTS tr_workspace_last_used
AFTER UPDATE ON window_states
FOR EACH ROW
WHEN NEW.focused = TRUE AND OLD.focused = FALSE AND NEW.workspace_id IS NOT NULL
BEGIN
    UPDATE workspaces 
    SET last_used = CURRENT_TIMESTAMP,
        use_count = use_count + 1
    WHERE id = NEW.workspace_id;
END;

-- Log window events automatically
CREATE TRIGGER IF NOT EXISTS tr_log_window_focus_events
AFTER UPDATE ON window_states
FOR EACH ROW
WHEN NEW.focused != OLD.focused
BEGIN
    INSERT INTO window_events (window_id, window_type, event_type, event_data)
    VALUES (
        NEW.id, 
        NEW.window_type, 
        CASE WHEN NEW.focused = TRUE THEN 'focused' ELSE 'blurred' END,
        json_object(
            'previous_focused', OLD.focused,
            'workspace_id', NEW.workspace_id,
            'display_id', NEW.display_id
        )
    );
END;

-- Clean up old events periodically (keep last 1000 events per window)
CREATE TRIGGER IF NOT EXISTS tr_cleanup_old_events
AFTER INSERT ON window_events
FOR EACH ROW
BEGIN
    DELETE FROM window_events 
    WHERE window_id = NEW.window_id 
    AND id NOT IN (
        SELECT id FROM window_events 
        WHERE window_id = NEW.window_id 
        ORDER BY timestamp DESC 
        LIMIT 1000
    );
END;

-- Automatically create health record for new windows
CREATE TRIGGER IF NOT EXISTS tr_create_window_health
AFTER INSERT ON window_states
FOR EACH ROW
BEGIN
    INSERT INTO window_health (window_id)
    VALUES (NEW.id);
END;

-- Clean up relationships when windows are deleted
CREATE TRIGGER IF NOT EXISTS tr_cleanup_window_relationships
AFTER DELETE ON window_states
FOR EACH ROW
BEGIN
    DELETE FROM window_relationships 
    WHERE source_window_id = OLD.id OR target_window_id = OLD.id;
    
    DELETE FROM window_health 
    WHERE window_id = OLD.id;
    
    -- Keep events for historical analysis
    -- DELETE FROM window_events WHERE window_id = OLD.id;
END;

-- ===== INITIAL DATA =====

-- Create default workspace
INSERT OR IGNORE INTO workspaces (id, name, description, mvp_level, layout_type, active) 
VALUES ('default', 'Default Workspace', 'Default workspace for MVP1', 1, 'grid', TRUE);

-- Initial display configuration (will be updated by system)
INSERT OR IGNORE INTO display_configurations (
    display_id, bounds_x, bounds_y, bounds_width, bounds_height,
    work_area_x, work_area_y, work_area_width, work_area_height,
    is_primary
) VALUES (
    0, 0, 0, 1920, 1080,
    0, 0, 1920, 1040,
    TRUE
);

-- ===== MAINTENANCE PROCEDURES =====

-- Create a view for database maintenance tasks
CREATE VIEW IF NOT EXISTS v_maintenance_stats AS
SELECT 
    'window_states' as table_name,
    COUNT(*) as record_count,
    MAX(updated_at) as last_updated
FROM window_states

UNION ALL

SELECT 
    'window_events' as table_name,
    COUNT(*) as record_count,
    MAX(timestamp) as last_updated
FROM window_events

UNION ALL

SELECT 
    'ipc_messages' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as last_updated
FROM ipc_messages

UNION ALL

SELECT 
    'workspaces' as table_name,
    COUNT(*) as record_count,
    MAX(last_used) as last_updated
FROM workspaces;

-- Performance analysis
ANALYZE window_states;
ANALYZE window_events;
ANALYZE workspaces;
ANALYZE workspace_windows;
ANALYZE window_health;