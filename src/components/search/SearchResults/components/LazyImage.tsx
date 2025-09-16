/**
 * LazyImage Component
 *
 * Optimized image loading with intersection observer and fallback handling
 * @version 2.0.0
 */

import React, { memo, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { LazyImageProps } from '../types';
import { supportsIntersectionObserver } from '../utils';

/**
 * Lazy loading image component with intersection observer optimization
 */
export const LazyImage: React.FC<LazyImageProps> = memo(({
  src,
  alt,
  className = '',
  fallbackSrc = '/assets/placeholder-image.svg',
  observerOptions = { threshold: 0.1, rootMargin: '50px' },
  placeholder,
  errorPlaceholder
}) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Initialize intersection observer
  useEffect(() => {
    if (!supportsIntersectionObserver() || !imgRef.current) {
      // Fallback: load image immediately if no intersection observer support
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      observerOptions
    );

    observerRef.current = observer;
    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [observerOptions]);

  // Load image when in view
  useEffect(() => {
    if (isInView && src && !imageSrc) {
      setImageSrc(src);
    }
  }, [isInView, src, imageSrc]);

  // Image load handler
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  // Image error handler
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);

    // Try fallback if different from current src
    if (fallbackSrc && fallbackSrc !== imageSrc) {
      setImageSrc(fallbackSrc);
      setHasError(false);
      setIsLoading(true);
    }
  }, [fallbackSrc, imageSrc]);

  // Default placeholder
  const defaultPlaceholder = (
    <div
      className="absolute inset-0 bg-gray-200 animate-pulse rounded flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  // Default error placeholder
  const defaultErrorPlaceholder = (
    <div
      className="absolute inset-0 bg-gray-100 rounded flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="text-gray-500 text-sm text-center">
        <div className="text-2xl mb-1">📷</div>
        <div>Image unavailable</div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Loading placeholder */}
      {isLoading && !hasError && (
        placeholder || defaultPlaceholder
      )}

      {/* Error placeholder */}
      {hasError && !isLoading && (
        errorPlaceholder || defaultErrorPlaceholder
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`
          ${className}
          ${isLoading || hasError ? 'opacity-0' : 'opacity-100'}
          transition-opacity duration-300
        `}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        style={{
          display: imageSrc ? 'block' : 'none'
        }}
      />
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// Simplified version without intersection observer for cases where it's not needed
export const SimpleImage: React.FC<Omit<LazyImageProps, 'observerOptions'>> = memo(({
  src,
  alt,
  className = '',
  fallbackSrc = '/assets/placeholder-image.svg',
  placeholder,
  errorPlaceholder
}) => {
  const [isLoading, setIsLoading] = useState(!!src);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);

    if (fallbackSrc && fallbackSrc !== imageSrc) {
      setImageSrc(fallbackSrc);
      setHasError(false);
      setIsLoading(true);
    }
  }, [fallbackSrc, imageSrc]);

  useEffect(() => {
    setImageSrc(src);
    setIsLoading(!!src);
    setHasError(false);
  }, [src]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && !hasError && (
        placeholder || (
          <div
            className="absolute inset-0 bg-gray-200 animate-pulse rounded"
            aria-hidden="true"
          />
        )
      )}

      {hasError && !isLoading && (
        errorPlaceholder || (
          <div
            className="absolute inset-0 bg-gray-100 rounded flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="text-gray-500 text-sm">Failed to load</span>
          </div>
        )
      )}

      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          className={`
            ${className}
            ${isLoading || hasError ? 'opacity-0' : 'opacity-100'}
            transition-opacity duration-300
          `}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
});

SimpleImage.displayName = 'SimpleImage';

export default LazyImage;