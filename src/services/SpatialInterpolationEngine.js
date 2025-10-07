/**
 * Spatial Interpolation Engine for 3D Geological Modeling
 * Implements IDW (Inverse Distance Weighting) interpolation for creating smooth geological surfaces
 * Enhanced with geological validation and constraint enforcement
 */

import { GeologicalValidator } from './GeologicalValidator';

const EPSILON = 1e-10; // Small value for division-by-zero protection

export class SpatialInterpolationEngine {
  /**
   * Build KD-tree for efficient nearest neighbor searches
   * @private
   */
  static buildKDTree(points) {
    if (points.length === 0) return null;
    
    function buildTree(points, depth = 0) {
      if (points.length === 0) return null;
      if (points.length === 1) return { point: points[0], left: null, right: null };
      
      const axis = depth % 2; // Alternate between x and y
      points.sort((a, b) => axis === 0 ? a.x - b.x : a.y - b.y);
      
      const median = Math.floor(points.length / 2);
      
      return {
        point: points[median],
        left: buildTree(points.slice(0, median), depth + 1),
        right: buildTree(points.slice(median + 1), depth + 1)
      };
    }
    
    return buildTree(points);
  }
  
  /**
   * Find k nearest neighbors using KD-tree
   * @private
   */
  static findNearestNeighbors(tree, target, k = 8) {
    const nearest = [];
    
    function search(node, depth = 0) {
      if (!node) return;
      
      const dist = Math.sqrt(
        (node.point.x - target.x) ** 2 + 
        (node.point.y - target.y) ** 2
      );
      
      nearest.push({ point: node.point, distance: dist });
      nearest.sort((a, b) => a.distance - b.distance);
      if (nearest.length > k) nearest.pop();
      
      const axis = depth % 2;
      const diff = axis === 0 ? target.x - node.point.x : target.y - node.point.y;
      
      // Search the closer subtree first
      if (diff < 0) {
        search(node.left, depth + 1);
        if (nearest.length < k || Math.abs(diff) < nearest[nearest.length - 1].distance) {
          search(node.right, depth + 1);
        }
      } else {
        search(node.right, depth + 1);
        if (nearest.length < k || Math.abs(diff) < nearest[nearest.length - 1].distance) {
          search(node.left, depth + 1);
        }
      }
    }
    
    search(tree);
    return nearest.map(n => n.point);
  }


  /**
   * Generate a regular grid of points across the site extent
   * @param {Object} extent - Site boundaries {minX, maxX, minY, maxY}
   * @param {number} resolution - Number of grid points in each direction
   * @returns {Array} Array of grid points with x,y coordinates
   */
  static generateGrid(extent, resolution) {
    const points = [];
    const stepX = (extent.maxX - extent.minX) / (resolution - 1);
    const stepY = (extent.maxY - extent.minY) / (resolution - 1);

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        points.push({
          x: extent.minX + stepX * i,
          y: extent.minY + stepY * j,
          gridIndex: { i, j }
        });
      }
    }
    return points;
  }

  /**
   * Perform Inverse Distance Weighting interpolation
   * @param {Object} targetPoint - Point to interpolate {x, y}
   * @param {Array} dataPoints - Known data points with values [{x, y, value}]
   * @param {number} power - IDW power parameter (default 2)
   * @param {number} maxDistance - Maximum influence distance (optional)
   * @returns {number} Interpolated value at target point
   */
  static inverseDistanceWeighting(targetPoint, dataPoints, power = 2, maxDistance = null) {
    if (dataPoints.length === 0) return 0;
    if (dataPoints.length === 1) return dataPoints[0].value;

    let numerator = 0;
    let denominator = 0;

    for (const point of dataPoints) {
      const dx = targetPoint.x - point.x;
      const dy = targetPoint.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EPSILON) {
          // Point is at exact data location - skip to avoid division by zero
          continue;
        }

      // Handle exact match
      if (distance < 0.001) {
        return point.value;
      }

      // Apply distance cutoff if specified
      if (maxDistance && distance > maxDistance) {
        continue;
      }

      const weight = (Math.abs(distance) < EPSILON ? 0 : 1 / Math.pow(distance, power));
      numerator += weight * point.value;
      denominator += weight;
    }

    // Handle case where all points are beyond maxDistance
    if (denominator === 0) {
      // Find nearest point
      let minDist = Infinity;
      let nearestValue = 0;
      for (const point of dataPoints) {
        const dx = targetPoint.x - point.x;
        const dy = targetPoint.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EPSILON) {
          // Point is at exact data location - skip to avoid division by zero
          continue;
        }
        if (distance < minDist) {
          minDist = distance;
          nearestValue = point.value;
        }
      }
      return nearestValue;
    }

    return (Math.abs(denominator) < EPSILON ? 0 : numerator / denominator);
  }

  /**
   * Interpolate both top and bottom surfaces for a geological layer
   * @param {Array} layerPoints - Points with layer data [{x, y, topZ, bottomZ}]
   * @param {Object} gridExtent - Grid boundaries
   * @param {number} resolution - Grid resolution
   * @param {Object} options - Additional options {power, maxDistance}
   * @returns {Object} {topSurface, bottomSurface} arrays of interpolated points
   */
  static interpolateLayerSurface(layerPoints, gridExtent, resolution, options = {}) {
    const { power = 2, maxDistance = null } = options;
    const grid = this.generateGrid(gridExtent, resolution);

    // ENHANCED: Handle cases with limited data points using geological principles
    if (layerPoints.length < 3) {

      if (layerPoints.length === 1) {
        // Single point: use geological assumption of horizontal continuity with distance decay
        const point = layerPoints[0];
        const topSurface = grid.map(gridPoint => {
          const result = this.geologicalExtrapolation([point], gridPoint, { valueField: 'topZ' });
          return {
            ...gridPoint,
            z: result.value,
            confidence: result.confidence
          };
        });
        const bottomSurface = grid.map(gridPoint => {
          const result = this.geologicalExtrapolation([point], gridPoint, { valueField: 'bottomZ' });
          return {
            ...gridPoint,
            z: result.value,
            confidence: result.confidence
          };
        });
        return { topSurface, bottomSurface, gridResolution: resolution };
      } else if (layerPoints.length === 2) {
        // Two points: use constrained linear trend with geological limits
        const p1 = layerPoints[0];
        const p2 = layerPoints[1];
        
        const topSurface = grid.map(gridPoint => {
          const result = this.geologicalExtrapolation([p1, p2], gridPoint, { valueField: 'topZ' });
          return {
            ...gridPoint,
            z: result.value,
            confidence: result.confidence
          };
        });
        const bottomSurface = grid.map(gridPoint => {
          const result = this.geologicalExtrapolation([p1, p2], gridPoint, { valueField: 'bottomZ' });
          return {
            ...gridPoint,
            z: result.value,
            confidence: result.confidence
          };
        });
        return { topSurface, bottomSurface, gridResolution: resolution };
      }
    }

    // Standard IDW interpolation for 3+ points
    const topSurface = grid.map(gridPoint => ({
      ...gridPoint,
      z: this.inverseDistanceWeighting(
        gridPoint,
        layerPoints.map(p => ({ x: p.x, y: p.y, value: p.topZ })),
        power,
        maxDistance
      )
    }));

    const bottomSurface = grid.map(gridPoint => ({
      ...gridPoint,
      z: this.inverseDistanceWeighting(
        gridPoint,
        layerPoints.map(p => ({ x: p.x, y: p.y, value: p.bottomZ })),
        power,
        maxDistance
      )
    }));

    // Basic minimum thickness enforcement (enhanced validation applied later)
    const minThickness = 0.1; // 10cm minimum
    for (let i = 0; i < topSurface.length; i++) {
      if (bottomSurface[i].z > topSurface[i].z - minThickness) {
        bottomSurface[i].z = topSurface[i].z - minThickness;
      }
    }

    return { topSurface, bottomSurface, gridResolution: resolution };
  }

  /**
   * Linear interpolation between two points for limited data scenarios
   * @param {Object} targetPoint - Target grid point
   * @param {Object} p1 - First data point
   * @param {Object} p2 - Second data point  
   * @param {string} valueField - Field to interpolate ('topZ' or 'bottomZ')
   * @returns {number} Interpolated value
   */
  static linearInterpolation(targetPoint, p1, p2, valueField) {
    // Calculate distances to both points
    const dist1 = Math.sqrt(Math.pow(targetPoint.x - p1.x, 2) + Math.pow(targetPoint.y - p1.y, 2));
    const dist2 = Math.sqrt(Math.pow(targetPoint.x - p2.x, 2) + Math.pow(targetPoint.y - p2.y, 2));
    
    // Handle edge case where target is exactly at one of the points
    if (dist1 === 0) return p1[valueField];
    if (dist2 === 0) return p2[valueField];
    
    // Linear interpolation based on inverse distance
    const totalDist = dist1 + dist2;
    const weight1 = (totalDist - dist1) / totalDist; // Closer points get higher weight
    const weight2 = (totalDist - dist2) / totalDist;
    
    return p1[valueField] * weight1 + p2[valueField] * weight2;
  }

  /**
   * Geological extrapolation using continuity principles and distance decay
   * @param {Array} points - Known data points (1-2 points)
   * @param {Object} gridPoint - Target point for extrapolation
   * @param {Object} settings - Configuration options
   * @returns {Object} {value, confidence, method}
   */
  static geologicalExtrapolation(points, gridPoint, settings = {}) {
    const {
      valueField = 'topZ',
      maxSlope = 0.3, // Geological layers rarely exceed 30% slope
      confidenceDecayDistance = 50 // Distance for confidence decay
    } = settings;

    if (points.length === 1) {
      // Single point - use geological assumption of horizontal continuity
      const point = points[0];
      const distance = Math.sqrt(
        Math.pow(gridPoint.x - point.x, 2) + 
        Math.pow(gridPoint.y - point.y, 2)
      );

      // Confidence decays with distance but maintains minimum for geological continuity
      const confidence = Math.max(0.2, Math.exp(-(Math.abs(confidenceDecayDistance) < EPSILON ? 0 : distance / confidenceDecayDistance)));

      return {
        value: point[valueField],
        confidence: confidence,
        method: 'horizontal-continuity'
      };
    }

    if (points.length === 2) {
      // Two points - use constrained linear trend with geological limits
      const p1 = points[0];
      const p2 = points[1];
      
      // Calculate trend between the two points
      const deltaX = p2.x - p1.x;
      const deltaY = p2.y - p1.y;
      const deltaZ = p2[valueField] - p1[valueField];
      const distance2D = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Calculate slope and constrain it to geological limits
      let slope = distance2D > 0 ? (Math.abs(distance2D) < EPSILON ? 0 : deltaZ / distance2D) : 0;
      slope = Math.max(-maxSlope, Math.min(maxSlope, slope));
      
      // Calculate extrapolated value
      const targetDeltaX = gridPoint.x - p1.x;
      const targetDeltaY = gridPoint.y - p1.y;
      const targetDistance = Math.sqrt(targetDeltaX * targetDeltaX + targetDeltaY * targetDeltaY);
      
      const extrapolatedValue = p1[valueField] + (slope * targetDistance * 
        (targetDistance > 0 ? (targetDeltaX * deltaX + targetDeltaY * deltaY) / (targetDistance * distance2D) : 0));
      
      // Calculate confidence based on extrapolation distance and slope constraint
      const distanceFromLine = this.calculateDistanceFromLine(gridPoint, p1, p2);
      const distanceConfidence = Math.exp(-(Math.abs(confidenceDecayDistance) < EPSILON ? 0 : distanceFromLine / confidenceDecayDistance));
      const slopeConfidence = 1 - Math.abs(slope) / maxSlope; // Lower confidence for steeper slopes
      const confidence = Math.max(0.1, distanceConfidence * slopeConfidence);
      
      return {
        value: extrapolatedValue,
        confidence: confidence,
        method: 'constrained-linear'
      };
    }

    // Fallback for unexpected cases
    return {
      value: points[0][valueField],
      confidence: 0.1,
      method: 'fallback'
    };
  }

  /**
   * Calculate perpendicular distance from point to line defined by two points
   * @param {Object} point - Target point
   * @param {Object} lineP1 - First point of line
   * @param {Object} lineP2 - Second point of line
   * @returns {number} Distance from point to line
   */
  static calculateDistanceFromLine(point, lineP1, lineP2) {
    const A = point.x - lineP1.x;
    const B = point.y - lineP1.y;
    const C = lineP2.x - lineP1.x;
    const D = lineP2.y - lineP1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line is actually a point
      return Math.sqrt(A * A + B * B);
    }

    const param = (Math.abs(lenSq) < EPSILON ? 0 : dot / lenSq);
    let xx, yy;

    if (param < 0) {
      xx = lineP1.x;
      yy = lineP1.y;
    } else if (param > 1) {
      xx = lineP2.x;
      yy = lineP2.y;
    } else {
      xx = lineP1.x + param * C;
      yy = lineP1.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate interpolation (Math.abs(quality) < EPSILON ? 0 : confidence / quality) metric
   * @param {Object} targetPoint - Point to evaluate
   * @param {Array} dataPoints - Known data points
   * @param {number} maxGoodDistance - Distance for "good" confidence
   * @returns {number} Confidence value 0-1
   */
  static calculateConfidence(targetPoint, dataPoints, maxGoodDistance = 32.8) {
    if (dataPoints.length === 0) return 0;

    // Find minimum distance to any data point
    let minDistance = Infinity;
    for (const point of dataPoints) {
      const dx = targetPoint.x - point.x;
      const dy = targetPoint.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EPSILON) {
          // Point is at exact data location - skip to avoid division by zero
          continue;
        }
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // Calculate confidence based on distance
    if (minDistance === 0) return 1.0;
    if (minDistance >= maxGoodDistance * 3) return 0.1;
    
    // Smooth falloff
    const normalized = (Math.abs(maxGoodDistance) < EPSILON ? 0 : minDistance / maxGoodDistance);
    return Math.max(0.1, 1.0 - (normalized / 3));
  }

  /**
   * Generate confidence grid for interpolated surfaces
   * @param {Array} grid - Grid points
   * @param {Array} dataPoints - Known data points
   * @param {Object} options - Confidence calculation options
   * @returns {Array} Grid with confidence values
   */
  static generateConfidenceGrid(grid, dataPoints, options = {}) {
    const { maxGoodDistance = 32.8 } = options;
    
    return grid.map(gridPoint => ({
      ...gridPoint,
      confidence: this.calculateConfidence(
        gridPoint,
        dataPoints,
        maxGoodDistance
      )
    }));
  }

  /**
   * Smooth interpolated surface using gaussian filter
   * @param {Array} surface - Surface points array
   * @param {number} resolution - Grid resolution
   * @param {number} sigma - Smoothing factor
   * @returns {Array} Smoothed surface
   */
  static smoothSurface(surface, resolution, sigma = 1) {
    const smoothed = [...surface];
    const kernel = this._generateGaussianKernel(sigma);
    const kernelRadius = Math.floor(kernel.length / 2);

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const idx = i * resolution + j;
        let sum = 0;
        let weightSum = 0;

        // Apply kernel
        for (let ki = -kernelRadius; ki <= kernelRadius; ki++) {
          for (let kj = -kernelRadius; kj <= kernelRadius; kj++) {
            const ni = i + ki;
            const nj = j + kj;

            if (ni >= 0 && ni < resolution && nj >= 0 && nj < resolution) {
              const nIdx = ni * resolution + nj;
              const weight = kernel[ki + kernelRadius][kj + kernelRadius];
              sum += surface[nIdx].z * weight;
              weightSum += weight;
            }
          }
        }

        smoothed[idx] = {
          ...surface[idx],
          z: (Math.abs(weightSum) < EPSILON ? 0 : sum / weightSum)
        };
      }
    }

    return smoothed;
  }

  /**
   * Generate 2D Gaussian kernel for smoothing
   * @private
   */
  static _generateGaussianKernel(sigma) {
    const size = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = [];
    const center = Math.floor(size / 2);
    
    for (let i = 0; i < size; i++) {
      kernel[i] = [];
      for (let j = 0; j < size; j++) {
        const x = i - center;
        const y = j - center;
        kernel[i][j] = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      }
    }

    return kernel;
  }

  /**
   * Calculate site extent from borehole positions
   * @param {Array} boreholes - Array of boreholes
   * @param {number} padding - Padding factor (default 1.2)
   * @returns {Object} Site extent {minX, maxX, minY, maxY}
   */
  static calculateExtent(boreholes, padding = 1.1) { // Reduced padding from 20% to 10%
    if (boreholes.length === 0) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const borehole of boreholes) {
      minX = Math.min(minX, borehole.x);
      maxX = Math.max(maxX, borehole.x);
      minY = Math.min(minY, borehole.z); // Use z for N-S in Three.js
      maxY = Math.max(maxY, borehole.z);
    }

    // Add padding
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const paddingX = rangeX * (padding - 1) / 2;
    const paddingY = rangeY * (padding - 1) / 2;

    // Ensure minimum size (reduced from 20 to 10)
    const minSize = 10;
    if (rangeX < minSize) {
      const additional = (minSize - rangeX) / 2;
      minX -= additional;
      maxX += additional;
    }
    if (rangeY < minSize) {
      const additional = (minSize - rangeY) / 2;
      minY -= additional;
      maxY += additional;
    }

    return {
      minX: minX - paddingX,
      maxX: maxX + paddingX,
      minY: minY - paddingY,
      maxY: maxY + paddingY
    };
  }

  /**
   * Apply geological validation and constraints to interpolated layer sequence
   * @param {Array} layerSequence - Array of interpolated layers
   * @param {Object} validationOptions - Geological validation options
   * @returns {Array} Geologically validated layer sequence
   */
  static applyGeologicalValidation(layerSequence, validationOptions = {}) {

    // Default validation options
    const options = {
      minThickness: 0.15,       // 15cm minimum (slightly more conservative)
      maxSlope: 30,             // 30° maximum slope (geologically reasonable)
      smoothingRadius: 1,       // 1 grid unit smoothing
      enforceOrder: true,       // Enforce stratigraphic ordering
      applyLateralContinuity: true, // Apply continuity constraints
      ...validationOptions
    };

    // Apply comprehensive geological validation
    const validatedLayers = GeologicalValidator.validateLayerSequence(layerSequence, options);

    return validatedLayers;
  }

  /**
   * Enhanced layer interpolation with geological validation
   * @param {Array} materialLayers - Array of {material, layerPoints} objects
   * @param {Object} gridExtent - Grid boundaries
   * @param {number} resolution - Grid resolution
   * @param {Object} options - Interpolation and validation options
   * @returns {Array} Validated geological layer sequence
   */
  static interpolateGeologicalSequence(materialLayers, gridExtent, resolution, options = {}) {

    const interpolationOptions = {
      power: options.power || 2,
      maxDistance: options.maxDistance || null
    };

    const validationOptions = {
      minThickness: options.minThickness || 0.15,
      maxSlope: options.maxSlope || 30,
      smoothingRadius: options.smoothingRadius || 1,
      enforceOrder: options.enforceOrder !== false,
      applyLateralContinuity: options.applyLateralContinuity !== false
    };

    // Step 1: Interpolate each material layer
    const interpolatedLayers = materialLayers.map((materialLayer, index) => {

      const layerSurface = this.interpolateLayerSurface(
        materialLayer.layerPoints,
        gridExtent,
        resolution,
        interpolationOptions
      );

      return {
        material: materialLayer.material,
        layerIndex: index,
        ...layerSurface
      };
    });

    // Step 2: Apply geological validation and constraints
    const validatedLayers = this.applyGeologicalValidation(interpolatedLayers, validationOptions);

    return validatedLayers;
  }
}