import React, { lazy, Suspense, useState, useEffect } from 'react';

const ThreeJsCanvas = lazy(() => import('./ThreeJsCanvas'));

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

// Defers WebGL initialization to improve LCP
const LazyThreeJsCanvas = () => {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(() => {
        setShouldLoad(true);
      }, { timeout: 1000 });

      return () => {
        if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleCallbackId);
        }
      };
    } else {
      const timeoutId = setTimeout(() => {
        setShouldLoad(true);
      }, 100);

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