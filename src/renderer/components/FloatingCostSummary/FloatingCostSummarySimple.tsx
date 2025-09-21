import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, DollarSign, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface FloatingCostSummarySimpleProps {
  enabled?: boolean;
}

const FloatingCostSummarySimple: React.FC<FloatingCostSummarySimpleProps> = ({
  enabled = true
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 300, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  // Mock data
  const costData = {
    currentSpend: 78.45,
    monthlyBudget: 100,
    dailySpend: 2.35,
    operationsToday: 24,
    budgetPercentage: 78.5,
    trend: 'warning'
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 300)),
          y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 200))
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

  if (!isVisible) return null;

  // Use React Portal to render the widget at the document body level
  return ReactDOM.createPortal(
    <div
      ref={widgetRef}
      className="floating-cost-widget"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '280px',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(107, 114, 128, 0.5)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        zIndex: 9999,
        transition: isDragging ? 'none' : 'all 0.3s ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #A100FF 0%, #6B00FF 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#E5E7EB' }}>Cost Summary</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Real-time tracking</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          background: 'rgba(31, 41, 55, 0.5)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '8px'
          }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                ${costData.currentSpend.toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                of ${costData.monthlyBudget} budget
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {costData.trend === 'warning' && <AlertTriangle size={12} color="#F59E0B" />}
              <span style={{ fontSize: '12px', color: '#F59E0B' }}>
                {costData.budgetPercentage}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '6px',
            background: '#374151',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${costData.budgetPercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #A100FF 0%, #6B00FF 100%)',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <div style={{
                background: 'rgba(31, 41, 55, 0.3)',
                borderRadius: '6px',
                padding: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Today</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#10B981' }}>
                  ${costData.dailySpend.toFixed(2)}
                </div>
              </div>
              <div style={{
                background: 'rgba(31, 41, 55, 0.3)',
                borderRadius: '6px',
                padding: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Operations</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#60A5FA' }}>
                  {costData.operationsToday}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              paddingTop: '12px',
              borderTop: '1px solid rgba(107, 114, 128, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: '#10B981' }}>●</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Live</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to settings or details
                }}
                style={{
                  background: 'rgba(161, 0, 255, 0.2)',
                  border: '1px solid rgba(161, 0, 255, 0.3)',
                  color: '#A78BFA',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                View Details →
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FloatingCostSummarySimple;