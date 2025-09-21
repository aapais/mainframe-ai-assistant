import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const FloatingCostWidgetFixed: React.FC = () => {
  const [portalReady, setPortalReady] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  // Garantir que o portal seja criado apenas quando o DOM estiver pronto
  useEffect(() => {
    const timer = setTimeout(() => {
      setPortalReady(true);
      console.log('Portal ready for FloatingCostWidget');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && widgetRef.current) {
        const newX = e.clientX - dragRef.current.x;
        const newY = e.clientY - dragRef.current.y;

        const maxX = window.innerWidth - 340;
        const maxY = window.innerHeight - 400;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Widget JSX
  const widgetJSX = (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '320px',
        background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.95) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(161, 0, 255, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(161, 0, 255, 0.1)',
        zIndex: 999999,
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        cursor: isDragging ? 'grabbing' : 'move',
        userSelect: 'none',
        color: 'white'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #A100FF 0%, #6B00FF 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            💰
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#F3E8FF' }}>Cost Summary</div>
            <div style={{ fontSize: '12px', color: '#A78BFA', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                background: '#10B981',
                borderRadius: '50%',
                display: 'inline-block'
              }} />
              Live Tracking
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            const widget = document.querySelector('[data-widget-id="floating-cost"]');
            if (widget) widget.remove();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#9CA3AF',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Display */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(161, 0, 255, 0.1) 0%, rgba(107, 0, 255, 0.05) 100%)',
        border: '1px solid rgba(161, 0, 255, 0.2)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>$78.45</div>
            <div style={{ fontSize: '13px', color: '#A78BFA' }}>of $100 monthly budget</div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(245, 158, 11, 0.2)',
            padding: '6px 10px',
            borderRadius: '8px'
          }}>
            <span style={{ color: '#F59E0B' }}>⚠️</span>
            <span style={{ fontSize: '14px', color: '#FCD34D', fontWeight: 600 }}>78.5%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: 'rgba(55, 65, 81, 0.5)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '78.5%',
            height: '100%',
            background: 'linear-gradient(90deg, #F59E0B 0%, #F59E0B 100%)',
            boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)'
          }} />
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '10px',
          padding: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#6EE7B7', marginBottom: '4px' }}>Today's Spend</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#10B981' }}>$2.35</div>
          <div style={{ fontSize: '11px', color: '#6EE7B7', marginTop: '2px' }}>24 operations</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%)',
          border: '1px solid rgba(96, 165, 250, 0.2)',
          borderRadius: '10px',
          padding: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#93C5FD', marginBottom: '4px' }}>Projected</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#60A5FA' }}>$96.20</div>
          <div style={{ fontSize: '11px', color: '#93C5FD', marginTop: '2px' }}>End of month</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={{
          flex: 1,
          background: 'rgba(161, 0, 255, 0.2)',
          border: '1px solid rgba(161, 0, 255, 0.3)',
          color: '#E9D5FF',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          ⏸️ Pause AI
        </button>
        <button style={{
          flex: 1,
          background: 'linear-gradient(135deg, #A100FF 0%, #6B00FF 100%)',
          border: 'none',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(161, 0, 255, 0.3)'
        }}>
          View Details →
        </button>
      </div>
    </div>
  );

  // Adicionar atributo para identificar o widget
  useEffect(() => {
    if (portalReady && widgetRef.current) {
      widgetRef.current.setAttribute('data-widget-id', 'floating-cost');
    }
  }, [portalReady]);

  // Renderizar apenas quando portal estiver pronto
  if (!portalReady) {
    return null;
  }

  // Usar ReactDOM.createPortal para renderizar fora da hierarquia
  return ReactDOM.createPortal(widgetJSX, document.body);
};

export default FloatingCostWidgetFixed;