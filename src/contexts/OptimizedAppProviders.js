import React, { useMemo, lazy, Suspense } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import GeologicalErrorBoundary from '../components/GeologicalErrorBoundary';

// Critical providers that must load immediately
import { UIProvider } from './UIContext';
import { LayersProvider } from './LayersContext';
import { SelectionProvider } from './SelectionContext';

// Lazy load heavy providers to improve initial load
const ThreeJsProvider = lazy(() => import('./ThreeJsContext').then(m => ({ default: m.ThreeJsProvider })));
const DisplayOptionsProvider = lazy(() => import('./DisplayOptionsContext').then(m => ({ default: m.DisplayOptionsProvider })));
const LayerRenderingProvider = lazy(() => import('./LayerRenderingContext').then(m => ({ default: m.LayerRenderingProvider })));
const SiteMapProvider = lazy(() => import('./SiteMapContext').then(m => ({ default: m.SiteMapProvider })));
const GeologicalModelingProvider = lazy(() => import('./OptimizedGeologicalModelingContext').then(m => ({ default: m.GeologicalModelingProvider })));
const StratigraphyProvider = lazy(() => import('./StratigraphyContext').then(m => ({ default: m.StratigraphyProvider })));
const TransformationProvider = lazy(() => import('./TransformationContext').then(m => ({ default: m.TransformationProvider })));
const BoreholeProvider = lazy(() => import('./BoreholeContext').then(m => ({ default: m.BoreholeProvider })));

/**
 * Loading state for providers
 */
const ProviderLoadingFallback = ({ children }) => children;

/**
 * Optimized compound provider with lazy loading and better performance
 * Reduces initial bundle parse time by deferring heavy context initialization
 */
const OptimizedAppProviders = React.memo(({ children }) => {
  // Critical providers load immediately for UI responsiveness
  const criticalProviders = useMemo(() => (
    <UIProvider>
      <LayersProvider>
        <SelectionProvider>
          {children}
        </SelectionProvider>
      </LayersProvider>
    </UIProvider>
  ), [children]);

  // Heavy providers load lazily after initial render
  const lazyProviders = useMemo(() => (
    <Suspense fallback={<ProviderLoadingFallback>{criticalProviders}</ProviderLoadingFallback>}>
      <ThreeJsProvider>
        <DisplayOptionsProvider>
          <SiteMapProvider>
            <TransformationProvider>
              <LayerRenderingProvider>
                <GeologicalModelingProvider>
                  <StratigraphyProvider>
                    <BoreholeProvider>
                      {criticalProviders}
                    </BoreholeProvider>
                  </StratigraphyProvider>
                </GeologicalModelingProvider>
              </LayerRenderingProvider>
            </TransformationProvider>
          </SiteMapProvider>
        </DisplayOptionsProvider>
      </ThreeJsProvider>
    </Suspense>
  ), [criticalProviders]);

  return (
    <ErrorBoundary 
      name="Application" 
      title="Application Error" 
      message="An unexpected error occurred. Please try refreshing the page."
    >
      <GeologicalErrorBoundary>
        <ErrorBoundary 
          name="DataProcessing" 
          title="Data Processing Error" 
          message="An error occurred while processing geological data."
        >
          {lazyProviders}
        </ErrorBoundary>
      </GeologicalErrorBoundary>
    </ErrorBoundary>
  );
});

OptimizedAppProviders.displayName = 'OptimizedAppProviders';

export default OptimizedAppProviders;