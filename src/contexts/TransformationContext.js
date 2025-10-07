import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Matrix4, Vector3, Euler, Quaternion } from 'three';
import { Logger } from '../utils/Logger.js';

const logger = new Logger().withContext('TransformationContext');

const TransformationContext = createContext();

/**
 * Transformation provider that manages all model space transformations
 */
export function TransformationProvider({ children }) {
  // Model space transformations (from interpolation/generation)
  const [modelTransform, setModelTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // View space transformations (alignment settings from UI)
  const [viewTransform, setViewTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    enabled: false
  });

  // Original base transformation (calculated positioning)
  const [baseTransform, setBaseTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // Coordinate system mappings
  const [coordinateSystem, setCoordinateSystem] = useState({
    inputSystem: 'interpolation', // 'interpolation' or 'threejs'
    outputSystem: 'threejs',
    requiresYInversion: false
  });

  /**
   * Validate and sanitize transform values with enhanced NaN detection
   */
  const validateTransformValues = useCallback((transform) => {
    const sanitize = (value, defaultValue = 0) => {
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        return defaultValue;
      }
      return value;
    };

    // Additional validation for the entire transform object
    if (!transform || typeof transform !== 'object') {
      return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
    }

    const sanitized = {
      position: {
        x: sanitize(transform.position?.x, 0),
        y: sanitize(transform.position?.y, 0),
        z: sanitize(transform.position?.z, 0)
      },
      rotation: {
        x: sanitize(transform.rotation?.x, 0),
        y: sanitize(transform.rotation?.y, 0),
        z: sanitize(transform.rotation?.z, 0)
      },
      scale: {
        x: sanitize(transform.scale?.x, 1),
        y: sanitize(transform.scale?.y, 1),
        z: sanitize(transform.scale?.z, 1)
      }
    };

    return sanitized;
  }, []);

  /**
   * Update model space transformation
   */
  const updateModelTransform = useCallback((transform) => {
    setModelTransform(prev => {
      const merged = {
        ...prev,
        ...transform
      };
      return validateTransformValues(merged);
    });
  }, [validateTransformValues]);

  /**
   * Update view space transformation (alignment settings)
   */
  const updateViewTransform = useCallback((transform) => {
    setViewTransform(prev => {
      const merged = {
        ...prev,
        ...transform
      };
      return validateTransformValues(merged);
    });
  }, [validateTransformValues]);

  /**
   * Update base transformation (original calculated position)
   */
  const updateBaseTransform = useCallback((transform) => {
    setBaseTransform(prev => {
      const merged = {
        ...prev,
        ...transform
      };
      return validateTransformValues(merged);
    });
  }, [validateTransformValues]);

  /**
   * Update coordinate system configuration
   */
  const updateCoordinateSystem = useCallback((config) => {
    setCoordinateSystem(prev => ({
      ...prev,
      ...config
    }));
  }, []);

  /**
   * Safely create rotation quaternion from euler angles
   * Returns identity quaternion if any value is invalid
   */
  const createSafeQuaternion = useCallback((rotation) => {
    const quaternion = new Quaternion();
    
    // Validate rotation values
    const rotX = (typeof rotation?.x === 'number' && !isNaN(rotation.x) && isFinite(rotation.x)) ? rotation.x : 0;
    const rotY = (typeof rotation?.y === 'number' && !isNaN(rotation.y) && isFinite(rotation.y)) ? rotation.y : 0;
    const rotZ = (typeof rotation?.z === 'number' && !isNaN(rotation.z) && isFinite(rotation.z)) ? rotation.z : 0;
    
    // Only set from euler if we have valid values
    if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
      try {
        const euler = new Euler(rotX, rotY, rotZ, 'XYZ');
        quaternion.setFromEuler(euler);
        
        // Verify quaternion is valid
        if (isNaN(quaternion.x) || isNaN(quaternion.y) || isNaN(quaternion.z) || isNaN(quaternion.w)) {
          quaternion.identity();
        }
      } catch (error) {
        logger.warn('Error creating quaternion from euler:', error);
        quaternion.identity();
      }
    }
    
    return quaternion;
  }, []);

  /**
   * Compute composite transformation matrix
   * This combines all transformations in the correct order
   */
  const getCompositeTransformMatrix = useCallback(() => {
    const matrix = new Matrix4();
    
    // Start with identity matrix
    matrix.identity()

    // Validate all transforms before applying
    const validatedBase = validateTransformValues(baseTransform);
    const validatedModel = validateTransformValues(modelTransform);
    const validatedView = validateTransformValues(viewTransform);
    
    try {
      // Apply base transformation first (original calculated position)
      const basePos = new Vector3(
        isFinite(validatedBase.position.x) ? validatedBase.position.x : 0,
        isFinite(validatedBase.position.y) ? validatedBase.position.y : 0,
        isFinite(validatedBase.position.z) ? validatedBase.position.z : 0
      );
      
      const baseQuat = createSafeQuaternion(validatedBase.rotation);
      
      const baseScale = new Vector3(
        isFinite(validatedBase.scale.x) && validatedBase.scale.x > 0 ? validatedBase.scale.x : 1,
        isFinite(validatedBase.scale.y) && validatedBase.scale.y > 0 ? validatedBase.scale.y : 1,
        isFinite(validatedBase.scale.z) && validatedBase.scale.z > 0 ? validatedBase.scale.z : 1
      );
      
      const baseMatrix = new Matrix4();
      baseMatrix.compose(basePos, baseQuat, baseScale);
      
      // Verify matrix is valid
      if (baseMatrix.elements.some(el => isNaN(el) || !isFinite(el))) {
        baseMatrix.identity();
        baseMatrix.setPosition(basePos);
        baseMatrix.scale(baseScale);
      }
      
      matrix.multiply(baseMatrix);
      
      // Apply model transformation
      const modelPos = new Vector3(
        isFinite(validatedModel.position.x) ? validatedModel.position.x : 0,
        isFinite(validatedModel.position.y) ? validatedModel.position.y : 0,
        isFinite(validatedModel.position.z) ? validatedModel.position.z : 0
      );
      
      const modelQuat = createSafeQuaternion(validatedModel.rotation);
      
      const modelScale = new Vector3(
        isFinite(validatedModel.scale.x) && validatedModel.scale.x > 0 ? validatedModel.scale.x : 1,
        isFinite(validatedModel.scale.y) && validatedModel.scale.y > 0 ? validatedModel.scale.y : 1,
        isFinite(validatedModel.scale.z) && validatedModel.scale.z > 0 ? validatedModel.scale.z : 1
      );
      
      const modelMatrix = new Matrix4();
      modelMatrix.compose(modelPos, modelQuat, modelScale);
      
      // Verify matrix is valid
      if (modelMatrix.elements.some(el => isNaN(el) || !isFinite(el))) {
        modelMatrix.identity();
        modelMatrix.setPosition(modelPos);
        modelMatrix.scale(modelScale);
      }
      
      matrix.multiply(modelMatrix);
      
      // Apply view transformation if enabled (alignment settings)
      if (viewTransform.enabled) {
        const viewPos = new Vector3(
          isFinite(validatedView.position.x) ? validatedView.position.x : 0,
          isFinite(validatedView.position.y) ? validatedView.position.y : 0,
          isFinite(validatedView.position.z) ? validatedView.position.z : 0
        );
        
        const viewQuat = createSafeQuaternion(validatedView.rotation);
        
        const viewScale = new Vector3(
          isFinite(validatedView.scale.x) && validatedView.scale.x > 0 ? validatedView.scale.x : 1,
          isFinite(validatedView.scale.y) && validatedView.scale.y > 0 ? validatedView.scale.y : 1,
          isFinite(validatedView.scale.z) && validatedView.scale.z > 0 ? validatedView.scale.z : 1
        );
        
        const viewMatrix = new Matrix4();
        viewMatrix.compose(viewPos, viewQuat, viewScale);
        
        // Verify matrix is valid
        if (viewMatrix.elements.some(el => isNaN(el) || !isFinite(el))) {
          viewMatrix.identity();
          viewMatrix.setPosition(viewPos);
          viewMatrix.scale(viewScale);
        }
        
        matrix.multiply(viewMatrix);
      }
      
      // Final validation of composite matrix
      if (matrix.elements.some(el => isNaN(el) || !isFinite(el))) {
        // Last resort: create a basic translation matrix to preserve model positioning
        const fallbackMatrix = new Matrix4();
        fallbackMatrix.setPosition(validatedBase.position.x, validatedBase.position.y, validatedBase.position.z);
        return fallbackMatrix;
      }
      
      return matrix;
      
    } catch (error) {
      logger.error('Error creating composite matrix:', error);
      return new Matrix4(); // Return identity matrix on error
    }
  }, [modelTransform, viewTransform, baseTransform, validateTransformValues, createSafeQuaternion]);

  /**
   * Get the final transformation as decomposed components
   */
  const getFinalTransform = useCallback(() => {
    try {
      const matrix = getCompositeTransformMatrix();
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();
      
      matrix.decompose(position, quaternion, scale);
      
      // Convert quaternion to euler for consistent API
      const euler = new Euler();
      euler.setFromQuaternion(quaternion);
      
      // Validate the decomposed values
      const safePosition = {
        x: isFinite(position.x) ? position.x : 0,
        y: isFinite(position.y) ? position.y : 0,
        z: isFinite(position.z) ? position.z : 0
      };
      
      const safeRotation = {
        x: isFinite(euler.x) ? euler.x : 0,
        y: isFinite(euler.y) ? euler.y : 0,
        z: isFinite(euler.z) ? euler.z : 0
      };
      
      const safeScale = {
        x: isFinite(scale.x) && scale.x > 0 ? scale.x : 1,
        y: isFinite(scale.y) && scale.y > 0 ? scale.y : 1,
        z: isFinite(scale.z) && scale.z > 0 ? scale.z : 1
      };
      
      return {
        position: safePosition,
        rotation: safeRotation,
        scale: safeScale
      };
    } catch (error) {
      // Error getting final transform, using defaults
      return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
    }
  }, [getCompositeTransformMatrix]);

  /**
   * Apply coordinate system conversion if needed
   */
  const applyCoordinateSystemConversion = useCallback((position) => {
    const converted = { ...position };
    
    if (coordinateSystem.requiresYInversion) {
      converted.y = -converted.y;
    }
    
    return converted;
  }, [coordinateSystem]);

  /**
   * Get transformation metadata for export
   */
  const getTransformMetadata = useCallback(() => {
    return {
      baseTransform: { ...baseTransform },
      modelTransform: { ...modelTransform },
      viewTransform: { ...viewTransform },
      coordinateSystem: { ...coordinateSystem },
      compositeMatrix: getCompositeTransformMatrix().toArray(),
      finalTransform: getFinalTransform()
    };
  }, [baseTransform, modelTransform, viewTransform, coordinateSystem, getCompositeTransformMatrix, getFinalTransform]);

  /**
   * Reset all transformations to identity
   */
  const resetTransformations = useCallback(() => {
    setModelTransform({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    setViewTransform({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      enabled: false
    });
    setBaseTransform({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  }, []);

  const value = useMemo(() => ({
    // State
    modelTransform,
    viewTransform,
    baseTransform,
    coordinateSystem,
    
    // Update methods
    updateModelTransform,
    updateViewTransform,
    updateBaseTransform,
    updateCoordinateSystem,
    
    // Computed values
    getCompositeTransformMatrix,
    getFinalTransform,
    applyCoordinateSystemConversion,
    getTransformMetadata,
    resetTransformations
  }), [
    modelTransform,
    viewTransform,
    baseTransform,
    coordinateSystem,
    updateModelTransform,
    updateViewTransform,
    updateBaseTransform,
    updateCoordinateSystem,
    getCompositeTransformMatrix,
    getFinalTransform,
    applyCoordinateSystemConversion,
    getTransformMetadata,
    resetTransformations
  ]);

  return (
    <TransformationContext.Provider value={value}>
      {children}
    </TransformationContext.Provider>
  );
}

/**
 * Hook to use transformation context
 */
export function useTransformation() {
  const context = useContext(TransformationContext);
  if (!context) {
    throw new Error('useTransformation must be used within a TransformationProvider');
  }
  return context;
}

export default TransformationContext;