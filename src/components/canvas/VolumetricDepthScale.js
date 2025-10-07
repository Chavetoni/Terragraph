

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useContext } from 'react';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';
import { useGeologicalModeling } from '../../contexts/OptimizedGeologicalModelingContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { useBoreholeData } from '../../hooks/useOptimizedBorehole';
import { createGlassmorphismLabel } from '../../utils/threeJsHelpers';
import { generateDepthPositions } from '../../utils/depthScaleCalculator';
import { Box3, BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';

// Note: 3D text labels for GLTF export are handled by SceneExporter
// to ensure proper depth marker creation with accurate values

/**
 * Component that manages volumetric geological model depth scale
 */
export function VolumetricDepthScale() {
  const { scene, sceneManager, isInitialized } = useContext(ThreeJsContext);
  const { prototypeResult } = useGeologicalModeling();
  const { showDepthMarkers } = useDisplayOptions();
  const { boreholes } = useBoreholeData();
  
  const depthLabelsRef = useRef([]);
  const depthGroupRef = useRef(null);

  // Memoize the volumes data to prevent unnecessary recalculations
  const volumesData = useMemo(() => {
    if (!prototypeResult?.volumes || !Array.isArray(prototypeResult.volumes)) {
      return null;
    }
    return {
      volumes: prototypeResult.volumes,
      processedAt: prototypeResult.processedAt,
      type: prototypeResult.type
    };
  }, [prototypeResult?.volumes, prototypeResult?.processedAt, prototypeResult?.type]);

  /**
   * Calculate depth range from actual borehole data
   * Determines the maximum depth across all boreholes for consistent scale rendering
   */
  const calculateDepthRangeFromBoreholes = useCallback(() => {
    if (!boreholes?.length) {
      return { minDepth: 0, maxDepth: 0, totalDepth: 0, surfaceLevel: 0, bottomLevel: 0 };
    }
    
    const maxBoreholeDepth = Math.max(
      ...boreholes.map(borehole => {
        // Priority order: totalDepth > depth > calculated from layers
        if (borehole.totalDepth > 0) return borehole.totalDepth;
        if (borehole.depth > 0) return borehole.depth;
        if (borehole.layers?.length) {
          return Math.max(...borehole.layers.map(layer => layer.to || 0));
        }
        return 0;
      }),
      10 // Minimum depth fallback
    );
    
    return {
      minDepth: 0,
      maxDepth: maxBoreholeDepth,
      totalDepth: maxBoreholeDepth,
      surfaceLevel: 0,
      bottomLevel: -maxBoreholeDepth
    };
  }, [boreholes]);


  /**
   * Calculate model bounds for positioning using volumes or boreholes
   * @param {Array} volumes - Geological volume data with meshes
   * @param {Array} fallbackBoreholes - Borehole positions as fallback
   * @returns {Box3} Model bounds for positioning calculations
   */
  const calculateModelBounds = useCallback((volumes, fallbackBoreholes = null) => {
    const modelBounds = new Box3();
    
    // Priority 1: Use volume meshes (exclude isolated pockets)
    const hasVolumeBounds = volumes?.some(volume => {
      if (volume.mesh && volume.type !== 'pocket') {
        const volumeBounds = new Box3().setFromObject(volume.mesh);
        modelBounds.union(volumeBounds);
        return true;
      }
      return false;
    });
    
    // Priority 2: Fallback to borehole positions
    if (!hasVolumeBounds && fallbackBoreholes?.length) {
      fallbackBoreholes.forEach(borehole => {
        modelBounds.expandByPoint(new Vector3(
          borehole.x || 0,
          borehole.y || 0,
          borehole.z || 0
        ));
      });
      modelBounds.expandByScalar(2); // Add margin for scale positioning
    }
    
    return modelBounds;
  }, []);

  /**
   * Calculate offset multiplier for scale positioning based on model size
   * @param {number} scaleRatio - Model size ratio to standard site
   * @param {number} modelDiameter - Model diameter in feet
   * @returns {number} Offset multiplier for positioning
   */
  const calculateOffsetMultiplier = useCallback((scaleRatio, modelDiameter) => {
    if (scaleRatio < 0.1) {
      // Very small models - closer positioning with minimum distance
      return Math.max(0.2, 2 / modelDiameter);
    } else if (scaleRatio > 5.0) {
      // Very large models - more distant positioning
      return 0.15;
    } else {
      // Normal models - proportional positioning (25% to 10% based on size)
      return 0.25 - (scaleRatio * 0.03);
    }
  }, []);

  /**
   * Calculate tick and label sizes appropriate for model scale
   * @param {number} scaleRatio - Model size ratio to standard site
   * @param {number} modelDiameter - Model diameter in feet
   * @returns {Object} Tick length and label offset values
   */
  const calculateScaleElementSizes = useCallback((scaleRatio, modelDiameter) => {
    if (scaleRatio < 0.1) {
      // Small models - proportionally smaller elements
      return {
        tickLength: Math.max(0.2, modelDiameter * 0.02),
        labelOffset: Math.max(0.3, modelDiameter * 0.03)
      };
    } else if (scaleRatio > 5.0) {
      // Large models - proportionally larger elements for visibility
      return {
        tickLength: modelDiameter * 0.01,
        labelOffset: modelDiameter * 0.015
      };
    } else {
      // Normal scaling with ratio-based adjustment
      return {
        tickLength: 0.5 + (scaleRatio * 0.2),
        labelOffset: 1.0 + (scaleRatio * 0.3)
      };
    }
  }, []);

  /**
   * Calculate dynamic positioning and scaling based on model dimensions
   * Adapts scale positioning, tick size, and label offset to model size
   * @param {Box3} modelBounds - 3D bounds of the geological model
   * @returns {Object} Scale positioning and sizing parameters
   */
  const calculateDynamicScaleSettings = useCallback((modelBounds) => {
    const size = new Vector3();
    modelBounds.getSize(size);
    
    const STANDARD_SITE_SIZE = 164; // Standard geological site reference size (feet)
    const modelDiameter = Math.max(size.x, size.z);
    const scaleRatio = modelDiameter / STANDARD_SITE_SIZE;
    
    // Dynamic scale calculation based on model dimensions
    
    // Calculate positioning offset based on model size
    const offsetMultiplier = calculateOffsetMultiplier(scaleRatio, modelDiameter);
    const scaleDistance = modelDiameter * offsetMultiplier;
    const scaleXPosition = modelBounds.min.x - scaleDistance;
    
    // Calculate scale-appropriate tick and label dimensions
    const { tickLength, labelOffset } = calculateScaleElementSizes(scaleRatio, modelDiameter);
    
    return {
      scaleXPosition,
      tickLength,
      labelOffset,
      scaleRatio,
      modelDiameter,
      offsetMultiplier
    };
  }, [calculateOffsetMultiplier, calculateScaleElementSizes]);

  /**
   * Filter valid volumes from volumetric data
   * @param {Object} volumesData - Volumetric data object
   * @returns {Array} Array of valid volumes with material data
   */
  const getValidVolumes = useCallback((volumesData) => {
    if (!volumesData?.volumes || volumesData.type !== 'volumetric') {
      return [];
    }
    return volumesData.volumes.filter(volume => volume?.material);
  }, []);

  /**
   * Clear existing depth scale elements from scene and scene manager
   */
  const clearDepthScale = useCallback(() => {
    if (depthGroupRef.current && scene) {
      scene.remove(depthGroupRef.current);
      depthGroupRef.current = null;
    }
    
    if (sceneManager && depthLabelsRef.current.length > 0) {
      depthLabelsRef.current.forEach((labelId) => {
        sceneManager.removeCSS3D(labelId);
      });
      depthLabelsRef.current = [];
    }
  }, [scene, sceneManager]);

  /**
   * Create a tick mark for a depth position
   * @param {Object} position - Depth position data
   * @param {number} scaleXPosition - X position of the scale line
   * @param {number} tickLength - Length of the tick mark
   * @param {Material} material - Material for the tick mark
   * @returns {Line} Tick mark line object
   */
  const createTickMark = useCallback((position, scaleXPosition, tickLength, material) => {
    const tickGeometry = new BufferGeometry().setFromPoints([
      new Vector3(scaleXPosition, position.yPosition, 0),
      new Vector3(scaleXPosition - tickLength, position.yPosition, 0)
    ]);
    return new Line(tickGeometry, material);
  }, []);

  /**
   * Create and register a CSS3D depth label
   * @param {Object} position - Depth position data
   * @param {number} scaleXPosition - X position of the scale line
   * @param {number} tickLength - Length of the tick mark
   * @param {number} labelOffset - Offset distance for the label
   * @param {number} index - Index for unique label ID
   * @returns {string} Label ID for scene manager reference
   */
  const createDepthLabel = useCallback((position, scaleXPosition, tickLength, labelOffset, index) => {
    const glassLabel = createGlassmorphismLabel(position.label, '#ffffff', 'depth');
    
    glassLabel.position.set(
      scaleXPosition - tickLength - labelOffset,
      position.yPosition,
      0
    );
    
    const labelId = `volumetric-depth-${index}`;
    sceneManager.addCSS3D(labelId, glassLabel);
    
    return labelId;
  }, [sceneManager]);

  // Note: generateDepthPositions function is now imported from shared utility
  // This ensures consistency between live display and export intervals

  useEffect(() => {
    // Early return conditions
    if (!isInitialized || !scene || !sceneManager || !showDepthMarkers) {
      clearDepthScale();
      return;
    }

    if (!boreholes?.length) {
      return;
    }

    // Analyze available volumetric data
    const validVolumes = getValidVolumes(volumesData);

    // Clear any existing depth scale before creating new one
    clearDepthScale();

    // Calculate depth range from actual boreholes
    const depthRange = calculateDepthRangeFromBoreholes();

    if (depthRange.totalDepth <= 0) return;

    const modelBounds = calculateModelBounds(validVolumes, boreholes);
    if (modelBounds.isEmpty()) {
      return;
    }

    // Calculate dynamic scale settings based on model dimensions
    const scaleSettings = calculateDynamicScaleSettings(modelBounds);
    const { scaleXPosition, tickLength, labelOffset } = scaleSettings;

    // Create depth scale group
    const depthGroup = new Group();
    depthGroup.name = 'VolumetricDepthScale';

    // Generate depth positions
    const depthPositions = generateDepthPositions(depthRange);
    
    // Create main vertical line
    const mainLineMaterial = new LineBasicMaterial({ 
      color: 0xffffff,
      opacity: 0.8,
      transparent: true
    });
    
    const mainLineGeometry = new BufferGeometry().setFromPoints([
      new Vector3(scaleXPosition, depthRange.surfaceLevel, 0),
      new Vector3(scaleXPosition, depthRange.bottomLevel, 0)
    ]);
    
    const mainLine = new Line(mainLineGeometry, mainLineMaterial);
    depthGroup.add(mainLine);
    
    // Create tick marks and labels for each depth position
    const tickMaterial = new LineBasicMaterial({ 
      color: 0xffffff,
      opacity: 0.6,
      transparent: true
    });
    
    depthPositions.forEach((position, index) => {
      // Create and add tick mark
      const tick = createTickMark(position, scaleXPosition, tickLength, tickMaterial);
      depthGroup.add(tick);
      
      // Create and register CSS3D depth label
      const labelId = createDepthLabel(position, scaleXPosition, tickLength, labelOffset, index);
      depthLabelsRef.current.push(labelId);
    });
    
    // Add depth scale group to scene
    scene.add(depthGroup);
    depthGroupRef.current = depthGroup;

  }, [
    isInitialized,
    scene,
    sceneManager,
    showDepthMarkers,
    volumesData,
    boreholes,
    clearDepthScale,
    getValidVolumes,
    createTickMark,
    createDepthLabel,
    calculateDepthRangeFromBoreholes,
    calculateModelBounds,
    calculateDynamicScaleSettings,
    prototypeResult?.processedAt,
    prototypeResult?.type,
    prototypeResult?.volumes?.length
    // Note: Using all necessary functions to satisfy ESLint and ensure proper re-rendering
    // when dependencies change. The functions are memoized with useCallback to prevent
    // unnecessary re-renders while ensuring correct behavior.
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (depthGroupRef.current) {
        scene?.remove(depthGroupRef.current);
        
        // Clear CSS3D depth labels
        if (sceneManager) {
          depthLabelsRef.current.forEach((labelId) => {
            sceneManager.removeCSS3D(labelId);
          });
        }
        
        depthGroupRef.current = null;
        depthLabelsRef.current = [];
      }
    };
  }, [scene, sceneManager]);

  return null; // This component manages 3D objects only
}

export default VolumetricDepthScale;