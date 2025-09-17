/// <reference types="vite/client" />

/**
 * Vite Environment Type Definitions
 * Extended for Electron + React + MVP1 Knowledge Platform
 */

interface ImportMetaEnv {
  /** Base URL for the application */
  readonly VITE_APP_TITLE: string
  
  /** Environment mode */
  readonly VITE_APP_ENV: 'development' | 'production' | 'test'
  
  /** API Configuration */
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_AI_TIMEOUT_MS?: string
  readonly VITE_ENABLE_AI_SEARCH?: string
  
  /** Database Configuration */
  readonly VITE_DB_PATH?: string
  readonly VITE_DB_MAX_SIZE_MB?: string
  readonly VITE_ENABLE_DB_BACKUP?: string
  
  /** Performance Configuration */
  readonly VITE_SEARCH_TIMEOUT_MS?: string
  readonly VITE_CACHE_SIZE_MB?: string
  readonly VITE_ENABLE_PERFORMANCE_MONITORING?: string
  
  /** Feature Flags */
  readonly VITE_ENABLE_DEV_TOOLS?: string
  readonly VITE_ENABLE_TELEMETRY?: string
  readonly VITE_OFFLINE_MODE?: string
  
  /** Build Configuration */
  readonly VITE_APP_VERSION?: string
  readonly VITE_BUILD_NUMBER?: string
  readonly VITE_COMMIT_HASH?: string
  
  /** Future MVP Feature Flags */
  readonly VITE_ENABLE_PATTERN_DETECTION?: string  // MVP2
  readonly VITE_ENABLE_CODE_ANALYSIS?: string      // MVP3
  readonly VITE_ENABLE_IDZ_INTEGRATION?: string    // MVP4
  readonly VITE_ENABLE_AUTO_RESOLUTION?: string    // MVP5
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Vite HMR API Extensions for Electron
 */
declare global {
  interface ViteHotContext {
    // Add any custom HMR handlers for Electron
  }
}

/**
 * CSS Module Declarations
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string }
  export default classes
}

/**
 * Asset Declarations
 */
declare module '*.svg' {
  import React = require('react')
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.ico' {
  const src: string
  export default src
}

declare module '*.bmp' {
  const src: string
  export default src
}

/**
 * Font Declarations
 */
declare module '*.woff' {
  const src: string
  export default src
}

declare module '*.woff2' {
  const src: string
  export default src
}

declare module '*.eot' {
  const src: string
  export default src
}

declare module '*.ttf' {
  const src: string
  export default src
}

declare module '*.otf' {
  const src: string
  export default src
}

/**
 * JSON Declarations
 */
declare module '*.json' {
  const value: any
  export default value
}

/**
 * Text File Declarations
 */
declare module '*.txt' {
  const content: string
  export default content
}

declare module '*.md' {
  const content: string
  export default content
}

/**
 * Worker Declarations
 */
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module '*?worker&inline' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

/**
 * URL Declarations
 */
declare module '*?url' {
  const url: string
  export default url
}

declare module '*?inline' {
  const content: string
  export default content
}

/**
 * Raw Declarations
 */
declare module '*?raw' {
  const content: string
  export default content
}

/**
 * Electron Specific Declarations for Renderer Process
 */
declare global {
  interface Window {
    /** Electron API exposed through context isolation */
    api: import('./src/types/index').ElectronAPI
    
    /** Electron utilities (development only) */
    __electronAPI?: {
      openDevTools: () => void
      reload: () => void
      toggleFullScreen: () => void
    }
  }
}

/**
 * Node.js Global Extensions (for Electron main process)
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
      ELECTRON_IS_DEV?: string
      PORTABLE_EXECUTABLE_DIR?: string
      
      // MVP1 Environment Variables
      GEMINI_API_KEY?: string
      DB_PATH?: string
      ENABLE_AI_SEARCH?: string
      CACHE_SIZE_MB?: string
      
      // Build Information
      APP_VERSION?: string
      BUILD_NUMBER?: string
      COMMIT_HASH?: string
      
      // Feature Flags for Future MVPs
      ENABLE_PATTERN_DETECTION?: string  // MVP2
      ENABLE_CODE_ANALYSIS?: string      // MVP3
      ENABLE_IDZ_INTEGRATION?: string    // MVP4
      ENABLE_AUTO_RESOLUTION?: string    // MVP5
    }
  }
}

/**
 * Tailwind CSS IntelliSense Support
 */
declare module 'tailwindcss/lib/util/flattenColorPalette' {
  const flattenColorPalette: (colors: any) => any
  export = flattenColorPalette
}

/**
 * Better SQLite3 Type Augmentation
 */
declare module 'better-sqlite3' {
  interface Database {
    // Add any custom methods we might add to the database
  }
}

/**
 * Electron Store Type Augmentation (for future use)
 */
declare module 'electron-store' {
  interface Options<T> {
    // Add any custom options we might use
  }
}

/**
 * React Error Boundary Types
 */
declare module 'react' {
  interface ErrorInfo {
    digest?: string
  }
}

/**
 * Custom Global Types for Development
 */
declare global {
  /** Development-only global functions */
  var __DEV__: boolean
  var __PROD__: boolean
  var __TEST__: boolean
  
  /** Performance monitoring globals */
  var __PERFORMANCE_START__: number
  var __BUNDLE_SIZE__: number
  
  /** Feature flags globals */
  var __FEATURES__: {
    AI_SEARCH: boolean
    OFFLINE_MODE: boolean
    PATTERN_DETECTION: boolean  // MVP2
    CODE_ANALYSIS: boolean      // MVP3
    IDZ_INTEGRATION: boolean    // MVP4
    AUTO_RESOLUTION: boolean    // MVP5
  }
}

export {}