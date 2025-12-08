/**
 * useRevitExport Hook
 *
 * Provides a clean interface for components to interact with the Revit export system.
 * Integrates with the ExportContext orchestration layer and geological modeling contexts
 * to enable seamless BIM-compatible exports (OBJ+MTL and IFC-JSON formats).
 *
 * Features:
 * - Automatic export format validation and recommendations
 * - Real-time progress tracking with detailed status messages
 * - Export cancellation support with proper cleanup
 * - Integration with existing geological modeling contexts
 * - Memory management following existing volumetric disposal patterns
 * - Settings persistence and export configuration
 * - Error handling and recovery mechanisms
 *
 * Usage:
 * ```javascript
 * const {
 *   exportToRevit,
 *   isExporting,
 *   progress,
 *   error,
 *   cancelExport,
 *   availableFormats,
 *   exportSettings,
 *   updateSettings
 * } = useRevitExport();
 *
 * // Export geological model to Revit OBJ format
 * await exportToRevit('revit-obj', { unitSystem: 'imperial' });
 * ```
 *
 * @since 1.0.0
 * @author Frontend Developer Agent
 */

import { useState, useCallback, useRef, useEffect, useContext, useMemo } from 'react';

// Context imports following established patterns
import { useExportOrchestration, EXPORT_FORMATS } from '../contexts/ExportContext.js';
import { useGeologicalModeling } from '../contexts/GeologicalModelingContext.js';
import { useBoreholes } from '../contexts/BoreholeContext.js';
import { useDisplayOptions } from '../contexts/DisplayOptionsContext.js';
// Note: useThreeJsScene is commented out - using ThreeJsContext directly
import { ThreeJsContext } from '../contexts/ThreeJsContext.js';

// Service imports
import { RevitExportOrchestrator } from '../services/export/RevitExportOrchestrator.js';

// Utility imports following existing patterns
import { exportLogger } from '../utils/Logger.js';
import { volumetricTracker } from '../utils/volumetricDisposal.js';

/**
 * @typedef {Object} ExportOptions
 * @property {string} unitSystem - Unit system ('imperial' | 'metric')
 * @property {boolean} includeTextures - Include soil textures in export
 * @property {boolean} includeMaterials - Include geological materials
 * @property {boolean} includeMetadata - Include geological metadata
 * @property {boolean} generateInstructions - Generate Revit import instructions
 * @property {string} detailLevel - Export detail level ('low' | 'medium' | 'high')
 * @property {boolean} includeWaterTable - Include water table data
 * @property {boolean} includeBoreholesAsColumns - Export boreholes as structural columns
 */

/**
 * @typedef {Object} ExportProgress
 * @property {boolean} isExporting - Whether export is currently in progress
 * @property {number} progress - Progress percentage (0-100)
 * @property {string} message - Current progress message
 * @property {boolean} canCancel - Whether export can be cancelled
 * @property {number} duration - Export duration in milliseconds
 * @property {boolean} isComplete - Whether export completed successfully
 * @property {boolean} hasError - Whether export failed with error
 */

/**
 * @typedef {Object} ExportResult
 * @property {Array} files - Generated export files
 * @property {Object} metadata - Export metadata
 * @property {string} format - Export format used
 * @property {number} totalSize - Total size of export files
 * @property {string} downloadUrl - Download URL for export package
 * @property {Object} revitInstructions - Revit import instructions
 */

/**
 * @typedef {Object} UseRevitExportReturn
 * @property {Function} exportToRevit - Main export function
 * @property {boolean} isExporting - Export in progress status
 * @property {ExportProgress} progress - Detailed progress information
 * @property {string|null} error - Current error message
 * @property {ExportResult|null} result - Export result when complete
 * @property {Function} cancelExport - Cancel current export
 * @property {Function} clearExport - Clear export state and results
 * @property {Array} availableFormats - Available export formats
 * @property {Object} exportSettings - Current export settings
 * @property {Function} updateSettings - Update export settings
 * @property {Function} validateExportData - Validate data before export
 * @property {boolean} canExport - Whether export is possible with current data
 * @property {Object} exportCapabilities - Export capability analysis
 */

/**
 * Custom hook for Revit export functionality
 * @returns {UseRevitExportReturn} Hook interface with export functionality
 */
export function useRevitExport() {
  // Context dependencies following established patterns
  const {
    executeExport,
    cancelExport: cancelExportContext,
    resetExportState,
    registerExportStrategy,
    unregisterExportStrategy,
    getAvailableFormats,
    getExportProgress,
    exportSettings: contextExportSettings,
    updateExportSettings,
    exportState
    // EXPORT_FORMATS: CONTEXT_FORMATS // Unused
  } = useExportOrchestration();

  const {
    modelingMode,
    prototypeResult: geologicalModel,
    modelingSettings
  } = useGeologicalModeling();

  const { boreholes } = useBoreholes();

  const {
    textureSettings,
    showWaterTable,
    showBoreholes,
    showBoreholeStrata
  } = useDisplayOptions();

  const { sceneManager, scene, camera, isInitialized } = useContext(ThreeJsContext);

  // Local state management
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [hookInitialized, setHookInitialized] = useState(false);

  // References for cleanup and strategy management
  const orchestratorRef = useRef(null);
  const initializationRef = useRef(false);

  /**
   * Initialize the Revit export orchestrator and register it with the export system
   */
  const initializeExportStrategy = useCallback(async () => {
    if (initializationRef.current) {
      return;
    }

    try {
      exportLogger.info('Initializing Revit export strategy...');

      // Create orchestrator instance
      orchestratorRef.current = new RevitExportOrchestrator();

      // Register export strategy for supported formats
      const registrationPromises = [
        registerExportStrategy(EXPORT_FORMATS.REVIT_OBJ, orchestratorRef.current),
        registerExportStrategy(EXPORT_FORMATS.REVIT_IFC, orchestratorRef.current)
      ];

      const results = await Promise.all(registrationPromises);
      const allRegistered = results.every(success => success === true);

      if (!allRegistered) {
        throw new Error('Failed to register some export strategies');
      }

      initializationRef.current = true;
      setHookInitialized(true);

      exportLogger.info('Revit export strategies registered successfully', {
        formats: [EXPORT_FORMATS.REVIT_OBJ, EXPORT_FORMATS.REVIT_IFC]
      });

    } catch (error) {
      exportLogger.error('Failed to initialize Revit export strategy:', error);
      setError(`Failed to initialize export system: ${error.message}`);
    }
  }, [registerExportStrategy]);

  /**
   * Extract and prepare geological scene data for export
   */
  const extractSceneData = useCallback(() => {
    if (!isInitialized || !scene || !sceneManager) {
      throw new Error('Three.js scene not initialized');
    }

    exportLogger.info('Extracting geological scene data for Revit export');

    // Prepare comprehensive scene data following established patterns
    const sceneData = {
      scene,
      camera,
      sceneManager,
      boreholes: boreholes || [],
      soilLayers: [], // TODO: Extract from layers context if needed
      geologicalModel,
      waterTableData: boreholes.filter(bh =>
        bh.waterTableEncountered || typeof bh.waterTableDepth === 'number'
      ),
      strataDimensions: {
        // Extract dimensions from geological model if available
        bounds: geologicalModel?.siteExtent || null,
        resolution: geologicalModel?.gridSize || null
      },
      siteMap: sceneManager.get('siteMap') || null,
      displaySettings: {
        textureSettings,
        showWaterTable,
        showBoreholes,
        showBoreholeStrata
      },
      modelingSettings,
      modelingMode,
      metadata: {
        extractedAt: new Date().toISOString(),
        boreholeCount: boreholes.length,
        hasGeologicalModel: !!geologicalModel,
        hasWaterTable: boreholes.some(bh =>
          bh.waterTableEncountered || typeof bh.waterTableDepth === 'number'
        )
      }
    };

    exportLogger.info('Scene data extracted successfully', {
      boreholes: sceneData.boreholes.length,
      hasGeologicalModel: !!sceneData.geologicalModel,
      hasWaterTable: sceneData.waterTableData.length > 0,
      hasSiteMap: !!sceneData.siteMap
    });

    return sceneData;
  }, [
    isInitialized,
    scene,
    camera,
    sceneManager,
    boreholes,
    geologicalModel,
    textureSettings,
    showWaterTable,
    showBoreholes,
    showBoreholeStrata,
    modelingSettings,
    modelingMode
  ]);

  /**
   * Validate that current data is suitable for Revit export
   */
  const validateExportData = useCallback(() => {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      capabilities: {
        hasBoreholes: false,
        hasGeologicalModel: false,
        hasWaterTable: false,
        hasSiteMap: false,
        materialCount: 0,
        recommendedFormat: null
      }
    };

    try {
      // Check Three.js scene availability
      if (!isInitialized || !scene) {
        validation.errors.push('3D scene not initialized');
        validation.isValid = false;
      }

      // Check borehole data
      if (!boreholes || boreholes.length === 0) {
        validation.warnings.push('No boreholes available for export');
      } else {
        validation.capabilities.hasBoreholes = true;

        // Check for boreholes with layer data
        const boreholesWithLayers = boreholes.filter(bh =>
          bh.layers && bh.layers.length > 0
        );
        if (boreholesWithLayers.length === 0) {
          validation.warnings.push('No boreholes have geological layer data');
        }
      }

      // Check geological model
      if (geologicalModel && geologicalModel.layers) {
        validation.capabilities.hasGeologicalModel = true;
        validation.capabilities.materialCount = geologicalModel.layers.length;
      } else {
        validation.warnings.push('No geological model available - only borehole data will be exported');
      }

      // Check water table data
      const boreholesWithWaterTable = boreholes.filter(bh =>
        bh.waterTableEncountered || typeof bh.waterTableDepth === 'number'
      );
      if (boreholesWithWaterTable.length > 0) {
        validation.capabilities.hasWaterTable = true;
      }

      // Check for site map
      if (sceneManager && sceneManager.get('siteMap')) {
        validation.capabilities.hasSiteMap = true;
      }

      // Recommend export format based on data availability
      if (validation.capabilities.hasGeologicalModel && validation.capabilities.materialCount > 0) {
        validation.capabilities.recommendedFormat = EXPORT_FORMATS.REVIT_IFC;
        validation.capabilities.reason = 'IFC format recommended for complex geological models with multiple materials';
      } else if (validation.capabilities.hasBoreholes) {
        validation.capabilities.recommendedFormat = EXPORT_FORMATS.REVIT_OBJ;
        validation.capabilities.reason = 'OBJ format suitable for borehole geometry export';
      }

      // Final validation
      if (!validation.capabilities.hasBoreholes && !validation.capabilities.hasGeologicalModel) {
        validation.errors.push('No exportable geological data found');
        validation.isValid = false;
      }

    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
      validation.isValid = false;
      exportLogger.error('Export validation failed:', error);
    }

    return validation;
  }, [
    isInitialized,
    scene,
    sceneManager,
    boreholes,
    geologicalModel
  ]);

  /**
   * Main export function
   * @param {string} format - Export format (EXPORT_FORMATS.REVIT_OBJ or EXPORT_FORMATS.REVIT_IFC)
   * @param {ExportOptions} options - Export options and settings
   * @returns {Promise<ExportResult>} Export result
   */
  const exportToRevit = useCallback(async (format, options = {}) => {
    if (!hookInitialized || !orchestratorRef.current) {
      await initializeExportStrategy();
    }

    // Clear previous state
    setError(null);
    setResult(null);
    resetExportState();

    try {
      exportLogger.info(`Starting Revit export with format: ${format}`, options);

      // Validate export data
      const validation = validateExportData();
      if (!validation.isValid) {
        const errorMessage = validation.errors.join(', ');
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      // Show warnings but continue
      if (validation.warnings.length > 0) {
        exportLogger.warn('Export validation warnings:', validation.warnings);
      }

      // Validate format
      if (!Object.values(EXPORT_FORMATS).includes(format)) {
        const errorMessage = `Unsupported export format: ${format}`;
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      // Extract scene data
      const sceneData = extractSceneData();

      // Prepare export options with defaults
      const exportOptions = {
        format,
        ...options,
        // Merge with context settings
        settings: {
          ...contextExportSettings[format],
          ...options
        },
        // Add validation capabilities for informed processing
        capabilities: validation.capabilities
      };

      // Execute export through context orchestration
      const exportResult = await executeExport(sceneData, format, exportOptions);

      setResult(exportResult);
      exportLogger.info(`Revit export completed successfully`, {
        format,
        filesGenerated: exportResult?.files?.length || 0
      });

      return exportResult;

    } catch (error) {
      const errorMessage = `Revit export failed: ${error.message}`;
      setError(errorMessage);
      exportLogger.error('Revit export failed:', error);
      throw error;
    }
  }, [
    hookInitialized,
    initializeExportStrategy,
    validateExportData,
    extractSceneData,
    executeExport,
    resetExportState,
    contextExportSettings
  ]);

  /**
   * Cancel current export operation
   */
  const cancelExport = useCallback(async () => {
    try {
      await cancelExportContext();
      exportLogger.info('Revit export cancelled by user');
    } catch (error) {
      exportLogger.error('Error cancelling export:', error);
    }
  }, [cancelExportContext]);

  /**
   * Clear export state and results
   */
  const clearExport = useCallback(() => {
    setError(null);
    setResult(null);
    resetExportState();
    exportLogger.info('Revit export state cleared');
  }, [resetExportState]);

  /**
   * Update export settings for specific format
   * @param {string} format - Export format
   * @param {Object} newSettings - Settings to update
   */
  const updateSettings = useCallback((format, newSettings) => {
    updateExportSettings(format, newSettings);
    exportLogger.info(`Updated export settings for format: ${format}`, newSettings);
  }, [updateExportSettings]);

  // Initialize export strategy when hook mounts and context is ready
  useEffect(() => {
    if (isInitialized && !hookInitialized) {
      initializeExportStrategy();
    }
  }, [isInitialized, hookInitialized, initializeExportStrategy]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Unregister export strategies
      if (initializationRef.current) {
        unregisterExportStrategy(EXPORT_FORMATS.REVIT_OBJ);
        unregisterExportStrategy(EXPORT_FORMATS.REVIT_IFC);
      }

      // Cleanup orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.cleanup?.();
        orchestratorRef.current = null;
      }

      // Cleanup any tracked volumetric resources
      if (volumetricTracker?.getStats?.()?.tracked > 0) {
        exportLogger.info('Cleaning up tracked resources from Revit export');
        // Note: Don't call disposeAll() here as other components may be using tracked resources
        // Let the volumetricDisposal system handle cleanup based on usage patterns
      }

      initializationRef.current = false;
      exportLogger.info('Revit export hook cleaned up');
    };
  }, [unregisterExportStrategy]);

  // Get current progress information
  const progress = useMemo(() => {
    const progressInfo = getExportProgress();
    return {
      ...progressInfo,
      // Add any additional progress information specific to Revit exports
      stage: exportState.status || 'idle'
    };
  }, [getExportProgress, exportState.status]);

  // Get available formats
  const availableFormats = useMemo(() => {
    const formats = getAvailableFormats();
    return formats.filter(format =>
      format === EXPORT_FORMATS.REVIT_OBJ || format === EXPORT_FORMATS.REVIT_IFC
    );
  }, [getAvailableFormats]);

  // Calculate export capabilities
  const exportCapabilities = useMemo(() => {
    const validation = validateExportData();
    return validation.capabilities;
  }, [validateExportData]);

  // Determine if export is possible
  const canExport = useMemo(() => {
    const validation = validateExportData();
    return validation.isValid && hookInitialized;
  }, [validateExportData, hookInitialized]);

  return {
    // Core export functionality
    exportToRevit,
    cancelExport,
    clearExport,

    // State
    isExporting: progress.isExporting,
    progress,
    error,
    result,

    // Settings management
    exportSettings: contextExportSettings,
    updateSettings,

    // Data validation and capabilities
    validateExportData,
    exportCapabilities,
    canExport,

    // Available options
    availableFormats,

    // Export format constants for convenience
    EXPORT_FORMATS: {
      REVIT_OBJ: EXPORT_FORMATS.REVIT_OBJ,
      REVIT_IFC: EXPORT_FORMATS.REVIT_IFC
    },

    // Initialization status
    isInitialized: hookInitialized
  };
}

export default useRevitExport;