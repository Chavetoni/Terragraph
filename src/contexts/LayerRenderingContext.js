import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ThreeJsContext } from './ThreeJsContext';
import { useLayers } from './LayersContext';
import { useDisplayOptions } from './DisplayOptionsContext';
import { scene3dLogger } from '../utils/Logger.js';

const LayerRenderingContext = createContext();

export const LayerRenderingProvider = ({ children }) => {
  const { sceneManager, isInitialized, toggleGroundGrid } = useContext(ThreeJsContext);
  const { layers, strataDimensions, viewMode, verticalSpacing } = useLayers();
  const { 
    showStrata, 
    showLabels, 
    showDepthMarkers, 
    showConnectors,
    showGroundGrid
  } = useDisplayOptions();

  // Memoize display options to prevent unnecessary re-renders
  const displayOptions = useMemo(() => ({
    strataDimensions,
    viewMode,
    verticalSpacing,
    showStrata,
    showLabels,
    showDepthMarkers,
    showConnectors
  }), [strataDimensions, viewMode, verticalSpacing, showStrata, showLabels, showDepthMarkers, showConnectors]);

  // Track last render to prevent redundant updates
  const lastRenderRef = useRef(null);
  
  // Effect to handle layer data changes (structural changes and property changes)
  useEffect(() => {
    if (sceneManager && isInitialized && layers) {
      try {
        // Include layer properties (color, depth, name) in render key to detect property changes
        const renderKey = `${layers.length}-${layers.map(l => `${l.id}-${l.color}-${l.depth}-${l.name}`).join('-')}`;
        if (lastRenderRef.current?.layerKey !== renderKey) {
          sceneManager.drawSoilLayers(layers, displayOptions);
          lastRenderRef.current = { ...lastRenderRef.current, layerKey: renderKey };
        }
      } catch (error) {
        scene3dLogger.error('Error rendering soil layers (layer data):', error);
      }
    }
  }, [sceneManager, isInitialized, layers, displayOptions]);

  // Effect to handle strata-specific display changes
  useEffect(() => {
    if (sceneManager && isInitialized && layers) {
      try {
        const strataKey = `${showStrata}-${showLabels}`;
        if (lastRenderRef.current?.strataKey !== strataKey) {
          sceneManager.drawSoilLayers(layers, displayOptions);
          lastRenderRef.current = { ...lastRenderRef.current, strataKey: strataKey };
        }
      } catch (error) {
        scene3dLogger.error('Error rendering soil layers (strata options):', error);
      }
    }
  }, [sceneManager, isInitialized, layers, showStrata, showLabels, displayOptions]);

  // Effect to handle layout/spacing changes
  useEffect(() => {
    if (sceneManager && isInitialized && layers) {
      try {
        const layoutKey = `${viewMode}-${verticalSpacing}-${JSON.stringify(strataDimensions)}`;
        if (lastRenderRef.current?.layoutKey !== layoutKey) {
          sceneManager.drawSoilLayers(layers, displayOptions);
          lastRenderRef.current = { ...lastRenderRef.current, layoutKey: layoutKey };
        }
      } catch (error) {
        scene3dLogger.error('Error rendering soil layers (layout):', error);
      }
    }
  }, [sceneManager, isInitialized, layers, viewMode, verticalSpacing, strataDimensions, displayOptions]);

  // Effect to handle markers and connectors
  useEffect(() => {
    if (sceneManager && isInitialized && layers) {
      try {
        const markerKey = `${showDepthMarkers}-${showConnectors}`;
        if (lastRenderRef.current?.markerKey !== markerKey) {
          sceneManager.drawSoilLayers(layers, displayOptions);
          lastRenderRef.current = { ...lastRenderRef.current, markerKey: markerKey };
        }
      } catch (error) {
        scene3dLogger.error('Error rendering soil layers (markers):', error);
      }
    }
  }, [sceneManager, isInitialized, layers, showDepthMarkers, showConnectors, displayOptions]);

  // Effect to toggle ground grid
  useEffect(() => {
    if (toggleGroundGrid && isInitialized) {
      toggleGroundGrid(showGroundGrid);
    }
  }, [toggleGroundGrid, isInitialized, showGroundGrid]);

  const value = {
    // This context doesn't need to expose anything special
    // It just ensures the layers are rendered when data changes
  };

  return (
    <LayerRenderingContext.Provider value={value}>
      {children}
    </LayerRenderingContext.Provider>
  );
};

export const useLayerRendering = () => {
  const context = useContext(LayerRenderingContext);
  if (!context) {
    throw new Error('useLayerRendering must be used within a LayerRenderingProvider');
  }
  return context;
};