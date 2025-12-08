import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useContext } from 'react';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';
import { useGeologicalModeling } from '../../contexts/GeologicalModelingContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { createGlassmorphismLabel } from '../../utils/threeJsHelpers';
import { Box3, BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';

/**
 * Component that manages volumetric geological model labels
 */
export function VolumetricLabels() {
  const { scene, sceneManager, isInitialized } = useContext(ThreeJsContext);
  const { prototypeResult } = useGeologicalModeling();
  const { showLabels } = useDisplayOptions();

  const labelsRef = useRef([]);
  const labelGroupRef = useRef(null);

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

  // Extract unique materials and their data from volumetric model
  // Stable functions - no dependencies, so they don't need to be in useEffect deps
  const extractMaterialsFromVolumes = useCallback((volumes) => {
    if (!volumes || !volumes.length) {
      return [];
    }

    const materialMap = new Map();

    volumes.forEach((volume, index) => {
      if (volume.type === 'pocket') {
        return; // Skip pocket volumes for labels
      }

      // Try multiple ways to get the material
      let material = null;

      // Method 1: Direct material property
      if (volume.material) {
        material = volume.material;
      }
      // Method 2: From userData
      else if (volume.userData?.material) {
        material = volume.userData.material;
      }
      // Method 3: From mesh material (if it has a geologicalMaterial property)
      else if (volume.mesh?.material?.userData?.geologicalMaterial) {
        material = volume.mesh.material.userData.geologicalMaterial;
      }
      // Method 4: From mesh name or other properties
      else if (volume.mesh?.name) {
        // Try to extract material from mesh name if it follows a pattern
        const nameMatch = volume.mesh.name.match(/material[_-]?([A-Z_]+)/i);
        if (nameMatch) {
          material = nameMatch[1].toUpperCase();
        }
      }

      if (!material) {
        return;
      }

      if (!materialMap.has(material)) {
        // Calculate average depth and position for this material
        const bbox = new Box3();
        if (volume.mesh) {
          bbox.setFromObject(volume.mesh);
          const center = bbox.getCenter(new Vector3());
          const size = bbox.getSize(new Vector3());

          materialMap.set(material, {
            material,
            center: center.clone(),
            depth: size.y, // Height/depth of the volume
            color: volume.customColor || volume.color || '#ffffff',
            bounds: {
              min: bbox.min.clone(),
              max: bbox.max.clone()
            }
          });
        }
      }
    });

    return Array.from(materialMap.values());
  }, []);

  // Calculate optimal label positions with dynamic spacing
  // Stable function - no dependencies, so it doesn't need to be in useEffect deps
  const calculateLabelPosition = useCallback((materialData, modelBounds) => {
    const { center, bounds } = materialData;

    // Calculate dynamic offset based on model dimensions
    const size = new Vector3();
    modelBounds.getSize(size);
    const modelDiameter = Math.max(size.x, size.z);
    const STANDARD_SITE_SIZE = 164; // From SCALE constants
    const scaleRatio = modelDiameter / STANDARD_SITE_SIZE;

    // Dynamic spacing - proportional to model size but with limits
    let labelOffset;
    if (scaleRatio < 0.1) {
      // Small models - closer positioning (min 1.5 units)
      labelOffset = Math.max(1.5, modelDiameter * 0.1);
    } else if (scaleRatio > 5.0) {
      // Large models - distant positioning (8% of model diameter)
      labelOffset = modelDiameter * 0.08;
    } else {
      // Normal size models - proportional positioning (3-6 units based on scale)
      labelOffset = 3 + (scaleRatio * 1.5);
    }

    // Position label to the right of the volumetric model with dynamic spacing
    const labelX = bounds.max.x + labelOffset;
    const labelY = center.y; // Center vertically with the material
    const labelZ = center.z; // Same Z position as material center

    return new Vector3(labelX, labelY, labelZ);
  }, []);

  useEffect(() => {
    if (!isInitialized || !scene || !sceneManager || !showLabels) {
      // Clear labels when not showing
      if (labelGroupRef.current) {
        scene.remove(labelGroupRef.current);

        // Clear CSS3D labels from scene manager
        labelsRef.current.forEach((labelId, index) => {
          sceneManager.removeCSS3D(labelId);
        });

        labelGroupRef.current = null;
        labelsRef.current = [];
      }
      return;
    }

    // Enhanced data validation using memoized volumesData
    if (!volumesData) {
      return;
    }

    if (volumesData.type !== 'volumetric') {
      return;
    }

    // Validate that volumes have materials (meshes are optional)
    const validVolumes = volumesData.volumes.filter(volume =>
      volume &&
      volume.material
    );

    if (validVolumes.length === 0) {
      return;
    }

    // Clear previous labels
    if (labelGroupRef.current) {
      scene.remove(labelGroupRef.current);

      labelsRef.current.forEach((labelId, index) => {
        sceneManager.removeCSS3D(labelId);
      });

      labelGroupRef.current = null;
      labelsRef.current = [];
    }

    // Extract materials from volumetric data
    const materials = extractMaterialsFromVolumes(volumesData.volumes);

    if (materials.length === 0) return;

    // Create label group for organization
    const labelGroup = new Group();
    labelGroup.name = 'VolumetricLabels';

    // Calculate model bounds for positioning - multi-tier fallback approach
    // 1. Use mesh bounds if available (optimal)
    // 2. Use volume extent data if mesh not ready (good)
    // 3. Use default bounds as last resort (basic)
    const modelBounds = new Box3();
    let boundsFound = false;

    volumesData.volumes.forEach(volume => {
      if (volume.type === 'pocket') return;

      if (volume.mesh) {
        // Primary: Use mesh bounds if available
        const volumeBounds = new Box3().setFromObject(volume.mesh);
        modelBounds.union(volumeBounds);
        boundsFound = true;
      } else if (volume.extent) {
        // Fallback: Use extent data if mesh not available
        const { xMin, xMax, yMin, yMax, zMin, zMax } = volume.extent;
        const extentBounds = new Box3(
          new Vector3(xMin, yMin, zMin),
          new Vector3(xMax, yMax, zMax)
        );
        modelBounds.union(extentBounds);
        boundsFound = true;
      }
    });

    // Final fallback: Create default bounds
    if (!boundsFound) {
      modelBounds.set(
        new Vector3(-5, -5, -5),
        new Vector3(5, 5, 5)
      );
    }

    // Create labels for each unique material
    materials.forEach((materialData, index) => {
      const { material, depth, color } = materialData;

      // Format depth in feet (depth is already in feet)
      const depthInFeet = depth.toFixed(1);
      const labelText = `${material}: ${depthInFeet}' thick`;

      // Create glassmorphism label
      const glassLabel = createGlassmorphismLabel(labelText, color, 'layer');

      // Calculate label position
      const labelPosition = calculateLabelPosition(materialData, modelBounds);
      glassLabel.position.copy(labelPosition);

      // Add to scene manager for CSS3D rendering
      const labelId = `volumetric-label-${index}`;
      sceneManager.addCSS3D(labelId, glassLabel);
      labelsRef.current.push(labelId);

      // Create connector line from material to label
      const lineMaterial = new LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.6,
        transparent: true
      });

      const lineGeometry = new BufferGeometry().setFromPoints([
        new Vector3(materialData.bounds.max.x, materialData.center.y, materialData.center.z),
        new Vector3(labelPosition.x - 1.0, labelPosition.y, labelPosition.z)
      ]);

      const connectorLine = new Line(lineGeometry, lineMaterial);
      labelGroup.add(connectorLine);
    });

    // Add label group to scene
    if (labelGroup.children.length > 0) {
      scene.add(labelGroup);
      labelGroupRef.current = labelGroup;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isInitialized,
    scene,
    sceneManager,
    showLabels,
    volumesData
    // Intentionally excluding:
    // - extractMaterialsFromVolumes, calculateLabelPosition: stable functions with empty deps
    // - prototypeResult: we use memoized volumesData instead for stable reference
    // Including them causes infinite re-renders due to object reference changes
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (labelGroupRef.current) {
        scene?.remove(labelGroupRef.current);

        // Clear CSS3D labels
        if (sceneManager) {
          labelsRef.current.forEach((labelId, index) => {
            sceneManager.removeCSS3D(labelId);
          });
        }

        labelGroupRef.current = null;
        labelsRef.current = [];
      }
    };
  }, [scene, sceneManager]);

  return null; // This component manages 3D objects only
}

export default VolumetricLabels;