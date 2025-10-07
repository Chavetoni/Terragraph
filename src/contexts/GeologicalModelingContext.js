import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { geologicalLogger } from '../utils/Logger.js';

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
  IDW: 'idw',           // Inverse Distance Weighting - Most realistic for typical sites
  KRIGING: 'kriging'    // Kriging interpolation - Best for sparse data with uncertainty estimates
};

export const GRID_RESOLUTIONS = {
  AUTO: 'auto',
  COARSE: 'coarse',     // 33ft grid
  MEDIUM: 'medium',     // 16ft grid
  FINE: 'fine',         // 6.6ft grid
  ULTRA_FINE: 'ultra_fine' // 3.3ft grid
};

const DEFAULT_SETTINGS = {
  interpolationMethod: INTERPOLATION_METHODS.IDW,  // IDW is most realistic for typical sites
  gridResolution: GRID_RESOLUTIONS.AUTO,
  validateData: true,
  autoFixErrors: false,
  showValidationWarnings: true,
  confidenceThreshold: 0.7,
  maxInterpolationDistance: 328, // feet
  minimumBoreholes: 3,
  enableLayerCorrelation: true,
  correlationTolerance: 1.64, // feet
  geologicalConsistencyCheck: true,
  exportFormat: 'json',
  
  // Advanced interpolation settings - tuned for geological realism
  krigingVariogramModel: 'exponential',  // exponential gives sharper transitions than spherical
  krigingRange: 33,       // Reduced from 82ft - less smoothing, more local variation
  krigingNugget: 0.2,     // Increased to allow for measurement uncertainty
  krigingSill: 0.8,       // Reduced to limit extrapolation
  rbfBasisFunction: 'multiquadric',   // Good for geological surfaces
  rbfShapeParameter: 0.3, // Reduced from 1.0 - less curvature, more realistic
  trendSurfaceDegree: 1,  // Linear trend instead of parabolic
  idwPower: 2,
  idwAdaptivePower: true,
  
  // Quality assessment settings
  enableQualityWeighting: true,
  showInterpolationQuality: true,
  
  // Isolated material handling - SIMPLIFIED
  isolatedMaterialHandling: 'interpolate', // 'interpolate' | 'pockets' | 'ignore' - default to interpolate for continuous layers
  isolatedThreshold: 0.5,  // Materials in <50% of boreholes are isolated
  combinedPockets: true,   // true = one pocket per borehole, false = separate pockets per material
  pocketRadius: 0.8,       // feet - zone radius around borehole (matches marker scale)
  pocketOpacity: 0.8,      // Visual distinction
  pocketDepthRatio: 0.3    // Depth positioning as ratio (0.0=surface, 1.0=bottom of borehole)
};

export const GeologicalModelingProvider = ({ children }) => {
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
  
  // Add shared prototype state
  const [prototypeResult, setPrototypeResult] = useState(null);
  const [prototypeError, setPrototypeError] = useState(null);

  // Update capabilities based on available data
  const updateCapabilities = useCallback((boreholes = []) => {
    const boreholeCount = boreholes.length;
    const hasLayerData = boreholes.some(bh => bh.layers && bh.layers.length > 0);
    const hasSpatialData = boreholes.some(bh => 
      typeof bh.x === 'number' && typeof bh.y === 'number'
    );
    
    const canUseDataDriven = boreholeCount >= modelingSettings.minimumBoreholes && 
                            hasLayerData && 
                            hasSpatialData;

    setCapabilities({
      canUseDataDriven,
      boreholeCount,
      hasLayerData,
      hasSpatialData
    });

    // Auto-switch to conceptual mode if data-driven is not possible
    if (modelingMode === MODELING_MODES.DATA_DRIVEN && !canUseDataDriven) {
      setModelingMode(MODELING_MODES.CONCEPTUAL);
    }
  }, [modelingMode, modelingSettings.minimumBoreholes]);

  // Switch modeling mode with validation
  const switchMode = useCallback((newMode) => {
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
  }, [capabilities, modelingSettings.minimumBoreholes]);

  // Update modeling settings
  const updateSettings = useCallback((newSettings) => {
    setModelingSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setModelingSettings(DEFAULT_SETTINGS);
  }, []);

  // Validate current modeling configuration
  const validateConfiguration = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (modelingMode === MODELING_MODES.DATA_DRIVEN) {
      if (!capabilities.canUseDataDriven) {
        errors.push('Insufficient data for data-driven modeling');
      }
      
      if (modelingSettings.gridResolution === GRID_RESOLUTIONS.ULTRA_FINE && 
          capabilities.boreholeCount < 10) {
        warnings.push('Ultra-fine grid resolution with few boreholes may produce unreliable results');
      }
      
      if (modelingSettings.maxInterpolationDistance < 33) {
        warnings.push('Very small interpolation distance may result in sparse coverage');
      }
    }

    if (modelingSettings.confidenceThreshold < 0.5) {
      warnings.push('Low confidence threshold may include unreliable interpolations');
    }

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    setValidationResults(result);
    return result;
  }, [modelingMode, capabilities, modelingSettings]);

  // Process geological model (placeholder for actual processing)
  const processModel = useCallback(async (boreholes = [], options = {}) => {
    setIsProcessing(true);
    setProcessingStatus('Initializing...');

    try {
      // Validate configuration first
      const validation = validateConfiguration();
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Simulate processing steps
      const steps = [
        'Validating borehole data...',
        'Analyzing spatial distribution...',
        'Correlating geological layers...',
        'Building interpolation model...',
        'Generating 3D surfaces...',
        'Calculating confidence intervals...',
        'Finalizing model...'
      ];

      for (let i = 0; i < steps.length; i++) {
        setProcessingStatus(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
      }

      const result = {
        success: true,
        mode: modelingMode,
        settings: modelingSettings,
        processedAt: new Date().toISOString(),
        boreholeCount: boreholes.length,
        layerCount: boreholes.reduce((sum, bh) => sum + (bh.layers?.length || 0), 0),
        ...options
      };

      setProcessingStatus('Complete');
      return result;

    } catch (error) {
      setProcessingStatus(`Error: ${error.message}`);
      throw error;
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingStatus(null), 3000); // Clear status after 3 seconds
    }
  }, [modelingMode, modelingSettings, validateConfiguration]);

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
          requirements: ['Basic borehole data'],
          capabilities: ['Manual layer correlation', 'Interpretive modeling'],
          limitations: ['No automatic interpolation', 'Subjective interpretation']
        };
      
      case MODELING_MODES.DATA_DRIVEN:
        return {
          name: 'Data-Driven Modeling',
          description: 'Automated modeling based on borehole data interpolation',
          requirements: [
            `Minimum ${modelingSettings.minimumBoreholes} boreholes`,
            'Spatial coordinates for all boreholes',
            'Detailed layer data'
          ],
          capabilities: [
            'Automatic layer correlation',
            'Statistical interpolation',
            '3D geological surfaces',
            'Confidence mapping'
          ],
          limitations: ['Requires sufficient data density', 'May not capture geological complexity']
        };
      
      default:
        return null;
    }
  }, [modelingMode, modelingSettings.minimumBoreholes]);

  // Prototype state management
  const setPrototypeState = useCallback((result, error = null) => {
    setPrototypeResult(result);
    setPrototypeError(error);
  }, []);

  const clearPrototypeState = useCallback(() => {
    setPrototypeResult(null);
    setPrototypeError(null);
    
    // The isolated pocket cleanup is now handled directly in useVolumetricGeology's clearVolumetricModel
    // This ensures immediate cleanup when the user clicks "Clear Model"

  }, []);

  // Memoize expensive computed values and split context value for performance
  const contextState = useMemo(() => ({
    modelingMode,
    isProcessing,
    modelingSettings,
    processingStatus,
    validationResults,
    capabilities,
    prototypeResult,
    prototypeError
  }), [
    modelingMode,
    isProcessing,
    modelingSettings,
    processingStatus,
    validationResults,
    capabilities,
    prototypeResult,
    prototypeError
  ]);

  const contextActions = useMemo(() => ({
    switchMode,
    updateSettings,
    resetSettings,
    updateCapabilities,
    validateConfiguration,
    processModel,
    exportConfiguration,
    importConfiguration,
    setPrototypeState,
    clearPrototypeState,
    getModeInfo
  }), [
    switchMode,
    updateSettings,
    resetSettings,
    updateCapabilities,
    validateConfiguration,
    processModel,
    exportConfiguration,
    importConfiguration,
    setPrototypeState,
    clearPrototypeState,
    getModeInfo
  ]);

  const contextConstants = useMemo(() => ({
    MODELING_MODES,
    INTERPOLATION_METHODS,
    GRID_RESOLUTIONS
  }), []); // Constants don't need dependencies

  // Compute expensive derived state with memoization
  const modeInfo = useMemo(() => getModeInfo(modelingMode), [modelingMode, getModeInfo]);
  
  const isConfigurationValid = useMemo(() => {
    if (!capabilities.canUseDataDriven && modelingMode === MODELING_MODES.DATA_DRIVEN) {
      return false;
    }
    return modelingSettings.minimumBoreholes <= capabilities.boreholeCount;
  }, [capabilities, modelingMode, modelingSettings.minimumBoreholes]); // MODELING_MODES.DATA_DRIVEN is a constant

  const interpolationRecommendation = useMemo(() => {
    if (capabilities.boreholeCount <= 3) {
      return INTERPOLATION_METHODS.KRIGING;
    } else if (capabilities.boreholeCount >= 6) {
      return INTERPOLATION_METHODS.IDW;
    }
    return modelingSettings.interpolationMethod;
  }, [capabilities.boreholeCount, modelingSettings.interpolationMethod]); // INTERPOLATION_METHODS is a constant

  const contextValue = useMemo(() => ({
    // State
    ...contextState,
    
    // Actions  
    ...contextActions,
    
    // Constants
    ...contextConstants,
    
    // Computed expensive values (memoized)
    modeInfo,
    isConfigurationValid,
    interpolationRecommendation
  }), [contextState, contextActions, contextConstants, modeInfo, isConfigurationValid, interpolationRecommendation]);

  // Make functions available globally for testing
  useEffect(() => {
    window.setGeologicalMode = (mode) => {
      try {
        switchMode(mode);

      } catch (error) {
        geologicalLogger.error(`Failed to switch to ${mode} mode:`, error.message);
      }
    };
    window.clearGeologicalModel = clearPrototypeState;
    window.getCurrentGeologicalMode = () => modelingMode;
  }, [switchMode, clearPrototypeState, modelingMode]);

  return (
    <GeologicalModelingContext.Provider value={contextValue}>
      {children}
    </GeologicalModelingContext.Provider>
  );
};