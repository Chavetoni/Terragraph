/**
 * Custom hooks for selective subscription to BoreholeContext
 * Reduces unnecessary re-renders by allowing components to subscribe to specific sections only
 */

import { useContext, useMemo } from 'react';
import { BoreholeContext } from '../contexts/BoreholeContext';

/**
 * Subscribe to borehole data only (no actions)
 * Use this for display components that only need data
 */
export const useBoreholeData = () => {
  const context = useContext(BoreholeContext);
  if (!context) {
    throw new Error('useBoreholeData must be used within a BoreholeProvider');
  }

  return useMemo(() => ({
    boreholes: context.boreholes,
    selectedBorehole: context.selectedBorehole,
    hoveredBorehole: context.hoveredBorehole,
    hoveredStrataLayer: context.hoveredStrataLayer
  }), [
    context.boreholes,
    context.selectedBorehole,
    context.hoveredBorehole,
    context.hoveredStrataLayer
  ]);
};

/**
 * Subscribe to borehole placement actions only
 * Use this for UI controls that handle borehole creation
 */
export const useBoreholeActions = () => {
  const context = useContext(BoreholeContext);
  if (!context) {
    throw new Error('useBoreholeActions must be used within a BoreholeProvider');
  }

  return useMemo(() => ({
    isPlacingBorehole: context.isPlacingBorehole,
    showCreationModal: context.showCreationModal,
    pendingBoreholeData: context.pendingBoreholeData,
    setIsPlacingBorehole: context.setIsPlacingBorehole,
    handleCanvasClick: context.handleCanvasClick,
    handleBoreholeCreationConfirm: context.handleBoreholeCreationConfirm,
    handleBoreholeCreationCancel: context.handleBoreholeCreationCancel
  }), [
    context.isPlacingBorehole,
    context.showCreationModal,
    context.pendingBoreholeData,
    context.setIsPlacingBorehole,
    context.handleCanvasClick,
    context.handleBoreholeCreationConfirm,
    context.handleBoreholeCreationCancel
  ]);
};

/**
 * Subscribe to borehole CRUD operations only
 * Use this for components that manage borehole data
 */
export const useBoreholeCRUD = () => {
  const context = useContext(BoreholeContext);
  if (!context) {
    throw new Error('useBoreholeCRUD must be used within a BoreholeProvider');
  }

  return useMemo(() => ({
    boreholes: context.boreholes,
    addBorehole: context.addBorehole,
    updateBorehole: context.updateBorehole,
    deleteBorehole: context.deleteBorehole,
    removeBorehole: context.removeBorehole,
    clearAllBoreholes: context.clearAllBoreholes,
    addSimpleBorehole: context.addSimpleBorehole
  }), [
    context.boreholes,
    context.addBorehole,
    context.updateBorehole,
    context.deleteBorehole,
    context.removeBorehole,
    context.clearAllBoreholes,
    context.addSimpleBorehole
  ]);
};

/**
 * Subscribe to borehole interaction events only
 * Use this for hover and selection handling components
 */
export const useBoreholeInteractions = () => {
  const context = useContext(BoreholeContext);
  if (!context) {
    throw new Error('useBoreholeInteractions must be used within a BoreholeProvider');
  }

  return useMemo(() => ({
    selectedBorehole: context.selectedBorehole,
    hoveredBorehole: context.hoveredBorehole,
    hoveredStrataLayer: context.hoveredStrataLayer,
    selectBorehole: context.selectBorehole,
    hoverBorehole: context.hoverBorehole,
    handleCanvasMouseMove: context.handleCanvasMouseMove
  }), [
    context.selectedBorehole,
    context.hoveredBorehole,
    context.hoveredStrataLayer,
    context.selectBorehole,
    context.hoverBorehole,
    context.handleCanvasMouseMove
  ]);
};

/**
 * Subscribe to 3D visualization methods only
 * Use this for components that handle 3D scene updates
 */
export const useBorehole3D = () => {
  const context = useContext(BoreholeContext);
  if (!context) {
    throw new Error('useBorehole3D must be used within a BoreholeProvider');
  }

  return useMemo(() => ({
    createBoreholeVisual: context.createBoreholeVisual,
    updateBoreholeDynamic: context.updateBoreholeDynamic
  }), [
    context.createBoreholeVisual,
    context.updateBoreholeDynamic
  ]);
};

/**
 * Performance tip: Use these selective hooks instead of useBoreholes() 
 * when you only need specific functionality to reduce unnecessary re-renders
 * 
 * Example:
 * // Instead of:
 * const { boreholes, selectedBorehole, addBorehole } = useBoreholes();
 * 
 * // Use:
 * const { boreholes, selectedBorehole } = useBoreholeData();
 * const { addBorehole } = useBoreholeCRUD();
 * 
 * This prevents the component from re-rendering when unrelated borehole state changes.
 * 
 * For specific use cases:
 * - Display components: useBoreholeData()
 * - Creation forms: useBoreholeActions()
 * - Data management: useBoreholeCRUD()
 * - Interaction handling: useBoreholeInteractions()
 * - 3D scene operations: useBorehole3D()
 */