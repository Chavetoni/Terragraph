import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { useVolumetricModeling } from './useOptimizedGeologicalModeling';
import { useBoreholeData } from './useOptimizedBorehole';
import { useTextureSettings } from './useOptimizedDisplayOptions';
import { ThreeJsContext } from '../contexts/ThreeJsContext';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { SpatialInterpolationEngine } from '../services/SpatialInterpolationEngine';
import { volumetricTracker } from '../utils/volumetricDisposal';
import { Logger } from '../utils/Logger.js';

const logger = new Logger().withContext('useVolumetricGeology');

export function useVolumetricGeology() {
  const { boreholes } = useBoreholeData();
  const { sceneManager } = useContext(ThreeJsContext);
  const { textureSettings } = useTextureSettings();
  const { 
    modelingMode, 
    modelingSettings,
    setPrototypeState,
    clearPrototypeState
  } = useVolumetricModeling();

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const processingRef = useRef(false);
  const progressTimeoutRef = useRef(null);

  /**
   * Helper function to clean up all isolated pockets from the scene
   */
  const cleanupIsolatedPockets = useCallback(() => {
    if (sceneManager && sceneManager.objects) {
      const isolatedPocketKeys = Array.from(sceneManager.objects.keys()).filter(key => 
        key.startsWith('IsolatedPocket_')
      );
      
      if (isolatedPocketKeys.length > 0) {

        isolatedPocketKeys.forEach(key => {

          sceneManager.remove(key);
        });
        return isolatedPocketKeys.length;
      }
    }
    return 0;
  }, [sceneManager]);

  /**
   * Validate boreholes for volumetric modeling
   */
  const validateVolumetricData = useCallback((boreholes) => {
    const errors = [];
    const warnings = [];

    // Check minimum boreholes
    if (boreholes.length < 3) {
      errors.push('At least 3 boreholes required for volumetric modeling');
      return { isValid: false, errors, warnings };
    }

    // Check for layers
    const boreholesWithLayers = boreholes.filter(bh => 
      bh.layers && bh.layers.length > 0
    );
    if (boreholesWithLayers.length < 3) {
      errors.push('At least 3 boreholes must have layer data');
      return { isValid: false, errors, warnings };
    }

    // Check for collinearity
    const positions = boreholes.slice(0, 3).map(bh => ({ 
      x: bh.x, 
      z: bh.z  // Use Z for horizontal positioning
    }));
    const [p1, p2, p3] = positions;
    const area = Math.abs(
      p1.x * (p2.z - p3.z) + 
      p2.x * (p3.z - p1.z) + 
      p3.x * (p1.z - p2.z)
    ) / 2;

    if (area < 0.1) {
      errors.push('Boreholes are collinear - need triangular distribution');
      return { isValid: false, errors, warnings };
    }

    // Check for common materials
    const materialCounts = new Map();
    boreholesWithLayers.forEach(bh => {
      bh.layers.forEach(layer => {
        const count = materialCounts.get(layer.material) || 0;
        materialCounts.set(layer.material, count + 1);
      });
    });

    const commonMaterials = Array.from(materialCounts.entries())
      .filter(([material, count]) => count >= 3)
      .map(([material]) => material);

    if (commonMaterials.length === 0) {
      warnings.push('No materials found in at least 3 boreholes - limited interpolation');
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings,
      stats: {
        boreholeCount: boreholes.length,
        layeredBoreholes: boreholesWithLayers.length,
        uniqueMaterials: materialCounts.size,
        commonMaterials: commonMaterials.length
      }
    };
  }, []);

  /**
   * Process volumetric model from boreholes
   */
  const processVolumetricModel = useCallback(async () => {
    if (modelingMode !== 'data-driven') {
      setError({ message: 'Volumetric modeling requires data-driven mode' });
      return null;
    }

    // Prevent multiple simultaneous processing
    if (processingRef.current) {
      return null;
    }
    
    processingRef.current = true;
    setIsProcessing(true);
    
    // Debounced progress updates for better performance
    const updateProgress = (progressData) => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      progressTimeoutRef.current = setTimeout(() => {
        setProgress(progressData);
      }, 50); // 50ms debounce
    };
    
    updateProgress({ step: 'Initializing volumetric processing...', percent: 0 });
    setError(null);

    try {
      // Step 1: Validate data
      updateProgress({ step: 'Validating borehole data...', percent: 10 });
      const validation = validateVolumetricData(boreholes);
      
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }


      // Step 2: Generate volumetric meshes (ASYNC to prevent UI blocking)
      updateProgress({ step: 'Generating 3D geological volumes...', percent: 30 });
      
      // Convert grid resolution to numeric value
      let numericGridResolution = 10; // default - REDUCED for stability
      if (typeof modelingSettings.gridResolution === 'number') {
        numericGridResolution = modelingSettings.gridResolution;
      } else if (modelingSettings.gridResolution === 'auto') {
        numericGridResolution = 10; // auto = lower resolution for stability
      }

      // Use selected method directly (no auto-selection)
      let selectedMethod = modelingSettings.interpolationMethod || 'idw';
      let methodReasoning = selectedMethod === 'kriging' 
        ? 'Statistical interpolation with uncertainty estimates'
        : 'Realistic geological interpolation preserving detail';

      // Enhanced options with geological validation and interpolation methods
      const enhancedOptions = {
        gridResolution: numericGridResolution,
        interpolationPower: modelingSettings.interpolationPower || 2,
        smoothingFactor: modelingSettings.smoothingEnabled ? 1 : 0,
        minThickness: 0.15, // Slightly more conservative
        // NEW: Geological validation options (user-controlled)
        enableGeologicalValidation: modelingSettings.enableGeologicalValidation || false,
        maxSlope: 30,                    // 30° maximum geological slope
        smoothingRadius: 1,              // Grid unit smoothing
        enforceStratigraphicOrder: true, // Prevent layer inversions
        applyLateralContinuity: true,    // Smooth transitions
        
        // NEW: Advanced interpolation method settings
        interpolationMethod: selectedMethod,
        enableConfidenceMapping: false, // Removed from UI - not functional
        // Kriging settings (passed through from UI)
        krigingVariogramModel: modelingSettings.krigingVariogramModel || 'spherical',
        krigingRange: modelingSettings.krigingRange || 25,
        krigingNugget: modelingSettings.krigingNugget || 0.1,
        krigingSill: modelingSettings.krigingSill || 1.0,
        // RBF settings (passed through from UI)
        rbfBasisFunction: modelingSettings.rbfBasisFunction || 'multiquadric',
        rbfShapeParameter: modelingSettings.rbfShapeParameter || 1.0,
        
        // NEW: Isolated material handling (pass through from UI settings)
        // CRITICAL FIX: Default to 'interpolate' for continuous layers, not 'pockets'
        isolatedMaterialHandling: modelingSettings.isolatedMaterialHandling || 'interpolate',
        combinedPockets: modelingSettings.combinedPockets !== undefined ? modelingSettings.combinedPockets : true,
        pocketRadius: modelingSettings.pocketRadius || 0.8,
        pocketOpacity: modelingSettings.pocketOpacity || 0.7,
        pocketDepthRatio: modelingSettings.pocketDepthRatio || 0.3,
        pocketShape: modelingSettings.pocketShape || 'ellipsoid',
        
        // NEW: Texture settings for isolated pockets
        textureSettings: textureSettings,
        
        // Store method selection info for later use
        methodSelectionReasoning: methodReasoning,
        originalMethod: modelingSettings.interpolationMethod
      };

      // PERFORMANCE FIX: Break heavy computation into async chunks to prevent UI blocking
      const volumes = await new Promise((resolve, reject) => {
        // Use requestIdleCallback for better performance, fallback to setTimeout
        const scheduleWork = (callback) => {
          if (window.requestIdleCallback) {
            window.requestIdleCallback(callback, { timeout: 100 });
          } else {
            setTimeout(callback, 0);
          }
        };
        
        scheduleWork(() => {
          try {
            updateProgress({ step: 'Processing geological data...', percent: 40 });
            const result = VolumetricMeshGenerator.generateStratigraphy(boreholes, enhancedOptions);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });

      if (volumes.length === 0) {
        throw new Error('No volumes could be generated from the data');
      }

      updateProgress({ step: 'Calculating interpolation confidence...', percent: 70 });

      // Step 3: Calculate confidence metrics
      const extent = SpatialInterpolationEngine.calculateExtent(boreholes);
      const boreholePoints = boreholes.map(bh => ({ x: bh.x, y: bh.z }));
      
      // Generate confidence grid
      const confidenceGrid = SpatialInterpolationEngine.generateConfidenceGrid(
        SpatialInterpolationEngine.generateGrid(extent, 10), // Lower res for confidence
        boreholePoints,
        { maxGoodDistance: modelingSettings.maxInfluenceDistance || 20 }
      );

      const avgConfidence = confidenceGrid.reduce((sum, point) => 
        sum + point.confidence, 0
      ) / confidenceGrid.length;

      updateProgress({ step: 'Finalizing 3D model...', percent: 90 });

      // Step 4: Compile results
      const result = {
        volumes,
        confidence: {
          average: avgConfidence,
          grid: confidenceGrid
        },
        statistics: {
          volumeCount: volumes.length,
          materials: volumes.map(v => v.material),
          totalVertices: volumes.reduce((sum, v) => sum + v.vertexCount, 0),
          totalTriangles: volumes.reduce((sum, v) => sum + v.indexCount / 3, 0)
        },
        validation: validation.stats,
        processedAt: new Date().toISOString(),
        boreholeCount: boreholes.length,
        type: 'volumetric',
        settings: modelingSettings,
        memoryStats: volumetricTracker.getStats()
      };

      // Set result in context
      setPrototypeState(result);
      
      processingRef.current = false;
      setIsProcessing(false);
      updateProgress({ step: 'Volumetric model complete!', percent: 100 });
      
      // Clear progress after delay
      setTimeout(() => {
        setProgress(null);
        if (progressTimeoutRef.current) {
          clearTimeout(progressTimeoutRef.current);
        }
      }, 2000);

      return result;

    } catch (error) {
      logger.error('Volumetric processing error:', error);
      setError({ 
        message: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      });
      setPrototypeState(null, error.message);
      processingRef.current = false;
      setIsProcessing(false);
      setProgress(null);
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      return null;
    }
  }, [boreholes, modelingMode, modelingSettings, textureSettings, validateVolumetricData, setPrototypeState]);

  /**
   * Clear volumetric model
   */
  const clearVolumetricModel = useCallback(() => {
    // Dispose of all tracked volumetric resources
    volumetricTracker.disposeAll();
    
    // DIRECT CLEANUP: Remove all isolated pockets immediately when user clears model
    cleanupIsolatedPockets();

    clearPrototypeState();
    setError(null);
    setProgress(null);
    
    // Clear timeout refs
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
  }, [clearPrototypeState, cleanupIsolatedPockets]);

  /**
   * Auto-process when settings change (if enabled) - DISABLED FOR NOW TO PREVENT LOOPS
   */
  // useEffect(() => {
  //   if (modelingSettings.autoUpdate && 
  //       modelingMode === 'data-driven' && 
  //       boreholes.length >= 3 &&
  //       !isProcessing) {
  //     const timer = setTimeout(() => {
  //       processVolumetricModel();
  //     }, 500); // Debounce

  //     return () => clearTimeout(timer);
  //   }
  // }, [boreholes, modelingSettings.autoUpdate, modelingMode, isProcessing, processVolumetricModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      // Dispose of tracked resources
      volumetricTracker.disposeAll();
    };
  }, []);

  return {
    processVolumetricModel,
    clearVolumetricModel,
    cleanupIsolatedPockets,
    isProcessing,
    progress,
    error,
    validateVolumetricData
  };
}

export default useVolumetricGeology;