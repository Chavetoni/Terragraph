import React, { useMemo } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import GeologicalErrorBoundary from '../components/GeologicalErrorBoundary';
import { UIProvider } from './UIContext';
import { LayersProvider } from './LayersContext';
import { BoreholeProvider } from './BoreholeContext';
import { SelectionProvider } from './SelectionContext';
import { ThreeJsProvider } from './ThreeJsContext';
import { DisplayOptionsProvider } from './DisplayOptionsContext';
import { LayerRenderingProvider } from './LayerRenderingContext';
import { SiteMapProvider } from './SiteMapContext';
import { GeologicalModelingProvider } from './OptimizedGeologicalModelingContext';
import { StratigraphyProvider } from './StratigraphyContext';
import { TransformationProvider } from './TransformationContext';
import { ExportProvider } from './ExportContext';

/**
 * Compound provider to reduce nesting depth and improve performance
 * Uses React.memo and useMemo to prevent unnecessary re-renders
 */
const AppProviders = React.memo(({ children }) => {
  // Memoize the provider tree to prevent re-creation
  const providers = useMemo(() => {
    // Data-independent providers (can be initialized first)
    const independentProviders = [
      UIProvider,
      ThreeJsProvider,
      DisplayOptionsProvider,
      SiteMapProvider,
      TransformationProvider, // Add transformation tracking early in the chain
      ExportProvider, // Add export orchestration for BIM and standard exports
    ];

    // Data-dependent providers (depend on other contexts)
    const dependentProviders = [
      LayersProvider,
      LayerRenderingProvider,
      GeologicalModelingProvider,
      StratigraphyProvider,
      BoreholeProvider,
      SelectionProvider,
    ];

    return [...independentProviders, ...dependentProviders];
  }, []);

  // Build the provider tree dynamically
  const tree = providers.reduceRight((acc, Provider) => {
    return <Provider>{acc}</Provider>;
  }, children);

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
          {tree}
        </ErrorBoundary>
      </GeologicalErrorBoundary>
    </ErrorBoundary>
  );
});

AppProviders.displayName = 'AppProviders';

export default AppProviders;