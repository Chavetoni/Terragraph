import React, { lazy, Suspense, useState, useEffect } from 'react';

// Lazy load the actual Three.js canvas component
const ThreeJsCanvas = lazy(() => import('./ThreeJsCanvas'));

/**
 * Loading placeholder that shows while Three.js initializes
 */
const CanvasLoadingPlaceholder = () => (
  <div 
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      color: '#666',
      fontSize: '14px',
      flexDirection: 'column',
      gap: '10px'
    }}
  >
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #333',
      borderTopColor: '#666',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>
      {`@keyframes spin { to { transform: rotate(360deg); } }`}
    </style>
    <div>Initializing 3D Scene...</div>
  </div>
);

/**
 * Lazy-loaded Three.js canvas wrapper that defers heavy initialization
 * This component dramatically improves LCP by deferring WebGL context creation
 */
const LazyThreeJsCanvas = () => {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Defer Three.js loading until after initial paint
    // Using requestIdleCallback for optimal performance
    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(() => {
        setShouldLoad(true);
      }, { timeout: 1000 }); // Fallback to 1 second if idle not detected

      return () => {
        if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleCallbackId);
        }
      };
    } else {
      // Fallback for browsers without requestIdleCallback
      const timeoutId = setTimeout(() => {
        setShouldLoad(true);
      }, 100); // Quick delay to allow initial UI render

      return () => clearTimeout(timeoutId);
    }
  }, []);

  if (!shouldLoad) {
    return <CanvasLoadingPlaceholder />;
  }

  return (
    <Suspense fallback={<CanvasLoadingPlaceholder />}>
      <ThreeJsCanvas />
    </Suspense>
  );
};

export default LazyThreeJsCanvas;