/**
 * Splash Screen - Immediate display on app launch with progress tracking
 */

import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';

export interface SplashScreenOptions {
  width: number;
  height: number;
  minDisplayTime: number; // Minimum time to show splash (ms)
  fadeOutDuration: number; // Fade out animation duration (ms)
  showProgress: boolean;
  showLogo: boolean;
  backgroundColor: string;
}

export class SplashScreen {
  private window: BrowserWindow | null = null;
  private showStartTime = 0;
  private isVisible = false;

  private readonly options: SplashScreenOptions = {
    width: 400,
    height: 300,
    minDisplayTime: 1500, // Show for at least 1.5 seconds
    fadeOutDuration: 500,
    showProgress: true,
    showLogo: true,
    backgroundColor: '#1e293b' // Dark slate background
  };

  constructor(options?: Partial<SplashScreenOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Show splash screen immediately
   */
  async show(): Promise<void> {
    if (this.window || this.isVisible) {
      return;
    }

    try {
      this.showStartTime = Date.now();
      
      // Get primary display
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

      // Create splash window
      this.window = new BrowserWindow({
        width: this.options.width,
        height: this.options.height,
        x: Math.floor((screenWidth - this.options.width) / 2),
        y: Math.floor((screenHeight - this.options.height) / 2),
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        skipTaskbar: true,
        show: false,
        backgroundColor: this.options.backgroundColor,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: false,
          webSecurity: false
        }
      });

      // Load splash screen HTML
      await this.window.loadHTML(this.generateSplashHTML());

      // Show with fade-in effect
      this.window.show();
      this.window.focus();
      this.isVisible = true;

      console.log('💫 Splash screen shown');

    } catch (error) {
      console.error('Failed to show splash screen:', error);
      // Don't fail startup if splash screen fails
    }
  }

  /**
   * Update progress bar and status text
   */
  updateProgress(progress: number): void {
    if (!this.window || this.window.isDestroyed()) return;

    try {
      this.window.webContents.executeJavaScript(`
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar) {
          progressBar.style.width = '${Math.max(0, Math.min(100, progress))}%';
        }
        if (progressText) {
          progressText.textContent = '${Math.floor(progress)}%';
        }
      `);
    } catch (error) {
      // Ignore errors - splash screen is not critical
    }
  }

  /**
   * Update status text
   */
  updateStatus(status: string, progress?: number): void {
    if (!this.window || this.window.isDestroyed()) return;

    try {
      this.window.webContents.executeJavaScript(`
        const statusText = document.getElementById('status-text');
        if (statusText) {
          statusText.textContent = '${status.replace(/'/g, "\\'")}';
        }
        
        ${progress !== undefined ? `
          const progressBar = document.getElementById('progress-bar');
          const progressText = document.getElementById('progress-text');
          
          if (progressBar) {
            progressBar.style.width = '${Math.max(0, Math.min(100, progress))}%';
          }
          if (progressText) {
            progressText.textContent = '${Math.floor(progress)}%';
          }
        ` : ''}
      `);
    } catch (error) {
      // Ignore errors - splash screen is not critical
    }
  }

  /**
   * Show error message on splash screen
   */
  showError(message: string): void {
    if (!this.window || this.window.isDestroyed()) return;

    try {
      this.window.webContents.executeJavaScript(`
        const statusText = document.getElementById('status-text');
        const progressContainer = document.getElementById('progress-container');
        
        if (statusText) {
          statusText.textContent = '${message.replace(/'/g, "\\'")}';
          statusText.style.color = '#ef4444';
        }
        
        if (progressContainer) {
          progressContainer.style.display = 'none';
        }
      `);
    } catch (error) {
      // Ignore errors - splash screen is not critical
    }
  }

  /**
   * Hide splash screen with fade out animation
   */
  async hide(): Promise<void> {
    if (!this.window || this.window.isDestroyed() || !this.isVisible) {
      return;
    }

    try {
      // Ensure minimum display time
      const displayTime = Date.now() - this.showStartTime;
      if (displayTime < this.options.minDisplayTime) {
        const remainingTime = this.options.minDisplayTime - displayTime;
        await this.sleep(remainingTime);
      }

      // Fade out animation
      await this.fadeOut();

      // Close window
      this.window.close();
      this.window = null;
      this.isVisible = false;

      console.log('💫 Splash screen hidden');

    } catch (error) {
      console.error('Error hiding splash screen:', error);
      // Force close if animation fails
      if (this.window && !this.window.isDestroyed()) {
        this.window.close();
        this.window = null;
        this.isVisible = false;
      }
    }
  }

  /**
   * Fade out animation
   */
  private async fadeOut(): Promise<void> {
    if (!this.window || this.window.isDestroyed()) return;

    try {
      // Inject fade out CSS
      await this.window.webContents.executeJavaScript(`
        document.body.style.transition = 'opacity ${this.options.fadeOutDuration}ms ease-out';
        document.body.style.opacity = '0';
      `);

      // Wait for animation to complete
      await this.sleep(this.options.fadeOutDuration + 100);
    } catch (error) {
      // Animation failed, continue with close
    }
  }

  /**
   * Generate splash screen HTML
   */
  private generateSplashHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Loading...</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
            -webkit-app-region: drag;
          }
          
          .logo {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 1rem;
            text-align: center;
            opacity: 0;
            animation: fadeInUp 0.8s ease-out 0.2s forwards;
          }
          
          .logo-icon {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            display: block;
          }
          
          .app-name {
            font-size: 1.2rem;
            font-weight: 500;
            opacity: 0.9;
          }
          
          .version {
            font-size: 0.75rem;
            opacity: 0.7;
            margin-top: 0.25rem;
          }
          
          .loading-container {
            margin-top: 2rem;
            opacity: 0;
            animation: fadeInUp 0.8s ease-out 0.6s forwards;
          }
          
          .status-text {
            font-size: 0.875rem;
            text-align: center;
            opacity: 0.8;
            margin-bottom: 1rem;
            height: 1.25rem;
          }
          
          .progress-container {
            margin-top: 1rem;
          }
          
          .progress-background {
            width: 280px;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
          }
          
          .progress-bar {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%);
            border-radius: 2px;
            transition: width 0.3s ease-out;
          }
          
          .progress-text {
            font-size: 0.75rem;
            text-align: center;
            margin-top: 0.5rem;
            opacity: 0.7;
          }
          
          .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem auto;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .error {
            color: #ef4444;
          }
        </style>
      </head>
      <body>
        <div class="logo">
          <span class="logo-icon">🧠</span>
          <div class="app-name">Mainframe KB Assistant</div>
          <div class="version">v1.0 - MVP1</div>
        </div>
        
        <div class="loading-container">
          <div class="spinner"></div>
          <div class="status-text" id="status-text">Initializing application...</div>
          
          ${this.options.showProgress ? `
            <div class="progress-container" id="progress-container">
              <div class="progress-background">
                <div class="progress-bar" id="progress-bar"></div>
              </div>
              <div class="progress-text" id="progress-text">0%</div>
            </div>
          ` : ''}
        </div>
        
        <script>
          // Prevent context menu
          window.addEventListener('contextmenu', e => e.preventDefault());
          
          // Add some life to the interface
          let dots = 0;
          setInterval(() => {
            const statusText = document.getElementById('status-text');
            if (statusText && !statusText.textContent.includes('Ready')) {
              const baseText = statusText.textContent.replace(/\\.+$/, '');
              dots = (dots + 1) % 4;
              statusText.textContent = baseText + '.'.repeat(dots);
            }
          }, 500);
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.close();
      } catch (error) {
        // Window might already be closed
      }
      this.window = null;
    }
    this.isVisible = false;
  }

  /**
   * Check if splash screen is currently visible
   */
  get visible(): boolean {
    return this.isVisible && this.window && !this.window.isDestroyed();
  }
}