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
const GeologicalModelingProvider = lazy(() => import('./GeologicalModelingContext').then(m => ({ default: m.GeologicalModelingProvider })));
const StratigraphyProvider = lazy(() => import('./StratigraphyContext').then(m => ({ default: m.StratigraphyProvider })));
const TransformationProvider = lazy(() => import('./TransformationContext').then(m => ({ default: m.TransformationProvider })));
const BoreholeProvider = lazy(() => import('./BoreholeContext').then(m => ({ default: m.BoreholeProvider })));
const ExportProvider = lazy(() => import('./ExportContext').then(m => ({ default: m.ExportProvider })));

/**
 * Loading state for providers
 * Shows a minimal loading indicator while lazy providers load
 */
const ProviderLoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#666'
  }}>
    Loading application...
  </div>
);

/**
 * Compound provider with lazy loading and better performance
 * Reduces initial bundle parse time by deferring heavy context initialization
 *
 * Provider order (outside to inside):
 * 1. Independent lazy providers (ThreeJs, Display, SiteMap, Transform, Export)
 * 2. Critical immediate providers (UI, Layers, Selection)
 * 3. Dependent lazy providers (LayerRendering, GeoModeling, Stratigraphy, Borehole)
 * 4. Children (AppLayout)
 */
const AppProviders = React.memo(({ children }) => {
  const providerTree = useMemo(() => (
    <Suspense fallback={<ProviderLoadingFallback />}>
      {/* Independent providers - can load in any order */}
      <ThreeJsProvider>
        <DisplayOptionsProvider>
          <SiteMapProvider>
            <TransformationProvider>
              <ExportProvider>
                {/* Critical providers - must load before dependent providers */}
                <UIProvider>
                  <LayersProvider>
                    <SelectionProvider>
                      {/* Dependent providers - require critical providers above */}
                      <LayerRenderingProvider>
                        <GeologicalModelingProvider>
                          <StratigraphyProvider>
                            <BoreholeProvider>
                              {children}
                            </BoreholeProvider>
                          </StratigraphyProvider>
                        </GeologicalModelingProvider>
                      </LayerRenderingProvider>
                    </SelectionProvider>
                  </LayersProvider>
                </UIProvider>
              </ExportProvider>
            </TransformationProvider>
          </SiteMapProvider>
        </DisplayOptionsProvider>
      </ThreeJsProvider>
    </Suspense>
  ), [children]);

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
          {providerTree}
        </ErrorBoundary>
      </GeologicalErrorBoundary>
    </ErrorBoundary>
  );
});

AppProviders.displayName = 'AppProviders';

export default AppProviders;