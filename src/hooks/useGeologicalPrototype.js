import { useState, useCallback, useRef, useEffect } from 'react';
import { useBoreholes } from '../contexts/BoreholeContext';
import { useGeologicalModeling } from '../contexts/GeologicalModelingContext';
import { Logger } from '../utils/Logger.js';

const logger = new Logger().withContext('useGeologicalPrototype');

/**
 * Custom hook for managing geological modeling prototype workflow
 * @returns {Object} Hook interface with state and actions
 */
export function useGeologicalPrototype() {
  const { boreholes } = useBoreholes();
  const {
    modelingMode,
    modelingSettings,
    prototypeResult,
    prototypeError,
    setPrototypeState,
    clearPrototypeState,
    INTERPOLATION_METHODS
  } = useGeologicalModeling();

  // State management (local to hook)
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [workerReady, setWorkerReady] = useState(false);

  // Worker reference
  const workerRef = useRef(null);

  // Initialize Web Worker
  useEffect(() => {
    try {
      workerRef.current = new Worker('/workers/simpleGeologicalWorker.js');

      workerRef.current.onmessage = (e) => {
        const { type, ...data } = e.data;

        switch (type) {
          case 'WORKER_READY':
            setWorkerReady(true);

            break;

          case 'PROGRESS':
            setProgress({
              step: data.step,
              progress: data.progress || 0
            });
            break;

          case 'MODEL_COMPLETE':
            // Reconstruct typed arrays from transferred ArrayBuffers
            const reconstructedResult = reconstructTypedArrays(data.result);
            setPrototypeState(reconstructedResult, null);
            setIsProcessing(false);
            setProgress(null);

            break;

          case 'MODEL_ERROR':
            setPrototypeState(null, data.error);
            setIsProcessing(false);
            setProgress(null);
            logger.error('Geological modeling error:', data.error);
            break;

          default:
          // Unknown message type from worker
        }
      };

      workerRef.current.onerror = (error) => {
        logger.error('Worker error:', error);
        setPrototypeState(null, {
          message: 'Web Worker error: ' + error.message,
          timestamp: new Date().toISOString()
        });
        setIsProcessing(false);
        setProgress(null);
        setWorkerReady(false);
      };

      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
      };
    } catch (err) {
      logger.error('Failed to initialize geological worker:', err);
      setPrototypeState(null, {
        message: 'Failed to initialize Web Worker: ' + err.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [setPrototypeState]);

  // Generate geological model
  const generateModel = useCallback(async () => {

    // Add a small delay to ensure context updates have propagated
    await new Promise(resolve => setTimeout(resolve, 50));

    // TEMPORARY: Bypass web worker and run on main thread for debugging

    if (modelingMode !== 'data-driven') {
      setPrototypeState(null, {
        message: 'Data-driven mode required for geological modeling. Current mode: ' + modelingMode,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (boreholes.length < 3) {
      setPrototypeState(null, {
        message: `At least 3 boreholes required for interpolation. Found: ${boreholes.length}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate boreholes have layer data
    const validBoreholes = boreholes.filter(bh => bh.layers && bh.layers.length > 0);
    if (validBoreholes.length < 3) {
      const boreholeInfo = boreholes.map(bh => `${bh.name}: ${bh.layers?.length || 0} layers`).join(', ');
      setPrototypeState(null, {
        message: `At least 3 boreholes must have geological layer data. Found: ${validBoreholes.length} valid of ${boreholes.length} total. Boreholes: [${boreholeInfo}]. Manually created boreholes need layer data added via the Advanced panel.`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate spatial distribution
    const spatialValidation = validateSpatialDistribution(validBoreholes);
    if (!spatialValidation.isValid) {
      setPrototypeState(null, {
        message: spatialValidation.message,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Calculate site extent from borehole positions
    const siteExtent = calculateSiteExtent(validBoreholes);

    // Clear previous state
    setPrototypeState(null, null);
    setIsProcessing(true);
    setProgress({ step: 'Initializing...', progress: 0 });

    // Run geological processing on main thread
    try {
      const startTime = performance.now();

      // Use selected method directly (no auto-selection)
      let selectedMethod = modelingSettings.interpolationMethod || 'idw';
      let methodReasoning = selectedMethod === 'kriging'
        ? 'Statistical interpolation with uncertainty estimates'
        : 'Realistic geological interpolation preserving detail';

      // Determine which interpolation system to use based on selected method
      const useAdvancedInterpolation = selectedMethod === INTERPOLATION_METHODS.KRIGING;

      // Import the appropriate utilities
      let interpolateLayerFn, extractUniqueMaterialsFn;

      if (useAdvancedInterpolation) {
        const advanced = await import('../utils/advancedGeologicalInterpolation.js');
        interpolateLayerFn = advanced.interpolateLayerAdvanced;
        extractUniqueMaterialsFn = advanced.extractUniqueMaterialsAdvanced;

      } else {
        const basic = await import('../utils/simpleIdw.js');
        interpolateLayerFn = basic.interpolateLayer;
        extractUniqueMaterialsFn = basic.extractUniqueMaterials;

      }

      // Mesh builder will be imported conditionally based on interpolation method

      const serializableBoreholes = validBoreholes.map(borehole => ({
        id: borehole.id,
        name: borehole.name,
        x: borehole.x,
        y: borehole.y,
        z: borehole.z,
        layers: borehole.layers,
        type: borehole.type,
        diameter: borehole.diameter,
        depth: borehole.depth
      }));

      setProgress({ step: 'Analyzing geological layers...', progress: 10 });

      const uniqueMaterials = extractUniqueMaterialsFn(serializableBoreholes);

      if (uniqueMaterials.length === 0) {
        throw new Error('No geological layers found in borehole data');
      }

      setProgress({ step: `Processing ${uniqueMaterials.length} layer types...`, progress: 20 });

      const processedLayers = [];
      const gridSize = 10;

      for (let i = 0; i < uniqueMaterials.length; i++) {
        const material = uniqueMaterials[i];
        const progress = 20 + (i / uniqueMaterials.length) * 60;

        setProgress({
          step: `Interpolating ${material} layer...`,
          progress: Math.round(progress)
        });

        try {
          // Pass modeling settings to advanced interpolation if using advanced methods
          const effectiveSettings = useAdvancedInterpolation
            ? { ...modelingSettings, interpolationMethod: selectedMethod }
            : modelingSettings;

          const interpolatedGrid = useAdvancedInterpolation
            ? interpolateLayerFn(serializableBoreholes, material, siteExtent, gridSize, effectiveSettings)
            : interpolateLayerFn(serializableBoreholes, material, siteExtent, gridSize);

          if (!interpolatedGrid) {
            throw new Error(`No interpolation result for ${material}`);
          }

          // Use enhanced mesh builder for advanced interpolation methods
          let meshData;
          if (useAdvancedInterpolation) {
            const { buildEnhancedLayerMesh } = await import('../utils/enhancedMeshBuilder.js');
            meshData = buildEnhancedLayerMesh(interpolatedGrid, material, {
              showConfidence: false, // Removed from UI - not functional
              confidenceVisualization: 'color', // Show confidence as color variation
              interpolationMethod: selectedMethod
            });

          } else {
            const { buildLayerMesh } = await import('../utils/meshBuilder.js');
            meshData = buildLayerMesh(interpolatedGrid, material);

          }

          // Calculate quality metrics for advanced interpolation
          let qualityMetrics = {};
          if (useAdvancedInterpolation && interpolatedGrid.length > 0) {
            const confidenceValues = interpolatedGrid
              .filter(point => point.confidence !== undefined)
              .map(point => point.confidence);

            if (confidenceValues.length > 0) {
              qualityMetrics = {
                avgConfidence: confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length,
                minConfidence: Math.min(...confidenceValues),
                maxConfidence: Math.max(...confidenceValues),
                confidencePoints: confidenceValues.length,
                interpolationMethod: modelingSettings.interpolationMethod,
                hasConfidenceMapping: false // Removed from UI - not functional
              };
            }
          }

          processedLayers.push({
            material,
            meshData,
            pointCount: interpolatedGrid.length,
            dataPointCount: serializableBoreholes.length,
            interpolationQuality: qualityMetrics,
            useAdvancedInterpolation
          });

          // Yield to prevent blocking
          await new Promise(resolve => setTimeout(resolve, 10));

        } catch (layerError) {
          // Failed to process material layer
        }
      }

      if (processedLayers.length === 0) {
        throw new Error('No geological layers could be processed successfully');
      }

      const processingTime = performance.now() - startTime;

      setProgress({ step: 'Finalizing geological model...', progress: 90 });

      // Calculate overall interpolation statistics
      const interpolationStats = {
        useAdvancedInterpolation,
        interpolationMethod: modelingSettings.interpolationMethod,
        enableConfidenceMapping: false // Removed from UI - not functional
      };

      if (useAdvancedInterpolation) {
        const layersWithConfidence = processedLayers.filter(layer =>
          layer.interpolationQuality.avgConfidence !== undefined
        );

        if (layersWithConfidence.length > 0) {
          interpolationStats.overallAvgConfidence = layersWithConfidence
            .reduce((sum, layer) => sum + layer.interpolationQuality.avgConfidence, 0) / layersWithConfidence.length;
          interpolationStats.minLayerConfidence = Math.min(...layersWithConfidence
            .map(layer => layer.interpolationQuality.minConfidence));
          interpolationStats.maxLayerConfidence = Math.max(...layersWithConfidence
            .map(layer => layer.interpolationQuality.maxConfidence));
        }
      }

      const result = {
        layers: processedLayers,
        processedAt: new Date().toISOString(),
        boreholeCount: serializableBoreholes.length,
        siteExtent,
        processingTime: Math.round(processingTime),
        gridSize,
        interpolationStats,
        modelingSettings: {
          interpolationMethod: selectedMethod,
          originalMethod: modelingSettings.interpolationMethod,
          methodReasoning: methodReasoning,
          enableConfidenceMapping: false, // Removed from UI - not functional
          krigingVariogramModel: effectiveSettings.krigingVariogramModel,
          rbfBasisFunction: effectiveSettings.rbfBasisFunction
        },
        statistics: {
          totalLayers: processedLayers.length,
          totalVertices: processedLayers.reduce((sum, layer) => sum + layer.meshData.vertexCount, 0),
          totalFaces: processedLayers.reduce((sum, layer) => sum + layer.meshData.faceCount, 0)
        }
      };

      setPrototypeState(result, null);
      setIsProcessing(false);
      setProgress(null);

    } catch (err) {
      logger.error('Geological processing error:', err.message);
      setPrototypeState(null, {
        message: 'Failed to process geological model: ' + err.message,
        timestamp: new Date().toISOString()
      });
      setIsProcessing(false);
      setProgress(null);
    }

    return; // Main thread processing complete - skip original web worker code
  }, [boreholes, modelingMode, workerReady, setPrototypeState]);

  // Clear model and reset state
  const clearModel = useCallback(() => {
    clearPrototypeState();
    setProgress(null);
    if (isProcessing && workerRef.current) {
      // Terminate and recreate worker to cancel processing
      workerRef.current.terminate();
      setIsProcessing(false);
      setWorkerReady(false);
    }
  }, [isProcessing, clearPrototypeState]);

  // Get validation status
  const getValidationStatus = useCallback(() => {
    if (modelingMode !== 'data-driven') {
      return {
        canGenerate: false,
        message: 'Switch to Data-Driven mode to generate geological models',
        type: 'mode'
      };
    }

    if (boreholes.length < 3) {
      return {
        canGenerate: false,
        message: `Need at least 3 boreholes (found: ${boreholes.length})`,
        type: 'insufficient-boreholes'
      };
    }

    const validBoreholes = boreholes.filter(bh => bh.layers && bh.layers.length > 0);
    if (validBoreholes.length < 3) {
      return {
        canGenerate: false,
        message: `Need at least 3 boreholes with layer data (found: ${validBoreholes.length})`,
        type: 'insufficient-data'
      };
    }

    const spatialValidation = validateSpatialDistribution(validBoreholes);
    if (!spatialValidation.isValid) {
      return {
        canGenerate: false,
        message: spatialValidation.message,
        type: 'spatial-distribution'
      };
    }

    return {
      canGenerate: true,
      message: `Ready to generate model from ${validBoreholes.length} boreholes`,
      type: 'ready'
    };
  }, [boreholes, modelingMode]);

  // Get model statistics
  const getModelStatistics = useCallback(() => {
    if (!prototypeResult) return null;

    return {
      layerCount: prototypeResult.layers.length,
      boreholeCount: prototypeResult.boreholeCount,
      processingTime: prototypeResult.processingTime,
      totalVertices: prototypeResult.statistics?.totalVertices || 0,
      totalFaces: prototypeResult.statistics?.totalFaces || 0,
      gridSize: prototypeResult.gridSize,
      siteArea: (prototypeResult.siteExtent.width * prototypeResult.siteExtent.height).toFixed(2),
      layers: prototypeResult.layers.map(layer => ({
        material: layer.material,
        pointCount: layer.pointCount,
        dataPoints: layer.dataPointCount,
        vertexCount: layer.meshData.vertexCount,
        faceCount: layer.meshData.faceCount
      }))
    };
  }, [prototypeResult]);

  // Make generateModel available globally for testing
  useEffect(() => {
    window.generateGeologicalModel = generateModel;

    // Cleanup function to remove global assignment
    return () => {
      delete window.generateGeologicalModel;
    };
  }, [generateModel]);

  return {
    // State
    isProcessing,
    progress,
    result: prototypeResult,
    error: prototypeError,
    workerReady,

    // Computed properties
    validation: getValidationStatus(),
    statistics: getModelStatistics(),

    // Actions
    generateModel,
    clearModel,

    // Legacy computed (for backward compatibility)
    canGenerate: getValidationStatus().canGenerate
  };
}

/**
 * Calculates site extent with padding around boreholes
 * @param {Array} boreholes - Array of borehole objects
 * @returns {Object} Site extent object
 */
function calculateSiteExtent(boreholes) {
  if (boreholes.length === 0) {
    return { minX: -10, maxX: 10, minY: -10, maxY: 10, width: 20, height: 20 };
  }

  const positions = boreholes.map(bh => ({
    x: bh.x || 0,
    y: bh.z || 0  // Use Z coordinate for horizontal positioning
  }));

  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y));

  // Calculate dimensions
  const baseWidth = Math.max(maxX - minX, 1); // Minimum 1 unit
  const baseHeight = Math.max(maxY - minY, 1);

  // Add generous padding around boreholes to ensure all boreholes are included
  // Use 50% padding or minimum 5 units, whichever is larger
  const paddingX = Math.max(baseWidth * 0.5, 5);
  const paddingY = Math.max(baseHeight * 0.5, 5);

  return {
    minX: minX - paddingX,
    maxX: maxX + paddingX,
    minY: minY - paddingY,
    maxY: maxY + paddingY,
    width: baseWidth + 2 * paddingX,
    height: baseHeight + 2 * paddingY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/**
 * Reconstructs typed arrays from transferred ArrayBuffers
 * @param {Object} result - Result data from worker with transferred buffers
 * @returns {Object} Result with properly reconstructed typed arrays
 */
function reconstructTypedArrays(result) {

  const reconstructedLayers = result.layers.map(layer => {
    const meshData = layer.meshData;

    // Log the current state of mesh data

    // Log what we received from worker before reconstruction

    // Try to reconstruct typed arrays from whatever we received
    let reconstructedVertices, reconstructedFaces, reconstructedColors, reconstructedUvs;

    try {
      // If it's already a typed array, keep it; if it's an ArrayBuffer, construct from it; if it's an object, try to construct from it
      if (meshData.vertices instanceof Float32Array) {
        reconstructedVertices = meshData.vertices;
      } else if (meshData.vertices instanceof ArrayBuffer) {
        reconstructedVertices = new Float32Array(meshData.vertices);
      } else if (meshData.vertices && typeof meshData.vertices === 'object') {
        // It might be a serialized typed array (plain object with numeric indices)
        const values = Object.values(meshData.vertices);
        reconstructedVertices = new Float32Array(values);
      } else {
        reconstructedVertices = null;
      }

      if (meshData.faces instanceof Uint16Array) {
        reconstructedFaces = meshData.faces;
      } else if (meshData.faces instanceof ArrayBuffer) {
        reconstructedFaces = new Uint16Array(meshData.faces);
      } else if (meshData.faces && typeof meshData.faces === 'object') {
        const values = Object.values(meshData.faces);
        reconstructedFaces = new Uint16Array(values);
      } else {
        reconstructedFaces = null;
      }

      if (meshData.colors instanceof Float32Array) {
        reconstructedColors = meshData.colors;
      } else if (meshData.colors instanceof ArrayBuffer) {
        reconstructedColors = new Float32Array(meshData.colors);
      } else if (meshData.colors && typeof meshData.colors === 'object') {
        const values = Object.values(meshData.colors);
        reconstructedColors = new Float32Array(values);
      } else {
        reconstructedColors = null;
      }

      if (meshData.uvs instanceof Float32Array) {
        reconstructedUvs = meshData.uvs;
      } else if (meshData.uvs instanceof ArrayBuffer) {
        reconstructedUvs = new Float32Array(meshData.uvs);
      } else if (meshData.uvs && typeof meshData.uvs === 'object') {
        const values = Object.values(meshData.uvs);
        reconstructedUvs = new Float32Array(values);
      } else {
        reconstructedUvs = null;
      }
    } catch (reconstructionError) {
      logger.error(`Failed to reconstruct typed arrays for ${layer.material}:`, reconstructionError);
      return { ...layer, meshData: null };
    }

    // Reconstruct typed arrays from ArrayBuffers
    const reconstructedMeshData = {
      ...meshData,
      vertices: reconstructedVertices,
      faces: reconstructedFaces,
      colors: reconstructedColors,
      uvs: reconstructedUvs
    };

    // Validate reconstruction

    return {
      ...layer,
      meshData: reconstructedMeshData
    };
  });

  return {
    ...result,
    layers: reconstructedLayers
  };
}

/**
 * Validates spatial distribution of boreholes
 * @param {Array} boreholes - Array of borehole objects
 * @returns {Object} Validation result
 */
function validateSpatialDistribution(boreholes) {
  if (boreholes.length < 3) {
    return {
      isValid: false,
      message: 'Need at least 3 boreholes for spatial validation'
    };
  }

  // Check for duplicate positions (within 0.1 units) - use X,Z coordinates for horizontal plane
  const positions = boreholes.map(bh => ({
    x: Math.round((bh.x || 0) * 10) / 10,
    z: Math.round((bh.z || 0) * 10) / 10,
    y: bh.y || 0, // Keep Y for display but don't use for spatial validation
    id: bh.id,
    name: bh.name
  }));

  const positionMap = new Map();
  for (const pos of positions) {
    const key = `${pos.x},${pos.z}`;
    if (positionMap.has(key)) {
      return {
        isValid: false,
        message: `Boreholes too close together at horizontal position (${pos.x}, ${pos.z})`
      };
    }
    positionMap.set(key, pos.id);
  }

  // Check for collinearity in horizontal plane (X,Z coordinates) - Y is elevation, not horizontal position
  if (positions.length >= 3) {
    const [p1, p2, p3] = positions;
    const area = Math.abs(
      p1.x * (p2.z - p3.z) +
      p2.x * (p3.z - p1.z) +
      p3.x * (p1.z - p2.z)
    ) / 2;

    if (area < 0.01) {
      return {
        isValid: false,
        message: `Boreholes are collinear in horizontal plane (X,Z positions: ${positions.map(p => `(${p.x},${p.z})`).join(', ')}). All boreholes can start at same elevation (Y=${positions[0].y}) but need triangular distribution horizontally. Move boreholes to different X,Z coordinates.`
      };
    }
  }

  return {
    isValid: true,
    message: 'Good spatial distribution for interpolation'
  };
}