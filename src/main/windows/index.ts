/**
 * Window Management System - Export Module
 *
 * Central export point for the complete window management architecture
 * supporting progressive Knowledge-First MVP development
 */

// Core Classes
export { WindowManager } from './WindowManager';
export { WindowStateManager } from './WindowStateManager';
export { WindowRegistry } from './WindowRegistry';
export { IPCCoordinator } from './IPCCoordinator';
export { WindowFactory } from './WindowFactory';

// Type Definitions
export * from './types/WindowTypes';

// Re-export existing WindowService for backward compatibility
export { WindowService } from '../services/WindowService';

/**
 * Window Management Architecture Overview
 *
 * This system provides a comprehensive, progressive window management solution
 * that evolves from simple single-window (MVP1) to complex multi-window
 * enterprise platform (MVP5).
 *
 * Architecture Components:
 *
 * 1. WindowManager (Main Orchestrator)
 *    - Central coordination of all window operations
 *    - Service integration with ServiceManager
 *    - Progressive MVP feature enablement
 *    - Workspace management (MVP4+)
 *
 * 2. WindowStateManager (Persistence Layer)
 *    - Window position/size persistence
 *    - Session restoration
 *    - Workspace layouts and templates
 *    - Multi-monitor support
 *
 * 3. WindowRegistry (Active Window Tracking)
 *    - Real-time window registry
 *    - Health monitoring
 *    - Relationship management
 *    - Query and lookup operations
 *
 * 4. IPCCoordinator (Inter-Window Communication)
 *    - Secure message passing between windows
 *    - Event broadcasting
 *    - Data synchronization
 *    - MVP-level feature gating
 *
 * 5. WindowFactory (Window Creation)
 *    - Type-specific window creation
 *    - Security configuration
 *    - Theme management
 *    - Content loading
 *
 * Progressive Enhancement by MVP:
 *
 * MVP1: Single main window with KB interface
 *   - Basic window management
 *   - State persistence
 *   - Simple IPC
 *
 * MVP2: Multi-window pattern analysis
 *   - Pattern dashboard window
 *   - Alert popup windows
 *   - Window coordination
 *   - Basic broadcasting
 *
 * MVP3: Code analysis integration
 *   - Code viewer windows
 *   - Debug context windows
 *   - Code-KB linking
 *   - Enhanced IPC for code data
 *
 * MVP4: Project workspace management
 *   - Project workspace windows
 *   - Template editor windows
 *   - Full workspace management
 *   - Advanced layouts
 *
 * MVP5: Enterprise intelligence platform
 *   - Analytics dashboard
 *   - AI assistant windows
 *   - Auto-resolution monitoring
 *   - Predictive analytics
 *   - Advanced workspace templates
 *
 * Integration Points:
 *
 * - ServiceManager: Full service lifecycle integration
 * - DatabaseService: Window state persistence to SQLite
 * - ConfigService: MVP level detection and window preferences
 * - LoggingService: Comprehensive window operation logging
 * - MetricsService: Window performance and usage metrics
 *
 * Security Features:
 *
 * - Context isolation for all windows
 * - Secure preload scripts
 * - Origin validation
 * - Permission request blocking
 * - External navigation prevention
 *
 * Performance Features:
 *
 * - Lazy window creation
 * - Memory usage monitoring
 * - Health checks
 * - Graceful degradation
 * - Resource cleanup
 */
