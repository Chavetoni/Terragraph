import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';

const GeologicalModelingContext = createContext();

export const useGeologicalModeling = () => {
  const context = useContext(GeologicalModelingContext);
  if (!context) {
    throw new Error('useGeologicalModeling must be used within GeologicalModelingProvider');
  }
  return context;
};

export const MODELING_MODES = {
  CONCEPTUAL: 'conceptual',
  DATA_DRIVEN: 'data-driven'
};

export const INTERPOLATION_METHODS = {
  IDW: 'idw',
  KRIGING: 'kriging'
};

export const GRID_RESOLUTIONS = {
  AUTO: 'auto',
  COARSE: 'coarse',
  MEDIUM: 'medium',
  FINE: 'fine',
  ULTRA_FINE: 'ultra_fine'
};

// Move constants outside component to prevent recreation
const DEFAULT_SETTINGS = Object.freeze({
  interpolationMethod: INTERPOLATION_METHODS.IDW,
  gridResolution: GRID_RESOLUTIONS.AUTO,
  validateData: true,
  autoFixErrors: false,
  showValidationWarnings: true,
  confidenceThreshold: 0.7,
  maxInterpolationDistance: 328,
  minimumBoreholes: 3,
  enableLayerCorrelation: true,
  correlationTolerance: 1.64,
  geologicalConsistencyCheck: true,
  exportFormat: 'json',
  
  // Advanced interpolation settings
  krigingVariogramModel: 'exponential',
  krigingRange: 33,
  krigingNugget: 0.2,
  krigingSill: 0.8,
  rbfBasisFunction: 'multiquadric',
  rbfShapeParameter: 0.3,
  trendSurfaceDegree: 1,
  idwPower: 2,
  idwAdaptivePower: true,
  
  // Quality assessment settings
  enableQualityWeighting: true,
  showInterpolationQuality: true,
  
  // Isolated material handling
  isolatedMaterialHandling: 'interpolate', // Default to interpolate for continuous layers
  isolatedThreshold: 0.5,
  combinedPockets: true,
  pocketRadius: 0.8,
  pocketOpacity: 0.8,
  pocketDepthRatio: 0.3
});

export const GeologicalModelingProvider = React.memo(({ children }) => {
  const [modelingMode, setModelingMode] = useState(MODELING_MODES.CONCEPTUAL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelingSettings, setModelingSettings] = useState(DEFAULT_SETTINGS);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [capabilities, setCapabilities] = useState({
    canUseDataDriven: false,
    boreholeCount: 0,
    hasLayerData: false,
    hasSpatialData: false
  });
  
  // Shared prototype state
  const [prototypeResult, setPrototypeResult] = useState(null);
  const [prototypeError, setPrototypeError] = useState(null);
  
  // Use refs for values that don't need to trigger re-renders
  const processingTimeoutRef = useRef(null);
  const lastValidationRef = useRef(null);

  // Memoized capability checker
  const checkCapabilities = useCallback((boreholes = []) => {
    const boreholeCount = boreholes.length;
    const hasLayerData = boreholes.some(bh => bh.layers?.length > 0);
    const hasSpatialData = boreholes.some(bh => 
      typeof bh.x === 'number' && typeof bh.y === 'number'
    );
    
    return {
      canUseDataDriven: boreholeCount >= modelingSettings.minimumBoreholes && 
                       hasLayerData && hasSpatialData,
      boreholeCount,
      hasLayerData,
      hasSpatialData
    };
  }, [modelingSettings.minimumBoreholes]);

  // Optimized capability updater with memoization
  const updateCapabilities = useCallback((boreholes = []) => {
    const newCapabilities = checkCapabilities(boreholes);
    
    // Only update if capabilities actually changed
    setCapabilities(prev => {
      if (prev.canUseDataDriven === newCapabilities.canUseDataDriven &&
          prev.boreholeCount === newCapabilities.boreholeCount &&
          prev.hasLayerData === newCapabilities.hasLayerData &&
          prev.hasSpatialData === newCapabilities.hasSpatialData) {
        return prev;
      }
      return newCapabilities;
    });

    // Auto-switch mode if needed
    if (modelingMode === MODELING_MODES.DATA_DRIVEN && !newCapabilities.canUseDataDriven) {
      setModelingMode(MODELING_MODES.CONCEPTUAL);
    }
  }, [checkCapabilities, modelingMode]);

  // Optimized mode switcher
  const switchMode = useCallback((newMode) => {
    if (newMode === modelingMode) return; // No-op if same mode
    
    if (newMode === MODELING_MODES.DATA_DRIVEN && !capabilities.canUseDataDriven) {
      const missingRequirements = [];
      if (capabilities.boreholeCount < modelingSettings.minimumBoreholes) {
        missingRequirements.push(`At least ${modelingSettings.minimumBoreholes} boreholes required (have ${capabilities.boreholeCount})`);
      }
      if (!capabilities.hasLayerData) {
        missingRequirements.push('Boreholes must have layer data');
      }
      if (!capabilities.hasSpatialData) {
        missingRequirements.push('Boreholes must have spatial coordinates');
      }
      
      throw new Error(`Cannot switch to data-driven mode: ${missingRequirements.join(', ')}`);
    }
    
    setModelingMode(newMode);
  }, [capabilities, modelingSettings.minimumBoreholes, modelingMode]);

  // Optimized settings updater with shallow merge
  const updateSettings = useCallback((newSettings) => {
    if (typeof newSettings === 'function') {
      setModelingSettings(newSettings);
    } else {
      setModelingSettings(prev => {
        // Check if settings actually changed
        const hasChanges = Object.keys(newSettings).some(
          key => prev[key] !== newSettings[key]
        );
        return hasChanges ? { ...prev, ...newSettings } : prev;
      });
    }
  }, []);

  // Reset settings with memoized default
  const resetSettings = useCallback(() => {
    setModelingSettings(DEFAULT_SETTINGS);
  }, []);

  // Memoized validation configuration
  const validateConfiguration = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (modelingMode === MODELING_MODES.DATA_DRIVEN) {
      if (!capabilities.canUseDataDriven) {
        errors.push('Insufficient data for data-driven modeling');
      }
      
      if (capabilities.boreholeCount < 5 && modelingSettings.interpolationMethod === INTERPOLATION_METHODS.KRIGING) {
        warnings.push('Kriging works best with at least 5 boreholes');
      }
      
      if (modelingSettings.maxInterpolationDistance < 50) {
        warnings.push('Very small interpolation distance may create gaps');
      }
    }

    if (modelingSettings.gridResolution === GRID_RESOLUTIONS.ULTRA_FINE && capabilities.boreholeCount < 10) {
      warnings.push('Ultra-fine resolution may over-interpolate with limited data');
    }

    const result = { errors, warnings, isValid: errors.length === 0 };
    
    // Cache validation result
    lastValidationRef.current = result;
    return result;
  }, [modelingMode, capabilities, modelingSettings]);

  // Optimized processing starter with debouncing
  const startProcessing = useCallback((status = 'Processing...') => {
    // Clear any pending timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    setIsProcessing(true);
    setProcessingStatus(status);
    
    // Auto-clear after timeout
    processingTimeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
      setProcessingStatus(null);
    }, 30000); // 30 second timeout
  }, []);

  const stopProcessing = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    setIsProcessing(false);
    setProcessingStatus(null);
  }, []);

  // Prototype state management
  const setPrototypeState = useCallback((result, error = null) => {
    setPrototypeResult(result);
    setPrototypeError(error);
  }, []);

  const clearPrototypeState = useCallback(() => {
    setPrototypeResult(null);
    setPrototypeError(null);
  }, []);

  // Process geological model (placeholder for actual processing)
  const processModel = useCallback(async (boreholes = [], options = {}) => {
    setIsProcessing(true);
    setProcessingStatus('Initializing...');

    try {
      // Validate configuration first
      const validation = validateConfiguration();
      if (!validation.isValid) {
        throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
      }

      setProcessingStatus('Processing geological data...');
      
      // Simulate processing time for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProcessingStatus('Generating 3D model...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setProcessingStatus('Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsProcessing(false);
      setProcessingStatus('Completed successfully');
      
      return {
        success: true,
        message: 'Model processed successfully',
        data: { boreholes, options }
      };
    } catch (error) {
      setIsProcessing(false);
      setProcessingStatus(`Error: ${error.message}`);
      throw error;
    } finally {
      // Clear status after 3 seconds
      setTimeout(() => setProcessingStatus(null), 3000);
    }
  }, [validateConfiguration]);

  // Export model configuration
  const exportConfiguration = useCallback(() => {
    return {
      mode: modelingMode,
      settings: modelingSettings,
      capabilities,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }, [modelingMode, modelingSettings, capabilities]);

  // Import model configuration
  const importConfiguration = useCallback((config) => {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration data');
    }
    
    if (config.mode && Object.values(MODELING_MODES).includes(config.mode)) {
      setModelingMode(config.mode);
    }
    
    if (config.settings) {
      setModelingSettings(prev => ({ ...prev, ...config.settings }));
    }
    
    return true;
  }, []);

  // Get mode description and requirements
  const getModeInfo = useCallback((mode = modelingMode) => {
    switch (mode) {
      case MODELING_MODES.CONCEPTUAL:
        return {
          name: 'Conceptual Modeling',
          description: 'Manual geological interpretation and modeling',
          requirements: ['Basic geological knowledge'],
          minBoreholes: 1
        };
      case MODELING_MODES.DATA_DRIVEN:
        return {
          name: 'Data-Driven Modeling',
          description: 'Automated modeling based on borehole data',
          requirements: ['Sufficient borehole data', 'Spatial coordinates', 'Layer information'],
          minBoreholes: modelingSettings.minimumBoreholes || 3
        };
      default:
        return null;
    }
  }, [modelingMode, modelingSettings.minimumBoreholes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // State
    modelingMode,
    isProcessing,
    modelingSettings,
    processingStatus,
    validationResults,
    capabilities,
    prototypeResult,
    prototypeError,
    
    // Actions
    switchMode,
    updateSettings,
    resetSettings,
    validateConfiguration,
    startProcessing,
    stopProcessing,
    setValidationResults,
    updateCapabilities,
    setPrototypeResult,
    setPrototypeError,
    setPrototypeState,
    clearPrototypeState,
    processModel,
    exportConfiguration,
    importConfiguration,
    getModeInfo,
    
    // Constants
    MODELING_MODES,
    INTERPOLATION_METHODS,
    GRID_RESOLUTIONS
  }), [
    modelingMode,
    isProcessing,
    modelingSettings,
    processingStatus,
    validationResults,
    capabilities,
    prototypeResult,
    prototypeError,
    switchMode,
    updateSettings,
    resetSettings,
    validateConfiguration,
    startProcessing,
    stopProcessing,
    updateCapabilities,
    setPrototypeState,
    clearPrototypeState,
    processModel,
    exportConfiguration,
    importConfiguration,
    getModeInfo
  ]);

  return (
    <GeologicalModelingContext.Provider value={contextValue}>
      {children}
    </GeologicalModelingContext.Provider>
  );
});

GeologicalModelingProvider.displayName = 'GeologicalModelingProvider';

export default GeologicalModelingProvider;