/**
 * @fileoverview Display options context for managing UI visibility controls
 * Controls global and individual visibility of 3D scene elements
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, useTransition } from 'react';
import { validationLogger } from '../utils/Logger.js';

/**
 * React context for managing display options and visibility controls
 * @type {React.Context<Object|null>}
 */
const DisplayOptionsContext = createContext(null);

export const useDisplayOptions = () => {
  const context = useContext(DisplayOptionsContext);
  if (!context) {
    throw new Error('useDisplayOptions must be used within a DisplayOptionsProvider');
  }
  return context;
};

export const DisplayOptionsProvider = ({ children }) => {
  // Performance optimization - use transitions for expensive state updates
  const [isPending, startTransition] = useTransition();
  
  // Helper function to load from localStorage with fallback
  const loadFromStorage = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      validationLogger.warn(`Failed to load ${key} from localStorage:`, e);
      return defaultValue;
    }
  };

  // Load saved states or use defaults
  const [showLayerPanel, setShowLayerPanel] = useState(() => loadFromStorage('displayOptions.showLayerPanel', true));
  const [showLabels, setShowLabels] = useState(() => loadFromStorage('displayOptions.showLabels', true));
  const [showMarkers, setShowMarkers] = useState(() => loadFromStorage('displayOptions.showMarkers', true));
  const [showDepthMarkers, setShowDepthMarkers] = useState(() => loadFromStorage('displayOptions.showDepthMarkers', true));
  const [showConnectors, setShowConnectors] = useState(() => loadFromStorage('displayOptions.showConnectors', true));
  const [showStrata, setShowStrata] = useState(() => loadFromStorage('displayOptions.showStrata', true));
  const [showGroundGrid, setShowGroundGrid] = useState(() => loadFromStorage('displayOptions.showGroundGrid', true));
  const [showBoreholes, setShowBoreholes] = useState(() => loadFromStorage('displayOptions.showBoreholes', true));
  const [showBoreholeStrata, setShowBoreholeStrata] = useState(() => loadFromStorage('displayOptions.showBoreholeStrata', true));
  const [showWaterTable, setShowWaterTable] = useState(() => loadFromStorage('displayOptions.showWaterTable', true));
  
  // Texture Enhancement Settings
  const [textureSettings, setTextureSettings] = useState(() => loadFromStorage('displayOptions.textureSettings', {
    enabled: true,
    globalIntensity: 0.7,
    patternScale: 1.0,
    blendWithColor: true,
    adaptToZoom: false,
    materialOverrides: {
      CLAY: {
        pattern: 'horizontal-lines',
        intensity: 0.8,
        scale: 1.2,
        enabled: true
      },
      SAND: {
        pattern: 'dots',
        intensity: 0.6,
        scale: 0.8,
        enabled: true
      },
      GRAVEL: {
        pattern: 'circles',
        intensity: 0.7,
        scale: 1.0,
        enabled: true
      },
      ROCK: {
        pattern: 'cross-hatch',
        intensity: 0.9,
        scale: 1.5,
        enabled: true
      },
      SILT: {
        pattern: 'diagonal-lines',
        intensity: 0.6,
        scale: 1.1,
        enabled: true
      },
      FILL: {
        pattern: 'cross-hatch',
        intensity: 0.5,
        scale: 0.9,
        enabled: true
      },
      UNKNOWN: {
        pattern: 'horizontal-lines',
        intensity: 0.4,
        scale: 1.0,
        enabled: true
      }
    }
  }));
  
  // 3D Strata Alignment Settings - for manual positioning adjustments
  const [alignmentSettings, setAlignmentSettings] = useState(() => loadFromStorage('displayOptions.alignmentSettings', {
    enabled: false, // Whether manual alignment is enabled
    position: { x: 0, y: 0, z: 0 }, // Manual position offset
    rotation: { x: 0, y: 0, z: 0 }, // Manual rotation (in radians)
    scale: { x: 1, y: 1, z: 1 }, // Manual scale factors
    autoAlign: true, // Whether to use automatic alignment based on borehole positions
    showGizmo: false // Whether to show transform gizmo for visual adjustment
  }));
  
  /**
   * Map storing individual visibility states for each borehole
   * @type {Map<string|number, boolean>} boreholesIndividualVisibility
   */
  const [boreholesIndividualVisibility, setBoreholesIndividualVisibility] = useState(() => {
    const saved = loadFromStorage('displayOptions.boreholesIndividualVisibility', []);
    return new Map(saved);
  });
  
  /**
   * Map storing individual strata visibility states for each borehole
   * @type {Map<string|number, boolean>} boreholesStrataVisibility
   */
  const [boreholesStrataVisibility, setBoreholesStrataVisibility] = useState(() => {
    const saved = loadFromStorage('displayOptions.boreholesStrataVisibility', []);
    return new Map(saved);
  });
  const [openSections, setOpenSections] = useState({
    siteMap: true,
    strataModel: true,
    layerEditor: true,
    boreholes: false,
    displayOptions: false,
    legend: false
  });

  const toggleSection = useCallback((sectionName) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  }, []);

  /**
   * Controls global visibility of all boreholes in the 3D scene
   * @param {boolean} visible - Whether boreholes should be visible
   * @callback toggleGlobalBoreholeVisibility
   */
  const toggleGlobalBoreholeVisibility = useCallback((visible) => {
    setShowBoreholes(visible);
  }, []);

  /**
   * Controls visibility of an individual borehole
   * Performance-optimized with transitions
   * @param {string|number} boreholeId - Unique identifier of the borehole
   * @param {boolean} visible - Whether this borehole should be visible
   * @callback toggleIndividualBoreholeVisibility
   */
  const toggleIndividualBoreholeVisibility = useCallback((boreholeId, visible) => {
    startTransition(() => {
      setBoreholesIndividualVisibility(prev => {
        const newMap = new Map(prev);
        newMap.set(boreholeId, visible);
        return newMap;
      });
    });
  }, []);

  /**
   * Toggles visibility of strata for a specific borehole
   * Performance-optimized with transitions to reduce blocking time
   * @param {string|number} boreholeId - Unique identifier of the borehole
   * @callback toggleBoreholeStrataVisibility
   */
  const toggleBoreholeStrataVisibility = useCallback((boreholeId) => {
    startTransition(() => {
      setBoreholesStrataVisibility(prev => {
        const updated = new Map(prev);
        updated.set(boreholeId, !(prev.get(boreholeId) ?? true));
        return updated;
      });
    });
  }, []);

  /**
   * Gets the strata visibility state for a specific borehole
   * Memoized for performance optimization
   * @param {string|number} boreholeId - Unique identifier of the borehole
   * @returns {boolean} - Whether strata should be visible for this borehole
   * @callback getBoreholeStrataVisibility
   */
  const getBoreholeStrataVisibility = useCallback((boreholeId) => {
    return boreholesStrataVisibility.get(boreholeId) ?? true;
  }, [boreholesStrataVisibility]);
  
  // Memoized visibility state for expensive components
  const memoizedStrataVisibilityState = useMemo(() => ({
    globalVisible: showBoreholeStrata,
    individualStates: boreholesStrataVisibility,
    size: boreholesStrataVisibility.size
  }), [showBoreholeStrata, boreholesStrataVisibility]);

  /**
   * Updates global texture settings
   * @param {Object} updates - Partial texture settings object
   * @callback updateTextureSettings
   */
  const updateTextureSettings = useCallback((updates) => {
    setTextureSettings(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  /**
   * Updates material-specific texture settings
   * @param {string} materialType - Material type (e.g., 'CLAY', 'SAND')
   * @param {Object} materialSettings - Material-specific settings
   * @callback updateMaterialTextureSettings
   */
  const updateMaterialTextureSettings = useCallback((materialType, materialSettings) => {
    setTextureSettings(prev => ({
      ...prev,
      materialOverrides: {
        ...prev.materialOverrides,
        [materialType]: {
          ...prev.materialOverrides[materialType],
          ...materialSettings
        }
      }
    }));
  }, []);

  /**
   * Resets all texture settings to defaults
   * @callback resetTextureSettings
   */
  const resetTextureSettings = useCallback(() => {
    const defaultSettings = {
      enabled: true,
      globalIntensity: 0.7,
      patternScale: 1.0,
      blendWithColor: true,
      adaptToZoom: false,
      materialOverrides: {
        CLAY: { pattern: 'horizontal-lines', intensity: 0.8, scale: 1.2, enabled: true },
        SAND: { pattern: 'dots', intensity: 0.6, scale: 0.8, enabled: true },
        GRAVEL: { pattern: 'circles', intensity: 0.7, scale: 1.0, enabled: true },
        ROCK: { pattern: 'cross-hatch', intensity: 0.9, scale: 1.5, enabled: true },
        SILT: { pattern: 'diagonal-lines', intensity: 0.6, scale: 1.1, enabled: true },
        FILL: { pattern: 'cross-hatch', intensity: 0.5, scale: 0.9, enabled: true },
        UNKNOWN: { pattern: 'horizontal-lines', intensity: 0.4, scale: 1.0, enabled: true }
      }
    };
    setTextureSettings(defaultSettings);
  }, []);

  /**
   * Updates alignment settings for 3D strata positioning
   * @callback updateAlignmentSettings
   * @param {Object} updates - Partial alignment settings to update
   */
  const updateAlignmentSettings = useCallback((updates) => {
    setAlignmentSettings(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  /**
   * Updates alignment position
   * @callback updateAlignmentPosition
   * @param {Object} position - New position {x, y, z}
   */
  const updateAlignmentPosition = useCallback((position) => {
    setAlignmentSettings(prev => ({
      ...prev,
      position: { ...prev.position, ...position }
    }));
  }, []);

  /**
   * Updates alignment rotation
   * @callback updateAlignmentRotation
   * @param {Object} rotation - New rotation {x, y, z} in radians
   */
  const updateAlignmentRotation = useCallback((rotation) => {
    setAlignmentSettings(prev => ({
      ...prev,
      rotation: { ...prev.rotation, ...rotation }
    }));
  }, []);

  /**
   * Updates alignment scale
   * @callback updateAlignmentScale
   * @param {Object} scale - New scale {x, y, z}
   */
  const updateAlignmentScale = useCallback((scale) => {
    setAlignmentSettings(prev => ({
      ...prev,
      scale: { ...prev.scale, ...scale }
    }));
  }, []);

  /**
   * Resets alignment settings to defaults
   * @callback resetAlignmentSettings
   */
  const resetAlignmentSettings = useCallback(() => {
    const defaultSettings = {
      enabled: false,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      autoAlign: true,
      showGizmo: false
    };
    setAlignmentSettings(defaultSettings);
  }, []);

  // Optimize localStorage persistence - batch multiple settings into single effect
  // Use useRef to prevent excessive writes on rapid state changes
  const persistenceTimeoutRef = useRef(null);
  
  // Batch persist basic display options with debouncing
  useEffect(() => {
    if (persistenceTimeoutRef.current) {
      clearTimeout(persistenceTimeoutRef.current);
    }
    
    persistenceTimeoutRef.current = setTimeout(() => {
      const basicOptions = {
        showLayerPanel,
        showLabels,
        showMarkers,
        showDepthMarkers,
        showConnectors,
        showStrata,
        showGroundGrid,
        showBoreholes,
        showBoreholeStrata,
        showWaterTable
      };
      
      try {
        localStorage.setItem('displayOptions.basicSettings', JSON.stringify(basicOptions));
      } catch (e) {
        validationLogger.warn('Failed to persist basic display options:', e);
      }
    }, 100); // Debounce for 100ms to reduce localStorage writes
    
  }, [
    showLayerPanel, 
    showLabels, 
    showMarkers, 
    showDepthMarkers, 
    showConnectors, 
    showStrata, 
    showGroundGrid, 
    showBoreholes, 
    showBoreholeStrata, 
    showWaterTable
  ]);

  // Debounce complex object persistence (Maps, large objects)
  const complexPersistenceTimeoutRef = useRef(null);
  
  useEffect(() => {
    if (complexPersistenceTimeoutRef.current) {
      clearTimeout(complexPersistenceTimeoutRef.current);
    }
    
    complexPersistenceTimeoutRef.current = setTimeout(() => {
      try {
        // Persist visibility maps
        const individualMapData = Array.from(boreholesIndividualVisibility.entries());
        const strataMapData = Array.from(boreholesStrataVisibility.entries());
        
        localStorage.setItem('displayOptions.boreholesIndividualVisibility', JSON.stringify(individualMapData));
        localStorage.setItem('displayOptions.boreholesStrataVisibility', JSON.stringify(strataMapData));
        localStorage.setItem('displayOptions.textureSettings', JSON.stringify(textureSettings));
        localStorage.setItem('displayOptions.alignmentSettings', JSON.stringify(alignmentSettings));
      } catch (e) {
        validationLogger.warn('Failed to persist complex display options:', e);
      }
    }, 200); // Longer debounce for complex objects
    
  }, [boreholesIndividualVisibility, boreholesStrataVisibility, textureSettings, alignmentSettings]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (persistenceTimeoutRef.current) {
        clearTimeout(persistenceTimeoutRef.current);
      }
      if (complexPersistenceTimeoutRef.current) {
        clearTimeout(complexPersistenceTimeoutRef.current);
      }
    };
  }, []);

  // Memoize context value sections to prevent unnecessary re-renders
  // Split into logical groups for selective subscription patterns
  
  const basicVisibilityState = useMemo(() => ({
    showLayerPanel,
    showLabels,
    showMarkers,
    showDepthMarkers,
    showConnectors,
    showStrata,
    showGroundGrid,
    showBoreholes,
    showBoreholeStrata,
    showWaterTable
  }), [
    showLayerPanel,
    showLabels,
    showMarkers,
    showDepthMarkers,
    showConnectors,
    showStrata,
    showGroundGrid,
    showBoreholes,
    showBoreholeStrata,
    showWaterTable
  ]);

  const basicVisibilityActions = useMemo(() => ({
    setShowLayerPanel,
    setShowLabels,
    setShowMarkers,
    setShowDepthMarkers,
    setShowConnectors,
    setShowStrata,
    setShowGroundGrid,
    setShowBoreholes,
    setShowBoreholeStrata,
    setShowWaterTable
  }), [
    setShowLayerPanel,
    setShowLabels,
    setShowMarkers,
    setShowDepthMarkers,
    setShowConnectors,
    setShowStrata,
    setShowGroundGrid,
    setShowBoreholes,
    setShowBoreholeStrata,
    setShowWaterTable
  ]);

  const textureSection = useMemo(() => ({
    textureSettings,
    setTextureSettings,
    updateTextureSettings,
    updateMaterialTextureSettings,
    resetTextureSettings
  }), [
    textureSettings,
    setTextureSettings,
    updateTextureSettings,
    updateMaterialTextureSettings,
    resetTextureSettings
  ]);

  const alignmentSection = useMemo(() => ({
    alignmentSettings,
    setAlignmentSettings,
    updateAlignmentSettings,
    updateAlignmentPosition,
    updateAlignmentRotation,
    updateAlignmentScale,
    resetAlignmentSettings
  }), [
    alignmentSettings,
    setAlignmentSettings,
    updateAlignmentSettings,
    updateAlignmentPosition,
    updateAlignmentRotation,
    updateAlignmentScale,
    resetAlignmentSettings
  ]);

  const boreholeSection = useMemo(() => ({
    boreholesIndividualVisibility,
    setBoreholesIndividualVisibility,
    boreholesStrataVisibility,
    setBoreholesStrataVisibility,
    toggleGlobalBoreholeVisibility,
    toggleIndividualBoreholeVisibility,
    toggleBoreholeStrataVisibility,
    getBoreholeStrataVisibility,
    // Performance optimized memoized state
    memoizedStrataVisibilityState,
    isPendingStrataUpdate: isPending
  }), [
    boreholesIndividualVisibility,
    setBoreholesIndividualVisibility,
    boreholesStrataVisibility,
    setBoreholesStrataVisibility,
    toggleGlobalBoreholeVisibility,
    toggleIndividualBoreholeVisibility,
    toggleBoreholeStrataVisibility,
    getBoreholeStrataVisibility,
    memoizedStrataVisibilityState,
    isPending
  ]);

  const uiSection = useMemo(() => ({
    openSections,
    toggleSection
  }), [openSections, toggleSection]);

  // Combine all memoized sections into final context value
  const value = useMemo(() => ({
    // Basic visibility
    ...basicVisibilityState,
    ...basicVisibilityActions,
    
    // Specialized sections
    ...boreholeSection,
    ...uiSection,
    ...textureSection,
    ...alignmentSection
  }), [
    basicVisibilityState,
    basicVisibilityActions,
    boreholeSection,
    uiSection,
    textureSection,
    alignmentSection
  ]);

  return (
    <DisplayOptionsContext.Provider value={value}>
      {children}
    </DisplayOptionsContext.Provider>
  );
};