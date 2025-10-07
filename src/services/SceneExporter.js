// src/services/SceneExporter.js
import { Box3, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Float32BufferAttribute, FrontSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Scene, Vector2, Vector3 } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { calculateDepthInterval } from '../utils/depthScaleCalculator';
import { exportLogger, validationLogger } from '../utils/Logger.js';
import { CONVERSION_FACTORS, feetToInches } from '../utils/unitConverter.js';
import { TransformCompositionService } from './TransformCompositionService.js';
import { CoordinateSystemConverter } from '../utils/coordinateSystemConverter.js';

// Legacy unit conversion constants for backward compatibility
const UNIT_CONVERSION = {
  FEET_TO_METERS: CONVERSION_FACTORS.FEET_TO_METERS,
  METERS_TO_FEET: CONVERSION_FACTORS.METERS_TO_FEET,
  INCHES_PER_FOOT: CONVERSION_FACTORS.FEET_TO_INCHES
};

/**
 * Unit conversion utilities for consistent handling across the exporter
 */
const UnitConverter = {
  /**
   * Convert feet to meters
   * @param {number} feet - Value in feet
   * @returns {number} Value in meters
   */
  feetToMeters(feet) {
    return feet * UNIT_CONVERSION.FEET_TO_METERS;
  },

  /**
   * Convert meters to feet
   * @param {number} meters - Value in meters
   * @returns {number} Value in feet
   */
  metersToFeet(meters) {
    return meters * UNIT_CONVERSION.METERS_TO_FEET;
  },

  /**
   * Get conversion factor based on export options
   * @param {boolean} convertToMeters - Whether to convert feet to meters
   * @returns {number} Conversion factor (1.0 for no conversion, 0.3048 for feet to meters)
   */
  getConversionFactor(convertToMeters) {
    return convertToMeters ? UNIT_CONVERSION.FEET_TO_METERS : 1.0;
  },

  /**
   * Apply coordinate conversion to Y positions in geometry
   * @param {BufferGeometry} geometry - Geometry to modify
   * @param {number} conversionFactor - Factor to multiply Y coordinates by
   */
  convertGeometryYCoordinates(geometry, conversionFactor) {
    if (!geometry.attributes?.position) return;
    
    const positions = geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] *= conversionFactor;
    }
    geometry.attributes.position.needsUpdate = true;
  },

  /**
   * Create unit metadata for export
   * @param {boolean} convertToMeters - Whether conversion was applied
   * @returns {Object} Unit metadata object
   */
  createUnitMetadata(convertToMeters) {
    return {
      coordinate_system: convertToMeters ? 'GLTF meters (pre-compensated for viewer conversion)' : 'feet (raw)',
      original_app_units: 'feet',
      display_units: 'feet',
      conversion_applied: convertToMeters ? 'Pre-compensation: feet ÷ 3.28084 (so viewer × 3.28084 = correct feet)' : 'None (raw feet values)',
      viewer_instructions: convertToMeters 
        ? 'Coordinates pre-scaled so viewer automatic meter→feet conversion displays correctly'
        : 'Raw feet values - viewer may display incorrectly if it applies conversion',
      unit_scale_factor: convertToMeters ? UNIT_CONVERSION.FEET_TO_METERS : 1.0,
      coordinate_interpretation: convertToMeters ? 'pre_compensated_for_viewer_conversion' : 'raw_feet',
      expected_viewer_behavior: 'Viewer will multiply coordinates by ~3.28 and display as feet'
    };
  }
};

class SceneExporter {
  constructor() {
    this.gltfExporter = new GLTFExporter();
  }

  /**
   * Export the current 3D scene to GLTF format
   * @param {Object} sceneData - Complete scene data including objects, metadata, and settings
   * @param {Scene} sceneData.scene - Three.js scene to export
   * @param {Array} sceneData.soilLayers - Soil layer definitions
   * @param {Array} sceneData.boreholes - Borehole data with water table information
   * @param {Object} sceneData.siteMap - Site map data
   * @param {Object} sceneData.displayOptions - Display settings
   * @param {Object} sceneData.strataDimensions - Site dimensions
   * @param {Object} sceneData.geologicalModel - Geological modeling results
   * @param {Object} sceneData.waterTableData - Water table visualization data and settings
   * @param {Object} sceneData.textureData - Soil texture enhancement data and settings
   * @param {Object} sceneData.transformationContext - Transformation context with composite transforms
   * @param {Object} options - Export options
   * @returns {Promise} Promise that resolves with the exported data
   */
  async exportToGLTF(sceneData, options = {}) {
    const {
      scene,
      sceneManager = null,     // Scene manager for CSS3D label extraction
      soilLayers = [],
      boreholes = [],
      siteMap = null,
      displayOptions = {},
      strataDimensions = {},
      geologicalModel = null,  // Add geological model data for advanced metadata
      waterTableData = null,   // Water table visualization data and settings
      textureData = null,      // Soil texture enhancement data and settings
      transformationContext = null // Transformation context for accurate export
    } = sceneData;

    // Create export options with defaults
    const exportOptions = {
      binary: true, // Export as GLB for better compression
      includeCustomExtensions: true,
      animations: [],
      onlyVisible: true,
      truncateDrawRange: true,
      // NEW: Pre-compensate for viewer automatic conversion (feet→meters)
      // Since viewers automatically multiply by 3.28084, we divide by 3.28084 first
      // Math: (30ft ÷ 3.28084) × 3.28084 = 30ft displayed correctly
      convertFeetToMeters: options?.convertFeetToMeters !== false, // Default: true (pre-compensate for viewer)
      ...options
    };

    try {
      // If traditional soil layers are empty but we have boreholes, extract soil layers from borehole data
      let effectiveSoilLayers = soilLayers || [];
      if (effectiveSoilLayers.length === 0 && boreholes && boreholes.length > 0) {
        effectiveSoilLayers = this.extractSoilLayersFromBoreholes(boreholes);
      }
      
      // Create a clean scene for export
      const exportScene = this.createExportScene(scene, sceneManager, effectiveSoilLayers, boreholes, siteMap, displayOptions, strataDimensions, exportOptions, transformationContext);
      
      // Export the scene
      const gltfData = await this.exportSceneToGLTF(exportScene, exportOptions);
      
      // Add comprehensive metadata including geological model data and enhancements
      const exportData = {
        gltfData,
        metadata: {
          ...this.createMetadata(effectiveSoilLayers, boreholes, siteMap, displayOptions, strataDimensions, geologicalModel, waterTableData, textureData),
          units: UnitConverter.createUnitMetadata(exportOptions.convertFeetToMeters),
          transformations: transformationContext ? this.createSafeTransformMetadata(transformationContext) : null
        },
        exportOptions,
        timestamp: new Date().toISOString()
      };

      // Clean up temporary export scene
      this.disposeScene(exportScene);

      return exportData;
    } catch (error) {
      exportLogger.error('Export failed:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Create safe transformation metadata without triggering NaN matrix calculations
   */
  createSafeTransformMetadata(transformationContext) {
    try {
      // Basic metadata that doesn't require matrix calculations
      const safeMetadata = {
        base: transformationContext.baseTransform,
        model: transformationContext.modelTransform,
        view: transformationContext.viewTransform,
        coordinateSystem: transformationContext.coordinateSystem,
        unitConversion: { 
          factor: 0.3048, // Standard feet to meters conversion
          applied: true 
        },
        timestamp: new Date().toISOString(),
        safe: true // Flag to indicate this was created safely
      };

      // Enhanced validation before attempting matrix calculation
      try {
        const baseTransform = transformationContext.baseTransform || {};
        const modelTransform = transformationContext.modelTransform || {};
        const viewTransform = transformationContext.viewTransform || {};
        
        // Comprehensive validation of all transform values
        const validateTransform = (transform, name) => {
          const pos = transform.position || {};
          const rot = transform.rotation || {};
          const scale = transform.scale || {};
          
          const posValid = !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
                          isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z);
          const rotValid = !isNaN(rot.x) && !isNaN(rot.y) && !isNaN(rot.z) &&
                          isFinite(rot.x) && isFinite(rot.y) && isFinite(rot.z);
          const scaleValid = !isNaN(scale.x) && !isNaN(scale.y) && !isNaN(scale.z) &&
                            isFinite(scale.x) && isFinite(scale.y) && isFinite(scale.z) &&
                            scale.x > 0 && scale.y > 0 && scale.z > 0;
          
          const allValid = posValid && rotValid && scaleValid;
          
          if (!allValid) {
            validationLogger.warn(`SceneExporter: Invalid ${name} transform values:`, {
              posValid, rotValid, scaleValid,
              position: pos,
              rotation: rot,
              scale: scale
            });
          }
          
          return allValid;
        };
        
        const baseValid = validateTransform(baseTransform, 'base');
        const modelValid = validateTransform(modelTransform, 'model');
        const viewValid = !viewTransform.enabled || validateTransform(viewTransform, 'view');
        
        if (baseValid && modelValid && viewValid) {
          exportLogger.debug('SceneExporter: All transforms valid, attempting matrix calculation');
          const compositeMatrix = transformationContext.getCompositeTransformMatrix();

          if (compositeMatrix && compositeMatrix.elements.every(el => !isNaN(el) && isFinite(el))) {
            safeMetadata.composite = compositeMatrix;
            exportLogger.debug('SceneExporter: Successfully created composite matrix for export');
          } else {
            validationLogger.warn('SceneExporter: Composite matrix contains invalid values, omitting from metadata');
          }
        } else {
          validationLogger.warn('SceneExporter: Transform validation failed, omitting composite matrix from metadata');
        }
      } catch (matrixError) {
        validationLogger.warn('SceneExporter: Failed to generate composite matrix for metadata:', matrixError);
      }

      // Use fallback metadata structure if TransformCompositionService is not available
      if (typeof TransformCompositionService !== 'undefined' && TransformCompositionService.createTransformMetadata) {
        return TransformCompositionService.createTransformMetadata(safeMetadata);
      } else {
        exportLogger.debug('SceneExporter: Using direct metadata structure (TransformCompositionService not available)');
        return safeMetadata;
      }
    } catch (error) {
      validationLogger.warn('Failed to create transformation metadata, returning null:', error);
      return null;
    }
  }

  /**
   * Clean circular references from userData to prevent JSON serialization errors
   */
  cleanCircularReferences(userData) {
    if (!userData) return {};
    
    const seen = new WeakSet();
    
    const cleanObject = (obj, depth = 0) => {
      // Prevent infinite recursion
      if (depth > 10) return null;
      
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      
      // Check for circular reference
      if (seen.has(obj)) {
        validationLogger.warn('Circular reference detected, skipping object');
        return null;
      }
      
      seen.add(obj);
      
      if (Array.isArray(obj)) {
        return obj.map(item => cleanObject(item, depth + 1)).filter(item => item !== null);
      }
      
      const cleaned = {};
      for (const key in obj) {
        // Skip properties that commonly cause circular references
        if (key === 'mesh' || key === 'object' || key === 'volumeData' || 
            key === 'parent' || key === 'children' || key === 'scene' ||
            key === 'geometry' || key === 'material' || key === '_renderer' ||
            key === '_scene' || key === '_camera' || key === 'userData' ||
            key === 'sceneManager' || key === 'canvas' || key === 'renderer' ||
            key === 'context' || key === 'domElement' || key === 'program' ||
            key === 'buffer' || key === 'attribute') {
          continue;
        }
        
        const value = obj[key];
        if (value && typeof value === 'object') {
          const cleanedValue = cleanObject(value, depth + 1);
          if (cleanedValue !== null) {
            cleaned[key] = cleanedValue;
          }
        } else {
          cleaned[key] = value;
        }
      }
      
      return cleaned;
    };
    
    return cleanObject(userData);
  }

  /**
   * Safe clone method for objects with circular references
   * Creates a new mesh with the same geometry and materials without deep cloning userData
   */
  safeCloneMesh(mesh) {
    if (!mesh || mesh.type !== 'Mesh') {
      // For non-mesh objects, always use manual copy to avoid circular reference issues
      return this.manualCloneObject(mesh);
    }

    // For meshes, create a clean clone manually with deep buffer array cloning
    let geometry = null;
    if (mesh.geometry) {
      // CRITICAL FIX: Deep clone BufferGeometry with isolated buffer arrays
      geometry = this.deepCloneGeometry(mesh.geometry);
    }
    
    const material = mesh.material ? 
      (Array.isArray(mesh.material) ? 
        mesh.material.map(m => m.clone()) : 
        mesh.material.clone()) : 
      null;

    const clonedMesh = new Mesh(geometry, material);
    
    // Copy transformation properties
    clonedMesh.position.copy(mesh.position);
    clonedMesh.rotation.copy(mesh.rotation);
    clonedMesh.scale.copy(mesh.scale);
    clonedMesh.quaternion.copy(mesh.quaternion);
    
    // Copy other properties
    clonedMesh.name = mesh.name;
    clonedMesh.visible = mesh.visible;
    clonedMesh.castShadow = mesh.castShadow;
    clonedMesh.receiveShadow = mesh.receiveShadow;
    clonedMesh.renderOrder = mesh.renderOrder;
    clonedMesh.frustumCulled = mesh.frustumCulled;
    
    // Clean and copy userData
    clonedMesh.userData = this.cleanCircularReferences(mesh.userData);
    
    // Handle children if they exist
    if (mesh.children && mesh.children.length > 0) {
      mesh.children.forEach(child => {
        const clonedChild = this.safeCloneMesh(child);
        if (clonedChild) {
          clonedMesh.add(clonedChild);
        }
      });
    }
    
    return clonedMesh;
  }

  /**
   * Manual clone for Group and Object3D objects
   */
  manualCloneObject(object) {
    if (!object) return null;
    
    let clonedObject;
    if (object.type === 'Group') {
      clonedObject = new Group();
    } else if (object.type === 'Object3D') {
      clonedObject = new Object3D();
    } else {
      // For other types, create a basic Object3D
      clonedObject = new Object3D();
    }
    
    // Copy transformation properties
    clonedObject.position.copy(object.position);
    clonedObject.rotation.copy(object.rotation);
    clonedObject.scale.copy(object.scale);
    clonedObject.quaternion.copy(object.quaternion);
    
    // Copy other properties
    clonedObject.name = object.name;
    clonedObject.visible = object.visible;
    clonedObject.renderOrder = object.renderOrder;
    clonedObject.frustumCulled = object.frustumCulled;
    
    // Clean and copy userData
    clonedObject.userData = this.cleanCircularReferences(object.userData);
    
    // Handle children
    if (object.children && object.children.length > 0) {
      object.children.forEach(child => {
        const clonedChild = this.safeCloneMesh(child);
        if (clonedChild) {
          clonedObject.add(clonedChild);
        }
      });
    }
    
    return clonedObject;
  }

  /**
   * Deep clone BufferGeometry with isolated buffer arrays
   * This prevents coordinate conversions from affecting the original geometry
   * @param {BufferGeometry} originalGeometry - Geometry to clone
   * @returns {BufferGeometry} Deeply cloned geometry with isolated buffer arrays
   */
  deepCloneGeometry(originalGeometry) {
    if (!originalGeometry) return null;
    
    // Create new BufferGeometry
    const clonedGeometry = new BufferGeometry();
    
    // Clone all attributes with new buffer arrays
    Object.keys(originalGeometry.attributes).forEach(attributeName => {
      const originalAttribute = originalGeometry.attributes[attributeName];
      
      // Create new array with same data but isolated memory
      const newArray = new originalAttribute.array.constructor(originalAttribute.array);
      
      // Create new BufferAttribute with the isolated array
      const newAttribute = new BufferAttribute(newArray, originalAttribute.itemSize, originalAttribute.normalized);
      
      // Copy other properties
      if (originalAttribute.usage !== undefined) newAttribute.usage = originalAttribute.usage;
      if (originalAttribute.updateRange) {
        newAttribute.updateRange.offset = originalAttribute.updateRange.offset;
        newAttribute.updateRange.count = originalAttribute.updateRange.count;
      }
      
      clonedGeometry.setAttribute(attributeName, newAttribute);
    });
    
    // Clone index if it exists
    if (originalGeometry.index) {
      const originalIndex = originalGeometry.index;
      const newIndexArray = new originalIndex.array.constructor(originalIndex.array);
      clonedGeometry.setIndex(new BufferAttribute(newIndexArray, 1));
    }
    
    // Copy other properties
    if (originalGeometry.boundingBox) {
      clonedGeometry.boundingBox = originalGeometry.boundingBox.clone();
    }
    if (originalGeometry.boundingSphere) {
      clonedGeometry.boundingSphere = originalGeometry.boundingSphere.clone();
    }
    
    // Copy groups
    if (originalGeometry.groups.length > 0) {
      clonedGeometry.groups = originalGeometry.groups.map(group => ({ ...group }));
    }
    
    // Copy drawRange
    clonedGeometry.drawRange.start = originalGeometry.drawRange.start;
    clonedGeometry.drawRange.count = originalGeometry.drawRange.count;
    
    // Performance optimization: disable heavy geometry cloning logs
    // exportLogger.debug('Deep cloned geometry with isolated buffer arrays', { vertexCount });
    
    return clonedGeometry;
  }

  /**
   * Extract live depth scale from the scene for export
   * This ensures exported depth measurements match exactly what the user sees
   */
  extractLiveDepthScaleFromScene(originalScene) {
    let liveDepthScale = null;
    
    // Search for depth scale objects in the scene
    originalScene.traverse((child) => {
      // Look for depth scale tick marks or depth scale groups
      if (child.name && (
        child.name.includes('depth') || 
        child.name.includes('DepthScale') ||
        (child.userData && child.userData.type === 'DepthScale')
      )) {
        exportLogger.debug('Found potential depth scale object:', {
          name: child.name,
          type: child.type,
          children: child.children?.length,
          userData: child.userData
        });
        
        if (!liveDepthScale) {
          liveDepthScale = new Group();
          liveDepthScale.name = 'live_depth_scale_export';
        }
        
        // Clone depth scale geometry safely
        try {
          const clonedDepthChild = this.safeCloneMesh(child);
          if (clonedDepthChild) {
            clonedDepthChild.name = child.name + '_export';
            liveDepthScale.add(clonedDepthChild);
          }
        } catch (error) {
          validationLogger.warn('Failed to clone depth scale object:', error);
        }
      }
      
      // Also look for individual tick marks that might not be in a named group
      if (child.isMesh && child.material && child.geometry) {
        // Check if this looks like a depth scale tick mark
        const isTickMark = child.geometry.type === 'BoxGeometry' && 
                          (child.scale.x > child.scale.y || child.scale.z > child.scale.y) &&
                          child.position.y !== 0; // Likely positioned at a specific depth
                          
        if (isTickMark && child.position.x < 0) { // Depth scales are usually positioned to the left
          if (!liveDepthScale) {
            liveDepthScale = new Group();
            liveDepthScale.name = 'live_depth_scale_export';
          }
          
          try {
            const clonedTick = this.safeCloneMesh(child);
            if (clonedTick) {
              clonedTick.name = 'depth_tick_export';
              liveDepthScale.add(clonedTick);
            }
          } catch (error) {
            validationLogger.warn('Failed to clone depth tick:', error);
          }
        }
      }
    });
    
    // Convert glassmorphism labels to exportable 3D text geometry
    if (liveDepthScale) {
      this.addDepthLabelsTo3DGroup(liveDepthScale, originalScene);
    }
    
    return liveDepthScale;
  }

  /**
   * Convert CSS3D depth labels to exportable 3D text geometry
   */
  addDepthLabelsTo3DGroup(depthScaleGroup, originalScene) {
    // Extract depth positions from existing tick marks
    const depthPositions = [];
    exportLogger.debug(`Analyzing ${depthScaleGroup.children.length} depth scale children for position extraction`);
    
    depthScaleGroup.children.forEach((child, index) => {
      // Handle Line objects (VolumetricDepthScale creates Line objects)
      if (child.type === 'Line' && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
        const positions = child.geometry.attributes.position.array;
        // Line geometry has points: [x1, y1, z1, x2, y2, z2, ...]
        // We need the Y coordinate which represents depth position
        exportLogger.debug(`Found Line child ${index}:`, {
          name: child.name,
          positionArrayLength: positions.length,
          firstPoint: positions.length >= 3 ? [positions[0], positions[1], positions[2]] : 'insufficient data',
          secondPoint: positions.length >= 6 ? [positions[3], positions[4], positions[5]] : 'insufficient data'
        });
        
        if (positions.length >= 6) { // At least 2 points (6 values: x1,y1,z1,x2,y2,z2)
          const y1 = positions[1]; // Y coordinate of first point
          
          // Use the Y coordinate (both points should have same Y for horizontal tick)
          const yPosition = y1;
          if (yPosition !== 0) { // Has a depth position
            exportLogger.debug(`Extracting depth ${Math.abs(yPosition).toFixed(1)}ft from Y position ${yPosition}`);
            depthPositions.push({
              y: yPosition,
              x: positions[0], // X coordinate of first point
              z: positions[2]  // Z coordinate of first point
            });
          }
        }
      } 
      // Fallback: Handle regular mesh objects
      else if (child.position && child.position.y !== 0) {
        exportLogger.debug(`Found mesh child ${index} with position:`, {
          name: child.name,
          type: child.type,
          position: [child.position.x, child.position.y, child.position.z]
        });
        depthPositions.push({
          y: child.position.y,
          x: child.position.x,
          z: child.position.z
        });
      } else {
        exportLogger.debug(`Skipping child ${index}:`, {
          name: child.name,
          type: child.type,
          hasGeometry: !!child.geometry,
          hasPosition: !!child.position,
          positionY: child.position?.y
        });
      }
    });
    
    // Create 3D text labels for each depth position
    depthPositions.forEach((pos, index) => {
      const depthValue = Math.abs(pos.y).toFixed(1);
      const labelText = `${depthValue}ft`; // Use feet units consistently
      
      // Create simple 3D text geometry for export
      const textMesh = this.create3DTextLabel(labelText, pos.x - 2, pos.y, pos.z);
      if (textMesh) {
        textMesh.name = `depth_label_${index}_export`;
        depthScaleGroup.add(textMesh);
      }
    });
    
    exportLogger.info(`Added ${depthPositions.length} depth labels to export`, {
      extractedDepths: depthPositions.map(p => `${Math.abs(p.y).toFixed(1)}ft`),
      yPositions: depthPositions.map(p => p.y.toFixed(3))
    });
  }

  /**
   * Diagnostic helper for viewer compatibility issues
   */
  createViewerDiagnostics(maxDepth, actualValues) {
    return {
      appValues: {
        maxDepthFeet: maxDepth.toFixed(1) + 'ft',
        labelValues: actualValues.map(d => d.text)
      },
      gltfExport: {
        maxDepthMeters: UnitConverter.feetToMeters(maxDepth).toFixed(2) + 'm',
        coordinateSystem: 'Y-up, meters',
        expectedViewerDisplay: actualValues.map(d => ({
          label: d.text,
          meterCoord: UnitConverter.feetToMeters(d.value).toFixed(2) + 'm',
          ifViewerConvertsToFeet: UnitConverter.metersToFeet(UnitConverter.feetToMeters(d.value)).toFixed(1) + 'ft'
        }))
      },
      diagnostics: {
        possibleIssues: [
          `${maxDepth}ft → ${UnitConverter.metersToFeet(UnitConverter.feetToMeters(maxDepth)).toFixed(1)}ft (double conversion)`,
          `Viewer scale factor: ${(98.4 / maxDepth).toFixed(2)}x`,
          'Check viewer unit settings',
          'Check if model has additional scene scale'
        ]
      }
    };
  }

  /**
   * Verify depth scale values match expected calculations
   */
  verifyDepthScaleValues(depthGroup, boreholes) {
    // Calculate expected depth values using same logic as VolumetricDepthScale
    let expectedMaxDepth = 0;
    
    if (boreholes && boreholes.length > 0) {
      boreholes.forEach(borehole => {
        let boreholeDepth = 0;
        if (borehole.totalDepth && borehole.totalDepth > 0) {
          boreholeDepth = borehole.totalDepth;
        } else if (borehole.depth && borehole.depth > 0) {
          boreholeDepth = borehole.depth;
        } else if (borehole.layers && borehole.layers.length > 0) {
          boreholeDepth = Math.max(...borehole.layers.map(layer => layer.to || 0));
        }
        expectedMaxDepth = Math.max(expectedMaxDepth, boreholeDepth);
      });
    }
    
    if (expectedMaxDepth <= 0) {
      expectedMaxDepth = 10; // Default
    }
    
    // Extract actual depth values from the depth group
    const actualDepthValues = [];
    depthGroup.traverse((node) => {
      if (node.userData?.isDepthLabel && node.userData?.labelText) {
        const depthText = node.userData.labelText;
        const depthValue = parseFloat(depthText.replace("'", ""));
        actualDepthValues.push({
          text: depthText,
          value: depthValue,
          yPosition: node.position.y
        });
      }
    });
    
    // Sort by depth value
    actualDepthValues.sort((a, b) => a.value - b.value);
    
    const maxActualDepth = actualDepthValues.length > 0 ? Math.max(...actualDepthValues.map(d => d.value)) : 0;
    
    exportLogger.debug('Depth Scale Verification:', {
      expectedMaxDepth: expectedMaxDepth.toFixed(1) + 'ft',
      actualDepthValues: actualDepthValues.map(d => d.text),
      actualMaxDepth: maxActualDepth.toFixed(1) + 'ft',
      valuesMatch: actualDepthValues.length > 0 && 
        Math.abs(maxActualDepth - expectedMaxDepth) < 0.1,
      depthToYMapping: actualDepthValues.map(d => ({
        depth: d.text,
        yPos: d.yPosition.toFixed(2)
      }))
    });
    
    // Add viewer diagnostics for troubleshooting
    if (actualDepthValues.length > 0) {
      const diagnostics = this.createViewerDiagnostics(maxActualDepth, actualDepthValues);
      exportLogger.debug('Viewer Compatibility Diagnostics:', diagnostics);
    }
    
    return {
      valid: actualDepthValues.length > 0,
      expectedMax: expectedMaxDepth,
      actualValues: actualDepthValues
    };
  }

  /**
   * Create simple 3D text geometry for depth labels
   */
  create3DTextLabel(text, x, y, z) {
    // For now, create a simple plane with text-like appearance
    const geometry = new PlaneGeometry(text.length * 0.3, 0.5);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: DoubleSide
    });
    
    const textMesh = new Mesh(geometry, material);
    textMesh.position.set(x, y, z);
    textMesh.userData = {
      isDepthLabel: true,
      labelText: text
    };
    
    return textMesh;
  }

  /**
   * Determine if an object should be included in the export based on visibility settings
   * @param {Object3D} object - The object to check
   * @param {Object} displayOptions - Display options from context
   * @returns {boolean} Whether the object should be included
   */
  shouldIncludeInExport(object, displayOptions = {}) {
    // First check if the object itself is visible
    if (!object.visible) {
      return false;
    }
    
    // Also check parent visibility up the hierarchy
    let parent = object.parent;
    while (parent && parent !== parent.parent) {
      if (!parent.visible) {
        return false;
      }
      parent = parent.parent;
    }
    
    const name = object.name?.toLowerCase() || '';
    const userData = object.userData || {};
    const type = userData.type?.toLowerCase() || '';
    
    // Provide default values for displayOptions to handle undefined cases
    const options = {
      showBoreholes: true,
      showBoreholeStrata: true, 
      showWaterTable: true,
      showStrata: true,
      showDepthMarkers: true,
      showLabels: true,
      showGroundGrid: true,
      ...displayOptions
    };
    
    // Check specific object types against display options
    
    // Borehole objects
    if (type === 'borehole' || name.includes('borehole')) {
      // Check if it's a borehole strata specifically
      if (name.includes('strata') || type === 'borehole_strata' || type === 'borehole_strata_layer') {
        return options.showBoreholeStrata !== false;
      }
      // Regular borehole markers
      return options.showBoreholes !== false;
    }
    
    // Water table indicators - check multiple naming patterns and types
    if (type === 'water_table' || type === 'watertableindicator' || type === 'water_table_indicator' ||
        name.includes('watertable') || name.includes('water_table') || 
        name.includes('water-table') || name.includes('waterTableIndicator')) {
      return options.showWaterTable !== false;
    }
    
    // Geological strata (non-borehole)
    if ((type === 'strata' || name.includes('strata')) && !name.includes('borehole')) {
      return options.showStrata !== false;
    }
    
    // Depth markers and scales
    if (type === 'depth_marker' || type === 'depthscale' || type === 'DepthScale' ||
        name.includes('depth_marker') || name.includes('depth_scale') || 
        name.includes('depthscale') || name.includes('DepthScale')) {
      return options.showDepthMarkers !== false;
    }
    
    // Labels - including volumetric labels
    if (type === 'label' || name.includes('label') || 
        type === 'volumetriclabel' || name.includes('volumetriclabel')) {
      return options.showLabels !== false;
    }
    
    // Volumetric models should always be included if visible
    if (name === 'VolumetricGeologicalModel' || type === 'VolumetricModel' || 
        name.includes('IsolatedPocket') || name.includes('volumetric')) {
      // These represent the main geological model and should be included if visible
      return true;
    }
    
    // Site map objects
    if (type === 'sitemap' || name.includes('site_map')) {
      return true; // Site map visibility is controlled at load time
    }
    
    // Grid helpers
    if (type === 'gridhelper' || name.includes('grid')) {
      return options.showGroundGrid !== false;
    }
    
    // Default: include if no specific rule applies and object is visible
    return true;
  }

  /**
   * Create a clean scene containing only the objects we want to export
   * Respects visibility settings from displayOptions
   */
  createExportScene(originalScene, sceneManager, soilLayers, boreholes, siteMap, displayOptions, strataDimensions, exportOptions = {}, transformationContext = null) {
    const exportScene = new Scene();
    exportScene.name = 'GeoTech_Export_Scene';
    
    // ADD METADATA explaining pre-compensation approach  
    const unitMetadata = UnitConverter.createUnitMetadata(exportOptions.convertFeetToMeters);
    exportScene.userData = {
      ...exportScene.userData,
      coordinate_units: exportOptions.convertFeetToMeters ? 'meters_precompensated' : 'feet_raw',
      unit_handling: exportOptions.convertFeetToMeters ? 'pre_compensated_for_viewer' : 'raw_feet_no_conversion',
      geological_metadata: {
        original_units: unitMetadata.original_app_units,
        final_display_units: unitMetadata.display_units,
        viewer_behavior: unitMetadata.viewer_instructions,
        coordinate_scale_factor: unitMetadata.unit_scale_factor,
        pre_compensation_applied: exportOptions.convertFeetToMeters,
        expected_final_display: unitMetadata.display_units
      }
    };
    
    exportLogger.info('Creating export scene with unit metadata and display options:', {
      coordinateUnits: exportScene.userData.coordinate_units,
      unitHandling: exportScene.userData.unit_handling,
      scaleFactor: exportScene.userData.geological_metadata.coordinate_scale_factor,
      preventConversion: exportScene.userData.geological_metadata.no_unit_conversion_required,
      displayOptions: {
        showBoreholes: displayOptions?.showBoreholes,
        showBoreholeStrata: displayOptions?.showBoreholeStrata,
        showWaterTable: displayOptions?.showWaterTable,
        showStrata: displayOptions?.showStrata,
        showDepthMarkers: displayOptions?.showDepthMarkers,
        showGrid: displayOptions?.showGroundGrid,
        textureEnabled: displayOptions?.textureSettings?.enabled
      }
    });

    // Set up GLTF-compatible lighting (no ambient light, proper directional setup)
    const directionalLight = new DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 10, 5);
    directionalLight.name = 'main_light';
    
    // Create proper target setup for GLTF compatibility
    const lightTarget = new Object3D();
    lightTarget.position.set(0, 0, -1); // Position at 0,0,-1 as recommended
    lightTarget.name = 'light_target';
    directionalLight.target = lightTarget;
    
    // Make the target a child of the light for GLTF compatibility
    directionalLight.add(lightTarget);
    exportScene.add(directionalLight);
    
    // Add a second directional light as fill (more GLTF compatible than ambient)
    const fillLight = new DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5, 8, -5);
    fillLight.name = 'fill_light';
    
    const fillTarget = new Object3D();
    fillTarget.position.set(0, 0, -1);
    fillTarget.name = 'fill_target';
    fillLight.target = fillTarget;
    fillLight.add(fillTarget);
    
    exportScene.add(fillLight);

    // Export scene objects

    // Copy objects directly from the original scene with priority for volumetric models
    let hasVolumetricModel = false;
    
    originalScene.traverse((child) => {
      // Skip lights, cameras, and helpers unless specifically needed
      if (child.type === 'Light' || child.type === 'Camera' || child.type === 'AxesHelper') {
        return;
      }
      
      // Include grid helper if enabled
      if (child.type === 'GridHelper') {
        // Only include if grid is actually shown
        if (displayOptions?.showGroundGrid) {
          const gridClone = child.clone();
          gridClone.name = 'reference_grid';
          gridClone.visible = true; // Ensure visibility is set
          exportScene.add(gridClone);
        }
        return;
      }
      
      // Include all meshes, groups, and other 3D objects - but check visibility
      if (child.type === 'Mesh' || child.type === 'Group' || child.type === 'Object3D') {
        // Check if this object should be included based on its type and visibility settings
        const shouldInclude = this.shouldIncludeInExport(child, displayOptions);
        
        if (!shouldInclude) {
          return; // Skip this object
        }
        
        // Skip if this is a direct child of the scene and has a parent already added
        if (child.parent === originalScene) {
          try {
            // Use safe cloning method that handles circular references
            const clonedChild = this.safeCloneMesh(child);
            if (!clonedChild) {
              validationLogger.warn('Failed to clone child object:', child.name || 'unnamed');
              return;
            }
            
            // DETAILED TRACING: Check for any unexpected transformations during cloning
            if (child.name === 'VolumetricDepthScale' || child.name === 'VolumetricGeologicalModel') {
              exportLogger.debug('TRACE: Transformation check after cloning', {
                originalName: child.name,
                originalPosition: child.position,
                originalScale: child.scale,
                clonedName: clonedChild.name,
                clonedPosition: clonedChild.position,
                clonedScale: clonedChild.scale,
                transformationChanged: !child.position.equals(clonedChild.position) || !child.scale.equals(clonedChild.scale)
              });
            }
            
            clonedChild.name = (child.name || 'unnamed') + '_export';
            
            // Special handling for VolumetricDepthScale to verify values and convert units
            if (child.name === 'VolumetricDepthScale') {
              // DETAILED TRACING: Track every value transformation
              const rawBoreholeDatas = boreholes.map(b => ({
                name: b.name,
                rawDepth: b.depth,
                rawTotalDepth: b.totalDepth,
                dataType: typeof b.depth
              }));
              
              exportLogger.debug('TRACE START: VolumetricDepthScale Export', {
                name: child.name,
                position: child.position,
                childrenCount: child.children ? child.children.length : 0,
                rawBoreholeData: rawBoreholeDatas,
                convertFeetToMeters: exportOptions.convertFeetToMeters
              });
              
              // Trace original children positions BEFORE any conversion
              const originalPositions = [];
              child.children.forEach((originalChild, idx) => {
                if (originalChild.userData?.isDepthLabel) {
                  originalPositions.push({
                    index: idx,
                    name: originalChild.name,
                    labelText: originalChild.userData.labelText,
                    originalY: originalChild.position.y,
                    type: originalChild.type
                  });
                }
                if (originalChild.type === 'Line' && originalChild.geometry?.attributes?.position) {
                  const positions = originalChild.geometry.attributes.position.array;
                  const yCoords = [];
                  for (let i = 1; i < positions.length; i += 3) {
                    yCoords.push(positions[i]);
                  }
                  originalPositions.push({
                    index: idx,
                    name: originalChild.name,
                    type: 'Line',
                    originalYCoords: yCoords
                  });
                }
              });
              
              exportLogger.debug('TRACE: Original depth scale positions (before cloning)', originalPositions);
              
              // CONDITIONAL: Convert feet to meters for GLTF export (configurable)
              if (exportOptions.convertFeetToMeters) {
                const conversionFactor = UnitConverter.getConversionFactor(true);
                
                // Adjust Y positions of all depth scale elements to convert from feet to meters
                clonedChild.traverse((node) => {
                  // Convert Y position from feet to meters
                  node.position.y *= conversionFactor;
                  
                  // Update geometry vertices if it's a Line (tick marks and main line)
                  if (node.geometry) {
                    UnitConverter.convertGeometryYCoordinates(node.geometry, conversionFactor);
                  }
                });
                
                exportLogger.debug('Applied feet-to-meters conversion to depth scale positions');
              } else {
                exportLogger.debug('Skipping unit conversion (convertFeetToMeters = false)');
              }
              
              // DETAILED TRACING: Log final positions after conversion (or lack thereof)
              const finalPositions = [];
              clonedChild.traverse((node) => {
                if (node.userData?.isDepthLabel && node.userData?.labelText) {
                  finalPositions.push({
                    label: node.userData.labelText,
                    finalY: node.position.y,
                    absoluteDepth: Math.abs(node.position.y)
                  });
                }
                if (node.type === 'Line' && node.geometry?.attributes?.position) {
                  const positions = node.geometry.attributes.position.array;
                  const yCoords = [];
                  for (let i = 1; i < positions.length; i += 3) {
                    yCoords.push(positions[i]);
                  }
                  finalPositions.push({
                    type: 'Line',
                    name: node.name,
                    finalYCoords: yCoords
                  });
                }
              });
              
              // Calculate expected viewer display values
              // const viewerPredictions = finalPositions
              //   .filter(p => p.label)
              //   .map(p => ({
              //     label: p.label,
              //     yPosition: p.finalY,
              //     predictedViewerValue: Math.abs(p.finalY).toFixed(1),
              //     // Different viewer interpretation scenarios
              //     ifViewerThinksMeters: (Math.abs(p.finalY) * 3.28084).toFixed(1) + "'",
              //     ifViewerThinksFeet: Math.abs(p.finalY).toFixed(1) + "'",
              //   }));
              
              
              // Verify depth values from 3D text labels
              const depthLabels = [];
              clonedChild.traverse((node) => {
                if (node.userData?.isDepthLabel && node.userData?.labelText) {
                  depthLabels.push({
                    text: node.userData.labelText,
                    position: node.position.clone(),
                    yPos: node.position.y
                  });
                }
              });
              
              exportLogger.debug('SceneExporter: VolumetricDepthScale verification:', {
                depthLabelsFound: depthLabels.length,
                depthValues: depthLabels.map(l => l.text),
                yPositions: depthLabels.map(l => l.yPos.toFixed(2))
              });
              
              // Run comprehensive verification
              const verification = this.verifyDepthScaleValues(clonedChild, boreholes);
              
              if (depthLabels.length === 0) {
                // This is expected - VolumetricDepthScale no longer creates 3D labels
                // The depth scale lines and ticks are exported correctly
                exportLogger.debug('SceneExporter: Depth scale exported as lines and ticks (no 3D labels needed)');
              } else if (!verification.valid) {
                validationLogger.warn('SceneExporter: Depth scale values may not match expected ranges');
              } else {
                exportLogger.debug('SceneExporter: Depth scale with 3D labels verified successfully');
              }
            }
            
            // Check if this is a volumetric geological model or isolated pocket
            const isVolumetric = child.name === 'VolumetricGeologicalModel' || 
                                (child.userData && child.userData.type === 'VolumetricModel');
            const isIsolatedPocket = child.name && child.name.startsWith('IsolatedPocket_');
            
            if (isVolumetric || isIsolatedPocket) {
              hasVolumetricModel = true;
              
              exportLogger.debug('Processing volumetric/pocket for export', {
                name: child.name,
                isVolumetric,
                isIsolatedPocket,
                type: child.type,
                hasChildren: child.children ? child.children.length : 0,
                convertFeetToMeters: exportOptions.convertFeetToMeters
              });
              
              // Sample some vertices before conversion for tracing
              let sampleYCoords = [];
              clonedChild.traverse((node) => {
                if (node.geometry && node.geometry.attributes && node.geometry.attributes.position && sampleYCoords.length < 10) {
                  const positions = node.geometry.attributes.position.array;
                  for (let i = 1; i < positions.length && sampleYCoords.length < 10; i += 3) {
                    sampleYCoords.push(positions[i]);
                  }
                }
              });
              exportLogger.debug('Volumetric model sample Y coords (before conversion)', sampleYCoords.slice(0, 5));
              
              // NEW COORDINATE SYSTEM PIPELINE: Apply standardized coordinate transformations
              exportLogger.info('Applying standardized coordinate system transformations to geological model:', {
                name: child.name,
                hasTransformationContext: !!transformationContext,
                needsUnitConversion: exportOptions.convertFeetToMeters
              });

              // CRITICAL FIX: Capture transformation context BEFORE any coordinate conversions
              // This prevents NaN issues from coordinate-converted geometry affecting TransformationContext
              let exportTransformMatrix = null;
              let exportTransformMetadata = null;
              if (transformationContext) {
                try {
                  // ENHANCED VALIDATION: Check ALL transformation values for NaN before accessing
                  const baseTransform = transformationContext.baseTransform || {};
                  const modelTransform = transformationContext.modelTransform || {};
                  const viewTransform = transformationContext.viewTransform || {};
                  
                  // Deep validation of all transform properties
                  const validateTransformObject = (transform, name) => {
                    const pos = transform.position || {};
                    const rot = transform.rotation || {};
                    const scale = transform.scale || {};
                    
                    const posValid = !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) && 
                                   isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z);
                    const rotValid = !isNaN(rot.x) && !isNaN(rot.y) && !isNaN(rot.z) && 
                                   isFinite(rot.x) && isFinite(rot.y) && isFinite(rot.z);
                    const scaleValid = !isNaN(scale.x) && !isNaN(scale.y) && !isNaN(scale.z) && 
                                     isFinite(scale.x) && isFinite(scale.y) && isFinite(scale.z);
                    
                    if (!posValid || !rotValid || !scaleValid) {
                      validationLogger.warn(`TransformationContext ${name} contains invalid values:`, {
                        position: pos, rotation: rot, scale: scale,
                        posValid, rotValid, scaleValid
                      });
                      return false;
                    }
                    return true;
                  };
                  
                  const baseValid = validateTransformObject(baseTransform, 'BASE');
                  const modelValid = validateTransformObject(modelTransform, 'MODEL');
                  const viewValid = !viewTransform.enabled || validateTransformObject(viewTransform, 'VIEW');
                  
                  if (!baseValid || !modelValid || !viewValid) {
                    validationLogger.warn('TransformationContext contains NaN/invalid values, skipping transformation application');
                    exportTransformMatrix = null;
                    exportTransformMetadata = null;
                  } else {
                    // SAFE: All values validated - use safe transformation methods
                    try {
                      // Use the safe metadata creation method to avoid NaN issues
                      exportTransformMetadata = this.createSafeTransformMetadata(transformationContext);
                      
                      // Only get the matrix if we have valid metadata
                      if (exportTransformMetadata && exportTransformMetadata.composite) {
                        exportTransformMatrix = exportTransformMetadata.composite;
                      } else {
                        // Try to get matrix separately with additional validation
                        const testMatrix = transformationContext.getCompositeTransformMatrix();
                        if (testMatrix && testMatrix.elements.every(el => !isNaN(el) && isFinite(el))) {
                          exportTransformMatrix = testMatrix;
                        } else {
                          validationLogger.warn('SceneExporter: Transformation matrix contains invalid values, using fallback');
                          exportTransformMatrix = null;
                        }
                      }
                    } catch (matrixError) {
                      validationLogger.warn('SceneExporter: Error getting transformation data, using fallback:', matrixError);
                      exportTransformMatrix = null;
                      exportTransformMetadata = null;
                    }
                    
                    exportLogger.debug('Captured transformation context before coordinate conversion', {
                      hasMatrix: !!exportTransformMatrix,
                      hasMetadata: !!exportTransformMetadata
                    });
                  }
                } catch (error) {
                  validationLogger.warn('Failed to capture transformation context, proceeding without transforms:', error);
                  exportTransformMatrix = null;
                  exportTransformMetadata = null;
                }
              }
              
              // WYSIWYG EXPORT: Use the actual world positions from display for perfect alignment
              const useWorldPositions = clonedChild.userData?.exportTransform?.isWorldTransform;
              
              if (useWorldPositions) {
                // Use the exact positions from the display - this ensures WYSIWYG export
                const worldTransform = clonedChild.userData.exportTransform;
                clonedChild.position.set(
                  worldTransform.worldPosition.x,
                  worldTransform.worldPosition.y,
                  worldTransform.worldPosition.z
                );
                clonedChild.scale.set(
                  worldTransform.worldScale.x,
                  worldTransform.worldScale.y,
                  worldTransform.worldScale.z
                );
                
                // CRITICAL FIX: For true WYSIWYG export, only convert position, never modify geometry or scale
                // The display scale already includes all user intent + performance optimizations
                if (exportOptions.convertFeetToMeters) {
                  const unitConversion = 0.3048;
                  clonedChild.position.multiplyScalar(unitConversion);
                  // WYSIWYG: Do NOT modify geometry vertices or scale - this would change what user sees
                }
                
                // Skip complex coordinate transformations that alter positioning
                exportLogger.info('Applied WYSIWYG export transform', {
                  nodeName: child.name,
                  preservedWorldPosition: true,
                  unitConversion: exportOptions.convertFeetToMeters
                });
              } else {
              
                // Fallback: For objects without explicit world transform, preserve display scale
                const unitConversionFactor = exportOptions.convertFeetToMeters ? UNIT_CONVERSION.FEET_TO_METERS : 1;
                
                // WYSIWYG FIX: Instead of modifying geometry, apply scaling to the object transform
                // This preserves the visual appearance without breaking vertex data
                if (unitConversionFactor !== 1) {
                  clonedChild.position.multiplyScalar(unitConversionFactor);
                  // Don't modify child scale - preserve display scaling exactly as user sees it
                }
                
                exportLogger.info('Applied fallback export transform', {
                  nodeName: child.name,
                  unitConversion: exportOptions.convertFeetToMeters
                });
              }
              
              // Clean logging - only log final results
              exportLogger.info('Applied export transformations', {
                nodeName: child.name,
                method: useWorldPositions ? 'WYSIWYG' : 'Fallback',
                unitConversion: exportOptions.convertFeetToMeters
              });
              
              // Store minimal metadata
              clonedChild.userData.appliedTransforms = {
                exportMethod: useWorldPositions ? 'WYSIWYG' : 'Traditional',
                unitConversionApplied: exportOptions.convertFeetToMeters,
                finalPosition: {
                  x: clonedChild.position.x,
                  y: clonedChild.position.y,
                  z: clonedChild.position.z
                }
              };
              
              // Check if this is a wireframe volumetric model
              const isWireframe = this.isWireframeVolumetricModel(child);
              
              if (isWireframe) {
                // For wireframe exports, preserve the original complex geometry
                this.preserveVolumetricGeometryForWireframe(clonedChild, soilLayers);
                clonedChild.userData = { ...child.userData, isVolumetricWireframe: true };
              } else {
                // For solid exports, use preserved materials
                clonedChild.userData = { ...child.userData, isVolumetricOriginal: true };
                this.preserveMaterialsForGLTF(clonedChild);
              }
              
              exportScene.add(clonedChild);
            } else {
              // Preserve all user data
              clonedChild.userData = { ...child.userData };
              
              // Ensure materials are properly preserved for GLTF with color fix
              this.preserveMaterialsForGLTF(clonedChild);
              
              exportScene.add(clonedChild);
            }
          } catch (error) {
            validationLogger.warn('Failed to clone object:', error);
          }
        }
      }
    });
    
    // FIX: Only add fallback layers if we DON'T have a volumetric model
    // The volumetric model already contains all geological information
    if (soilLayers && soilLayers.length > 0 && !hasVolumetricModel) {
      // Only create fallback layers when there's no volumetric model
      const fallbackLayers = this.createFallbackLayerExport(soilLayers, strataDimensions);
      fallbackLayers.name = 'fallback_soil_layers';
      exportLogger.info('SceneExporter: No volumetric model found, using fallback layers');
      exportScene.add(fallbackLayers);
    } else if (hasVolumetricModel) {
      exportLogger.info('SceneExporter: Volumetric model present, skipping fallback/reference layers');
    }
    
    // Note: We now use the live VolumetricDepthScale from the scene instead of creating a duplicate
    // The live scale has accurate positioning and will be processed during scene traversal
    exportLogger.info('SceneExporter: Using live VolumetricDepthScale from scene (no duplicate creation)');
    
    // Add borehole representations if they exist and are visible
    if (boreholes && boreholes.length > 0 && displayOptions?.showBoreholes) {
      // Extract actual colors from scene boreholes
      const enrichedBoreholes = this.extractBoreholeColorsFromScene(originalScene, boreholes);
      const boreholeObjects = this.createBoreholesForExport(enrichedBoreholes, exportOptions);
      boreholeObjects.visible = true;
      exportScene.add(boreholeObjects);
      
      // FIX: Only add borehole strata if visible and we DON'T have volumetric model
      // The volumetric model already includes interpolated geology
      if (!hasVolumetricModel && soilLayers && soilLayers.length > 0 && displayOptions?.showBoreholeStrata) {
        const boreholeStrata = this.createBoreholeStrataForExport(enrichedBoreholes, soilLayers, originalScene);
        boreholeStrata.visible = true;
        exportScene.add(boreholeStrata);
        exportLogger.info('SceneExporter: Added borehole strata (no volumetric model)');
      } else if (hasVolumetricModel) {
        exportLogger.info('SceneExporter: Skipping borehole strata (volumetric model present)');
      } else if (!displayOptions?.showBoreholeStrata) {
        exportLogger.info('SceneExporter: Skipping borehole strata (visibility disabled)');
      }
    }

    // Additional site map handling (if it exists as a separate object)
    if (siteMap && siteMap.object) {
      try {
        const siteMapClone = this.safeCloneMesh(siteMap.object);
        if (siteMapClone) {
          siteMapClone.name = 'site_map_explicit';
        
        // Apply site map transformations using coordinate system aware approach
        if (siteMap.position || siteMap.scale || siteMap.rotation) {
          // CRITICAL: Use the same elevation offset calculation as geological model for consistency
          const elevationOffset = CoordinateSystemConverter.calculateElevationOffset(
            boreholes || [], 
            siteMap, 
            { position: { y: 0 } }
          );
          const unitConversionFactor = exportOptions.convertFeetToMeters ? UNIT_CONVERSION.FEET_TO_METERS : 1;
          
          exportLogger.info('Using unified elevation offset for site map transformations', {
            elevationOffset,
            siteMapPosition: siteMap.position
          });
          
          // Create site transform matrix in export coordinate space
          const siteMatrix = CoordinateSystemConverter.applySiteTransform(siteMap, 'export', elevationOffset);
          
          // Apply unit conversion to site transform if needed
          if (unitConversionFactor !== 1) {
            TransformCompositionService.applyUnitConversionToMatrix(siteMatrix, unitConversionFactor, true);
          }
          
          // Apply the transform matrix to site map geometry
          if (siteMapClone.geometry) {
            TransformCompositionService.applyTransformToGeometry(siteMapClone.geometry, siteMatrix);
          } else {
            // Apply to all child geometries if it's a group
            siteMapClone.traverse((node) => {
              if (node.geometry && node.geometry.attributes?.position) {
                TransformCompositionService.applyTransformToGeometry(node.geometry, siteMatrix);
              }
            });
          }
          
          exportLogger.info('Applied coordinate-aware site map transformations', {
            elevationOffset,
            unitConversionFactor,
            originalTransform: {
              position: siteMap.position,
              scale: siteMap.scale,
              rotation: siteMap.rotation
            },
            finalSiteMapPosition: siteMapClone.position
          });
        }
        
        exportScene.add(siteMapClone);
        }
      } catch (error) {
        validationLogger.warn('Failed to add site map:', error);
      }
    }

    // Add exportable labels (converted from CSS3D to 3D geometry)
    const exportableLabels = this.createExportableLabels(originalScene, soilLayers, boreholes, siteMap, displayOptions);
    exportScene.add(exportableLabels);
    
    return exportScene;
  }

  /**
   * Create soil layers optimized for export
   */
  createSoilLayersForExport(layers, strataDimensions) {
    const soilGroup = new Group();
    soilGroup.name = 'soil_layers';

    const defaultDimensions = {
      width: 131,
      depth: 131,
      ...strataDimensions
    };

    let currentY = 0;

    layers.forEach((layer, index) => {
      const layerDepth = parseFloat(layer.depth) || 1;
      
      // Create layer geometry
      const geometry = new BoxGeometry(
        defaultDimensions.width,
        layerDepth,
        defaultDimensions.depth
      );
      
      // Create layer material with proper colors - solid for clean export
      const color = new Color(layer.color || '#888888');
      const material = new MeshStandardMaterial({
        color: color,
        transparent: false, // Make solid for clean appearance
        opacity: 1.0,
        side: FrontSide,
        roughness: 0.6,
        metalness: 0.1,
        name: `layer_${index}_material`
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.name = `layer_${index}_${(layer.name || `Layer_${index + 1}`).replace(/\s+/g, '_')}`;
      
      // Position the layer
      mesh.position.set(0, currentY - layerDepth / 2, 0);
      
      // Set render order to prevent color bleeding (deeper layers render first)
      mesh.renderOrder = index;
      
      // Add comprehensive user data for metadata
      mesh.userData = {
        layerIndex: index,
        layerName: layer.name || `Layer ${index + 1}`,
        layerDepthFeet: layerDepth.toFixed(1),
        layerColor: layer.color || '#888888',
        layerDescription: layer.description || '',
        position: {
          x: 0,
          y: currentY - layerDepth / 2,
          z: 0
        },
        dimensions: {
          width: defaultDimensions.width,
          height: layerDepth,
          depth: defaultDimensions.depth
        },
        type: 'soil_layer'
      };
      
      soilGroup.add(mesh);
      currentY -= layerDepth;
    });

    return soilGroup;
  }

  /**
   * Create depth scale markers for export
   */
  createDepthScaleForExport(soilLayers, strataDimensions, boreholes) {
    // Calculate maximum depth from boreholes (matches VolumetricDepthScale component logic)
    let totalDepth = 0;
    
    if (boreholes && boreholes.length > 0) {
      // Use same logic as VolumetricDepthScale component
      let maxBoreholeDepth = 0;
      
      boreholes.forEach(borehole => {
        let boreholeDepth = 0;
        
        // Try different depth sources in order of preference (same as VolumetricDepthScale)
        if (borehole.totalDepth && borehole.totalDepth > 0) {
          boreholeDepth = borehole.totalDepth;
        } else if (borehole.depth && borehole.depth > 0) {
          boreholeDepth = borehole.depth;
        } else if (borehole.layers && borehole.layers.length > 0) {
          // Calculate depth from layers
          boreholeDepth = Math.max(...borehole.layers.map(layer => layer.to || 0));
        }
        
        maxBoreholeDepth = Math.max(maxBoreholeDepth, boreholeDepth);
      });
      
      totalDepth = maxBoreholeDepth;
    } else if (soilLayers && soilLayers.length > 0) {
      // Fallback to soil layers only if no boreholes available
      totalDepth = soilLayers.reduce((sum, layer) => sum + (parseFloat(layer.depth) || 1), 0);
    }
    
    // Ensure we have a minimum depth for display (same as VolumetricDepthScale)
    if (totalDepth <= 0) {
      totalDepth = 10; // Default 10 feet if no depth data
    }
    
    const depthGroup = new Group();
    depthGroup.name = 'depth_scale_export';
    
    // Position depth markers relative to strata dimensions
    const strataWidth = strataDimensions?.width || 131;
    const depthMarkerOffset = strataWidth / 2 + 6.56; // 6.56ft offset from strata edge
    const lineLength = 4.92; // 4.92ft line length
    
    // Add main vertical line
    const verticalLineGeometry = new BufferGeometry();
    const verticalPositions = new Float32Array([
      -depthMarkerOffset, 0, 0,
      -depthMarkerOffset, -totalDepth, 0
    ]);
    verticalLineGeometry.setAttribute('position', new BufferAttribute(verticalPositions, 3));
    
    const verticalLineMaterial = new LineBasicMaterial({ 
      color: 0xffffff,
      name: 'depth_scale_main_line'
    });
    const verticalLine = new Line(verticalLineGeometry, verticalLineMaterial);
    verticalLine.name = 'depth_scale_main_line';
    depthGroup.add(verticalLine);
    
    // Calculate appropriate interval based on total depth (same as VolumetricDepthScale)
    let interval; // in feet
    if (totalDepth < 10) interval = 2; // 2ft intervals for shallow models
    else if (totalDepth < 30) interval = 5; // 5ft intervals 
    else if (totalDepth < 100) interval = 10; // 10ft intervals
    else interval = 20; // 20ft intervals for deep models
    
    // Always include surface marker (depth = 0)
    const depthMarkers = [0];
    
    // Add intermediate markers
    let currentDepth = interval;
    while (currentDepth < totalDepth) {
      depthMarkers.push(currentDepth);
      currentDepth += interval;
    }
    
    // Always include bottom depth marker (max borehole depth)
    if (totalDepth > 0 && !depthMarkers.includes(totalDepth)) {
      depthMarkers.push(totalDepth);
    }
    
    depthMarkers.forEach(depth => {
      
      // Create depth marker tick line
      const lineGeometry = new BufferGeometry();
      const positions = new Float32Array([
        -depthMarkerOffset, -depth, 0,
        -depthMarkerOffset - lineLength, -depth, 0
      ]);
      lineGeometry.setAttribute('position', new BufferAttribute(positions, 3));
      
      const lineMaterial = new LineBasicMaterial({ 
        color: 0xffffff,
        name: `depth_marker_${depth}ft`
      });
      const line = new Line(lineGeometry, lineMaterial);
      line.name = `depth_marker_${depth.toFixed(1)}ft`;
      
      // Add depth value as user data
      line.userData = {
        type: 'depth_marker',
        depth_ft: depth.toFixed(1),
        isExportDepthScale: true
      };
      
      depthGroup.add(line);
    });
    
    // Add metadata to the group
    depthGroup.userData = {
      type: 'depth_scale',
      totalDepth_ft: totalDepth.toFixed(1),
      interval_ft: interval.toFixed(1),
      markerCount: depthMarkers.length,
      isExportDepthScale: true
    };
    
    return depthGroup;
  }

  /**
   * Create boreholes optimized for export
   */
  createBoreholesForExport(boreholes, exportOptions = {}) {
    const boreholeGroup = new Group();
    boreholeGroup.name = 'boreholes';
    
    // Get unit conversion factor for GLTF export
    const conversionFactor = UnitConverter.getConversionFactor(exportOptions.convertFeetToMeters);

    boreholes.forEach((borehole, index) => {
      const depth = borehole.depth || 32.8;
      const diameter = borehole.diameter || 0.49;
      
      // Create borehole geometry with converted depth
      const geometry = new CylinderGeometry(
        diameter / 2,  // Keep diameter the same (it's already small)
        diameter / 2,
        depth * conversionFactor,  // Apply unit conversion to depth
        16 // Higher resolution for export
      );
      
      // Use the extracted color from scene or fallback to borehole color
      const boreholeColor = borehole.extractedColor || borehole.color || '#2196F3';
      
      const material = new MeshStandardMaterial({
        color: new Color(boreholeColor),
        transparent: false, // Make solid for better appearance
        opacity: 1.0,
        roughness: 0.4,
        metalness: 0.2,
        name: `borehole_${index}_material`
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.name = `borehole_${index}_${(borehole.name || `BH_${index + 1}`).replace(/\s+/g, '_')}`;
      
      mesh.position.set(
        borehole.x || (index * 5),
        -(depth * conversionFactor) / 2,  // Apply unit conversion to Y position
        borehole.z || 0
      );
      
      // Add comprehensive user data
      mesh.userData = {
        boreholeIndex: index,
        boreholeName: borehole.name || `BH-${index + 1}`,
        depth: depth,
        depthFeet: depth.toFixed(1),  // Original depth in feet
        depthMeters: (depth * conversionFactor).toFixed(2),  // Converted depth if applicable
        diameter: diameter,
        diameterInches: (diameter * UNIT_CONVERSION.INCHES_PER_FOOT).toFixed(1),
        position: {
          x: borehole.x || (index * 5),
          y: borehole.y || 0,
          z: borehole.z || 0
        },
        elevation: borehole.y || 0,
        elevationFeet: (borehole.y || 0).toFixed(1), // Keep original elevation (already in feet)
        type: 'borehole',
        boreholeType: borehole.type || 'OTHER',
        color: borehole.color || '#795548',
        layers: borehole.layers ? borehole.layers.map(layer => ({
          id: layer.id,
          name: layer.name,
          thickness: layer.thickness,
          thicknessFeet: layer.thickness.toFixed(1) // Keep original thickness (already in feet)
        })) : []
      };
      
      boreholeGroup.add(mesh);
    });
    
    const conversionStatus = exportOptions.convertFeetToMeters ? 'with feet-to-meters conversion' : 'without unit conversion';
    exportLogger.info(`SceneExporter: Created ${boreholes.length} boreholes for export ${conversionStatus}`);

    return boreholeGroup;
  }

  /**
   * Create borehole strata visualization for export
   */
  createBoreholeStrataForExport(boreholes, soilLayers, originalScene = null) {
    const strataGroup = new Group();
    strataGroup.name = 'borehole_strata';

    boreholes.forEach((borehole, boreholeIndex) => {
      if (!borehole.layers || borehole.layers.length === 0) return;
      
      const boreholeStrataGroup = new Group();
      boreholeStrataGroup.name = `borehole_${boreholeIndex}_strata`;
      
      let currentDepth = 0;
      
      borehole.layers.forEach((layer, layerIndex) => {
        // Find the corresponding global layer for color
        const globalLayer = soilLayers.find(l => l.id === layer.id);
        const radius = (borehole.diameter / 2) * 3.0; // 3x diameter as implemented
        
        const geometry = new CylinderGeometry(
          radius,
          radius,
          layer.thickness || 1,
          16
        );
        
        // Try to find existing textured material from the original scene
        let existingMaterial = null;
        if (originalScene) {
          const strataMaterialName = `borehole_strata_${borehole.id}_${layer.id}`;
          originalScene.traverse((child) => {
            if (child.isMesh && child.material && 
                (child.material.name === strataMaterialName ||
                 child.material.name?.includes(`strata_${boreholeIndex}_${layerIndex}`) ||
                 (child.material.userData?.boreholeId === borehole.id && 
                  child.material.userData?.layerId === layer.id))) {
              existingMaterial = child.material;
              return; // Found it, stop searching
            }
          });
        }
        
        let material;
        if (existingMaterial && existingMaterial.map) {
          // Use existing textured material and clone it for export

          material = this.cloneMaterialForExport(existingMaterial);
        } else {
          // Fallback: Create new solid color material
          let strataColor = '#888888';
          if (globalLayer?.color) {
            strataColor = globalLayer.color;
          } else if (borehole.extractedColor) {
            strataColor = borehole.extractedColor;
          }
          
          material = new MeshStandardMaterial({
            color: new Color(strataColor),
            transparent: false, // Make solid for clean export
            opacity: 1.0,
            roughness: 0.7,
            metalness: 0.1,
            side: FrontSide,
            name: `strata_${boreholeIndex}_${layerIndex}_material`
          });

        }
        
        const mesh = new Mesh(geometry, material);
        mesh.name = `strata_${boreholeIndex}_layer_${layerIndex}`;
        
        mesh.position.set(
          borehole.x || (boreholeIndex * 5),
          borehole.y - currentDepth - ((layer.thickness || 1) / 2),
          borehole.z || 0
        );
        
        // Set render order to prevent color bleeding (deeper strata render first)
        mesh.renderOrder = 50 + layerIndex;
        
        mesh.userData = {
          boreholeId: borehole.id,
          boreholeName: borehole.name,
          layerId: layer.id,
          layerName: layer.name || globalLayer?.name || `Layer ${layerIndex + 1}`,
          thickness: layer.thickness || 1,
          thicknessFeet: (layer.thickness || 1).toFixed(1), // Keep original thickness (already in feet)
          color: globalLayer?.color || '#888888',
          type: 'borehole_strata_layer',
          hasTexture: existingMaterial && existingMaterial.map ? true : false,
          materialType: existingMaterial?.userData?.materialType || 'unknown'
        };
        
        boreholeStrataGroup.add(mesh);
        currentDepth += layer.thickness || 1;
      });
      
      strataGroup.add(boreholeStrataGroup);
    });

    return strataGroup;
  }

  /**
   * Preserve materials for GLTF export with proper color handling
   */
  preserveMaterialsForGLTF(object) {
    object.traverse((child) => {
      if (child.material) {
        // Handle both single materials and material arrays
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => this.cloneMaterialForExport(mat));
        } else {
          child.material = this.cloneMaterialForExport(child.material);
        }
      }
    });
  }

  /**
   * Clone and fix material for GLTF export with proper volumetric support and texture preservation
   */
  cloneMaterialForExport(originalMaterial) {
    // Deep clone the material to prevent reference issues
    const material = originalMaterial.clone();
    
    // Ensure color is properly preserved
    if (originalMaterial.color && originalMaterial.color.isColor) {
      material.color = originalMaterial.color.clone();
    }
    
    // Convert problematic material types for better GLTF compatibility
    if (material.type === 'LineBasicMaterial') {
      // Create a solid MeshBasicMaterial for GLTF compatibility
      const meshMaterial = new MeshBasicMaterial({
        color: material.color ? material.color.clone() : new Color(0xffffff),
        transparent: material.transparent,
        opacity: material.opacity,
        side: material.side,
        name: material.name
      });
      
      // Preserve any depth scale metadata
      if (originalMaterial.userData) {
        meshMaterial.userData = { ...originalMaterial.userData };
      }
      
      return meshMaterial;
    }
    
    // For volumetric Lambert materials, preserve transparency for internal structure visibility
    if (material.type === 'MeshLambertMaterial') {
      // Check if this is a volumetric geological model material
      const isVolumetric = (material.name && material.name.includes('volumetric')) || 
                          (originalMaterial.userData?.isVolumetricMaterial);
      
      if (isVolumetric) {
        // For volumetric materials, preserve textures and colors
        const standardMaterial = new MeshStandardMaterial({
          color: material.color ? material.color.clone() : new Color(0xffffff),
          transparent: false, // Make solid - transparency handled by simplified export
          opacity: 1.0,
          side: FrontSide,
          name: material.name,
          roughness: 0.6,
          metalness: 0.1
        });
        
        // *** CRITICAL: Preserve texture maps for textured strata ***
        if (originalMaterial.map && originalMaterial.userData?.hasTexture) {
          standardMaterial.map = originalMaterial.map.clone();
          standardMaterial.map.needsUpdate = true;

        }
        
        // Preserve emissive properties for self-illumination
        if (material.emissive) {
          standardMaterial.emissive = material.emissive.clone();
          standardMaterial.emissiveIntensity = material.emissiveIntensity || 0.05;
        }
        
        // Preserve userData for metadata
        if (originalMaterial.userData) {
          standardMaterial.userData = { ...originalMaterial.userData };
        }
        
        return standardMaterial;
      } else {
        // Non-volumetric Lambert materials - make more solid
        const standardMaterial = new MeshStandardMaterial({
          color: material.color ? material.color.clone() : new Color(0xffffff),
          transparent: material.transparent && material.opacity < 0.9,
          opacity: Math.max(0.8, material.opacity), // At least 80% opacity for solid objects
          side: material.side,
          name: material.name,
          roughness: 0.7,
          metalness: 0.1
        });
        
        // Preserve any texture maps (for water table markers, etc.)
        if (originalMaterial.map) {
          standardMaterial.map = originalMaterial.map.clone();
          standardMaterial.map.needsUpdate = true;

        }
        
        if (material.emissive) {
          standardMaterial.emissive = material.emissive.clone();
          standardMaterial.emissiveIntensity = material.emissiveIntensity || 0;
        }
        
        // Preserve userData for metadata
        if (originalMaterial.userData) {
          standardMaterial.userData = { ...originalMaterial.userData };
        }
        
        return standardMaterial;
      }
    }
    
    // For other materials (MeshStandardMaterial, MeshBasicMaterial, etc.)
    if (material.transparent && material.opacity < 1.0) {
      material.depthWrite = material.opacity > 0.8;
      material.alphaTest = 0.1;
      material.needsUpdate = true;
    }
    
    // Preserve texture maps for any material type
    if (originalMaterial.map && !material.map) {
      material.map = originalMaterial.map.clone();
      material.map.needsUpdate = true;

    }
    
    return material;
  }


  /**
   * Export scene to GLTF format
   */
  async exportSceneToGLTF(scene, options) {
    // Sample the final scene before GLTF export
    exportLogger.debug('Final scene before GLTF export');
    const sceneSample = [];
    scene.traverse((node) => {
      if (node.name && (node.name.includes('DepthScale') || node.name.includes('VolumetricGeological'))) {
        sceneSample.push({
          name: node.name,
          type: node.type,
          position: node.position.clone(),
          scale: node.scale.clone(),
          hasGeometry: !!node.geometry,
          vertexCount: node.geometry?.attributes?.position?.count || 0
        });
        
        // Sample some Y coordinates if it's a mesh
        if (node.geometry?.attributes?.position) {
          const positions = node.geometry.attributes.position.array;
          const yCoords = [];
          for (let i = 1; i < Math.min(positions.length, 30); i += 3) {
            yCoords.push(positions[i]);
          }
          if (yCoords.length > 0) {
            sceneSample[sceneSample.length - 1].sampleYCoords = yCoords.slice(0, 5);
            sceneSample[sceneSample.length - 1].maxY = Math.max(...yCoords);
            sceneSample[sceneSample.length - 1].minY = Math.min(...yCoords);
          }
        }
      }
    });
    exportLogger.debug('Scene sample data going into GLTF:', sceneSample);
    
    return new Promise((resolve, reject) => {
      this.gltfExporter.parse(
        scene,
        (result) => {
          exportLogger.debug('GLTF export completed, result type:', typeof result);

          // INJECT CUSTOM METADATA into GLTF to prevent viewer unit conversion
          if (result && typeof result === 'object') {
            // For JSON GLTF format
            if (result.asset) {
              const assetUnitMetadata = UnitConverter.createUnitMetadata(options.convertFeetToMeters);
              result.asset.extras = {
                ...result.asset.extras,
                coordinate_units: options.convertFeetToMeters ? 'meters_precompensated' : 'feet_raw',
                unit_interpretation: options.convertFeetToMeters ? 'pre_compensated_for_viewer_conversion' : 'raw_feet_values',
                viewer_instructions: assetUnitMetadata.viewer_instructions,
                geological_data: {
                  original_depth_units: assetUnitMetadata.original_app_units,
                  final_display_units: assetUnitMetadata.display_units,
                  coordinate_system: options.convertFeetToMeters ? 'pre_compensated_meters' : 'raw_feet',
                  pre_compensation_factor: assetUnitMetadata.unit_scale_factor,
                  viewer_conversion_expected: options.convertFeetToMeters,
                  math_explanation: options.convertFeetToMeters 
                    ? `(30ft ÷ ${UNIT_CONVERSION.METERS_TO_FEET} = ${UnitConverter.feetToMeters(30).toFixed(3)}) → viewer × ${UNIT_CONVERSION.METERS_TO_FEET} → displays 30ft correctly`
                    : `Raw 30ft coordinates → viewer may × ${UNIT_CONVERSION.METERS_TO_FEET} → displays 98.4ft incorrectly`
                }
              };
              
              exportLogger.debug('Injected unit metadata into GLTF asset', {
                coordinateUnits: result.asset.extras.coordinate_units,
                unitInterpretation: result.asset.extras.unit_interpretation,
                scaleFactor: result.asset.extras.geological_data.unit_scale_factor,
                conversionApplied: options.convertFeetToMeters
              });
            }
          }
          
          resolve(result);
        },
        (error) => {
          exportLogger.error('GLTF export failed:', error);
          reject(error);
        },
        options
      );
    });
  }

  /**
   * Create comprehensive geological metadata for professional export
   */
  createMetadata(soilLayers, boreholes, siteMap, displayOptions, strataDimensions, geologicalModel = null, waterTableData = null, textureData = null) {
    const safeSoilLayers = soilLayers || [];
    const safeBoreholes = boreholes || [];
    
    // Extract interpolation and confidence data from geological model
    let interpolationMetadata = {};
    let confidenceMetadata = {};
    
    if (geologicalModel && geologicalModel.interpolationStats) {
      interpolationMetadata = {
        method: geologicalModel.interpolationStats.interpolationMethod || 'idw',
        useAdvancedInterpolation: geologicalModel.interpolationStats.useAdvancedInterpolation || false,
        enableConfidenceMapping: geologicalModel.interpolationStats.enableConfidenceMapping || false,
        processingTime_ms: geologicalModel.processingTime,
        gridSize: geologicalModel.gridSize
      };
      
      // Add confidence statistics if available
      if (geologicalModel.interpolationStats.overallAvgConfidence !== undefined) {
        confidenceMetadata = {
          overallAvgConfidence: Number(geologicalModel.interpolationStats.overallAvgConfidence.toFixed(3)),
          minLayerConfidence: Number(geologicalModel.interpolationStats.minLayerConfidence.toFixed(3)),
          maxLayerConfidence: Number(geologicalModel.interpolationStats.maxLayerConfidence.toFixed(3)),
          confidenceDescription: this.getConfidenceDescription(geologicalModel.interpolationStats.overallAvgConfidence)
        };
      }
      
      // Add method-specific parameters
      if (geologicalModel.modelingSettings) {
        if (geologicalModel.modelingSettings.krigingVariogramModel) {
          interpolationMetadata.krigingVariogramModel = geologicalModel.modelingSettings.krigingVariogramModel;
        }
        if (geologicalModel.modelingSettings.rbfBasisFunction) {
          interpolationMetadata.rbfBasisFunction = geologicalModel.modelingSettings.rbfBasisFunction;
        }
      }
    }
    
    // Enhanced layer metadata with interpolation quality
    const layerMetadata = safeSoilLayers.map((layer, index) => {
      const baseLayerData = {
        name: layer.name || `Layer ${index + 1}`,
        depth_ft: (parseFloat(layer.depth) || 3.28).toFixed(1),
        color: layer.color || '#888888',
        description: layer.description || '',
        layerIndex: index
      };
      
      // Add interpolation quality if available from geological model
      if (geologicalModel && geologicalModel.layers) {
        const modelLayer = geologicalModel.layers.find(l => l.material === layer.name);
        if (modelLayer && modelLayer.interpolationQuality) {
          baseLayerData.interpolationQuality = {
            avgConfidence: modelLayer.interpolationQuality.avgConfidence ? 
              Number(modelLayer.interpolationQuality.avgConfidence.toFixed(3)) : undefined,
            minConfidence: modelLayer.interpolationQuality.minConfidence ? 
              Number(modelLayer.interpolationQuality.minConfidence.toFixed(3)) : undefined,
            maxConfidence: modelLayer.interpolationQuality.maxConfidence ? 
              Number(modelLayer.interpolationQuality.maxConfidence.toFixed(3)) : undefined,
            interpolationMethod: modelLayer.interpolationQuality.interpolationMethod,
            confidencePoints: modelLayer.interpolationQuality.confidencePoints
          };
        }
      }
      
      return baseLayerData;
    });
    
    // Enhanced borehole metadata with water table information
    const boreholeMetadata = safeBoreholes.map((borehole, index) => {
      const baseMetadata = {
        name: borehole.name || `BH-${index + 1}`,
        coordinates: {
          x_ft: (borehole.x || (index * 16.4)).toFixed(1),
          y_ft: (borehole.y || 0).toFixed(1),
          z_ft: (borehole.z || 0).toFixed(1)
        },
        depth_ft: (borehole.depth || 32.8).toFixed(1),
        diameter_ft: (borehole.diameter || 0.49).toFixed(2),
        diameter_in: feetToInches(borehole.diameter || 0.49).toFixed(1),
        type: borehole.type || 'OTHER',
        layerCount: borehole.layers ? borehole.layers.length : 0,
        layers: borehole.layers ? borehole.layers.map(layer => ({
          name: layer.name,
          thickness_ft: (layer.thickness || 3.28).toFixed(1),
          description: layer.description || ''
        })) : []
      };

      // Add water table information if available
      if (borehole.waterTableEncountered && (borehole.waterTableDepth !== null || borehole.waterTableElevation !== null)) {
        baseMetadata.waterTable = {
          encountered: true,
          depth_ft: borehole.waterTableDepth ? borehole.waterTableDepth.toFixed(1) : null,
          elevation_ft: borehole.waterTableElevation ? borehole.waterTableElevation.toFixed(1) : null,
          surfaceElevation_ft: borehole.surfaceElevation ? borehole.surfaceElevation.toFixed(1) : null
        };
      } else {
        baseMetadata.waterTable = {
          encountered: false
        };
      }

      return baseMetadata;
    });
    
    // Site extent metadata
    const siteMetadata = {
      extent_ft: {
        width: (strataDimensions?.width || 131).toFixed(1),
        depth: (strataDimensions?.depth || 131).toFixed(1),
        height: (strataDimensions?.height || 65.6).toFixed(1)
      },
      area_ft2: ((strataDimensions?.width || 131) * (strataDimensions?.depth || 131)).toFixed(2)
    };
    
    // Water table metadata if available
    let waterTableMetadata = null;
    if (waterTableData) {
      const waterTableBoreholes = safeBoreholes.filter(bh => bh.waterTableEncountered && 
        (bh.waterTableDepth !== null || bh.waterTableElevation !== null));
      
      waterTableMetadata = {
        enabled: waterTableData.enabled || false,
        dataPoints: waterTableBoreholes.length,
        interpolationMethod: waterTableData.settings?.interpolationMethod || 'auto',
        surfaceGenerated: waterTableData.surface && waterTableData.surface.length > 0,
        settings: {
          opacity: waterTableData.settings?.opacity || 0.7,
          color: waterTableData.settings?.color || '#1976D2',
          showContours: waterTableData.settings?.showContours || true,
          contourInterval: waterTableData.settings?.contourInterval || 'medium',
          visible: waterTableData.settings?.visible !== false
        },
        statistics: waterTableBoreholes.length > 0 ? {
          minDepth_ft: Math.min(...waterTableBoreholes.map(bh => bh.waterTableDepth).filter(d => d !== null)).toFixed(1),
          maxDepth_ft: Math.max(...waterTableBoreholes.map(bh => bh.waterTableDepth).filter(d => d !== null)).toFixed(1),
          avgDepth_ft: (waterTableBoreholes.reduce((sum, bh) => sum + (bh.waterTableDepth || 0), 0) / waterTableBoreholes.length).toFixed(1),
          minElevation_ft: Math.min(...waterTableBoreholes.map(bh => bh.waterTableElevation).filter(e => e !== null)).toFixed(1),
          maxElevation_ft: Math.max(...waterTableBoreholes.map(bh => bh.waterTableElevation).filter(e => e !== null)).toFixed(1)
        } : null
      };
    }

    // Soil texture metadata if available
    let textureMetadata = null;
    if (textureData) {
      textureMetadata = {
        enabled: textureData.enabled || false,
        ready: textureData.ready || false,
        globalSettings: {
          defaultPattern: textureData.settings?.defaultPattern || 'horizontal-lines',
          globalIntensity: textureData.settings?.globalIntensity || 0.3,
          globalScale: textureData.settings?.globalScale || 1.0,
          useAtlas: textureData.settings?.useAtlas !== false
        },
        customizedMaterials: Object.keys(textureData.settings?.perMaterialSettings || {}).length,
        perMaterialSettings: textureData.settings?.perMaterialSettings || {},
        availablePatterns: textureData.availablePatterns ? Object.keys(textureData.availablePatterns) : [
          'none', 'horizontal-lines', 'dots', 'circles', 'cross-hatch', 'diagonal-lines'
        ]
      };
    }
    
    return {
      export: {
        date: new Date().toISOString(),
        format: 'GLB',
        software: 'GeoTech Visualizer',
        version: '2.0',
        exportType: 'Professional Geological Model',
        coordinate_system: 'Local Engineering Coordinates',
        units: {
          length: 'feet',
          elevation: 'feet_above_reference'
        }
      },
      interpolation: interpolationMetadata,
      confidence: confidenceMetadata,
      layers: layerMetadata,
      boreholes: boreholeMetadata,
      site: siteMetadata,
      depthScale: this.createDepthScaleMetadata(safeSoilLayers, safeBoreholes),
      waterTable: waterTableMetadata,
      textures: textureMetadata,
      quality: {
        dataPoints: safeBoreholes.length,
        layerTypes: safeSoilLayers.length,
        spatialCoverage: this.calculateSpatialCoverage(safeBoreholes, strataDimensions),
        modelComplexity: this.calculateModelComplexity(geologicalModel),
        enhancementsActive: {
          waterTable: waterTableMetadata?.enabled || false,
          textures: textureMetadata?.enabled || false
        }
      }
    };
  }
  
  /**
   * Create depth scale metadata for export
   */
  createDepthScaleMetadata(soilLayers, boreholes) {
    // Use same depth calculation logic as createDepthScaleForExport and VolumetricDepthScale
    let totalDepth = 0;
    let depthSource = 'none';
    
    if (boreholes && boreholes.length > 0) {
      // Use same logic as VolumetricDepthScale component
      let maxBoreholeDepth = 0;
      
      boreholes.forEach(borehole => {
        let boreholeDepth = 0;
        
        // Try different depth sources in order of preference
        if (borehole.totalDepth && borehole.totalDepth > 0) {
          boreholeDepth = borehole.totalDepth;
        } else if (borehole.depth && borehole.depth > 0) {
          boreholeDepth = borehole.depth;
        } else if (borehole.layers && borehole.layers.length > 0) {
          // Calculate depth from layers
          boreholeDepth = Math.max(...borehole.layers.map(layer => layer.to || 0));
        }
        
        maxBoreholeDepth = Math.max(maxBoreholeDepth, boreholeDepth);
      });
      
      totalDepth = maxBoreholeDepth;
      depthSource = 'boreholes';
    } else if (soilLayers && soilLayers.length > 0) {
      // Fallback to soil layers only if no boreholes available
      totalDepth = soilLayers.reduce((sum, layer) => sum + (parseFloat(layer.depth) || 3.28), 0);
      depthSource = 'strata_layers';
    }
    
    // Ensure we have a minimum depth for display (same as VolumetricDepthScale)
    if (totalDepth <= 0) {
      totalDepth = 10; // Default 10 feet if no depth data
      depthSource = 'default';
    }
    
    // Calculate appropriate interval based on total depth (same as VolumetricDepthScale)
    let interval; // in feet
    if (totalDepth < 10) interval = 2; // 2ft intervals for shallow models
    else if (totalDepth < 30) interval = 5; // 5ft intervals 
    else if (totalDepth < 100) interval = 10; // 10ft intervals
    else interval = 20; // 20ft intervals for deep models
    
    // Calculate actual depth markers (same logic as createDepthScaleForExport)
    const depthMarkers = [0];
    let currentDepth = interval;
    while (currentDepth < totalDepth) {
      depthMarkers.push(currentDepth);
      currentDepth += interval;
    }
    if (totalDepth > 0 && !depthMarkers.includes(totalDepth)) {
      depthMarkers.push(totalDepth);
    }
    
    return {
      enabled: true,
      totalDepth_ft: totalDepth.toFixed(1),
      interval_ft: interval.toFixed(1),
      markerCount: depthMarkers.length,
      depthSource: depthSource,
      markers: depthMarkers.map(depth => ({
          depth_ft: depth.toFixed(1),
          position: `${depth.toFixed(1)}ft below surface`
        })),
      description: `Depth scale markers positioned every ${interval} feet for reference`
    };
  }

  /**
   * Get human-readable confidence description
   */
  getConfidenceDescription(confidence) {
    if (confidence >= 0.8) return 'High - Excellent interpolation reliability';
    if (confidence >= 0.6) return 'Medium-High - Good interpolation reliability';
    if (confidence >= 0.4) return 'Medium - Acceptable interpolation reliability';
    if (confidence >= 0.2) return 'Low - Limited interpolation reliability';
    return 'Very Low - Use with caution';
  }
  
  /**
   * Calculate spatial coverage quality metric
   */
  calculateSpatialCoverage(boreholes, dimensions) {
    if (boreholes.length < 3) return 'Insufficient';
    
    const area = (dimensions?.width || 40) * (dimensions?.depth || 40);
    const density = boreholes.length / area;
    
    if (density >= 0.1) return 'Excellent';
    if (density >= 0.05) return 'Good';
    if (density >= 0.025) return 'Adequate';
    return 'Sparse';
  }
  
  /**
   * Calculate model complexity metric
   */
  calculateModelComplexity(geologicalModel) {
    if (!geologicalModel) return 'Basic';
    
    const layerCount = geologicalModel.layers?.length || 0;
    const vertexCount = geologicalModel.statistics?.totalVertices || 0;
    const useAdvanced = geologicalModel.interpolationStats?.useAdvancedInterpolation || false;
    
    if (useAdvanced && layerCount >= 5 && vertexCount >= 10000) return 'High Detail Professional';
    if (useAdvanced && layerCount >= 3) return 'Professional';
    if (layerCount >= 5) return 'Detailed';
    if (layerCount >= 3) return 'Standard';
    return 'Simple';
  }

  /**
   * Generate filename for export
   */
  generateExportFilename(prefix = 'geotech_export') {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    return `${prefix}_${timestamp}.glb`;
  }

  /**
   * Generate metadata filename
   */
  generateMetadataFilename(prefix = 'geotech_export') {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    return `${prefix}_metadata_${timestamp}.json`;
  }

  /**
   * Download the exported file
   */
  downloadFile(data, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  }

  /**
   * Download metadata as JSON
   */
  downloadMetadata(metadata, filename) {
    const jsonData = JSON.stringify(metadata, null, 2);
    this.downloadFile(jsonData, filename, 'application/json');
  }

  /**
   * Export scene as high-resolution image
   */
  async exportToImage(renderer, scene, camera, options = {}) {
    const {
      width = 1920,
      height = 1080,
      format = 'png',
      quality = 0.95
    } = options;

    // Store original renderer size
    const originalSize = renderer.getSize(new Vector2());
    
    try {
      // Set high resolution for export
      renderer.setSize(width, height, false);
      
      // Render the scene
      renderer.render(scene, camera);
      
      // Get the canvas data
      const canvas = renderer.domElement;
      const dataURL = canvas.toDataURL(`image/${format}`, quality);
      
      return {
        dataURL,
        width,
        height,
        format
      };
      
    } finally {
      // Restore original size
      renderer.setSize(originalSize.x, originalSize.y, false);
    }
  }

  /**
   * Export scene as PDF with metadata
   */
  async exportToPDF(renderer, scene, camera, metadata, options = {}) {
    const {
      width = 1920,
      height = 1080,
      title = 'GeoTech Visualization Export',
      includeMetadata = true
    } = options;

    // Get high-resolution image
    const imageData = await this.exportToImage(renderer, scene, camera, { width, height });
    
    // Create PDF content
    const pdfContent = this.createPDFContent(imageData, metadata, { title, includeMetadata });
    
    return pdfContent;
  }

  /**
   * Create PDF content with image and metadata
   */
  createPDFContent(imageData, metadata, options) {
    const { title, includeMetadata } = options;
    
    // Simple PDF-like structure (basic implementation)
    // For production, you'd want to use a library like jsPDF
    const pdfData = {
      title,
      image: imageData,
      metadata: includeMetadata ? metadata : null,
      createdAt: new Date().toISOString()
    };
    
    return pdfData;
  }

  /**
   * Download image file
   */
  downloadImage(dataURL, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate image filename
   */
  generateImageFilename(prefix = 'geotech_export', format = 'png') {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    return `${prefix}_${timestamp}.${format}`;
  }

  /**
   * Export multiple views for comprehensive documentation
   */
  async exportMultipleViews(renderer, scene, camera, metadata, options = {}) {
    const {
      includeTopView = true,
      includeSideView = true,
      includeIsometricView = true,
      resolution = { width: 1920, height: 1080 }
    } = options;

    const views = [];
    const originalPosition = camera.position.clone();

    try {
      // Current view
      const currentView = await this.exportToImage(renderer, scene, camera, resolution);
      views.push({
        name: 'Current View',
        data: currentView,
        cameraPosition: camera.position.clone()
      });

      // Top view
      if (includeTopView) {
        camera.position.set(0, 50, 0);
        camera.lookAt(0, 0, 0);
        const topView = await this.exportToImage(renderer, scene, camera, resolution);
        views.push({
          name: 'Top View',
          data: topView,
          cameraPosition: camera.position.clone()
        });
      }

      // Side view
      if (includeSideView) {
        camera.position.set(50, 0, 0);
        camera.lookAt(0, 0, 0);
        const sideView = await this.exportToImage(renderer, scene, camera, resolution);
        views.push({
          name: 'Side View',
          data: sideView,
          cameraPosition: camera.position.clone()
        });
      }

      // Isometric view
      if (includeIsometricView) {
        camera.position.set(30, 30, 30);
        camera.lookAt(0, 0, 0);
        const isoView = await this.exportToImage(renderer, scene, camera, resolution);
        views.push({
          name: 'Isometric View',
          data: isoView,
          cameraPosition: camera.position.clone()
        });
      }

      return views;

    } finally {
      // Restore original camera position
      camera.position.copy(originalPosition);
      camera.lookAt(0, 0, 0);
    }
  }

  /**
   * Create 3D text geometry for labels (fallback when font isn't available)
   */
  createAdvanced3DTextLabel(text, position, options = {}) {
    const {
      size = 0.5,
      color = 0xffffff,
      backgroundColor = 0x000000,
      backgroundOpacity = 0.7,
      name = 'text_label'
    } = options;

    const group = new Group();
    group.name = name;

    try {
      // Create background plane with glassmorphism-like appearance
      const backgroundGeometry = new PlaneGeometry(text.length * size * 0.6, size * 1.5);
      const backgroundMaterial = new MeshStandardMaterial({
        color: backgroundColor,
        transparent: true,
        opacity: backgroundOpacity,
        side: DoubleSide,
        name: `${name}_background`
      });
      
      const backgroundMesh = new Mesh(backgroundGeometry, backgroundMaterial);
      backgroundMesh.name = `${name}_background_mesh`;
      group.add(backgroundMesh);

      // Create text using canvas texture as fallback
      const textMesh = this.createCanvasTextMesh(text, {
        size: size * 0.8,
        backgroundColor: backgroundColor,
        name: `${name}_text`,
        labelType: 'layer'
      });
      
      textMesh.position.set(0, 0, 0.01); // Slightly in front of background
      group.add(textMesh);

    } catch (error) {
      validationLogger.warn('Failed to create 3D text label:', error);
      // Create a simple plane as fallback
      const fallbackGeometry = new PlaneGeometry(text.length * size * 0.6, size * 1.5);
      const fallbackMaterial = new MeshStandardMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        side: DoubleSide,
        name: `${name}_fallback`
      });
      
      const fallbackMesh = new Mesh(fallbackGeometry, fallbackMaterial);
      fallbackMesh.name = `${name}_fallback_mesh`;
      group.add(fallbackMesh);
    }

    // Position and add metadata
    group.position.copy(position);
    group.userData = {
      type: 'text_label',
      text: text,
      originalText: text,
      isExportLabel: true,
      ...options
    };

    return group;
  }

  /**
   * Create text mesh using canvas texture
   */
  createCanvasTextMesh(text, options = {}) {
    const {
      size = 0.5,
      backgroundColor = 'rgba(0,0,0,0.7)',
      name = 'canvas_text',
      labelType = 'layer' // 'layer', 'depth', 'borehole-pin'
    } = options;

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Dynamic sizing based on text content and type
    const fontSize = labelType === 'depth' ? 48 : labelType === 'borehole-pin' ? 36 : 54;
    const padding = labelType === 'depth' ? 24 : labelType === 'borehole-pin' ? 16 : 32;
    const borderRadius = labelType === 'depth' ? 16 : labelType === 'borehole-pin' ? 16 : 24;
    
    // Measure text for dynamic canvas sizing
    context.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    const textLines = text.split('\n');
    const maxLineWidth = Math.max(...textLines.map(line => context.measureText(line).width));
    
    canvas.width = Math.max(300, maxLineWidth + padding * 2);
    canvas.height = Math.max(120, (textLines.length * fontSize * 1.2) + padding * 2);
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create glassmorphism-style background
    this.drawGlassmorphismBackground(context, canvas.width, canvas.height, borderRadius, backgroundColor, labelType);
    
    // Configure text style
    context.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add strong text shadow for better contrast against dark background
    context.shadowColor = 'rgba(0, 0, 0, 0.8)'; // Darker shadow
    context.shadowBlur = 4; // Slightly more blur
    context.shadowOffsetX = 1; // Small horizontal offset
    context.shadowOffsetY = 2; // Increased vertical offset
    
    // Draw text lines
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = textLines.length * lineHeight;
    const startY = (canvas.height - totalTextHeight) / 2 + lineHeight / 2;
    
    textLines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
    
    // Create texture from canvas
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create material
    const material = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      side: DoubleSide,
      name: `${name}_material`
    });
    
    // Create geometry with proper aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    const geometry = new PlaneGeometry(size * aspectRatio, size);
    
    // Create mesh
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    
    return mesh;
  }

  /**
   * Draw glassmorphism-style background on canvas
   */
  drawGlassmorphismBackground(context, width, height, borderRadius, backgroundColor, labelType) {
    // Save context
    context.save();
    
    // Create rounded rectangle path
    const createRoundedRect = (x, y, w, h, r) => {
      context.beginPath();
      context.moveTo(x + r, y);
      context.lineTo(x + w - r, y);
      context.quadraticCurveTo(x + w, y, x + w, y + r);
      context.lineTo(x + w, y + h - r);
      context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      context.lineTo(x + r, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - r);
      context.lineTo(x, y + r);
      context.quadraticCurveTo(x, y, x + r, y);
      context.closePath();
    };
    
    // Main background with gradient (simulating glassmorphism)
    createRoundedRect(0, 0, width, height, borderRadius);
    
    // Create gradient for depth effect with much higher opacity for readability
    const gradient = context.createLinearGradient(0, 0, 0, height);
    if (labelType === 'borehole-pin') {
      // Darker blue background for borehole pins
      gradient.addColorStop(0, 'rgba(33, 150, 243, 0.85)'); // Much darker - was 0.15
      gradient.addColorStop(1, 'rgba(21, 101, 192, 0.75)'); // Much darker - was 0.08
    } else if (labelType === 'depth') {
      // Darker background for depth markers
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); // Much darker - was white 0.06
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.65)'); // Much darker - was white 0.04
    } else {
      // Much darker background for layer labels with layer color tint
      let baseR = 0, baseG = 0, baseB = 0;
      
      // Parse layer color for subtle tint
      if (backgroundColor && backgroundColor !== 'transparent') {
        try {
          // Handle hex colors
          if (backgroundColor.startsWith('#')) {
            const hex = backgroundColor.replace('#', '');
            baseR = parseInt(hex.substr(0, 2), 16);
            baseG = parseInt(hex.substr(2, 2), 16);
            baseB = parseInt(hex.substr(4, 2), 16);
          } else {
            // Handle rgba colors
            const colorMatch = backgroundColor.match(/rgba?\(([^)]+)\)/);
            if (colorMatch) {
              [baseR, baseG, baseB] = colorMatch[1].split(',').map(n => parseInt(n.trim()));
            }
          }
          
          // Create gradient with layer color tint but much darker
          gradient.addColorStop(0, `rgba(${Math.min(baseR + 40, 255)}, ${Math.min(baseG + 40, 255)}, ${Math.min(baseB + 40, 255)}, 0.85)`);
          gradient.addColorStop(1, `rgba(${Math.max(baseR - 20, 0)}, ${Math.max(baseG - 20, 0)}, ${Math.max(baseB - 20, 0)}, 0.75)`);
        } catch (e) {
          // Fallback to dark background
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        }
      } else {
        // Default dark background
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
      }
    }
    
    context.fillStyle = gradient;
    context.fill();
    
    // Border with stronger contrast for darker background
    createRoundedRect(0, 0, width, height, borderRadius);
    if (labelType === 'borehole-pin') {
      context.strokeStyle = 'rgba(33, 150, 243, 0.8)'; // Increased from 0.3
    } else if (labelType === 'depth') {
      context.strokeStyle = 'rgba(255, 255, 255, 0.6)'; // White border for dark depth markers
    } else {
      context.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // Increased from 0.15
    }
    context.lineWidth = 1;
    context.stroke();
    
    // Inner highlight for glassmorphism effect
    createRoundedRect(1, 1, width - 2, height - 2, borderRadius - 1);
    context.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Increased from 0.2 for better contrast
    context.lineWidth = 0.5;
    context.stroke();
    
    // Add enhanced shadow effect for darker backgrounds
    if (labelType === 'borehole-pin') {
      context.shadowColor = 'rgba(33, 150, 243, 0.6)';
    } else if (labelType === 'depth') {
      context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    } else {
      context.shadowColor = 'rgba(0, 0, 0, 0.7)';
    }
    context.shadowBlur = 20; // Increased for more pronounced effect
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 6; // Increased offset
    
    // Fill again to apply shadow
    createRoundedRect(0, 0, width, height, borderRadius);
    context.fillStyle = 'rgba(0, 0, 0, 0)'; // Transparent fill to apply shadow
    context.fill();
    
    // Restore context
    context.restore();
  }

  /**
   * Convert CSS3D labels to 3D geometry for export
   */
  createExportableLabels(originalScene, soilLayers, boreholes, siteMap, displayOptions) {
    
    const labelGroup = new Group();
    labelGroup.name = 'export_labels';

    // Creating exportable labels for export

    // Calculate strata dimensions for dynamic positioning
    const strataDimensions = this.getStrataDimensions(originalScene, displayOptions);
    const strataEdgeX = strataDimensions.width / 2;
    const strataScaleFactor = Math.max(0.5, Math.max(strataDimensions.width, strataDimensions.depth) / 5);

    // Create layer labels (avoid duplicates) - positioned based on actual model dimensions
    if (soilLayers && soilLayers.length > 0) {
      const createdLayerLabels = new Set(); // Track created labels to avoid duplicates
      const uniqueLayers = []; // Store unique layers for positioning
      
      // First, collect unique layer types
      soilLayers.forEach((layer, index) => {
        const layerKey = layer.name?.toLowerCase() || layer.id || `layer_type_${index}`;
        if (!createdLayerLabels.has(layerKey)) {
          uniqueLayers.push({
            ...layer,
            key: layerKey,
            originalIndex: index
          });
          createdLayerLabels.add(layerKey);
        }
      });
      
      
      // Calculate positioning parameters with validation
      const validWidth = Math.max(strataDimensions.width || 10, 1); // Prevent division by zero
      const validDepth = Math.max(strataDimensions.depth || 10, 1);
      const modelScale = Math.max(validWidth, validDepth) / 40; // Relative to default 40x40
      const safeScaleFactor = Math.max(strataScaleFactor || 1, 0.1); // Prevent zero scale
      const labelGapFromEdge = Math.max(4, 0.5 * safeScaleFactor * modelScale); // Further increased gap
      const labelAttachX = strataEdgeX + labelGapFromEdge;
      const lineToElementGap = 0.1 * safeScaleFactor * modelScale; // Further increased spacing
      
      uniqueLayers.forEach((layer, uniqueIndex) => {
        // Calculate position based on actual model Y range, not centered around 0
        let layerYPosition;
        if (uniqueLayers.length === 1) {
          // Single layer - position at model center
          layerYPosition = strataDimensions.centerY || 0;
        } else {
          // Multiple layers - distribute from top to bottom of actual model
          const layerFraction = uniqueIndex / (uniqueLayers.length - 1);
          const modelTop = strataDimensions.maxY !== undefined ? strataDimensions.maxY : (strataDimensions.height / 2);
          layerYPosition = modelTop - (layerFraction * strataDimensions.height);
        }
        
        // Create main layer label with updated styling
        const layerText = `${layer.name || `Layer ${uniqueIndex + 1}`}: ${layer.description || 'No description'}`;
        
        // Calculate final label position - moved much further from model
        const finalLabelX = labelAttachX - lineToElementGap + (10 * modelScale); // Increased from 6x to 10x
        const labelPosition = new Vector3(finalLabelX, layerYPosition, 0);
        
        // Make labels larger and more readable - increased scale
        const labelSize = Math.max(0.6, 1.8 * modelScale * 0.8); // Increased base size and scale
        
        const layerLabel = this.createCanvasTextMesh(layerText, {
          size: labelSize,
          backgroundColor: layer.color || '#CCCCCC',
          name: `layer_${uniqueIndex}_label`,
          labelType: 'layer'
        });
        
        layerLabel.position.copy(labelPosition);
        labelGroup.add(layerLabel);
      });
      
    }

    // Create depth scale labels (avoid duplicates) - based on actual model height
    if (displayOptions?.showDepthMarkers !== false) {
      // Use actual model height instead of sum of extracted layers
      const modelHeight = strataDimensions.height;
      const depthInterval = calculateDepthInterval(modelHeight); // Use standardized interval calculation
      
      // Position depth markers relative to strata edge with much larger offset
      const depthMarkerOffset = strataDimensions.width / 2 + (0.8 * strataScaleFactor); // Further increased offset
      const lineXPosition = -depthMarkerOffset;
      const scaledTickLength = 0.6 * strataScaleFactor; // Further increased tick length
      const modelScale = Math.max(strataDimensions.width, strataDimensions.depth) / 40;
      const scaledGapFromTick = 0.25 * strataScaleFactor * modelScale; // Further increased gap
      
      const createdDepthMarkers = new Set(); // Track created markers to avoid duplicates
      
      // Create markers from top to bottom of the actual model Y range
      for (let depth = 0; depth <= modelHeight; depth += depthInterval) {
        const depthKey = `depth_${depth}`;
        
        if (!createdDepthMarkers.has(depthKey)) {
          const depthInFeet = depth.toFixed(1); // Keep original depth (already in feet)
          const depthText = `${depthInFeet}'`;
          
          // Position relative to actual model top, not centered around 0
          const modelTop = strataDimensions.maxY !== undefined ? strataDimensions.maxY : (modelHeight / 2);
          const yPosition = modelTop - depth;
          
          // Calculate final marker position - moved much further from model
          const finalMarkerX = lineXPosition - scaledTickLength - scaledGapFromTick - (0.6 * modelScale);
          const depthPosition = new Vector3(finalMarkerX, yPosition, 0);
          
          // Make depth markers larger and more readable
          const markerSize = Math.max(0.5, 1.2 * modelScale * 0.8); // Increased size
          
          const depthLabel = this.createCanvasTextMesh(depthText, {
            size: markerSize,
            backgroundColor: '#ffffff',
            name: `depth_${depth}_label`,
            labelType: 'depth'
          });
          
          depthLabel.position.copy(depthPosition);
          labelGroup.add(depthLabel);
          createdDepthMarkers.add(depthKey);
        }
      }
    }

    // Create borehole labels (compact pin format)
    if (boreholes && boreholes.length > 0) {
      boreholes.forEach((borehole, index) => {
        // Create compact label with format "BH-2 @ 10'" (matching live app)
        const depthInFeet = (borehole.depth || 10).toFixed(1); // Keep original depth (already in feet)
        const boreholeText = `${borehole.name || 'BH'} @ ${depthInFeet}'`;
        
        // Position label slightly above and to the side of the borehole marker
        const labelOffset = 0.6;
        const boreholePosition = new Vector3(
          (borehole.x || (index * 5)) + 0.5, // Slight offset to the right
          (borehole.y || 0) + labelOffset,   // Above the marker
          (borehole.z || 0)                  // Same Z position
        );
        
        const boreholeLabel = this.createCanvasTextMesh(boreholeText, {
          size: 0.6,
          backgroundColor: '#2196F3',
          name: `borehole_${index}_label`,
          labelType: 'borehole-pin'
        });
        
        boreholeLabel.position.copy(boreholePosition);
        labelGroup.add(boreholeLabel);
      });
    }

    return labelGroup;
  }

  /**
   * Create simplified volumetric export without Z-fighting and black splotches
   */
  createSimplifiedVolumetricExport(volumetricObject, soilLayers) {
    try {
      const simplifiedGroup = new Group();
      simplifiedGroup.name = 'SimplifiedVolumetricExport';
      
      // Extract meshes from the volumetric object and organize by layer depth/position
      const layerMeshes = new Map();
      const allMeshes = [];
      
      volumetricObject.traverse((child) => {
        if (child.isMesh && child.material) {
          // Calculate mesh's world position for layer sorting
          child.updateMatrixWorld(true);
          const worldPosition = new Vector3();
          child.getWorldPosition(worldPosition);
          
          allMeshes.push({
            mesh: child,
            yPosition: worldPosition.y,
            material: child.material,
            userData: child.userData || {}
          });
        }
      });
      
      // If we have few or no meshes, fall back to soil layer approach
      if (allMeshes.length === 0) {
        return this.createDirectSoilLayerExport(soilLayers, { width: 40, depth: 40 });
      }
      
      // Sort meshes by Y position (top to bottom) to match layer order
      allMeshes.sort((a, b) => b.yPosition - a.yPosition);
      
      // Group meshes by similar Y positions (same layer)
      const positionTolerance = 2.0; // Meshes within 2 units are considered same layer
      let currentLayerIndex = 0;
      let lastYPosition = allMeshes.length > 0 ? allMeshes[0].yPosition : 0;
      
      for (const meshData of allMeshes) {
        // If Y position dropped significantly, move to next layer
        if (Math.abs(meshData.yPosition - lastYPosition) > positionTolerance) {
          currentLayerIndex++;
          lastYPosition = meshData.yPosition;
        }
        
        const layerKey = `layer_${currentLayerIndex}`;
        if (!layerMeshes.has(layerKey)) {
          layerMeshes.set(layerKey, []);
        }
        layerMeshes.get(layerKey).push(meshData.mesh);
      }
      
      // Process the volumetric meshes to extract actual colors from the live model
      let layerIndex = 0;
      const layerSpacing = 0.1; // Small gap between layers to prevent Z-fighting
      
      for (const [layerKey, meshes] of layerMeshes) {
        if (meshes.length === 0) continue;
        
        // Extract the actual color from the volumetric model materials
        let layerColor = null;
        
        // Look through all meshes to find the best representative color
        const colorCandidates = [];
        for (const mesh of meshes) {
          if (mesh.material && mesh.material.color && mesh.material.color.isColor) {
            const meshColor = mesh.material.color;
            
            // Collect all non-default colors
            if (!this.isDefaultGrayColor(meshColor)) {
              colorCandidates.push({
                color: meshColor.clone(),
                saturation: this.getColorSaturation(meshColor),
                brightness: this.getColorBrightness(meshColor)
              });
            }
          }
        }
        
        // Choose the most representative color (highest saturation/brightness)
        if (colorCandidates.length > 0) {
          colorCandidates.sort((a, b) => (b.saturation + b.brightness) - (a.saturation + a.brightness));
          layerColor = colorCandidates[0].color;
        }
        
        // If no good color found from meshes, try to match with soil layers
        if (!layerColor && soilLayers) {
          const currentIndex = layerIndex; // Capture layerIndex to avoid loop warning
          const matchingSoilLayer = soilLayers.find((layer, idx) => 
            idx === currentIndex || // Try index matching first
            layer.name?.toLowerCase().includes(layerKey.toLowerCase()) ||
            layerKey.toLowerCase().includes(layer.name?.toLowerCase())
          );
          
          if (matchingSoilLayer?.color) {
            layerColor = new Color(matchingSoilLayer.color);
          }
        }
        
        // Final fallback - use distinct geological colors based on layer index
        if (!layerColor) {
          const geologicalColors = ['#8B4513', '#F4A460', '#DEB887', '#708090', '#654321', '#D2691E', '#F0E68C'];
          layerColor = new Color(geologicalColors[layerIndex % geologicalColors.length]);
        }
        
        // Merge geometries for this layer to create single clean mesh
        const mergedGeometry = this.mergeLayerGeometries(meshes);
        if (!mergedGeometry) continue;
          
        // If user wants to see internal structure, create a wireframe version instead
        const useWireframe = meshes.some(m => m.material?.wireframe);
        
        const cleanMaterial = new MeshStandardMaterial({
          color: layerColor.clone(),
          transparent: false, // Solid to prevent Z-fighting and black splotches
          opacity: 1.0,
          side: FrontSide,
          roughness: 0.6,
          metalness: 0.1,
          wireframe: useWireframe,
          wireframeLinewidth: 2,
          name: `clean_layer_${layerIndex}`,
          // Disable features that can cause artifacts
          fog: false,
          alphaTest: 0,
          depthWrite: true,
          depthTest: true
        });
        
        // If wireframe is enabled, create a secondary solid version with light background
        if (useWireframe) {
          const solidMaterial = new MeshStandardMaterial({
            color: layerColor.clone().multiplyScalar(0.9), // Slightly lighter for better visibility
            transparent: true,
            opacity: 0.2, // Very light background so wireframe is visible
            side: FrontSide,
            roughness: 0.8,
            metalness: 0.05,
            name: `solid_background_${layerIndex}`,
            depthWrite: false,
            depthTest: true
          });
          
          // Create background mesh
          const backgroundMesh = new Mesh(mergedGeometry.clone(), solidMaterial);
          backgroundMesh.name = `background_${layerIndex}_${layerKey}`;
          backgroundMesh.position.y += layerIndex * layerSpacing - 0.01; // Slightly behind
          backgroundMesh.renderOrder = layerIndex - 0.5;
          backgroundMesh.userData = {
            layerIndex,
            layerKey,
            isBackground: true
          };
          
          simplifiedGroup.add(backgroundMesh);
        }
        
        const cleanMesh = new Mesh(mergedGeometry, cleanMaterial);
        cleanMesh.name = `clean_layer_${layerIndex}_${layerKey}`;
        
        // Slightly separate layers to prevent Z-fighting
        cleanMesh.position.y += layerIndex * layerSpacing;
        cleanMesh.renderOrder = layerIndex;
        
        // Clean user data
        cleanMesh.userData = {
          layerIndex,
          layerKey,
          originalColor: layerColor.getHexString(),
          isCleanExport: true
        };
        
        simplifiedGroup.add(cleanMesh);
        layerIndex++;
      }
      
      // If no layers were successfully created, fall back to fallback export
      if (simplifiedGroup.children.length === 0 && soilLayers && soilLayers.length > 0) {
        return this.createFallbackLayerExport(soilLayers);
      }
      
      return simplifiedGroup.children.length > 0 ? simplifiedGroup : null;
      
    } catch (error) {
      validationLogger.warn('Failed to create simplified volumetric export:', error);
      // Fallback to fallback layer export on any error
      return soilLayers && soilLayers.length > 0 ? this.createFallbackLayerExport(soilLayers) : null;
    }
  }

  /**
   * Create fallback layer export when volumetric processing fails
   */
  createFallbackLayerExport(soilLayers) {
    const fallbackGroup = new Group();
    fallbackGroup.name = 'FallbackLayerExport';
    
    let currentY = 0;
    const layerSpacing = 0.5; // Larger spacing to ensure clean separation
    
    soilLayers.forEach((layer, index) => {
      const layerDepth = parseFloat(layer.depth) || 1;
      const layerColor = new Color(layer.color || '#888888');
      
      // Create simple box geometry for clean export
      const geometry = new BoxGeometry(20, layerDepth, 20); // Fixed size for consistency
      
      const material = new MeshStandardMaterial({
        color: layerColor,
        transparent: false,
        opacity: 1.0,
        side: FrontSide,
        roughness: 0.6,
        metalness: 0.1,
        name: `fallback_layer_${index}`
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.name = `fallback_${layer.name || `Layer_${index + 1}`}`.replace(/\s+/g, '_');
      mesh.position.set(0, currentY - layerDepth / 2, 0);
      mesh.renderOrder = index;
      
      mesh.userData = {
        layerIndex: index,
        layerName: layer.name || `Layer ${index + 1}`,
        layerDepth: layerDepth,
        layerColor: layer.color || '#888888',
        isFallbackLayer: true
      };
      
      fallbackGroup.add(mesh);
      currentY -= layerDepth + layerSpacing;
    });
    
    return fallbackGroup;
  }

  /**
   * Create direct soil layer export using original strata colors
   */
  createDirectSoilLayerExport(soilLayers, strataDimensions) {
    
    const directGroup = new Group();
    directGroup.name = 'DirectSoilLayerExport';
    
    const defaultDimensions = {
      width: 131,
      depth: 131,
      ...strataDimensions
    };
    
    let currentY = 0;
    const layerSpacing = 0.2; // Small gap to prevent Z-fighting
    
    soilLayers.forEach((layer, index) => {
      const layerDepth = parseFloat(layer.depth) || 1;
      
      // Use the exact color from the soil layer definition
      const layerColor = new Color(layer.color || '#888888');
      
      // Create clean box geometry
      const geometry = new BoxGeometry(
        defaultDimensions.width,
        layerDepth,
        defaultDimensions.depth
      );
      
      // Create solid material with exact strata color
      const material = new MeshStandardMaterial({
        color: layerColor,
        transparent: false, // Solid for clean export
        opacity: 1.0,
        side: FrontSide,
        roughness: 0.6,
        metalness: 0.1,
        name: `direct_layer_${index}_material`
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.name = `direct_${layer.name || `Layer_${index + 1}`}`.replace(/\s+/g, '_');
      
      // Position layer with small spacing
      mesh.position.set(0, currentY - layerDepth / 2, 0);
      mesh.renderOrder = index;
      
      // Store comprehensive metadata
      mesh.userData = {
        layerIndex: index,
        layerName: layer.name || `Layer ${index + 1}`,
        layerDepthFeet: layerDepth.toFixed(1),
        layerColor: layer.color || '#888888',
        layerDescription: layer.description || '',
        isDirectSoilLayer: true,
        type: 'soil_layer'
      };
      
      directGroup.add(mesh);
      currentY -= layerDepth + layerSpacing;
    });
    
    return directGroup;
  }

  /**
   * Extract actual borehole colors from the 3D scene
   */
  extractBoreholeColorsFromScene(scene, boreholes) {
    const enrichedBoreholes = [];
    
    // Find borehole markers in the scene
    const boreholeMarkers = [];
    scene.traverse((child) => {
      if (child.name && (child.name.includes('borehole') || child.name.includes('BH'))) {
        boreholeMarkers.push(child);
      }
    });
    
    boreholes.forEach((borehole, index) => {
      const enrichedBorehole = { ...borehole };
      
      // Try to find corresponding marker in scene
      const marker = boreholeMarkers.find(m => 
        m.name.includes(borehole.name || `BH-${index + 1}`) ||
        m.name.includes(`borehole_${index}`) ||
        (Math.abs((m.position?.x || 0) - (borehole.x || 0)) < 1 &&
         Math.abs((m.position?.z || 0) - (borehole.z || 0)) < 1)
      );
      
      if (marker && marker.material && marker.material.color) {
        // Extract color from the marker material
        enrichedBorehole.extractedColor = '#' + marker.material.color.getHexString();
      } else if (borehole.color) {
        // Use provided color
        enrichedBorehole.extractedColor = borehole.color;
      } else {
        // Use distinct colors based on borehole type or index
        const typeColors = {
          'BUILDING': '#795548',
          'PAVEMENT': '#607D8B', 
          'OTHER': '#2196F3'
        };
        enrichedBorehole.extractedColor = typeColors[borehole.type] || '#2196F3';
      }
      
      enrichedBoreholes.push(enrichedBorehole);
    });
    
    return enrichedBoreholes;
  }

  /**
   * Check if a color is a default gray color
   */
  isDefaultGrayColor(color) {
    const tolerance = 0.1;
    return Math.abs(color.r - color.g) < tolerance && 
           Math.abs(color.g - color.b) < tolerance && 
           color.r > 0.3 && color.r < 0.7;
  }

  /**
   * Get color saturation (how vivid the color is)
   */
  getColorSaturation(color) {
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);
    return max === 0 ? 0 : (max - min) / max;
  }

  /**
   * Get color brightness
   */
  getColorBrightness(color) {
    return (color.r + color.g + color.b) / 3;
  }

  /**
   * Merge geometries for a single layer, removing internal complexity
   */
  mergeLayerGeometries(meshes) {
    try {
      const geometries = [];
      
      for (const mesh of meshes) {
        if (!mesh.geometry) continue;
        
        // Clone and transform geometry to world space
        const geometry = mesh.geometry.clone();
        
        // Apply mesh transformations
        mesh.updateMatrixWorld(true);
        geometry.applyMatrix4(mesh.matrixWorld);
        
        // Simplify complex geometry to reduce artifacts
        this.simplifyGeometry(geometry);
        
        geometries.push(geometry);
      }
      
      if (geometries.length === 0) return null;
      if (geometries.length === 1) return geometries[0];
      
      // Merge all geometries for this layer
      const mergedGeometry = new BufferGeometry();
      
      // Calculate total vertex count
      let totalVertices = 0;
      let totalIndices = 0;
      
      for (const geo of geometries) {
        const positionAttr = geo.getAttribute('position');
        if (positionAttr) {
          totalVertices += positionAttr.count;
        }
        const indexAttr = geo.getIndex();
        if (indexAttr) {
          totalIndices += indexAttr.count;
        }
      }
      
      // Merge position data
      const positions = new Float32Array(totalVertices * 3);
      const normals = new Float32Array(totalVertices * 3);
      const uvs = new Float32Array(totalVertices * 2);
      const indices = new Uint32Array(totalIndices);
      
      let positionOffset = 0;
      let normalOffset = 0;
      let uvOffset = 0;
      let indexOffset = 0;
      let vertexOffset = 0;
      
      for (const geo of geometries) {
        // Copy positions
        const posAttr = geo.getAttribute('position');
        if (posAttr) {
          positions.set(posAttr.array, positionOffset);
          positionOffset += posAttr.array.length;
        }
        
        // Copy normals
        const normAttr = geo.getAttribute('normal');
        if (normAttr) {
          normals.set(normAttr.array, normalOffset);
          normalOffset += normAttr.array.length;
        } else {
          // Generate normals if missing
          geo.computeVertexNormals();
          const newNormAttr = geo.getAttribute('normal');
          if (newNormAttr) {
            normals.set(newNormAttr.array, normalOffset);
            normalOffset += newNormAttr.array.length;
          }
        }
        
        // Copy UVs
        const uvAttr = geo.getAttribute('uv');
        if (uvAttr) {
          uvs.set(uvAttr.array, uvOffset);
          uvOffset += uvAttr.array.length;
        }
        
        // Copy indices
        const indexAttr = geo.getIndex();
        if (indexAttr) {
          for (let i = 0; i < indexAttr.count; i++) {
            indices[indexOffset + i] = indexAttr.getX(i) + vertexOffset;
          }
          indexOffset += indexAttr.count;
        }
        
        vertexOffset += posAttr ? posAttr.count : 0;
      }
      
      // Set attributes
      mergedGeometry.setAttribute('position', new BufferAttribute(positions, 3));
      mergedGeometry.setAttribute('normal', new BufferAttribute(normals, 3));
      mergedGeometry.setAttribute('uv', new BufferAttribute(uvs, 2));
      mergedGeometry.setIndex(new BufferAttribute(indices, 1));
      
      // Clean up geometry
      mergedGeometry.computeBoundingBox();
      mergedGeometry.computeBoundingSphere();
      
      return mergedGeometry;
      
    } catch (error) {
      validationLogger.warn('Failed to merge layer geometries:', error);
      return null;
    }
  }

  /**
   * Simplify geometry to reduce rendering artifacts
   */
  simplifyGeometry(geometry) {
    try {
      // Remove duplicate vertices and clean up geometry
      geometry.deleteAttribute('color'); // Remove vertex colors that can cause bleeding
      
      // Ensure proper normals
      geometry.computeVertexNormals();
      
      // Remove unnecessary attributes that can cause issues
      if (geometry.hasAttribute('tangent')) {
        geometry.deleteAttribute('tangent');
      }
      
    } catch (error) {
      validationLogger.warn('Failed to simplify geometry:', error);
    }
  }

  /**
   * Get strata dimensions from the actual 3D model in the scene
   */
  getStrataDimensions(originalScene, displayOptions) {
    // Default dimensions
    let dimensions = {
      width: 40,  // Increased defaults to match typical model size
      depth: 40,
      height: 20
    };

    try {
      // Look for the volumetric geological model first
      const volumetricModel = originalScene.getObjectByName('VolumetricGeologicalModel');
      
      if (volumetricModel) {
        // Primary bounding box calculation
        volumetricModel.updateMatrixWorld(true);
        const box = new Box3().setFromObject(volumetricModel);
        
        if (!box.isEmpty()) {
          dimensions.width = Math.abs(box.max.x - box.min.x);
          dimensions.depth = Math.abs(box.max.z - box.min.z);
          dimensions.height = Math.abs(box.max.y - box.min.y);
          dimensions.centerY = (box.max.y + box.min.y) / 2;
          dimensions.minY = box.min.y;
          dimensions.maxY = box.max.y;
        } else {
          // Alternative geometry analysis for empty bounding box
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;
          let meshCount = 0;
          
          volumetricModel.traverse((child) => {
            if (child.geometry && child.geometry.attributes.position) {
              meshCount++;
              child.updateMatrixWorld(true);
              const childBox = new Box3().setFromObject(child);
              
              if (!childBox.isEmpty()) {
                minX = Math.min(minX, childBox.min.x);
                maxX = Math.max(maxX, childBox.max.x);
                minY = Math.min(minY, childBox.min.y);
                maxY = Math.max(maxY, childBox.max.y);
                minZ = Math.min(minZ, childBox.min.z);
                maxZ = Math.max(maxZ, childBox.max.z);
              }
            }
          });
          
          if (meshCount > 0 && minY !== Infinity) {
            dimensions.width = Math.abs(maxX - minX);
            dimensions.depth = Math.abs(maxZ - minZ);
            dimensions.height = Math.abs(maxY - minY);
            dimensions.centerY = (maxY + minY) / 2;
            dimensions.minY = minY;
            dimensions.maxY = maxY;
          }
        }
      } else {
        // Fallback: Try to find traditional strata objects
        const strataObject = originalScene.getObjectByName('soilCube') || 
                            originalScene.getObjectByName('strata') ||
                            originalScene.children.find(child => 
                              child.userData && child.userData.type === 'soilCube'
                            );

        if (strataObject) {
          const box = new Box3().setFromObject(strataObject);
          if (!box.isEmpty()) {
            dimensions.width = Math.abs(box.max.x - box.min.x);
            dimensions.depth = Math.abs(box.max.z - box.min.z);
            dimensions.height = Math.abs(box.max.y - box.min.y);
            dimensions.centerY = (box.max.y + box.min.y) / 2;
            dimensions.minY = box.min.y;
            dimensions.maxY = box.max.y;
          }
        } else if (displayOptions && displayOptions.strataDimensions) {
          // Use display options if available
          dimensions.width = displayOptions.strataDimensions.width || 40;
          dimensions.depth = displayOptions.strataDimensions.depth || 40;
          dimensions.height = displayOptions.strataDimensions.height || 20;
        }
      }
    } catch (error) {
      validationLogger.warn('Could not determine strata dimensions, using defaults:', error.message);
    }

    // Ensure reasonable minimum dimensions
    dimensions.width = Math.max(dimensions.width, 10);
    dimensions.depth = Math.max(dimensions.depth, 10);
    dimensions.height = Math.max(dimensions.height, 5);
    
    return dimensions;
  }

  /**
   * Check if a volumetric model is in wireframe mode
   */
  isWireframeVolumetricModel(volumetricObject) {
    // Validate input
    if (!volumetricObject || typeof volumetricObject.traverse !== 'function') {
      validationLogger.warn('Invalid volumetric object for wireframe detection');
      return false;
    }
    
    let wireframeCount = 0;
    let totalMeshCount = 0;
    
    try {
      volumetricObject.traverse((child) => {
        if (child.isMesh && child.material) {
          totalMeshCount++;
          
          // Check if any material is in wireframe mode
          if (Array.isArray(child.material)) {
            if (child.material.some(mat => mat && mat.wireframe === true)) {
              wireframeCount++;
            }
          } else {
            if (child.material.wireframe === true) {
              wireframeCount++;
            }
          }
        }
      });
    } catch (error) {
      validationLogger.warn('Error during wireframe detection:', error);
      return false;
    }
    
    // Handle edge case of no meshes
    if (totalMeshCount === 0) {
      return false;
    }
    
    // Consider it wireframe if more than 50% of meshes are wireframe
    const isWireframe = wireframeCount > (totalMeshCount * 0.5);
    
    return isWireframe;
  }

  /**
   * Preserve volumetric geometry for wireframe export with accurate elevations
   */
  preserveVolumetricGeometryForWireframe(volumetricObject, soilLayers) {
    
    // Create a color mapping from soil layers for better wireframe colors
    const layerColorMap = new Map();
    if (soilLayers && soilLayers.length > 0) {
      soilLayers.forEach((layer, index) => {
        const layerId = layer.id || `layer_${index}`;
        const layerName = layer.name?.toLowerCase() || `layer_${index}`;
        const color = layer.color || '#888888';
        
        layerColorMap.set(layerId, color);
        layerColorMap.set(layerName, color);
      });
    }
    
    let processedMeshes = 0;
    let wireframeMeshes = 0;
    
    volumetricObject.traverse((child) => {
      if (child.isMesh && child.material) {
        processedMeshes++;
        
        // Preserve and enhance the original geometry for wireframe
        if (child.geometry && child.geometry.attributes) {
          try {
            // Ensure proper normals for wireframe rendering
            if (!child.geometry.attributes.normal && child.geometry.computeVertexNormals) {
              child.geometry.computeVertexNormals();
            }
            
            // Ensure UV coordinates for texture compatibility
            if (!child.geometry.attributes.uv && child.geometry.attributes.position) {
              this.generateSimpleUVs(child.geometry);
            }
            
            // Optimize geometry for wireframe export (remove internal faces if needed)
            if (child.geometry.attributes.position) {
              // Ensure the geometry has proper bounds for export
              if (child.geometry.computeBoundingBox) child.geometry.computeBoundingBox();
              if (child.geometry.computeBoundingSphere) child.geometry.computeBoundingSphere();
            }
          } catch (error) {
            validationLogger.warn('Failed to process geometry for wireframe:', error);
          }
        }
        
        // Handle material enhancement for wireframe export
        const isCurrentlyWireframe = Array.isArray(child.material) 
          ? child.material.some(mat => mat.wireframe === true)
          : child.material.wireframe === true;
          
        if (isCurrentlyWireframe) {
          wireframeMeshes++;
        }
        
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => this.enhanceWireframeMaterial(mat, layerColorMap, child));
        } else {
          child.material = this.enhanceWireframeMaterial(child.material, layerColorMap, child);
        }
        
        // Optimize render settings for wireframe export
        child.frustumCulled = false; // Prevent culling of complex wireframe geometry
        child.matrixAutoUpdate = true;
        child.castShadow = false; // Wireframes don't need shadows
        child.receiveShadow = false;
        
        // Ensure proper render order for complex wireframes
        if (child.userData.layerIndex !== undefined) {
          child.renderOrder = child.userData.layerIndex + 100; // Higher than solid objects
        }
      }
    });
    
    
    // Ensure the object maintains its transformation for export
    volumetricObject.updateMatrixWorld(true);
    
    // Add metadata for wireframe export
    volumetricObject.userData = {
      ...volumetricObject.userData,
      isWireframeExport: true,
      processedMeshes,
      wireframeMeshes,
      exportTimestamp: new Date().toISOString()
    };
  }

  /**
   * Enhance wireframe materials for better export quality
   */
  enhanceWireframeMaterial(originalMaterial, layerColorMap, meshObject) {
    // Clone the material to avoid modifying the original
    const material = originalMaterial.clone();
    
    // Determine if this should remain wireframe or be converted
    const shouldBeWireframe = originalMaterial.wireframe === true;
    
    // Try to find a better color from the layer mapping
    let enhancedColor = material.color?.clone() || new Color(0xffffff);
    let colorSource = 'original';
    
    // Look for layer-based colors
    if (layerColorMap.size > 0) {
      const meshName = meshObject.name?.toLowerCase() || '';
      const userData = meshObject.userData || {};
      
      // Try different matching strategies
      for (const [layerKey, color] of layerColorMap.entries()) {
        if (meshName.includes(layerKey.toString().toLowerCase()) || 
            userData.layerName?.toLowerCase().includes(layerKey.toString().toLowerCase()) ||
            userData.layerId === layerKey ||
            userData.geologicalType?.toLowerCase() === layerKey.toString().toLowerCase()) {
          try {
            enhancedColor = new Color(color);
            colorSource = `layer_${layerKey}`;
            break;
          } catch (error) {
            validationLogger.warn(`Invalid color "${color}" for layer ${layerKey}, using fallback`);
            continue;
          }
        }
      }
    }
    
    // Create the appropriate material based on original wireframe state
    if (shouldBeWireframe) {
      // Enhanced wireframe material with geological colors
      const wireframeMaterial = new MeshStandardMaterial({
        color: enhancedColor,
        wireframe: true,
        // Note: wireframeLinewidth removed - not supported in WebGL
        transparent: false,
        opacity: 1.0,
        side: DoubleSide, // Show both sides for complete wireframe visibility
        roughness: 0.7,
        metalness: 0.1,
        name: `enhanced_wireframe_${material.name || 'material'}`,
        // Optimized for export
        fog: false,
        flatShading: false,
        depthWrite: true,
        depthTest: true,
        alphaTest: 0
      });
      
      // Add subtle emissive glow for better wireframe visibility in exports
      wireframeMaterial.emissive = enhancedColor.clone().multiplyScalar(0.15);
      wireframeMaterial.emissiveIntensity = 0.2;
      
      // Ensure material updates are applied
      wireframeMaterial.needsUpdate = true;
      
      // Store metadata
      wireframeMaterial.userData = {
        isEnhancedWireframe: true,
        colorSource,
        originalColor: material.color?.getHexString() || 'unknown',
        enhancedColor: enhancedColor.getHexString()
      };
      
      return wireframeMaterial;
      
    } else {
      // For non-wireframe materials, ensure they're export-ready
      const solidMaterial = new MeshStandardMaterial({
        color: enhancedColor,
        wireframe: false,
        transparent: material.transparent || false,
        opacity: Math.max(material.opacity || 1.0, 0.8), // Ensure visibility
        side: material.side || FrontSide,
        roughness: material.roughness || 0.6,
        metalness: material.metalness || 0.1,
        name: `enhanced_solid_${material.name || 'material'}`
      });
      
      // Preserve emissive if it exists
      if (material.emissive && material.emissive.isColor) {
        solidMaterial.emissive = material.emissive.clone();
        solidMaterial.emissiveIntensity = material.emissiveIntensity || 0;
      }
      
      // Ensure material updates are applied
      solidMaterial.needsUpdate = true;
      
      solidMaterial.userData = {
        isEnhancedSolid: true,
        colorSource,
        originalColor: material.color?.getHexString() || 'unknown',
        enhancedColor: enhancedColor.getHexString()
      };
      
      return solidMaterial;
    }
  }

  /**
   * Generate simple UV coordinates for geometries that don't have them
   */
  generateSimpleUVs(geometry) {
    const positions = geometry.attributes.position;
    const uvs = [];
    
    // Simple planar UV mapping
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      // Normalize coordinates to 0-1 range (simple box projection)
      const u = (x + 50) / 100; // Assuming typical coordinate range
      const v = (z + 50) / 100;
      
      uvs.push(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    }
    
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  }

  /**
   * Extract soil layers from borehole data when traditional layers are not available
   */
  extractSoilLayersFromBoreholes(boreholes) {
    
    const layerMap = new Map(); // Track unique layers by ID
    const geologicalColors = [
      '#8B4513', // SaddleBrown - topsoil
      '#F4A460', // SandyBrown - sandy layer  
      '#DEB887', // BurlyWood - clay layer
      '#708090', // SlateGray - gravel layer
      '#654321', // DarkBrown - dense clay
      '#D2691E', // Chocolate - silt layer
      '#F0E68C', // Khaki - weathered layer
      '#A0522D', // Sienna - bedrock
      '#CD853F', // Peru - mixed soil
      '#BC8F8F'  // RosyBrown - oxidized layer
    ];
    
    // First, collect all layer instances with their positions for proper ID generation
    const allLayerInstances = [];
    boreholes.forEach((borehole, boreholeIndex) => {
      if (borehole.layers && borehole.layers.length > 0) {
        
        borehole.layers.forEach((boreholeLayer, layerIndex) => {
          allLayerInstances.push({
            ...boreholeLayer,
            boreholeIndex,
            layerIndex,
            boreholeId: borehole.id || borehole.name || `bh_${boreholeIndex}`
          });
        });
      }
    });
    
    // Process unique layers - deduplicate by GEOLOGICAL TYPE, not position
    allLayerInstances.forEach((layerInstance) => {
      // Use layer NAME as the primary deduplication key (this represents geological type)
      // This ensures "Clay" at different elevations is treated as one layer type
      const layerId = layerInstance.name?.toLowerCase() || 
                     layerInstance.id || 
                     `layer_type_${layerInstance.layerIndex}`;
      
      if (!layerMap.has(layerId)) {
        
        // Find all instances of this GEOLOGICAL TYPE across all boreholes
        const allInstancesOfThisLayer = allLayerInstances.filter(instance => {
          const instanceId = instance.name?.toLowerCase() || 
                            instance.id || 
                            `layer_type_${instance.layerIndex}`;
          return instanceId === layerId;
        });
        
        
        const avgThickness = allInstancesOfThisLayer.length > 0 
          ? allInstancesOfThisLayer.reduce((sum, layer) => sum + (parseFloat(layer.thickness) || 1), 0) / allInstancesOfThisLayer.length
          : parseFloat(layerInstance.thickness) || 1;
            
        // Assign color based on layer name or index
        let assignedColor = geologicalColors[layerInstance.layerIndex % geologicalColors.length];
        
        // Try to match common geological layer names to appropriate colors
        const layerName = (layerInstance.name || '').toLowerCase();
        if (layerName.includes('topsoil') || layerName.includes('organic')) {
          assignedColor = '#3b2e1e'; // Dark brown
        } else if (layerName.includes('clay')) {
          assignedColor = '#5e4b37'; // Brown clay
        } else if (layerName.includes('sand')) {
          assignedColor = '#9b8569'; // Sandy brown
        } else if (layerName.includes('gravel')) {
          assignedColor = '#a1917e'; // Gravelly
        } else if (layerName.includes('bedrock') || layerName.includes('rock')) {
          assignedColor = '#c4c4c4'; // Gray bedrock
        }
        
        layerMap.set(layerId, {
          id: layerId,
          name: layerInstance.name || `Layer ${layerInstance.layerIndex + 1}`,
          depth: avgThickness,
          thickness: avgThickness,
          color: assignedColor,
          description: layerInstance.description || `Geological layer extracted from borehole data`,
          source: 'borehole_extraction',
          instanceCount: allInstancesOfThisLayer.length
        });
        
      }
    });
    
    // Convert map to array and sort by typical geological sequence
    const extractedLayers = Array.from(layerMap.values());
    
    // Sort layers by name/type to create a logical geological sequence
    extractedLayers.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // Topsoil first
      if (aName.includes('topsoil') || aName.includes('organic')) return -1;
      if (bName.includes('topsoil') || bName.includes('organic')) return 1;
      
      // Sandy layers before clay
      if (aName.includes('sand') && bName.includes('clay')) return -1;
      if (bName.includes('sand') && aName.includes('clay')) return 1;
      
      // Bedrock last
      if (aName.includes('bedrock') || aName.includes('rock')) return 1;
      if (bName.includes('bedrock') || bName.includes('rock')) return -1;
      
      // Default alphabetical
      return aName.localeCompare(bName);
    });
    
    
    return extractedLayers;
  }

  /**
   * Clean up resources
   */
  disposeScene(scene) {
    scene.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            if (material.map) {
              material.map.dispose();
            }
            material.dispose();
          });
        } else {
          if (child.material.map) {
            child.material.map.dispose();
          }
          child.material.dispose();
        }
      }
    });
  }
}

export default SceneExporter;