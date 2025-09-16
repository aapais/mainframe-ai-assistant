import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

export interface ExplanationData {
  title: string;
  summary: string;
  factors: {
    name: string;
    value: number;
    weight: number;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
  reasoning: string;
  suggestions?: string[];
  confidence: number;
  algorithm: string;
  timestamp: Date;
}

export interface RankingExplanationProps {
  explanation: ExplanationData;
  trigger: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  delay?: number;
  showOnHover?: boolean;
  showOnClick?: boolean;
  maxWidth?: number;
  className?: string;
  portal?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  'aria-label'?: string;
}

const RankingExplanation: React.FC<RankingExplanationProps> = ({
  explanation,
  trigger,
  placement = 'auto',
  delay = 300,
  showOnHover = true,
  showOnClick = false,
  maxWidth = 400,
  className = '',
  portal = true,
  onOpen,
  onClose,
  'aria-label': ariaLabel
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPlacement, setActualPlacement] = useState(placement);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const calculatePosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let newPlacement = placement;
    let x = 0;
    let y = 0;

    // Auto placement logic
    if (placement === 'auto') {
      const spaceTop = triggerRect.top;
      const spaceBottom = viewport.height - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = viewport.width - triggerRect.right;

      if (spaceBottom >= 200) newPlacement = 'bottom';
      else if (spaceTop >= 200) newPlacement = 'top';
      else if (spaceRight >= maxWidth) newPlacement = 'right';
      else if (spaceLeft >= maxWidth) newPlacement = 'left';
      else newPlacement = 'bottom';
    }

    // Calculate position based on placement
    switch (newPlacement) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2;
        y = triggerRect.top - 10;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2;
        y = triggerRect.bottom + 10;
        break;
      case 'left':
        x = triggerRect.left - 10;
        y = triggerRect.top + triggerRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + 10;
        y = triggerRect.top + triggerRect.height / 2;
        break;
    }

    setActualPlacement(newPlacement);
    setPosition({ x, y });
  };

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
      onOpen?.();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsVisible(false);
    onClose?.();
  };

  const toggleTooltip = () => {
    if (isVisible) {
      hideTooltip();
    } else {
      showTooltip();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        calculatePosition();
      }
    };

    const handleScroll = () => {
      if (isVisible) {
        calculatePosition();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        hideTooltip();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible]);

  const getTooltipTransformOrigin = () => {
    switch (actualPlacement) {
      case 'top': return 'bottom center';
      case 'bottom': return 'top center';
      case 'left': return 'right center';
      case 'right': return 'left center';
      default: return 'center';
    }
  };

  const getTooltipTransform = () => {
    switch (actualPlacement) {
      case 'top': return 'translate(-50%, -100%)';
      case 'bottom': return 'translate(-50%, 0%)';
      case 'left': return 'translate(-100%, -50%)';
      case 'right': return 'translate(0%, -50%)';
      default: return 'translate(-50%, 0%)';
    }
  };

  const renderFactorItem = (factor: typeof explanation.factors[0], index: number) => {
    const impactColors = {
      positive: 'text-green-600 bg-green-50',
      negative: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50'
    };

    const weightPercentage = Math.round(factor.weight * 100);
    const valuePercentage = Math.round(factor.value * 100);

    return (
      <motion.div
        key={factor.name}
        className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0 mb-3 last:mb-0"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm text-gray-900">
            {factor.name}
          </h4>
          <div className="flex items-center space-x-2">
            <span className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${impactColors[factor.impact]}
            `}>
              {factor.impact}
            </span>
            <span className="text-xs text-gray-500">
              {weightPercentage}% weight
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-2">
          {factor.description}
        </p>

        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <motion.div
              className={`h-1.5 rounded-full ${
                factor.impact === 'positive' ? 'bg-green-500' :
                factor.impact === 'negative' ? 'bg-red-500' : 'bg-gray-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${valuePercentage}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            />
          </div>
          <span className="text-xs text-gray-700 font-medium min-w-8">
            {valuePercentage}%
          </span>
        </div>
      </motion.div>
    );
  };

  const renderTooltipContent = () => (
    <motion.div
      ref={tooltipRef}
      className={`
        absolute z-50 bg-white rounded-lg shadow-lg border
        ${className}
      `}
      style={{
        left: position.x,
        top: position.y,
        transform: getTooltipTransform(),
        transformOrigin: getTooltipTransformOrigin(),
        maxWidth: `${maxWidth}px`,
        minWidth: '300px'
      }}
      initial={{
        opacity: 0,
        scale: 0.95,
        y: actualPlacement === 'top' ? 10 : actualPlacement === 'bottom' ? -10 : 0,
        x: actualPlacement === 'left' ? 10 : actualPlacement === 'right' ? -10 : 0
      }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        x: 0
      }}
      exit={{
        opacity: 0,
        scale: 0.95,
        y: actualPlacement === 'top' ? 5 : actualPlacement === 'bottom' ? -5 : 0
      }}
      transition={{
        duration: 0.2,
        ease: "easeOut"
      }}
      role="tooltip"
      aria-label={ariaLabel || explanation.title}
    >
      {/* Arrow */}
      <div
        className={`
          absolute w-3 h-3 bg-white border transform rotate-45
          ${actualPlacement === 'top' ? 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0' : ''}
          ${actualPlacement === 'bottom' ? 'top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0' : ''}
          ${actualPlacement === 'left' ? 'right-[-6px] top-1/2 -translate-y-1/2 border-l-0 border-b-0' : ''}
          ${actualPlacement === 'right' ? 'left-[-6px] top-1/2 -translate-y-1/2 border-r-0 border-t-0' : ''}
        `}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {explanation.title}
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              {explanation.summary}
            </p>
          </div>
          <div className="flex items-center space-x-2 ml-3">
            <span className="text-xs text-gray-500">
              {explanation.algorithm}
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-blue-600">
                {Math.round(explanation.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Factors */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Ranking Factors
          </h4>
          <div className="space-y-3">
            {explanation.factors.map((factor, index) => renderFactorItem(factor, index))}
          </div>
        </div>

        {/* Reasoning */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Algorithm Reasoning
          </h4>
          <p className="text-xs text-gray-600 leading-relaxed">
            {explanation.reasoning}
          </p>
        </div>

        {/* Suggestions */}
        {explanation.suggestions && explanation.suggestions.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Improvement Suggestions
            </h4>
            <ul className="space-y-1">
              {explanation.suggestions.map((suggestion, index) => (
                <motion.li
                  key={index}
                  className="text-xs text-gray-600 flex items-start"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <span className="text-blue-500 mr-2 text-xs">•</span>
                  {suggestion}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
          <span>
            Generated: {explanation.timestamp.toLocaleTimeString()}
          </span>
          <span>
            Confidence: {Math.round(explanation.confidence * 100)}%
          </span>
        </div>
      </div>
    </motion.div>
  );

  const enhancedTrigger = React.cloneElement(trigger, {
    ref: triggerRef,
    onMouseEnter: showOnHover ? () => {
      trigger.props.onMouseEnter?.();
      showTooltip();
    } : trigger.props.onMouseEnter,
    onMouseLeave: showOnHover ? () => {
      trigger.props.onMouseLeave?.();
      hideTooltip();
    } : trigger.props.onMouseLeave,
    onClick: showOnClick ? () => {
      trigger.props.onClick?.();
      toggleTooltip();
    } : trigger.props.onClick,
    'aria-describedby': isVisible ? 'ranking-explanation-tooltip' : undefined,
    'aria-expanded': showOnClick ? isVisible : undefined
  });

  return (
    <>
      {enhancedTrigger}
      <AnimatePresence>
        {isVisible && (
          portal ?
            createPortal(renderTooltipContent(), document.body) :
            renderTooltipContent()
        )}
      </AnimatePresence>
    </>
  );
};

export default RankingExplanation;