import React, { useState, useEffect, useRef } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface LazyContentLoaderProps {
  onLoad: () => void;
  height: number;
  threshold?: number;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  className?: string;
}

const LazyContentLoader: React.FC<LazyContentLoaderProps> = ({
  onLoad,
  height,
  threshold = 100,
  loadingComponent,
  errorComponent,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          loadContent();
        }
      },
      {
        threshold: 0.1,
        rootMargin: `${threshold}px`
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [threshold, hasLoaded]);

  const loadContent = async () => {
    if (hasLoaded || isLoading) return;

    setIsLoading(true);
    setHasError(false);

    try {
      // Simulate async loading - in real implementation, this would load actual content
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

      setHasLoaded(true);
      onLoad();
    } catch (error) {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setHasError(false);
    loadContent();
  };

  if (hasLoaded) {
    return null; // Content should be rendered by parent
  }

  if (hasError) {
    return (
      <div
        ref={elementRef}
        className={`lazy-content-loader error ${className}`}
        style={{ height }}
      >
        {errorComponent || (
          <div className="flex flex-col items-center justify-center h-full text-red-600 bg-red-50 rounded">
            <div className="text-center">
              <p className="text-sm mb-2">Failed to load content</p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center space-x-1 text-sm text-red-700 hover:text-red-900 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={elementRef}
      className={`lazy-content-loader loading ${className}`}
      style={{ height }}
    >
      {loadingComponent || (
        <div className="flex items-center justify-center h-full bg-gray-50 rounded">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Loading content...</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Progressive content loader that loads content in chunks
 */
export const ProgressiveContentLoader: React.FC<{
  content: string;
  chunkSize?: number;
  loadDelay?: number;
  onChunkLoad?: (chunk: string, progress: number) => void;
  className?: string;
}> = ({
  content,
  chunkSize = 1000,
  loadDelay = 100,
  onChunkLoad,
  className = ''
}) => {
  const [loadedContent, setLoadedContent] = useState('');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const totalChunks = Math.ceil(content.length / chunkSize);
  const progress = (currentChunk / totalChunks) * 100;

  useEffect(() => {
    if (currentChunk < totalChunks && !isLoading) {
      setIsLoading(true);

      intervalRef.current = setTimeout(() => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, content.length);
        const chunk = content.slice(start, end);

        setLoadedContent(prev => prev + chunk);
        setCurrentChunk(prev => prev + 1);
        setIsLoading(false);

        onChunkLoad?.(chunk, progress);
      }, loadDelay);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [currentChunk, totalChunks, chunkSize, loadDelay, content, progress, onChunkLoad, isLoading]);

  const isComplete = currentChunk >= totalChunks;

  return (
    <div className={`progressive-content-loader ${className}`}>
      {/* Progress indicator */}
      {!isComplete && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Loading content...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Loaded content */}
      <div className="loaded-content whitespace-pre-wrap">
        {loadedContent}
        {isLoading && (
          <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
};

/**
 * Virtualized content loader for very large content
 */
export const VirtualizedContentLoader: React.FC<{
  items: string[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: string, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

  const visibleItems = items.slice(startIndex, endIndex + 1);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      className={`virtualized-content-loader overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
              className="virtualized-item"
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LazyContentLoader;