/**
 * Assistive Technology Simulator
 *
 * Simulates various assistive technologies for testing compatibility:
 * - Screen magnifiers (ZoomText, MAGic, Windows Magnifier)
 * - Voice recognition (Dragon, Voice Access)
 * - Screen readers (NVDA, JAWS, VoiceOver, Orca)
 * - Alternative input devices (switches, eye tracking)
 *
 * @author Assistive Technology Testing Team
 * @version 1.0.0
 */

import { Page } from 'playwright';

// ========================
// Types & Interfaces
// ========================

interface ZoomTextConfig {
  magnificationLevel: number;
  trackingMode: 'mouse' | 'focus' | 'caret' | 'smart';
  colorInversion: boolean;
  textEnhancement: boolean;
  smoothing: boolean;
}

interface MAGicConfig {
  magnificationLevel: number;
  enhancedCursor: boolean;
  smartInvert: boolean;
  dualMonitor: boolean;
  voice: boolean;
}

interface WindowsMagnifierConfig {
  magnificationLevel: number;
  trackingMode: 'mouse' | 'focus' | 'caret';
  smoothing: boolean;
  colorInversion: boolean;
  followNarrator: boolean;
}

interface DragonConfig {
  voiceProfile: 'standard' | 'technical' | 'medical' | 'legal';
  accuracy: number;
  commandMode: boolean;
  dictationMode: boolean;
  customCommands?: Record<string, string>;
}

interface VoiceAccessConfig {
  numberOverlay: boolean;
  gridMode: boolean;
  mouseGrid: boolean;
  spellingMode: boolean;
}

interface SwitchDeviceConfig {
  type: 'single-switch' | 'dual-switch' | 'joystick';
  scanRate?: number;
  autoAdvance?: boolean;
  switch1Action?: string;
  switch2Action?: string;
  sensitivity?: 'low' | 'medium' | 'high';
  acceleration?: boolean;
  deadZone?: number;
}

interface EyeTrackingConfig {
  gazeAccuracy: 'low' | 'medium' | 'high';
  dwellTime: number;
  blinkSelection: boolean;
  gazeClick: boolean;
  smoothPursuit: boolean;
}

interface ScreenReaderConfig {
  speechRate: 'slow' | 'medium' | 'fast';
  verbosity: 'minimal' | 'medium' | 'detailed';
  punctuationLevel: 'none' | 'some' | 'most' | 'all';
  browseMode?: boolean;
  focusMode?: boolean;
  quickNav?: boolean;
}

// ========================
// Assistive Technology Simulator Class
// ========================

export class AssistiveTechnologySimulator {

  // ========================
  // Screen Magnification Simulators
  // ========================

  async simulateZoomText(page: Page, config: ZoomTextConfig): Promise<void> {
    // Apply ZoomText magnification and tracking
    await page.addStyleTag({
      content: `
        /* ZoomText Simulation */
        html {
          zoom: ${config.magnificationLevel}%;
          ${config.colorInversion ? 'filter: invert(1);' : ''}
        }

        /* Enhanced text rendering */
        ${config.textEnhancement ? `
          * {
            font-smoothing: antialiased;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
        ` : ''}

        /* Tracking highlight */
        *:focus, *:hover {
          outline: 3px solid #ffff00 !important;
          outline-offset: 2px !important;
          ${config.smoothing ? 'transition: outline 0.2s ease;' : ''}
        }

        /* Cursor enhancement */
        body {
          cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="8" fill="yellow" stroke="black" stroke-width="2"/></svg>') 16 16, auto;
        }
      `
    });

    // Simulate focus tracking
    if (config.trackingMode === 'focus') {
      await page.evaluate(() => {
        let currentFocus: Element | null = null;

        const trackFocus = () => {
          const focused = document.activeElement;
          if (focused && focused !== currentFocus) {
            currentFocus = focused;

            // Ensure focused element is in viewport
            if (focused instanceof HTMLElement) {
              focused.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
              });
            }
          }
        };

        document.addEventListener('focusin', trackFocus);
        document.addEventListener('focusout', trackFocus);
      });
    }
  }

  async simulateMAGic(page: Page, config: MAGicConfig): Promise<void> {
    // Apply MAGic magnification
    await page.addStyleTag({
      content: `
        /* MAGic Simulation */
        html {
          zoom: ${config.magnificationLevel}%;
          ${config.smartInvert ? 'filter: invert(1) hue-rotate(180deg);' : ''}
        }

        /* Enhanced cursor */
        ${config.enhancedCursor ? `
          body {
            cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="12" fill="none" stroke="white" stroke-width="4"/><circle cx="24" cy="24" r="8" fill="none" stroke="black" stroke-width="2"/></svg>') 24 24, auto;
          }
        ` : ''}

        /* Focus enhancement */
        *:focus {
          outline: 4px solid #ff6600 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 10px rgba(255, 102, 0, 0.8) !important;
        }

        /* Text contrast enhancement */
        input, textarea, select {
          background: white !important;
          color: black !important;
          border: 2px solid #000 !important;
        }
      `
    });

    // Simulate voice feedback if enabled
    if (config.voice) {
      await page.evaluate(() => {
        const speakElement = (element: Element) => {
          if ('speechSynthesis' in window) {
            let text = '';
            if (element instanceof HTMLInputElement) {
              text = `${element.type} input, ${element.placeholder || 'no placeholder'}`;
            } else if (element instanceof HTMLButtonElement) {
              text = `Button, ${element.textContent}`;
            } else {
              text = element.textContent?.substring(0, 100) || 'Element';
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.2;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
          }
        };

        document.addEventListener('focusin', (e) => {
          if (e.target) speakElement(e.target as Element);
        });
      });
    }
  }

  async simulateWindowsMagnifier(page: Page, config: WindowsMagnifierConfig): Promise<void> {
    // Apply Windows Magnifier
    await page.addStyleTag({
      content: `
        /* Windows Magnifier Simulation */
        html {
          zoom: ${config.magnificationLevel}%;
          ${config.colorInversion ? 'filter: invert(1);' : ''}
        }

        /* Smooth tracking */
        ${config.smoothing ? `
          * {
            transition: all 0.3s ease !important;
          }
        ` : ''}

        /* Focus indicator */
        *:focus {
          outline: 2px solid #0078d4 !important;
          outline-offset: 2px !important;
        }

        /* Mouse tracking highlight */
        .magnifier-highlight {
          position: fixed;
          pointer-events: none;
          border: 3px solid #0078d4;
          border-radius: 4px;
          z-index: 10000;
          transition: all 0.1s ease;
        }
      `
    });

    // Implement mouse tracking
    if (config.trackingMode === 'mouse') {
      await page.evaluate(() => {
        const highlight = document.createElement('div');
        highlight.className = 'magnifier-highlight';
        document.body.appendChild(highlight);

        document.addEventListener('mousemove', (e) => {
          const target = e.target as HTMLElement;
          if (target && target !== highlight) {
            const rect = target.getBoundingClientRect();
            highlight.style.left = `${rect.left - 3}px`;
            highlight.style.top = `${rect.top - 3}px`;
            highlight.style.width = `${rect.width + 6}px`;
            highlight.style.height = `${rect.height + 6}px`;
            highlight.style.display = 'block';
          }
        });
      });
    }
  }

  // ========================
  // Voice Recognition Simulators
  // ========================

  async simulateDragon(page: Page, config: DragonConfig): Promise<void> {
    // Simulate Dragon NaturallySpeaking
    await page.evaluate((config) => {
      // Add Dragon command interface
      const dragonInterface = {
        accuracy: config.accuracy,
        commandMode: config.commandMode,
        customCommands: config.customCommands || {}
      };

      // Add to window object for testing access
      (window as any).dragonInterface = dragonInterface;

      // Simulate command recognition accuracy
      const originalAddEventListener = Element.prototype.addEventListener;
      Element.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && config.commandMode) {
          // Add command recognition delay
          const wrappedListener = (e: Event) => {
            setTimeout(() => {
              if (Math.random() * 100 < config.accuracy) {
                listener.call(this, e);
              }
            }, 100 + Math.random() * 200);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    }, config);
  }

  async simulateVoiceCommand(page: Page, command: string): Promise<void> {
    // Parse and execute voice command
    const commandMap: Record<string, () => Promise<void>> = {
      'click search button': async () => {
        const searchBtn = page.locator('button[type="submit"], button:has-text("search")').first();
        await searchBtn.click();
      },
      'navigate to main content': async () => {
        const main = page.locator('main, #main, [role="main"]').first();
        await main.focus();
      },
      'select entry title field': async () => {
        const titleField = page.locator('#entry-title, input[name="title"]').first();
        await titleField.focus();
      },
      'scroll down': async () => {
        await page.keyboard.press('PageDown');
      }
    };

    const commandAction = commandMap[command.toLowerCase()];
    if (commandAction) {
      await commandAction();
    }
  }

  async simulateVoiceDictation(page: Page, text: string): Promise<void> {
    // Simulate voice-to-text conversion
    const processedText = this.processVoiceText(text);

    // Find focused input element
    const focusedElement = page.locator(':focus');
    await focusedElement.type(processedText, { delay: 50 });
  }

  async simulateVoiceAccess(page: Page, config: VoiceAccessConfig): Promise<void> {
    // Simulate Windows Voice Access
    if (config.numberOverlay) {
      await page.addStyleTag({
        content: `
          /* Voice Access Number Overlay */
          .voice-access-number {
            position: absolute;
            background: #0078d4;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            z-index: 10000;
            pointer-events: none;
          }
        `
      });

      await page.evaluate(() => {
        let counter = 1;
        const interactiveElements = document.querySelectorAll(
          'button, input, select, textarea, a, [role="button"], [tabindex]:not([tabindex="-1"])'
        );

        interactiveElements.forEach((element) => {
          if (element instanceof HTMLElement) {
            const rect = element.getBoundingClientRect();
            const numberLabel = document.createElement('div');
            numberLabel.className = 'voice-access-number';
            numberLabel.textContent = counter.toString();
            numberLabel.style.left = `${rect.left}px`;
            numberLabel.style.top = `${rect.top - 20}px`;
            document.body.appendChild(numberLabel);

            // Store reference for voice commands
            element.setAttribute('data-voice-number', counter.toString());
            counter++;
          }
        });
      });
    }
  }

  // ========================
  // Alternative Input Device Simulators
  // ========================

  async simulateSwitchDevice(page: Page, config: SwitchDeviceConfig): Promise<void> {
    await page.evaluate((config) => {
      let currentIndex = 0;
      let scanInterval: number;

      const focusableElements = Array.from(document.querySelectorAll(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )) as HTMLElement[];

      const highlightElement = (element: HTMLElement) => {
        // Remove previous highlights
        document.querySelectorAll('.switch-highlight').forEach(el => el.remove());

        // Add highlight
        const highlight = document.createElement('div');
        highlight.className = 'switch-highlight';
        highlight.style.cssText = `
          position: absolute;
          border: 4px solid #ff0000;
          background: rgba(255, 0, 0, 0.2);
          pointer-events: none;
          z-index: 10000;
          animation: blink 0.5s infinite;
        `;

        const rect = element.getBoundingClientRect();
        highlight.style.left = `${rect.left - 4}px`;
        highlight.style.top = `${rect.top - 4}px`;
        highlight.style.width = `${rect.width + 8}px`;
        highlight.style.height = `${rect.height + 8}px`;

        document.body.appendChild(highlight);
      };

      if (config.type === 'single-switch' && config.autoAdvance) {
        scanInterval = setInterval(() => {
          if (focusableElements[currentIndex]) {
            highlightElement(focusableElements[currentIndex]);
            currentIndex = (currentIndex + 1) % focusableElements.length;
          }
        }, config.scanRate || 1000);

        // Store for cleanup
        (window as any).switchScanInterval = scanInterval;
      }
    }, config);
  }

  async simulateJoystick(page: Page, config: SwitchDeviceConfig): Promise<void> {
    // Simulate joystick/directional pad navigation
    await page.evaluate((config) => {
      const joystickInterface = {
        sensitivity: config.sensitivity || 'medium',
        acceleration: config.acceleration,
        deadZone: config.deadZone || 0.1
      };

      (window as any).joystickInterface = joystickInterface;

      // Add spatial navigation styles
      const style = document.createElement('style');
      style.textContent = `
        .joystick-focus {
          outline: 3px solid #00ff00 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 10px rgba(0, 255, 0, 0.5) !important;
        }
      `;
      document.head.appendChild(style);
    }, config);
  }

  async simulateEyeTracking(page: Page, config: EyeTrackingConfig): Promise<void> {
    // Simulate eye tracking device
    await page.addStyleTag({
      content: `
        /* Eye tracking simulation */
        .gaze-cursor {
          position: fixed;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.2) 70%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 10000;
          transition: all 0.1s ease;
        }

        .dwell-indicator {
          position: fixed;
          width: 40px;
          height: 40px;
          border: 3px solid #0078d4;
          border-radius: 50%;
          border-top: 3px solid transparent;
          pointer-events: none;
          z-index: 10001;
          animation: dwell-countdown ${config.dwellTime}ms linear;
        }

        @keyframes dwell-countdown {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `
    });

    await page.evaluate((config) => {
      const gazeCursor = document.createElement('div');
      gazeCursor.className = 'gaze-cursor';
      document.body.appendChild(gazeCursor);

      let dwellTimer: number;
      let currentTarget: Element | null = null;

      document.addEventListener('mousemove', (e) => {
        gazeCursor.style.left = `${e.clientX - 10}px`;
        gazeCursor.style.top = `${e.clientY - 10}px`;

        const target = e.target as Element;
        if (target && target !== currentTarget) {
          currentTarget = target;

          // Clear previous dwell timer
          if (dwellTimer) clearTimeout(dwellTimer);

          // Start dwell timer for interactive elements
          if (target.matches('button, input, select, textarea, a, [role="button"]')) {
            const dwellIndicator = document.createElement('div');
            dwellIndicator.className = 'dwell-indicator';
            dwellIndicator.style.left = `${e.clientX - 20}px`;
            dwellIndicator.style.top = `${e.clientY - 20}px`;
            document.body.appendChild(dwellIndicator);

            dwellTimer = setTimeout(() => {
              // Simulate dwell click
              if (target instanceof HTMLElement) {
                target.click();
              }
              dwellIndicator.remove();
            }, config.dwellTime);

            // Remove indicator on mouse leave
            setTimeout(() => {
              if (dwellIndicator.parentNode) {
                dwellIndicator.remove();
              }
            }, config.dwellTime + 100);
          }
        }
      });
    }, config);
  }

  // ========================
  // Screen Reader Simulators
  // ========================

  async simulateWindowsNarrator(page: Page, config: ScreenReaderConfig): Promise<void> {
    await page.evaluate((config) => {
      const narratorInterface = {
        verbosity: config.verbosity,
        scanMode: true,
        announce: (text: string) => {
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = config.speechRate === 'fast' ? 2 : config.speechRate === 'slow' ? 0.5 : 1;
            speechSynthesis.speak(utterance);
          }
        }
      };

      (window as any).narratorInterface = narratorInterface;

      // Add focus announcements
      document.addEventListener('focusin', (e) => {
        const target = e.target as HTMLElement;
        if (target) {
          let announcement = '';

          if (target.tagName === 'INPUT') {
            const input = target as HTMLInputElement;
            announcement = `${input.type} input, ${input.placeholder || input.value || 'empty'}`;
          } else if (target.tagName === 'BUTTON') {
            announcement = `Button, ${target.textContent}`;
          } else if (target.hasAttribute('role')) {
            announcement = `${target.getAttribute('role')}, ${target.textContent}`;
          }

          if (announcement) {
            narratorInterface.announce(announcement);
          }
        }
      });
    }, config);
  }

  async simulateVoiceOver(page: Page, config: ScreenReaderConfig): Promise<void> {
    await page.evaluate((config) => {
      const voiceOverInterface = {
        verbosity: config.verbosity,
        quickNav: config.quickNav,
        trackingMode: 'focus'
      };

      (window as any).voiceOverInterface = voiceOverInterface;

      // Add VoiceOver cursor
      const voCursor = document.createElement('div');
      voCursor.style.cssText = `
        position: absolute;
        border: 2px solid #000;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 2px 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(voCursor);

      document.addEventListener('focusin', (e) => {
        const target = e.target as HTMLElement;
        if (target) {
          const rect = target.getBoundingClientRect();
          voCursor.style.left = `${rect.left}px`;
          voCursor.style.top = `${rect.top - 25}px`;
          voCursor.textContent = target.tagName.toLowerCase();
          voCursor.style.display = 'block';
        }
      });
    }, config);
  }

  async simulateNVDA(page: Page, config: ScreenReaderConfig): Promise<void> {
    await page.evaluate((config) => {
      const nvdaInterface = {
        speechMode: 'talk',
        browseMode: config.browseMode,
        focusMode: config.focusMode
      };

      (window as any).nvdaInterface = nvdaInterface;

      // Add NVDA virtual cursor
      if (config.browseMode) {
        let virtualCursor = 0;
        const textNodes = Array.from(document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        ).nextNode() || []);

        document.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            virtualCursor = Math.min(virtualCursor + 1, textNodes.length - 1);
            // Highlight current text node
          } else if (e.key === 'ArrowUp') {
            virtualCursor = Math.max(virtualCursor - 1, 0);
            // Highlight current text node
          }
        });
      }
    }, config);
  }

  async simulateOrca(page: Page, config: ScreenReaderConfig): Promise<void> {
    await page.evaluate((config) => {
      const orcaInterface = {
        speechRate: config.speechRate,
        punctuationLevel: config.punctuationLevel,
        keyEcho: true
      };

      (window as any).orcaInterface = orcaInterface;

      // Add Orca announcements
      document.addEventListener('keydown', (e) => {
        if (orcaInterface.keyEcho && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(e.key);
          utterance.rate = 1.5;
          utterance.volume = 0.3;
          speechSynthesis.speak(utterance);
        }
      });
    }, config);
  }

  async simulateDragonProfessional(page: Page, config: DragonConfig): Promise<void> {
    await page.evaluate((config) => {
      const dragonProfessional = {
        voiceProfile: config.voiceProfile,
        commandAccuracy: config.commandAccuracy,
        customCommands: config.customCommands || {
          'VSAM file': 'VSAM file',
          'JCL error': 'JCL error',
          'system abend': 'system abend',
          'batch job': 'batch job',
          'DB2 SQL code': 'DB2 SQLCODE',
          'cobol program': 'COBOL program',
          'sort step': 'SORT step'
        }
      };

      (window as any).dragonProfessional = dragonProfessional;
    }, config);
  }

  // ========================
  // Utility Methods
  // ========================

  private processVoiceText(text: string): string {
    // Convert common voice-to-text patterns
    const conversions: Record<string, string> = {
      'thirty-five': '35',
      'thirty five': '35',
      'oh see four': 'S0C4',
      'oh see seven': 'S0C7',
      'see see one': 'CC1',
      'jay see ell': 'JCL',
      'vee sam': 'VSAM',
      'dee bee two': 'DB2',
      'sequel': 'SQL',
      'sequel code': 'SQLCODE',
      'cobol': 'COBOL',
      'sort': 'SORT'
    };

    let processedText = text;
    for (const [pattern, replacement] of Object.entries(conversions)) {
      const regex = new RegExp(pattern, 'gi');
      processedText = processedText.replace(regex, replacement);
    }

    return processedText;
  }

  async cleanup(page: Page): Promise<void> {
    // Clean up any simulation artifacts
    await page.evaluate(() => {
      // Remove highlight elements
      document.querySelectorAll('.switch-highlight, .magnifier-highlight, .voice-access-number, .gaze-cursor, .dwell-indicator').forEach(el => el.remove());

      // Clear intervals
      if ((window as any).switchScanInterval) {
        clearInterval((window as any).switchScanInterval);
      }

      // Stop speech synthesis
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    });
  }
}

export default AssistiveTechnologySimulator;