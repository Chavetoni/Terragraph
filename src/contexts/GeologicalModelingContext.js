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

const DEFAULT_SETTINGS = {
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

  krigingVariogramModel: 'exponential',
  krigingRange: 33,
  krigingNugget: 0.2,
  krigingSill: 0.8,
  rbfBasisFunction: 'multiquadric',
  rbfShapeParameter: 0.3,
  trendSurfaceDegree: 1,
  idwPower: 2,
  idwAdaptivePower: true,

  enableQualityWeighting: true,
  showInterpolationQuality: true,

  isolatedMaterialHandling: 'interpolate',
  isolatedThreshold: 0.5,
  combinedPockets: true,
  pocketRadius: 0.8,
  pocketOpacity: 0.8,
  pocketDepthRatio: 0.3
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

  const [prototypeResult, setPrototypeResult] = useState(null);
  const [prototypeError, setPrototypeError] = useState(null);

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

    if (modelingMode === MODELING_MODES.DATA_DRIVEN && !canUseDataDriven) {
      setModelingMode(MODELING_MODES.CONCEPTUAL);
    }
  }, [modelingMode, modelingSettings.minimumBoreholes]);

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

  const updateSettings = useCallback((newSettings) => {
    setModelingSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const resetSettings = useCallback(() => {
    setModelingSettings(DEFAULT_SETTINGS);
  }, []);

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

  const processModel = useCallback(async (boreholes = [], options = {}) => {
    setIsProcessing(true);
    setProcessingStatus('Initializing...');

    try {
      const validation = validateConfiguration();
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

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
        await new Promise(resolve => setTimeout(resolve, 500));
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
      setTimeout(() => setProcessingStatus(null), 3000);
    }
  }, [modelingMode, modelingSettings, validateConfiguration]);

  const exportConfiguration = useCallback(() => {
    return {
      mode: modelingMode,
      settings: modelingSettings,
      capabilities,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }, [modelingMode, modelingSettings, capabilities]);

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

  const setPrototypeState = useCallback((result, error = null) => {
    setPrototypeResult(result);
    setPrototypeError(error);
  }, []);

  const clearPrototypeState = useCallback(() => {
    setPrototypeResult(null);
    setPrototypeError(null);
  }, []);

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
  }), []);

  const modeInfo = useMemo(() => getModeInfo(modelingMode), [modelingMode, getModeInfo]);

  const isConfigurationValid = useMemo(() => {
    if (!capabilities.canUseDataDriven && modelingMode === MODELING_MODES.DATA_DRIVEN) {
      return false;
    }
    return modelingSettings.minimumBoreholes <= capabilities.boreholeCount;
  }, [capabilities, modelingMode, modelingSettings.minimumBoreholes]);

  const interpolationRecommendation = useMemo(() => {
    if (capabilities.boreholeCount <= 3) {
      return INTERPOLATION_METHODS.KRIGING;
    } else if (capabilities.boreholeCount >= 6) {
      return INTERPOLATION_METHODS.IDW;
    }
    return modelingSettings.interpolationMethod;
  }, [capabilities.boreholeCount, modelingSettings.interpolationMethod]);

  const contextValue = useMemo(() => ({
    ...contextState,

    ...contextActions,

    ...contextConstants,

    modeInfo,
    isConfigurationValid,
    interpolationRecommendation
  }), [contextState, contextActions, contextConstants, modeInfo, isConfigurationValid, interpolationRecommendation]);

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