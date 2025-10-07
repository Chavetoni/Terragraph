/**
 * Transform Composition Service
 *
 * Provides utilities for composing and applying transformation matrices
 * to geological models for accurate export and rendering.
 */

import { Matrix4, Matrix3, Vector3, Euler, Quaternion } from 'three';
import { validationLogger } from '../utils/Logger.js';

export class TransformCompositionService {
  /**
   * Compose a transformation matrix from position, rotation, and scale
   * @param {Object} transform - Transform object with position, rotation, scale
   * @returns {Matrix4} Composed transformation matrix
   */
  static composeTransformMatrix(transform) {
    const matrix = new Matrix4();
    
    const position = new Vector3(
      transform.position?.x || 0,
      transform.position?.y || 0,
      transform.position?.z || 0
    );
    
    const rotation = new Euler(
      transform.rotation?.x || 0,
      transform.rotation?.y || 0,
      transform.rotation?.z || 0,
      'XYZ'
    );
    
    const scale = new Vector3(
      transform.scale?.x || 1,
      transform.scale?.y || 1,
      transform.scale?.z || 1
    );
    
    const quaternion = new Quaternion();
    quaternion.setFromEuler(rotation);
    
    matrix.compose(position, quaternion, scale);
    return matrix;
  }

  /**
   * Decompose a transformation matrix into position, rotation, and scale
   * @param {Matrix4} matrix - Transformation matrix
   * @returns {Object} Decomposed transform object
   */
  static decomposeTransformMatrix(matrix) {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    
    matrix.decompose(position, quaternion, scale);
    
    const rotation = new Euler();
    rotation.setFromQuaternion(quaternion);
    
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      scale: { x: scale.x, y: scale.y, z: scale.z }
    };
  }

  /**
   * Combine multiple transformation matrices in order
   * @param {Array<Matrix4>} matrices - Array of matrices to multiply
   * @returns {Matrix4} Combined transformation matrix
   */
  static combineTransformMatrices(matrices) {
    const result = new Matrix4();
    result.identity();
    
    for (const matrix of matrices) {
      if (matrix instanceof Matrix4) {
        result.multiply(matrix);
      }
    }
    
    return result;
  }

  /**
   * Apply a transformation matrix to a geometry (modifies in place)
   * @param {BufferGeometry} geometry - Three.js geometry to transform
   * @param {Matrix4} matrix - Transformation matrix to apply
   */
  static applyTransformToGeometry(geometry, matrix) {
    if (!geometry || !geometry.attributes?.position) {
      validationLogger.warn('Invalid geometry provided to applyTransformToGeometry');
      return;
    }

    // Validate matrix before applying
    const validation = this.validateTransformMatrix(matrix);
    if (!validation.isValid) {
      validationLogger.error('Invalid transformation matrix:', validation.warnings);
      return;
    }
    
    // Apply the transformation matrix to the geometry
    geometry.applyMatrix4(matrix);
    
    // Update normals if they exist
    if (geometry.attributes.normal) {
      const normalMatrix = new Matrix3();
      normalMatrix.getNormalMatrix(matrix);
      
      const normals = geometry.attributes.normal.array;
      const normalVector = new Vector3();
      
      for (let i = 0; i < normals.length; i += 3) {
        normalVector.set(normals[i], normals[i + 1], normals[i + 2]);
        normalVector.applyMatrix3(normalMatrix);
        normalVector.normalize();
        
        normals[i] = normalVector.x;
        normals[i + 1] = normalVector.y;
        normals[i + 2] = normalVector.z;
      }
      
      geometry.attributes.normal.needsUpdate = true;
    }
    
    // Mark geometry as needing update
    geometry.attributes.position.needsUpdate = true;
    
    // Validate geometry after transformation
    const positions = geometry.attributes.position.array;
    let hasNaN = false;
    for (let i = 0; i < positions.length; i++) {
      if (isNaN(positions[i]) || !isFinite(positions[i])) {
        hasNaN = true;
        break;
      }
    }
    
    if (hasNaN) {
      validationLogger.error('Transformation resulted in NaN positions - geometry may be invalid');
      return;
    }
    
    // Recompute bounding box and sphere
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Apply uniform scaling to all axes
   * @param {BufferGeometry} geometry - Geometry to scale
   * @param {number} scale - Uniform scale factor
   */
  static applyUniformScale(geometry, scale) {
    const scaleMatrix = new Matrix4();
    scaleMatrix.makeScale(scale, scale, scale);
    this.applyTransformToGeometry(geometry, scaleMatrix);
  }

  /**
   * Apply coordinate system conversion (e.g., Y-up to Z-up)
   * @param {BufferGeometry} geometry - Geometry to convert
   * @param {string} fromSystem - Source coordinate system
   * @param {string} toSystem - Target coordinate system
   */
  static convertCoordinateSystem(geometry, fromSystem, toSystem) {
    if (fromSystem === toSystem) return;
    
    const conversionMatrix = new Matrix4();
    
    // Common conversions
    if (fromSystem === 'y-up' && toSystem === 'z-up') {
      // Rotate -90 degrees around X axis
      conversionMatrix.makeRotationX(-Math.PI / 2);
    } else if (fromSystem === 'z-up' && toSystem === 'y-up') {
      // Rotate 90 degrees around X axis
      conversionMatrix.makeRotationX(Math.PI / 2);
    }
    
    this.applyTransformToGeometry(geometry, conversionMatrix);
  }

  /**
   * Create a transformation matrix for alignment settings
   * @param {Object} alignmentSettings - Alignment settings from UI
   * @param {Object} baseTransform - Base transformation to apply on top of
   * @returns {Matrix4} Combined transformation matrix
   */
  static createAlignmentMatrix(alignmentSettings, baseTransform = null) {
    const matrices = [];
    
    // Add base transform if provided
    if (baseTransform) {
      matrices.push(this.composeTransformMatrix(baseTransform));
    }
    
    // Add alignment transform if enabled
    if (alignmentSettings?.enabled) {
      // For alignment, we want additive position and rotation, multiplicative scale
      const alignmentTransform = {
        position: alignmentSettings.position || { x: 0, y: 0, z: 0 },
        rotation: alignmentSettings.rotation || { x: 0, y: 0, z: 0 },
        scale: alignmentSettings.scale || { x: 1, y: 1, z: 1 }
      };
      
      matrices.push(this.composeTransformMatrix(alignmentTransform));
    }
    
    return this.combineTransformMatrices(matrices);
  }

  /**
   * Apply unit conversion to a transformation matrix
   * @param {Matrix4} matrix - Matrix to modify
   * @param {number} conversionFactor - Unit conversion factor
   * @param {boolean} applyToAllAxes - If true, apply to all axes; if false, only Y
   */
  static applyUnitConversionToMatrix(matrix, conversionFactor, applyToAllAxes = true) {
    if (conversionFactor === 1) return matrix;
    
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    
    matrix.decompose(position, quaternion, scale);
    
    if (applyToAllAxes) {
      // Apply conversion to all position components
      position.multiplyScalar(conversionFactor);
      // Scale should also be adjusted for proper unit conversion
      scale.multiplyScalar(conversionFactor);
    } else {
      // Apply only to Y axis (legacy behavior - not recommended)
      position.y *= conversionFactor;
      scale.y *= conversionFactor;
    }
    
    matrix.compose(position, quaternion, scale);
    return matrix;
  }

  /**
   * Extract and apply all transforms from a Three.js object hierarchy
   * @param {Object3D} object - Three.js object with transform
   * @returns {Matrix4} World transformation matrix
   */
  static extractWorldTransform(object) {
    if (!object) return new Matrix4();
    
    // Update world matrix
    object.updateMatrixWorld(true);
    
    // Return the world matrix (includes all parent transforms)
    return object.matrixWorld.clone();
  }

  /**
   * Apply transforms to geometry for export (creates a copy)
   * @param {BufferGeometry} geometry - Original geometry
   * @param {Matrix4} transformMatrix - Transform to apply
   * @returns {BufferGeometry} New transformed geometry
   */
  static createTransformedGeometry(geometry, transformMatrix) {
    // Clone the geometry to avoid modifying the original
    const clonedGeometry = geometry.clone();
    
    // Apply the transformation
    this.applyTransformToGeometry(clonedGeometry, transformMatrix);
    
    return clonedGeometry;
  }

  /**
   * Validate transformation matrix for reasonable values
   * @param {Matrix4} matrix - Matrix to validate
   * @returns {Object} Validation result with warnings
   */
  static validateTransformMatrix(matrix) {
    const transform = this.decomposeTransformMatrix(matrix);
    const warnings = [];
    
    // Check for extreme positions
    const maxPosition = 10000;
    if (Math.abs(transform.position.x) > maxPosition ||
        Math.abs(transform.position.y) > maxPosition ||
        Math.abs(transform.position.z) > maxPosition) {
      warnings.push(`Extreme position detected: [${transform.position.x.toFixed(2)}, ${transform.position.y.toFixed(2)}, ${transform.position.z.toFixed(2)}]`);
    }
    
    // Check for extreme scales
    const minScale = 0.001;
    const maxScale = 1000;
    if (transform.scale.x < minScale || transform.scale.x > maxScale ||
        transform.scale.y < minScale || transform.scale.y > maxScale ||
        transform.scale.z < minScale || transform.scale.z > maxScale) {
      warnings.push(`Extreme scale detected: [${transform.scale.x.toFixed(3)}, ${transform.scale.y.toFixed(3)}, ${transform.scale.z.toFixed(3)}]`);
    }
    
    // Check for NaN or Infinity
    const elements = matrix.elements;
    for (let i = 0; i < elements.length; i++) {
      if (isNaN(elements[i]) || !isFinite(elements[i])) {
        warnings.push(`Invalid matrix element at index ${i}: ${elements[i]}`);
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      transform
    };
  }

  /**
   * Create metadata object describing transformations
   * @param {Object} transforms - Object containing various transform states
   * @returns {Object} Metadata object for export
   */
  static createTransformMetadata(transforms) {
    return {
      base_transform: transforms.base || null,
      model_transform: transforms.model || null,
      view_transform: transforms.view || null,
      alignment_enabled: transforms.view?.enabled || false,
      composite_matrix: transforms.composite?.toArray() || null,
      coordinate_system: transforms.coordinateSystem || 'y-up',
      unit_conversion: transforms.unitConversion || { factor: 1, applied: false },
      validation: transforms.composite ? this.validateTransformMatrix(transforms.composite) : null
    };
  }
}

export default TransformCompositionService;