/**
 * Inject Floating Cost Widget directly into DOM
 * This ensures the widget is always visible regardless of React rendering issues
 */

export function injectFloatingCostWidget() {
  // Remove existing widget if present
  const existing = document.getElementById('floating-cost-widget-root');
  if (existing) {
    existing.remove();
  }

  // Create widget container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'floating-cost-widget-root';
  widgetContainer.style.cssText = `
    position: fixed;
    right: 20px;
    top: 20px;
    width: 320px;
    background: linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.95) 100%);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(161, 0, 255, 0.3);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(161, 0, 255, 0.1);
    z-index: 1000;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: move;
    user-select: none;
    color: white;
    transition: transform 0.2s ease;
  `;

  widgetContainer.innerHTML = `
    <div class="widget-content">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #A100FF 0%, #6B00FF 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            💰
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: #F3E8FF;">Cost Summary</div>
            <div style="font-size: 12px; color: #A78BFA; display: flex; align-items: center; gap: 6px;">
              <span style="width: 6px; height: 6px; background: #10B981; border-radius: 50%; display: inline-block;"></span>
              Live Tracking
            </div>
          </div>
        </div>
        <button id="widget-close-btn" style="background: rgba(255, 255, 255, 0.1); border: none; color: #9CA3AF; cursor: pointer; padding: 6px; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>

      <div style="background: linear-gradient(135deg, rgba(161, 0, 255, 0.1) 0%, rgba(107, 0, 255, 0.05) 100%); border: 1px solid rgba(161, 0, 255, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          <div>
            <div id="widget-amount" style="font-size: 32px; font-weight: 800; color: white;">$78.45</div>
            <div style="font-size: 13px; color: #A78BFA;">of $100 monthly budget</div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.2); padding: 6px 10px; border-radius: 8px;">
            <span style="color: #F59E0B;">⚠️</span>
            <span id="widget-percentage" style="font-size: 14px; color: #FCD34D; font-weight: 600;">78.5%</span>
          </div>
        </div>

        <div style="width: 100%; height: 8px; background: rgba(55, 65, 81, 0.5); border-radius: 4px; overflow: hidden;">
          <div id="widget-progress" style="width: 78.5%; height: 100%; background: linear-gradient(90deg, #F59E0B 0%, #F59E0B 100%); box-shadow: 0 0 10px rgba(245, 158, 11, 0.5); transition: width 0.5s ease;"></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 12px;">
          <div style="font-size: 12px; color: #6EE7B7; margin-bottom: 4px;">Today's Spend</div>
          <div id="widget-today" style="font-size: 20px; font-weight: 700; color: #10B981;">$2.35</div>
          <div id="widget-operations" style="font-size: 11px; color: #6EE7B7; margin-top: 2px;">24 operations</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 10px; padding: 12px;">
          <div style="font-size: 12px; color: #93C5FD; margin-bottom: 4px;">Projected</div>
          <div id="widget-projected" style="font-size: 20px; font-weight: 700; color: #60A5FA;">$96.20</div>
          <div style="font-size: 11px; color: #93C5FD; margin-top: 2px;">End of month</div>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <button id="widget-pause-btn" style="flex: 1; background: rgba(161, 0, 255, 0.2); border: 1px solid rgba(161, 0, 255, 0.3); color: #E9D5FF; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
          ⏸️ Pause AI
        </button>
        <button id="widget-details-btn" style="flex: 1; background: linear-gradient(135deg, #A100FF 0%, #6B00FF 100%); border: none; color: white; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(161, 0, 255, 0.3);">
          View Details →
        </button>
      </div>
    </div>
  `;

  // Add drag functionality
  let isDragging = false;
  let currentX: number;
  let currentY: number;
  let initialX: number;
  let initialY: number;
  let xOffset = 0;
  let yOffset = 0;

  function dragStart(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    widgetContainer.style.cursor = 'grabbing';
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    widgetContainer.style.cursor = 'move';
  }

  function drag(e: MouseEvent) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;

      widgetContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }

  widgetContainer.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Add close button functionality
  widgetContainer.querySelector('#widget-close-btn')?.addEventListener('click', () => {
    widgetContainer.style.display = 'none';
    localStorage.setItem('floating-widget-hidden', 'true');
  });

  // Add pause button functionality
  widgetContainer.querySelector('#widget-pause-btn')?.addEventListener('click', function() {
    const isPaused = this.textContent?.includes('Pause');
    this.innerHTML = isPaused ? '▶️ Resume' : '⏸️ Pause AI';
    console.log('AI', isPaused ? 'paused' : 'resumed');
  });

  // Add details button functionality
  widgetContainer.querySelector('#widget-details-btn')?.addEventListener('click', () => {
    console.log('Navigate to cost details');
    // You can dispatch a custom event here for React to handle
    window.dispatchEvent(new CustomEvent('navigate-cost-details'));
  });

  // Check if widget should be hidden
  const isHidden = localStorage.getItem('floating-widget-hidden');
  if (isHidden === 'true') {
    widgetContainer.style.display = 'none';
  }

  // Append to body
  document.body.appendChild(widgetContainer);

  // Return control functions
  return {
    show: () => {
      widgetContainer.style.display = 'block';
      localStorage.removeItem('floating-widget-hidden');
    },
    hide: () => {
      widgetContainer.style.display = 'none';
      localStorage.setItem('floating-widget-hidden', 'true');
    },
    updateData: (data: {
      amount?: number;
      percentage?: number;
      today?: number;
      operations?: number;
      projected?: number;
    }) => {
      if (data.amount !== undefined) {
        const el = document.getElementById('widget-amount');
        if (el) el.textContent = `$${data.amount.toFixed(2)}`;
      }
      if (data.percentage !== undefined) {
        const el = document.getElementById('widget-percentage');
        if (el) el.textContent = `${data.percentage.toFixed(1)}%`;
        const progress = document.getElementById('widget-progress') as HTMLElement;
        if (progress) progress.style.width = `${data.percentage}%`;
      }
      if (data.today !== undefined) {
        const el = document.getElementById('widget-today');
        if (el) el.textContent = `$${data.today.toFixed(2)}`;
      }
      if (data.operations !== undefined) {
        const el = document.getElementById('widget-operations');
        if (el) el.textContent = `${data.operations} operations`;
      }
      if (data.projected !== undefined) {
        const el = document.getElementById('widget-projected');
        if (el) el.textContent = `$${data.projected.toFixed(2)}`;
      }
    }
  };
}

// Auto-inject on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('Auto-injecting floating cost widget...');
    injectFloatingCostWidget();
  });
}