/**
 * Custom hook for selective subscription to DisplayOptionsContext
 * Reduces unnecessary re-renders by allowing components to subscribe to specific sections only
 */

import { useMemo } from 'react';
import { useDisplayOptions } from '../contexts/DisplayOptionsContext';

/**
 * Subscribe to basic visibility controls only
 * Use this for components that only need basic show/hide toggles
 */
export const useBasicVisibility = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    showLayerPanel: context.showLayerPanel,
    setShowLayerPanel: context.setShowLayerPanel,
    showLabels: context.showLabels,
    setShowLabels: context.setShowLabels,
    showMarkers: context.showMarkers,
    setShowMarkers: context.setShowMarkers,
    showDepthMarkers: context.showDepthMarkers,
    setShowDepthMarkers: context.setShowDepthMarkers,
    showConnectors: context.showConnectors,
    setShowConnectors: context.setShowConnectors,
    showStrata: context.showStrata,
    setShowStrata: context.setShowStrata,
    showGroundGrid: context.showGroundGrid,
    setShowGroundGrid: context.setShowGroundGrid,
    showBoreholes: context.showBoreholes,
    setShowBoreholes: context.setShowBoreholes,
    showBoreholeStrata: context.showBoreholeStrata,
    setShowBoreholeStrata: context.setShowBoreholeStrata,
    showWaterTable: context.showWaterTable,
    setShowWaterTable: context.setShowWaterTable
  }), [
    context.showLayerPanel,
    context.setShowLayerPanel,
    context.showLabels,
    context.setShowLabels,
    context.showMarkers,
    context.setShowMarkers,
    context.showDepthMarkers,
    context.setShowDepthMarkers,
    context.showConnectors,
    context.setShowConnectors,
    context.showStrata,
    context.setShowStrata,
    context.showGroundGrid,
    context.setShowGroundGrid,
    context.showBoreholes,
    context.setShowBoreholes,
    context.showBoreholeStrata,
    context.setShowBoreholeStrata,
    context.showWaterTable,
    context.setShowWaterTable
  ]);
};

/**
 * Subscribe to texture settings only
 * Use this for components that only work with texture controls
 */
export const useTextureSettings = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    textureSettings: context.textureSettings,
    setTextureSettings: context.setTextureSettings,
    updateTextureSettings: context.updateTextureSettings,
    updateMaterialTextureSettings: context.updateMaterialTextureSettings,
    resetTextureSettings: context.resetTextureSettings
  }), [
    context.textureSettings,
    context.setTextureSettings,
    context.updateTextureSettings,
    context.updateMaterialTextureSettings,
    context.resetTextureSettings
  ]);
};

/**
 * Subscribe to borehole visibility controls only
 * Use this for components that manage individual borehole visibility
 */
export const useBoreholeVisibility = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    boreholesIndividualVisibility: context.boreholesIndividualVisibility,
    setBoreholesIndividualVisibility: context.setBoreholesIndividualVisibility,
    boreholesStrataVisibility: context.boreholesStrataVisibility,
    setBoreholesStrataVisibility: context.setBoreholesStrataVisibility,
    toggleGlobalBoreholeVisibility: context.toggleGlobalBoreholeVisibility,
    toggleIndividualBoreholeVisibility: context.toggleIndividualBoreholeVisibility,
    toggleBoreholeStrataVisibility: context.toggleBoreholeStrataVisibility,
    getBoreholeStrataVisibility: context.getBoreholeStrataVisibility
  }), [
    context.boreholesIndividualVisibility,
    context.setBoreholesIndividualVisibility,
    context.boreholesStrataVisibility,
    context.setBoreholesStrataVisibility,
    context.toggleGlobalBoreholeVisibility,
    context.toggleIndividualBoreholeVisibility,
    context.toggleBoreholeStrataVisibility,
    context.getBoreholeStrataVisibility
  ]);
};

/**
 * Subscribe to alignment settings only
 * Use this for components that handle 3D alignment controls
 */
export const useAlignmentSettings = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    alignmentSettings: context.alignmentSettings,
    setAlignmentSettings: context.setAlignmentSettings,
    updateAlignmentSettings: context.updateAlignmentSettings,
    updateAlignmentPosition: context.updateAlignmentPosition,
    updateAlignmentRotation: context.updateAlignmentRotation,
    updateAlignmentScale: context.updateAlignmentScale,
    resetAlignmentSettings: context.resetAlignmentSettings
  }), [
    context.alignmentSettings,
    context.setAlignmentSettings,
    context.updateAlignmentSettings,
    context.updateAlignmentPosition,
    context.updateAlignmentRotation,
    context.updateAlignmentScale,
    context.resetAlignmentSettings
  ]);
};

/**
 * Subscribe to UI state only (panels, sections)
 * Use this for components that manage UI state
 */
export const useUIState = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    openSections: context.openSections,
    toggleSection: context.toggleSection
  }), [
    context.openSections,
    context.toggleSection
  ]);
};

/**
 * Subscribe to volumetric-specific display settings
 * Use this for components working with 3D geological models
 */
export const useVolumetricDisplaySettings = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    showStrata: context.showStrata,
    setShowStrata: context.setShowStrata,
    showWaterTable: context.showWaterTable,
    setShowWaterTable: context.setShowWaterTable,
    textureSettings: context.textureSettings,
    updateTextureSettings: context.updateTextureSettings,
    alignmentSettings: context.alignmentSettings,
    updateAlignmentSettings: context.updateAlignmentSettings
  }), [
    context.showStrata,
    context.setShowStrata,
    context.showWaterTable,
    context.setShowWaterTable,
    context.textureSettings,
    context.updateTextureSettings,
    context.alignmentSettings,
    context.updateAlignmentSettings
  ]);
};

/**
 * Subscribe to performance-critical display settings only
 * Use this for components that handle render-heavy operations
 */
export const useRenderingSettings = () => {
  const context = useDisplayOptions();

  return useMemo(() => ({
    showBoreholes: context.showBoreholes,
    showStrata: context.showStrata,
    showGroundGrid: context.showGroundGrid,
    textureSettings: context.textureSettings,
    alignmentSettings: context.alignmentSettings
  }), [
    context.showBoreholes,
    context.showStrata,
    context.showGroundGrid,
    context.textureSettings,
    context.alignmentSettings
  ]);
};

/**
 * Performance tip: Use these selective hooks instead of useDisplayOptions() 
 * when you only need specific functionality to reduce unnecessary re-renders
 * 
 * Example:
 * // Instead of:
 * const { textureSettings, updateTextureSettings } = useDisplayOptions();
 * 
 * // Use:
 * const { textureSettings, updateTextureSettings } = useTextureSettings();
 * 
 * This prevents the component from re-rendering when unrelated display options change.
 * 
 * For 3D geological modeling components, use:
 * const { showStrata, textureSettings, alignmentSettings } = useVolumetricDisplaySettings();
 * 
 * For performance-critical render components, use:
 * const { showBoreholes, showStrata, textureSettings } = useRenderingSettings();
 */