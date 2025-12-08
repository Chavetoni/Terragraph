import React, { useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';
import { useGeologicalModeling } from '../../contexts/GeologicalModelingContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { useLayers } from '../../contexts/LayersContext';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useTransformation } from '../../contexts/TransformationContext';
import { VolumetricMeshGenerator } from '../../services/VolumetricMeshGenerator';
import { TextureManager } from '../../services/TextureManager';
import VolumetricLabels from './VolumetricLabels';
import VolumetricDepthScale from './VolumetricDepthScale';
import { Box3, Color, DoubleSide, Group, Mesh, Vector3 } from 'three';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger().withContext('VolumetricGeologicalModel');

/**
 * Component that manages volumetric geological model rendering
 * Memoized for performance optimization
 */
export const VolumetricGeologicalModel = React.memo(() => {
  const { scene, sceneManager, isInitialized } = useContext(ThreeJsContext);
  const { prototypeResult, modelingSettings } = useGeologicalModeling();
  const { textureSettings, alignmentSettings, showStrata, showConfidenceVisualization } = useDisplayOptions();
  const { layers } = useLayers();
  const { boreholes } = useBoreholes();
  const { updateBaseTransform, updateViewTransform } = useTransformation();

  const modelGroupRef = useRef(null);
  const meshesRef = useRef([]);
  const textureManagerRef = useRef(null);
  const originalTransformRef = useRef(null); // Store original position/rotation/scale
  const isolatedPocketsRef = useRef(new Map()); // Track isolated pockets and their transforms
  const lastProcessedAtRef = useRef(null); // Track last processed model to prevent unnecessary recreations

  // Memoized color map to prevent O(n²) operations on every render
  const materialColorMap = useMemo(() => {
    const colorMap = new Map();

    // Build color map from borehole layers (user-selected colors take priority)
    boreholes.forEach(borehole => {
      if (borehole.layers) {
        borehole.layers.forEach(layer => {
          if (layer.material && layer.customColor && !colorMap.has(layer.material)) {
            colorMap.set(layer.material, layer.customColor);
          }
        });
      }
    });

    // Add global layer colors as fallback
    layers.forEach(layer => {
      const materialKey = layer.material || layer.name?.toUpperCase();
      if (materialKey && layer.color && !colorMap.has(materialKey)) {
        colorMap.set(materialKey, layer.color);
      }
    });

    return colorMap;
  }, [boreholes, layers]);

  // Fast O(1) color lookup function
  const getCustomColorForMaterial = useCallback((materialType) => {
    return materialColorMap.get(materialType) || null;
  }, [materialColorMap]);

  // Memoize stable values for useEffect dependencies
  const stableModelingSettings = useMemo(() => ({
    layerOpacity: modelingSettings.layerOpacity,
    showWireframe: modelingSettings.showWireframe
  }), [modelingSettings.layerOpacity, modelingSettings.showWireframe]);

  const stableTextureHash = useMemo(() => {
    // Create a stable hash of texture settings to prevent unnecessary re-renders
    return `${textureSettings.globalIntensity}-${textureSettings.patternScale}-${textureSettings.enableTextures}`;
  }, [textureSettings.globalIntensity, textureSettings.patternScale, textureSettings.enableTextures]);

  const stableAlignmentSettings = useMemo(() => ({
    enabled: alignmentSettings.enabled || false,
    position: alignmentSettings.position || { x: 0, y: 0, z: 0 },
    rotation: alignmentSettings.rotation || { x: 0, y: 0, z: 0 },
    scale: alignmentSettings.scale || { x: 1, y: 1, z: 1 }
  }), [
    alignmentSettings.enabled,
    alignmentSettings.position,
    alignmentSettings.rotation,
    alignmentSettings.scale
  ]);

  useEffect(() => {
    if (!isInitialized || !scene || !prototypeResult?.volumes) return;

    // Check if this is the exact same model we already rendered
    // This prevents recreating the model when only alignment settings change
    if (lastProcessedAtRef.current === prototypeResult.processedAt && modelGroupRef.current) {
      // Same model, don't recreate - just update colors if needed
      if (meshesRef.current.length > 0) {
        meshesRef.current.forEach(mesh => {
          const volumeData = mesh.userData.volumeData;
          if (volumeData) {
            const customColor = getCustomColorForMaterial(volumeData.material);
            if (customColor && mesh.material) {
              mesh.material.color = new Color(customColor);
              mesh.material.needsUpdate = true;
            }
          }
        });
      }
      return;
    }

    // Prevent infinite loops - only create if result changed or layers changed
    if (modelGroupRef.current &&
      prototypeResult.processedAt === modelGroupRef.current.userData.processedAt &&
      JSON.stringify(layers) === modelGroupRef.current.userData.layersSnapshot) {
      // Model is up-to-date, but check if we need to update materials/colors
      if (modelGroupRef.current && meshesRef.current.length > 0) {
        // Update existing mesh materials with new colors from layers
        meshesRef.current.forEach(mesh => {
          const volumeData = mesh.userData.volumeData;
          if (volumeData) {
            const customColor = getCustomColorForMaterial(volumeData.material);
            if (customColor && mesh.material) {
              mesh.material.color = new Color(customColor);
              mesh.material.needsUpdate = true;
            }
          }
        });
      }
      return;
    }

    // Add debounce to prevent rapid re-creation
    const timeoutId = setTimeout(() => {

      // Ensure TextureManager is initialized (may have been disposed in previous cleanup)
      if (!textureManagerRef.current) {
        textureManagerRef.current = new TextureManager();
      }

      // Clear previous model
      if (modelGroupRef.current) {
        scene.remove(modelGroupRef.current);
        disposeVolumetricGroup(modelGroupRef.current);

        // Clear mesh references from volume objects to prevent memory leaks
        if (prototypeResult?.volumes) {
          prototypeResult.volumes.forEach(volume => {
            if (volume.mesh) {
              volume.mesh = null;
            }
          });
        }

        modelGroupRef.current = null;
        meshesRef.current = [];
      }

      // Clear previous isolated pockets from world space
      if (sceneManager && sceneManager.objects) {
        // sceneManager.objects is a Map, not a plain object
        const isolatedPocketKeys = Array.from(sceneManager.objects.keys()).filter(key =>
          key.startsWith('IsolatedPocket_')
        );

        if (isolatedPocketKeys.length > 0) {
          isolatedPocketKeys.forEach(key => {
            sceneManager.remove(key);
          });
        }
      }

      // Clear isolated pockets tracking reference
      isolatedPocketsRef.current.clear();

      // Check if we have volumetric data
      if (!prototypeResult || prototypeResult.type !== 'volumetric' || !prototypeResult.volumes.length) {
        return;
      }

      // Create new volumetric model group
      const modelGroup = new Group();
      modelGroup.name = 'VolumetricGeologicalModel';
      modelGroup.userData = {
        type: 'VolumetricModel',
        createdAt: new Date().toISOString(),
        processedAt: prototypeResult.processedAt, // Track when result was created
        layersSnapshot: JSON.stringify(layers) // Track layers state for change detection
      };

      // Create render settings from modeling settings with progressive transparency
      const renderSettings = {
        opacity: stableModelingSettings.layerOpacity || 0.3, // Default to 30% opacity
        wireframe: stableModelingSettings.showWireframe || false,
        flatShading: false,
        side: DoubleSide,
        layerOpacity: stableModelingSettings.layerOpacity || 0.3, // Pass opacity to volume generation
        showConfidenceVisualization: showConfidenceVisualization || false  // Per-vertex alpha based on data certainty
      };

      // Separate isolated pockets from regular geological volumes  
      const regularVolumes = prototypeResult.volumes.filter(v => v.type !== 'pocket');
      const pocketVolumes = prototypeResult.volumes.filter(v => v.type === 'pocket');

      // Add isolated pockets directly to scene (world space) to align with borehole markers
      pocketVolumes.forEach((volumeData, index) => {
        if (volumeData.mesh && sceneManager) {
          const mesh = volumeData.mesh;

          // Apply render settings to pocket mesh
          if (mesh.material) {
            mesh.material.transparent = true;
            mesh.material.opacity = volumeData.pocketData?.opacity || renderSettings.opacity;
            mesh.material.wireframe = renderSettings.wireframe;
          }

          // Store pocket mesh and its original transform for alignment system
          const pocketKey = `IsolatedPocket_${volumeData.uniqueKey}`;
          isolatedPocketsRef.current.set(pocketKey, {
            mesh: mesh,
            originalTransform: {
              position: mesh.position.clone(),
              rotation: mesh.rotation.clone(),
              scale: mesh.scale.clone()
            }
          });

          // Add exportTransform to IsolatedPocket mesh to prevent double scaling
          // IsolatedPockets are already positioned correctly in world space, so use 1:1 scale
          mesh.userData.exportTransform = {
            worldPosition: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
            worldScale: { x: 1, y: 1, z: 1 }, // No scaling needed - already correctly positioned
            worldRotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
            isWorldTransform: true
          };

          sceneManager.add(pocketKey, mesh);
        }
      });

      // Add each regular geological volume to the model group
      regularVolumes.forEach((volumeData, index) => {
        try {
          // Use the custom color from volume data (already determined during generation)
          // This ensures consistent color for material+color combinations
          const customColor = volumeData.customColor; // Use ONLY the volume's specific color, or null for default

          // Create mesh with textures for regular interpolated volumes
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeData,
            { ...renderSettings, enableTextures: true }, // Enable textures for all geological materials
            textureManagerRef.current,
            textureSettings,
            customColor
          );

          // Attach mesh back to volume object for label components
          volumeData.mesh = mesh;

          // Set render order to display below site map (lower values render first)
          const baseRenderOrder = -1; // Base order: render before site map
          const renderOffset = volumeData.renderOrderOffset || 0;
          mesh.renderOrder = baseRenderOrder + renderOffset;

          mesh.layers.enable(0); // Default rendering layer
          mesh.layers.enable(2); // Hover raycasting layer (same as strata)
          mesh.frustumCulled = false; // Don't cull even if outside camera frustum

          // Depth testing: always test, but preserve depthWrite from material settings
          // VolumetricMeshGenerator sets depthWrite based on opacity for proper transparency
          mesh.material.depthTest = true;
          // Don't override depthWrite - it's set correctly by VolumetricMeshGenerator
          // based on opacity (false for semi-transparent, true for opaque)

          // Store statistics and volume data for later updates
          mesh.userData.statistics = VolumetricMeshGenerator.calculateVolumeStatistics(volumeData);
          mesh.userData.volumeData = volumeData; // Store for color updates

          modelGroup.add(mesh);
          meshesRef.current.push(mesh);
        } catch (error) {
          logger.error(`Failed to create mesh for material ${volumeData.material}:`, error);
        }
      });

      // Position model to align with strata cylinder coordinate system
      // In the strata system: Y=0 is surface, negative Y is below surface
      const boundingBox = new Box3().setFromObject(modelGroup);

      // Validate bounding box before using it to prevent NaN propagation
      if (!boundingBox.min || !boundingBox.max) {
        logger.error('Invalid bounding box for geological model - using fallback values');
        // Set fallback bounding box
        boundingBox.min.set(-10, -10, -10);
        boundingBox.max.set(10, 10, 10);
      }

      const size = boundingBox.getSize(new Vector3());
      const center = boundingBox.getCenter(new Vector3());

      // Validate size and center values before using them
      const isValidValue = (value) => !isNaN(value) && isFinite(value);
      if (!isValidValue(size.x) || !isValidValue(size.y) || !isValidValue(size.z)) {
        logger.error('NaN detected in bounding box size:', { size });
        size.set(20, 20, 20); // Fallback size
      }

      if (!isValidValue(center.x) || !isValidValue(center.y) || !isValidValue(center.z)) {
        logger.error('NaN detected in bounding box center:', { center });
        center.set(0, 0, 0); // Fallback center
      }

      const maxDimension = Math.max(size.x, size.y, size.z);

      // Smart scaling based on vertex count and size
      const totalVertices = meshesRef.current.reduce((sum, m) => sum + (m.userData.vertexCount || 0), 0);
      let scaleFactor = 1.0;

      // Scale down high-vertex models to prevent visual issues
      if (totalVertices > 20000) {
        scaleFactor = 0.5; // 50% scale for ultra-high-detail models
      } else if (totalVertices > 10000) {
        scaleFactor = 0.7; // 70% scale for high-detail models
      } else if (maxDimension > 50 && maxDimension > 0) {
        scaleFactor = 50 / maxDimension; // Prevent oversized models
      }

      if (scaleFactor < 1.0) {
        modelGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      // Proper alignment with borehole coordinate system
      // Calculate borehole centroid for better alignment
      let boreholeCenterX = 0, boreholeCenterZ = 0;
      if (boreholes.length > 0) {
        boreholeCenterX = boreholes.reduce((sum, bh) => sum + bh.x, 0) / boreholes.length;
        boreholeCenterZ = boreholes.reduce((sum, bh) => sum + bh.z, 0) / boreholes.length;
      }

      // Align X and Z with borehole centroid, but keep Y at 0 (ground level)
      // The model vertices already have correct Y coordinates (negative = below ground)
      const alignedX = boreholeCenterX - center.x;
      const alignedZ = boreholeCenterZ - center.z;
      const alignedY = 0; // Keep at ground level, don't offset by center.y
      modelGroup.position.set(alignedX, alignedY, alignedZ);

      // Store original transform values for alignment system
      // Only set original transform if it doesn't exist
      // This prevents corruption of the baseline when model recreates
      if (!originalTransformRef.current) {
        originalTransformRef.current = {
          position: { x: alignedX, y: alignedY, z: alignedZ },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: scaleFactor, y: scaleFactor, z: scaleFactor }
        };

        // Enhanced validation for transformation values
        const isValidValue = (value) => {
          return typeof value === 'number' && !isNaN(value) && isFinite(value);
        };

        const isValidPositiveValue = (value) => {
          return isValidValue(value) && value > 0;
        };

        // Comprehensive validation with detailed logging
        const safeAlignedX = isValidValue(alignedX) ? alignedX : 0;
        const safeAlignedY = isValidValue(alignedY) ? alignedY : 0;
        const safeAlignedZ = isValidValue(alignedZ) ? alignedZ : 0;
        const safeScaleFactor = isValidPositiveValue(scaleFactor) ? scaleFactor : 1;

        // Additional validation to prevent extreme values
        const clampedX = Math.max(-1000, Math.min(1000, safeAlignedX));
        const clampedY = Math.max(-1000, Math.min(1000, safeAlignedY));
        const clampedZ = Math.max(-1000, Math.min(1000, safeAlignedZ));
        const clampedScale = Math.max(0.001, Math.min(100, safeScaleFactor));

        // Only warn for extreme values
        const hasExtremeValues = clampedX !== safeAlignedX || clampedY !== safeAlignedY ||
          clampedZ !== safeAlignedZ || clampedScale !== safeScaleFactor;

        if (hasExtremeValues) {
        }

        // Create the final validated transform
        const finalTransform = {
          position: { x: clampedX, y: clampedY, z: clampedZ },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: clampedScale, y: clampedScale, z: clampedScale }
        };

        // Store the world transform for export use - this ensures WYSIWYG export
        modelGroup.userData.exportTransform = {
          worldPosition: { x: alignedX, y: alignedY, z: alignedZ },
          worldScale: { x: scaleFactor, y: scaleFactor, z: scaleFactor },
          worldRotation: { x: 0, y: 0, z: 0 },
          isWorldTransform: true
        };

        // Update TransformationContext with basic transform (only for UI alignment controls)
        if (updateBaseTransform) {
          updateBaseTransform(finalTransform);
        }

        // Only log critical errors, not every sanitization
        const hasInvalidValues = !isValidValue(alignedX) || !isValidValue(alignedY) ||
          !isValidValue(alignedZ) || !isValidPositiveValue(scaleFactor);

        if (hasInvalidValues) {
          logger.error('Invalid transform values detected, using fallbacks');
        }
      }

      // Ensure group is visible and on correct layer
      modelGroup.visible = true;
      modelGroup.layers.enable(0);
      modelGroup.frustumCulled = false;

      // Add to scene with scene manager if available
      if (sceneManager) {
        sceneManager.add('VolumetricGeologicalModel', modelGroup);
      } else {
        scene.add(modelGroup);
      }

      modelGroupRef.current = modelGroup;

      // Track that we've processed this model
      lastProcessedAtRef.current = prototypeResult.processedAt;

    }, 100); // 100ms debounce

    return () => {
      // Clear timeout on cleanup
      clearTimeout(timeoutId);

      // Cleanup on unmount
      if (modelGroupRef.current) {
        if (sceneManager) {
          sceneManager.remove('VolumetricGeologicalModel');
        } else {
          scene.remove(modelGroupRef.current);
        }
        disposeVolumetricGroup(modelGroupRef.current);

        // Clear mesh references from volume objects to prevent memory leaks
        if (prototypeResult?.volumes) {
          prototypeResult.volumes.forEach(volume => {
            if (volume.mesh) {
              volume.mesh = null;
            }
          });
        }

        modelGroupRef.current = null;
        meshesRef.current = [];
        lastProcessedAtRef.current = null; // Reset processed tracking
      }

      // Cleanup isolated pockets
      if (sceneManager && sceneManager.objects) {
        const isolatedPocketKeys = Array.from(sceneManager.objects.keys()).filter(key =>
          key.startsWith('IsolatedPocket_')
        );

        if (isolatedPocketKeys.length > 0) {
          isolatedPocketKeys.forEach(key => {
            sceneManager.remove(key);
          });
        }
      }

      // Clear isolated pocket references using captured ref to avoid ESLint warning
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const currentIsolatedPockets = isolatedPocketsRef.current;
      if (currentIsolatedPockets) {
        currentIsolatedPockets.clear();
      }

      // Cleanup TextureManager only on component unmount
      if (textureManagerRef.current) {
        textureManagerRef.current.dispose();
        textureManagerRef.current = null;
      }
    };
  }, [
    isInitialized,
    scene,
    sceneManager,
    prototypeResult,
    stableModelingSettings, // OPTIMIZED: Use memoized settings instead of entire object
    stableTextureHash, // OPTIMIZED: Use texture hash instead of entire textureSettings object
    getCustomColorForMaterial, // Already optimized with memoized color map
    updateBaseTransform, // Include transformation context updater
    boreholes, // Include for color mapping updates
    layers, // Include for layer data changes
    textureSettings, // Include for texture updates
    showConfidenceVisualization // Include to recreate meshes with per-vertex alpha
    // NOTE: alignmentSettings intentionally NOT in dependencies to prevent recreation on alignment change
    // ESLint warning for modelingSettings.layerOpacity/showWireframe is intentionally ignored
    // because we use stableModelingSettings which includes these memoized values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // Handle visibility changes
  useEffect(() => {
    if (!modelGroupRef.current) return;

    // Show model when both display options and modeling settings allow it
    const showModel = showStrata && (modelingSettings.showGeologicalModel !== false);
    modelGroupRef.current.visible = showModel;

    // Also control isolated pockets visibility
    if (sceneManager && sceneManager.objects) {
      const isolatedPocketKeys = Array.from(sceneManager.objects.keys()).filter(key =>
        key.startsWith('IsolatedPocket_')
      );

      isolatedPocketKeys.forEach(key => {
        const pocket = sceneManager.objects.get(key);
        if (pocket) {
          pocket.visible = showModel;
        }
      });
    }

  }, [showStrata, modelingSettings.showGeologicalModel, sceneManager]);

  // Handle opacity changes
  useEffect(() => {
    if (!meshesRef.current.length) return;

    const opacity = stableModelingSettings.layerOpacity || 0.3; // Consistent with initial render settings
    meshesRef.current.forEach(mesh => {
      if (mesh.material) {
        mesh.material.opacity = opacity;
        mesh.material.transparent = opacity < 1;
        mesh.material.needsUpdate = true;
      }
    });
  }, [stableModelingSettings.layerOpacity]);

  // Handle wireframe toggle
  useEffect(() => {
    if (!meshesRef.current.length) return;

    const showWireframe = stableModelingSettings.showWireframe || false;
    meshesRef.current.forEach(mesh => {
      if (mesh.material) {
        mesh.material.wireframe = showWireframe;
        mesh.material.needsUpdate = true;
      }
    });
  }, [stableModelingSettings.showWireframe]);

  // Handle alignment transformation changes
  useEffect(() => {
    // Check alignment settings for NaN values using stable settings
    const pos = stableAlignmentSettings.position;
    const rot = stableAlignmentSettings.rotation;
    const scale = stableAlignmentSettings.scale;

    const posNaN = isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z);
    const rotNaN = isNaN(rot.x) || isNaN(rot.y) || isNaN(rot.z);
    const scaleNaN = isNaN(scale.x) || isNaN(scale.y) || isNaN(scale.z);

    if (posNaN || rotNaN || scaleNaN) {
      logger.error('NaN in alignment settings detected');
    }

    // Update TransformationContext with view transform (alignment settings)
    updateViewTransform({
      position: stableAlignmentSettings.position,
      rotation: stableAlignmentSettings.rotation,
      scale: stableAlignmentSettings.scale,
      enabled: stableAlignmentSettings.enabled
    });

    // Apply transformations to main model group
    if (modelGroupRef.current && originalTransformRef.current) {
      const modelGroup = modelGroupRef.current;
      const original = originalTransformRef.current;

      if (stableAlignmentSettings.enabled) {
        // Apply manual alignment transformations relative to original position
        modelGroup.position.set(
          original.position.x + stableAlignmentSettings.position.x,
          original.position.y + stableAlignmentSettings.position.y,
          original.position.z + stableAlignmentSettings.position.z
        );

        modelGroup.rotation.set(
          original.rotation.x + stableAlignmentSettings.rotation.x,
          original.rotation.y + stableAlignmentSettings.rotation.y,
          original.rotation.z + stableAlignmentSettings.rotation.z
        );

        modelGroup.scale.set(
          original.scale.x * stableAlignmentSettings.scale.x,
          original.scale.y * stableAlignmentSettings.scale.y,
          original.scale.z * stableAlignmentSettings.scale.z
        );
      } else {
        // Reset to original transform values
        modelGroup.position.set(
          original.position.x,
          original.position.y,
          original.position.z
        );

        modelGroup.rotation.set(
          original.rotation.x,
          original.rotation.y,
          original.rotation.z
        );

        modelGroup.scale.set(
          original.scale.x,
          original.scale.y,
          original.scale.z
        );
      }

      // Mark for re-render
      modelGroup.updateMatrix();
    }

    // Apply same transformations to isolated pockets as the main model
    // This ensures pockets move with the geological interpolation
    isolatedPocketsRef.current.forEach((pocketData, pocketKey) => {
      const { mesh, originalTransform } = pocketData;

      if (!mesh) return;

      if (stableAlignmentSettings.enabled) {
        // Apply position transformations relative to pocket's original position
        mesh.position.set(
          originalTransform.position.x + stableAlignmentSettings.position.x,
          originalTransform.position.y + stableAlignmentSettings.position.y,
          originalTransform.position.z + stableAlignmentSettings.position.z
        );

        // Apply rotation transformations
        mesh.rotation.set(
          originalTransform.rotation.x + stableAlignmentSettings.rotation.x,
          originalTransform.rotation.y + stableAlignmentSettings.rotation.y,
          originalTransform.rotation.z + stableAlignmentSettings.rotation.z
        );

        // Apply scale transformations
        mesh.scale.set(
          originalTransform.scale.x * stableAlignmentSettings.scale.x,
          originalTransform.scale.y * stableAlignmentSettings.scale.y,
          originalTransform.scale.z * stableAlignmentSettings.scale.z
        );
      } else {
        // Reset to original transform
        mesh.position.copy(originalTransform.position);
        mesh.rotation.copy(originalTransform.rotation);
        mesh.scale.copy(originalTransform.scale);
      }

      // Mark for re-render
      mesh.updateMatrix();
    });
  }, [
    stableAlignmentSettings,
    updateViewTransform
  ]);

  // Render the label and depth scale components
  return (
    <>
      <VolumetricLabels />
      <VolumetricDepthScale />
    </>
  );
});


/**
 * Dispose of volumetric group and all its resources
 * @param {Group} group - Group to dispose
 */
function disposeVolumetricGroup(group) {
  if (!group) return;

  group.traverse((child) => {
    if (child instanceof Mesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose material
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });

  // Clear the group
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}

export default VolumetricGeologicalModel;