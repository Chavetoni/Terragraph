// src/utils/modelUtils.js
import { Color } from 'three';
import { DEFAULT_SOIL_TYPES } from './constants';
import { validationLogger } from './Logger.js';

/**
 * Generate a unique ID for a layer
 * @param {Number} index - Layer index
 * @returns {String} Unique ID
 */
export const generateLayerId = (index) => {
  return `layer-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new layer with default properties
 * @param {Number} index - Layer index
 * @returns {Object} New layer object
 */
export const createDefaultLayer = (index) => {
  const defaultLayer = DEFAULT_SOIL_TYPES[index % DEFAULT_SOIL_TYPES.length];
  
  return {
    id: generateLayerId(index),
    name: defaultLayer.name,
    color: defaultLayer.color,
    description: defaultLayer.description,
    depth: index === 0 ? 1.0 : 2.0
  };
};

/**
 * Calculate total actual depth of all layers
 * @param {Array} layers - Layer array
 * @returns {Number} Total depth
 */
export const calculateTotalDepth = (layers) => {
  return layers.reduce((sum, layer) => sum + (parseFloat(layer.depth) || 1), 0);
};

/**
 * Calculate layer positions in the visual model
 * @param {Array} layers - Layer array
 * @param {Object} options - Calculation options
 * @returns {Array} Layer position data
 */
export const calculateLayerPositions = (layers, options) => {
  const {
    modelVisualHeight,
    viewMode,
    verticalSpacing
  } = options;
  
  const totalActualDepth = calculateTotalDepth(layers);
  const positions = [];
  let currentY = 0;
  
  for (let i = 0; i < layers.length; i++) {
    const layerActualDepth = parseFloat(layers[i].depth) || 1;
    
    const layerVisualHeight = (totalActualDepth > 0
      ? (layerActualDepth / totalActualDepth)
      : (layers.length > 0 ? 1 / layers.length : 0)) * modelVisualHeight;
    
    const layerTop = currentY;
    const layerCenter = currentY - (layerVisualHeight / 2);
    const layerBottom = currentY - layerVisualHeight;
    
    positions.push({
      index: i,
      top: layerTop,
      center: layerCenter,
      bottom: layerBottom,
      height: layerVisualHeight,
      actualDepth: layerActualDepth
    });
    
    currentY = layerBottom;
    
    if (viewMode === 'exploded' && i < layers.length - 1) {
      currentY -= verticalSpacing;
    }
  }
  
  return positions;
};

/**
 * Parse color string to THREE.Color
 * @param {String} colorStr - Color string (hex, rgb, etc.)
 * @param {String} fallbackColor - Fallback color if parsing fails
 * @returns {THREE.Color} Parsed color
 */
export const parseColor = (colorStr, fallbackColor = '#CCCCCC') => {
  try {
    return new Color(colorStr);
  } catch (e) {
    validationLogger.warn(`Invalid color: ${colorStr}, using fallback`);
    return new Color(fallbackColor);
  }
};

/**
 * Get scaling factor based on model dimensions
 * @param {Object} strataDimensions - Model dimensions
 * @param {Number} baseDimension - Base dimension for scaling
 * @returns {Number} Scaling factor
 */
export const getScalingFactor = (strataDimensions, baseDimension = 5) => {
  const currentMaxSize = Math.max(strataDimensions.width, strataDimensions.depth, baseDimension);
  return Math.max(0.5, currentMaxSize / baseDimension);
};