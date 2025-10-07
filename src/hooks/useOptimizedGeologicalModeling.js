/**
 * Custom hooks for selective subscription to GeologicalModelingContext
 * Reduces unnecessary re-renders by allowing components to subscribe to specific sections only
 */

import { useMemo } from 'react';
import { useGeologicalModeling } from '../contexts/OptimizedGeologicalModelingContext';

/**
 * Subscribe to geological modeling state only (no actions)
 * Use this for display components that only need current state
 */
export const useGeologicalModelingState = () => {
  const context = useGeologicalModeling();

  return useMemo(() => ({
    modelingMode: context.modelingMode,
    isProcessing: context.isProcessing,
    processingStatus: context.processingStatus,
    validationResults: context.validationResults,
    capabilities: context.capabilities,
    prototypeResult: context.prototypeResult,
    prototypeError: context.prototypeError,
    isConfigurationValid: context.isConfigurationValid
  }), [
    context.modelingMode,
    context.isProcessing,
    context.processingStatus,
    context.validationResults,
    context.capabilities,
    context.prototypeResult,
    context.prototypeError,
    context.isConfigurationValid
  ]);
};

/**
 * Subscribe to modeling settings only
 * Use this for settings panels and configuration components
 */
export const useModelingSettings = () => {
  const context = useGeologicalModeling();

  return useMemo(() => ({
    modelingSettings: context.modelingSettings,
    updateSettings: context.updateSettings,
    resetSettings: context.resetSettings,
    interpolationRecommendation: context.interpolationRecommendation
  }), [
    context.modelingSettings,
    context.updateSettings,
    context.resetSettings,
    context.interpolationRecommendation
  ]);
};

/**
 * Subscribe to modeling actions only
 * Use this for action buttons and control components
 */
export const useModelingActions = () => {
  const context = useGeologicalModeling();

  return useMemo(() => ({
    switchMode: context.switchMode,
    processModel: context.processModel,
    validateConfiguration: context.validateConfiguration,
    setPrototypeState: context.setPrototypeState,
    clearPrototypeState: context.clearPrototypeState
  }), [
    context.switchMode,
    context.processModel,
    context.validateConfiguration,
    context.setPrototypeState,
    context.clearPrototypeState
  ]);
};

/**
 * Subscribe to modeling constants only
 * Use this for components that need reference data
 */
export const useModelingConstants = () => {
  const context = useGeologicalModeling();

  return useMemo(() => ({
    MODELING_MODES: context.MODELING_MODES,
    INTERPOLATION_METHODS: context.INTERPOLATION_METHODS,
    GRID_RESOLUTIONS: context.GRID_RESOLUTIONS,
    modeInfo: context.modeInfo
  }), [
    context.MODELING_MODES,
    context.INTERPOLATION_METHODS,
    context.GRID_RESOLUTIONS,
    context.modeInfo
  ]);
};

/**
 * Subscribe to data import/export functionality only
 * Use this for components handling data persistence
 */
export const useModelingDataOps = () => {
  const context = useGeologicalModeling();

  return useMemo(() => ({
    exportConfiguration: context.exportConfiguration,
    importConfiguration: context.importConfiguration,
    updateCapabilities: context.updateCapabilities
  }), [
    context.exportConfiguration,
    context.importConfiguration,
    context.updateCapabilities
  ]);
};

/**
 * Lightweight hook for volumetric processing components
 * Subscribe only to volumetric-specific state and actions
 */
export const useVolumetricModeling = () => {
  const context = useGeologicalModeling();

  return useMemo(() => ({
    modelingMode: context.modelingMode,
    isProcessing: context.isProcessing,
    processingStatus: context.processingStatus,
    prototypeResult: context.prototypeResult,
    prototypeError: context.prototypeError,
    modelingSettings: context.modelingSettings,
    processModel: context.processModel,
    setPrototypeState: context.setPrototypeState,
    clearPrototypeState: context.clearPrototypeState,
    capabilities: context.capabilities
  }), [
    context.modelingMode,
    context.isProcessing,
    context.processingStatus,
    context.prototypeResult,
    context.prototypeError,
    context.modelingSettings,
    context.processModel,
    context.setPrototypeState,
    context.clearPrototypeState,
    context.capabilities
  ]);
};

/**
 * Performance tip: Use these selective hooks instead of useGeologicalModeling() 
 * when you only need specific functionality to reduce unnecessary re-renders
 * 
 * Example:
 * // Instead of:
 * const { modelingMode, modelingSettings, processModel } = useGeologicalModeling();
 * 
 * // Use:
 * const { modelingMode } = useGeologicalModelingState();
 * const { modelingSettings } = useModelingSettings();
 * const { processModel } = useModelingActions();
 * 
 * This prevents the component from re-rendering when unrelated modeling state changes.
 * 
 * For specific use cases:
 * - Status displays: useGeologicalModelingState()
 * - Settings panels: useModelingSettings()
 * - Action buttons: useModelingActions()
 * - Reference data: useModelingConstants()
 * - Data operations: useModelingDataOps()
 * - Volumetric processing: useVolumetricModeling()
 */