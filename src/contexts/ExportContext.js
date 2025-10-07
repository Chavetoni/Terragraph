/**
 * ExportContext - Safe orchestration layer for all export functionality
 *
 * This context extends the existing export system without modifying SceneExporter.js
 * Uses a plugin architecture to support multiple export formats while maintaining
 * full backward compatibility with existing GLTF/GLB exports.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { exportLogger } from '../utils/Logger.js';

// Create the context
const ExportContext = createContext();

// Custom hook for accessing export context
export const useExportOrchestration = () => {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExportOrchestration must be used within ExportProvider');
  }
  return context;
};

// Export format constants
export const EXPORT_FORMATS = {
  // Existing formats (handled by SceneExporter)
  GLTF: 'gltf',
  GLB: 'glb',

  // New BIM formats (handled by RevitExportOrchestrator)
  REVIT_OBJ: 'revit-obj',
  REVIT_IFC: 'revit-ifc',

  // Future expansion slots
  CAD_DWG: 'cad-dwg',
  CSV_DATA: 'csv-data'
};

// Export status constants
export const EXPORT_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  PROCESSING: 'processing',
  GENERATING: 'generating',
  PACKAGING: 'packaging',
  COMPLETE: 'complete',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

// Default export state
const DEFAULT_EXPORT_STATE = {
  format: EXPORT_FORMATS.GLTF,
  status: EXPORT_STATUS.IDLE,
  progress: 0,
  message: '',
  error: null,
  result: null,
  startTime: null,
  endTime: null
};

/**
 * ExportProvider - React context provider for export orchestration
 */
export const ExportProvider = ({ children }) => {
  // Core export state
  const [exportState, setExportState] = useState(DEFAULT_EXPORT_STATE);

  // Export strategy registry
  const exportStrategiesRef = useRef(new Map());

  // Active export cancellation
  const exportCancellationRef = useRef(null);

  // Export settings for different formats
  const [exportSettings, setExportSettings] = useState({
    [EXPORT_FORMATS.REVIT_OBJ]: {
      unitSystem: 'imperial', // 'imperial' | 'metric'
      includeTextures: true,
      includeMaterials: true,
      includeMetadata: true,
      generateInstructions: true,
      detailLevel: 'medium' // 'low' | 'medium' | 'high'
    },
    [EXPORT_FORMATS.REVIT_IFC]: {
      unitSystem: 'imperial',
      ifcVersion: '4',
      includeGeologicalProperties: true,
      includeWaterTable: true,
      includeBoreholesAsColumns: true,
      spatialStructure: 'site-building' // 'site-building' | 'site-only'
    }
  });

  /**
   * Register an export strategy for a specific format
   */
  const registerExportStrategy = useCallback((format, strategy) => {
    if (!format || !strategy) {
      exportLogger.error('Invalid export strategy registration:', { format, strategy });
      return false;
    }

    // Validate strategy interface
    const requiredMethods = ['canExport', 'prepareExport', 'execute', 'cleanup'];
    const hasRequiredMethods = requiredMethods.every(method =>
      typeof strategy[method] === 'function'
    );

    if (!hasRequiredMethods) {
      exportLogger.error('Export strategy missing required methods:', {
        format,
        required: requiredMethods,
        available: Object.keys(strategy).filter(key => typeof strategy[key] === 'function')
      });
      return false;
    }

    exportStrategiesRef.current.set(format, strategy);
    exportLogger.info(`Export strategy registered for format: ${format}`);
    return true;
  }, []);

  /**
   * Unregister an export strategy
   */
  const unregisterExportStrategy = useCallback((format) => {
    const removed = exportStrategiesRef.current.delete(format);
    if (removed) {
      exportLogger.info(`Export strategy unregistered for format: ${format}`);
    }
    return removed;
  }, []);

  /**
   * Get available export formats
   */
  const getAvailableFormats = useCallback(() => {
    const registeredFormats = Array.from(exportStrategiesRef.current.keys());
    const allFormats = [
      // Always available legacy formats
      EXPORT_FORMATS.GLTF,
      EXPORT_FORMATS.GLB,
      // Registered new formats
      ...registeredFormats
    ];

    return [...new Set(allFormats)]; // Remove duplicates
  }, []);

  /**
   * Update export state safely
   */
  const updateExportState = useCallback((updates) => {
    setExportState(prevState => ({
      ...prevState,
      ...updates,
      // Auto-set timestamps
      ...(updates.status === EXPORT_STATUS.PROCESSING && !prevState.startTime && {
        startTime: Date.now()
      }),
      ...(updates.status === EXPORT_STATUS.COMPLETE && {
        endTime: Date.now()
      })
    }));
  }, []);

  /**
   * Reset export state to default
   */
  const resetExportState = useCallback(() => {
    setExportState(DEFAULT_EXPORT_STATE);
    exportCancellationRef.current = null;
  }, []);

  /**
   * Update export settings for a specific format
   */
  const updateExportSettings = useCallback((format, newSettings) => {
    setExportSettings(prev => ({
      ...prev,
      [format]: {
        ...prev[format],
        ...newSettings
      }
    }));
  }, []);

  /**
   * Main export orchestration method
   */
  const executeExport = useCallback(async (sceneData, format, options = {}) => {
    // Validate inputs
    if (!sceneData || !format) {
      const error = new Error('Invalid export parameters: sceneData and format are required');
      exportLogger.error(error.message, { sceneData: !!sceneData, format });
      updateExportState({
        status: EXPORT_STATUS.ERROR,
        error: error.message
      });
      throw error;
    }

    // Check if export already in progress
    if (exportState.status === EXPORT_STATUS.PROCESSING) {
      const error = new Error('Export already in progress. Cancel current export or wait for completion.');
      exportLogger.warn(error.message);
      throw error;
    }

    // Initialize export state
    updateExportState({
      format,
      status: EXPORT_STATUS.PREPARING,
      progress: 0,
      message: 'Initializing export...',
      error: null,
      result: null
    });

    // Create cancellation token
    const cancellationToken = {
      isCancelled: false,
      cancel: () => { cancellationToken.isCancelled = true; }
    };
    exportCancellationRef.current = cancellationToken;

    try {
      // Get export strategy for format
      const strategy = exportStrategiesRef.current.get(format);

      if (!strategy) {
        // For legacy formats (GLTF/GLB), this is expected - they're handled elsewhere
        if (format === EXPORT_FORMATS.GLTF || format === EXPORT_FORMATS.GLB) {
          exportLogger.info(`Legacy format ${format} - delegating to existing SceneExporter`);
          return null; // Let existing export handle this
        }

        throw new Error(`No export strategy registered for format: ${format}`);
      }

      // Check if strategy can handle this export
      const canExport = await strategy.canExport(sceneData, options);
      if (!canExport) {
        throw new Error(`Export strategy for ${format} cannot handle current scene data`);
      }

      // Update progress
      updateExportState({
        status: EXPORT_STATUS.PROCESSING,
        progress: 10,
        message: 'Preparing scene data...'
      });

      // Check cancellation
      if (cancellationToken.isCancelled) {
        throw new Error('Export cancelled during preparation');
      }

      // Prepare export data
      const preparedData = await strategy.prepareExport(sceneData, {
        ...options,
        settings: exportSettings[format] || {},
        onProgress: (progress, message) => {
          if (!cancellationToken.isCancelled) {
            updateExportState({
              progress: Math.min(10 + (progress * 0.4), 50), // 10-50% for preparation
              message: message || 'Preparing export data...'
            });
          }
        }
      });

      // Check cancellation
      if (cancellationToken.isCancelled) {
        await strategy.cleanup?.(preparedData);
        throw new Error('Export cancelled during preparation');
      }

      // Execute export
      updateExportState({
        status: EXPORT_STATUS.GENERATING,
        progress: 50,
        message: 'Generating export files...'
      });

      const exportResult = await strategy.execute(preparedData, {
        onProgress: (progress, message) => {
          if (!cancellationToken.isCancelled) {
            updateExportState({
              progress: Math.min(50 + (progress * 0.4), 90), // 50-90% for execution
              message: message || 'Generating files...'
            });
          }
        },
        cancellationToken
      });

      // Check cancellation
      if (cancellationToken.isCancelled) {
        await strategy.cleanup?.(preparedData, exportResult);
        throw new Error('Export cancelled during generation');
      }

      // Finalize export
      updateExportState({
        status: EXPORT_STATUS.PACKAGING,
        progress: 90,
        message: 'Finalizing export package...'
      });

      // Final validation and packaging
      const finalResult = {
        ...exportResult,
        format,
        timestamp: new Date().toISOString(),
        settings: exportSettings[format] || {},
        metadata: {
          ...exportResult.metadata,
          exportDuration: Date.now() - exportState.startTime,
          format,
          version: '1.0'
        }
      };

      // Complete export
      updateExportState({
        status: EXPORT_STATUS.COMPLETE,
        progress: 100,
        message: `Export completed successfully (${format.toUpperCase()})`,
        result: finalResult
      });

      // Cleanup
      await strategy.cleanup?.(preparedData, finalResult);

      exportLogger.info(`Export completed successfully`, {
        format,
        duration: Date.now() - exportState.startTime,
        filesGenerated: finalResult.files?.length || 0
      });

      return finalResult;

    } catch (error) {
      exportLogger.error('Export failed:', {
        format,
        error: error.message,
        duration: Date.now() - (exportState.startTime || Date.now())
      });

      updateExportState({
        status: EXPORT_STATUS.ERROR,
        error: error.message,
        progress: 0
      });

      // Cleanup on error
      const strategy = exportStrategiesRef.current.get(format);
      if (strategy?.cleanup) {
        try {
          await strategy.cleanup();
        } catch (cleanupError) {
          exportLogger.error('Error during export cleanup:', cleanupError);
        }
      }

      throw error;
    }
  }, [exportState.status, exportState.startTime, exportSettings, updateExportState]);

  /**
   * Cancel current export
   */
  const cancelExport = useCallback(async () => {
    if (exportCancellationRef.current && !exportCancellationRef.current.isCancelled) {
      exportCancellationRef.current.cancel();

      updateExportState({
        status: EXPORT_STATUS.CANCELLED,
        message: 'Export cancelled by user',
        progress: 0
      });

      // Cleanup will be handled by the export strategy
      exportLogger.info('Export cancelled by user');
    }
  }, [updateExportState]);

  /**
   * Get export progress information
   */
  const getExportProgress = useCallback(() => {
    const { status, progress, message, startTime } = exportState;

    return {
      status,
      progress,
      message,
      isExporting: status === EXPORT_STATUS.PROCESSING || status === EXPORT_STATUS.GENERATING || status === EXPORT_STATUS.PACKAGING,
      isComplete: status === EXPORT_STATUS.COMPLETE,
      hasError: status === EXPORT_STATUS.ERROR,
      isCancelled: status === EXPORT_STATUS.CANCELLED,
      duration: startTime ? Date.now() - startTime : 0,
      canCancel: status === EXPORT_STATUS.PROCESSING || status === EXPORT_STATUS.GENERATING
    };
  }, [exportState]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // State
    exportState,
    exportSettings,

    // Export orchestration methods
    executeExport,
    cancelExport,
    resetExportState,

    // Settings management
    updateExportSettings,

    // Strategy management
    registerExportStrategy,
    unregisterExportStrategy,
    getAvailableFormats,

    // Progress monitoring
    getExportProgress,

    // Constants
    EXPORT_FORMATS,
    EXPORT_STATUS
  }), [
    exportState,
    exportSettings,
    executeExport,
    cancelExport,
    resetExportState,
    updateExportSettings,
    registerExportStrategy,
    unregisterExportStrategy,
    getAvailableFormats,
    getExportProgress
  ]);

  return (
    <ExportContext.Provider value={contextValue}>
      {children}
    </ExportContext.Provider>
  );
};

export default ExportProvider;