import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { useGeologicalModeling } from '../contexts/GeologicalModelingContext';
import { useBoreholes } from '../contexts/BoreholeContext';
import { useDisplayOptions } from '../contexts/DisplayOptionsContext';
import { ThreeJsContext } from '../contexts/ThreeJsContext';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { SpatialInterpolationEngine } from '../services/SpatialInterpolationEngine';
import { volumetricTracker } from '../utils/volumetricDisposal';
import { Logger } from '../utils/Logger.js';

const logger = new Logger().withContext('useVolumetricGeology');

export function useVolumetricGeology() {
  const { boreholes } = useBoreholes();
  const { sceneManager } = useContext(ThreeJsContext);
  const { textureSettings, showConfidenceVisualization } = useDisplayOptions();
  const {
    modelingMode,
    modelingSettings,
    setPrototypeState,
    clearPrototypeState,
    // Interpolation style settings (natural vs conservative)
    interpolationStyleSettings,
    // Advanced interpolation mode (horizon preprocessing + anisotropic distance)
    useAdvancedInterpolation
  } = useGeologicalModeling();

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

    // Check for sparse borehole configurations
    const calculateAverageSpacing = (boreholes) => {
      if (boreholes.length < 2) return 0;
      let totalDistance = 0;
      let pairCount = 0;
      for (let i = 0; i < boreholes.length; i++) {
        for (let j = i + 1; j < boreholes.length; j++) {
          const dx = boreholes[i].x - boreholes[j].x;
          const dy = boreholes[i].z - boreholes[j].z;
          const distance = Math.sqrt(dx * dx + dy * dy);
          totalDistance += distance;
          pairCount++;
        }
      }
      return pairCount > 0 ? totalDistance / pairCount : 0;
    };

    const averageSpacing = calculateAverageSpacing(boreholes);
    if (averageSpacing > 150) {
      warnings.push(`Boreholes are widely spaced (avg: ${Math.round(averageSpacing)} ft) - interpolation accuracy may be reduced. Consider adding more boreholes for better results.`);
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
      let numericGridResolution = modelingSettings.defaultGridResolution || 15; // Unified default: balanced quality/performance
      if (typeof modelingSettings.gridResolution === 'number') {
        numericGridResolution = modelingSettings.gridResolution;
      } else if (modelingSettings.gridResolution === 'auto') {
        numericGridResolution = modelingSettings.defaultGridResolution || 15; // Use default setting
      }

      // Use selected method directly (no auto-selection)
      let selectedMethod = modelingSettings.interpolationMethod || 'idw';
      let methodReasoning = selectedMethod === 'kriging'
        ? 'Statistical interpolation with uncertainty estimates'
        : 'Realistic geological interpolation preserving detail';

      // ==========================================================================
      // SPARSE BOREHOLE DETECTION AND ADAPTIVE PARAMETER ADJUSTMENT
      // ==========================================================================
      // Calculate average borehole spacing to detect sparse configurations
      const calculateAverageSpacing = (boreholes) => {
        if (boreholes.length < 2) return 0;

        let totalDistance = 0;
        let pairCount = 0;

        for (let i = 0; i < boreholes.length; i++) {
          for (let j = i + 1; j < boreholes.length; j++) {
            const dx = boreholes[i].x - boreholes[j].x;
            const dy = boreholes[i].z - boreholes[j].z; // Use z for horizontal positioning
            const distance = Math.sqrt(dx * dx + dy * dy);
            totalDistance += distance;
            pairCount++;
          }
        }

        return pairCount > 0 ? totalDistance / pairCount : 0;
      };

      const averageSpacing = calculateAverageSpacing(boreholes);
      const maxBoreholeDistance = boreholes.reduce((max, bh1) => {
        const distances = boreholes.map(bh2 => {
          const dx = bh1.x - bh2.x;
          const dy = bh1.z - bh2.z;
          return Math.sqrt(dx * dx + dy * dy);
        });
        return Math.max(max, Math.max(...distances));
      }, 0);

      // ADAPTIVE INTERPOLATION DISTANCE
      // For sparse configurations, increase maxDistance to ensure interpolation works
      // Default maxDistance of 100 ft is too small for widely spaced boreholes
      const calculateAdaptiveMaxDistance = () => {
        // If user explicitly set maxInfluenceDistance, respect it
        if (modelingSettings.maxInfluenceDistance && modelingSettings.maxInfluenceDistance > 0) {
          return modelingSettings.maxInfluenceDistance;
        }

        // Calculate adaptive distance based on borehole spacing
        // Use 1.5x the average spacing, with a minimum of 100 ft and maximum of 1000 ft
        const adaptiveDistance = Math.max(100, Math.min(1000, averageSpacing * 1.5));

        // For very sparse configs (3 boreholes spread >200 ft apart), be even more generous
        if (boreholes.length === 3 && averageSpacing > 200) {
          return Math.min(1000, maxBoreholeDistance * 0.8); // 80% of max distance
        }

        return adaptiveDistance;
      };

      const adaptiveMaxDistance = calculateAdaptiveMaxDistance();

      // Enhanced options with geological validation and interpolation methods
      const enhancedOptions = {
        gridResolution: numericGridResolution,
        interpolationPower: modelingSettings.interpolationPower || 2,
        smoothingFactor: modelingSettings.smoothingEnabled ? 1 : 0,
        // Use interpolation style settings from context (natural vs conservative mode)
        // These values come from INTERPOLATION_STYLE_PRESETS based on user's mode selection
        minThickness: interpolationStyleSettings?.minThickness ?? 0.05,
        // NEW: Geological validation options (user-controlled)
        enableGeologicalValidation: modelingSettings.enableGeologicalValidation || false,
        maxSlope: interpolationStyleSettings?.maxSlope ?? 45,
        smoothingRadius: interpolationStyleSettings?.smoothingRadius ?? 0,
        enforceStratigraphicOrder: true, // Prevent layer inversions
        applyLateralContinuity: interpolationStyleSettings?.applyLateralContinuity ?? false,

        // NEW: Advanced interpolation method settings
        interpolationMethod: selectedMethod,
        enableConfidenceMapping: false, // Removed from UI - not functional
        // ADAPTIVE MAX DISTANCE: Automatically adjusted for sparse borehole configurations
        maxDistance: adaptiveMaxDistance,
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

        // NEW: Confidence visualization (per-vertex alpha based on data certainty)
        showConfidenceVisualization: showConfidenceVisualization || false,

        // Store method selection info for later use
        methodSelectionReasoning: methodReasoning,
        originalMethod: modelingSettings.interpolationMethod,

        // ===== NEW: Performance Optimization Flags (Phase 2) =====
        useKDTree: modelingSettings.useKDTreeInterpolation !== false, // Default true
        maxNeighbors: modelingSettings.maxNeighbors || 12,
        adaptiveConfidence: modelingSettings.adaptiveConfidenceDistance !== false, // Default true
        searchRadius: modelingSettings.searchRadiusEnabled !== false, // Default true

        // ===== NEW: Accuracy Improvement Flags (Phase 3) =====
        enableCrossValidation: modelingSettings.enableCrossValidation || false, // Default false (adds time)
        detectAnisotropy: modelingSettings.enableAnisotropyDetection || false, // Default false (experimental)
        anisotropyOptions: {
          minRatio: modelingSettings.anisotropyMinRatio || 1.5,
          minConfidence: modelingSettings.anisotropyMinConfidence || 0.6
        },

        // ===== Advanced Interpolation Mode (user-toggled) =====
        // These features work better with large datasets (10+ boreholes)
        // For small datasets, they can cause flat/over-smoothed surfaces
        useHorizonPreprocessing: useAdvancedInterpolation,   // Pinch-out handling with zero-thickness markers
        useAnisotropicDistance: useAdvancedInterpolation     // 3D ellipsoidal distance (10:1 vertical ratio)
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
        const boreholeCount = boreholes.length;
        const hasLayers = boreholes.some(bh => bh.layers && bh.layers.length > 0);

        let errorMsg = 'No volumes could be generated from the data. ';
        if (boreholeCount < 3) {
          errorMsg += `At least 3 boreholes are required for volumetric modeling (currently: ${boreholeCount}).`;
        } else if (!hasLayers) {
          errorMsg += 'Boreholes must have at least one geological layer defined.';
        } else {
          errorMsg += 'Check that boreholes have valid coordinates and geological layers with depth/thickness values.';
        }

        throw new Error(errorMsg);
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
  }, [boreholes, modelingMode, modelingSettings, textureSettings, showConfidenceVisualization, validateVolumetricData, setPrototypeState, interpolationStyleSettings, useAdvancedInterpolation]);

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