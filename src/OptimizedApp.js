import React, { useEffect } from 'react';
import AppLayout from './components/layout/AppLayout';
import AppProviders from './contexts/AppProviders';
import OptimizedAppProviders from './contexts/OptimizedAppProviders';
import ErrorBoundary from './components/ErrorBoundary';
import { PERFORMANCE_CONFIG } from './config/performance.config';
import { monitorWebVitals, monitorMemoryUsage } from './utils/performanceOptimizer';

import './App.css';

/**
 * Optimized App component with performance improvements
 * Switches between optimized and original providers based on config
 */
function OptimizedApp() {
  // Use optimized providers if enabled
  const ProvidersComponent = PERFORMANCE_CONFIG.ENABLE_OPTIMIZED_PROVIDERS 
    ? OptimizedAppProviders 
    : AppProviders;

  useEffect(() => {
    // Start performance monitoring in development
    if (PERFORMANCE_CONFIG.DEV_TOOLS.LOG_WEB_VITALS) {
      monitorWebVitals();
    }
    
    if (PERFORMANCE_CONFIG.DEV_TOOLS.MONITOR_MEMORY) {
      monitorMemoryUsage();
    }

  }, []);

  return (
    <ProvidersComponent>
      <ErrorBoundary 
        name="MainApplication" 
        title="Interface Error" 
        message="An error occurred in the user interface."
      >
        <div className="App">
          <AppLayout />
        </div>
      </ErrorBoundary>
    </ProvidersComponent>
  );
}

export default OptimizedApp;