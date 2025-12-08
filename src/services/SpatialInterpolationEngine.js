/**
 * Spatial Interpolation Engine for 3D Geological Modeling
 * Implements IDW (Inverse Distance Weighting) interpolation for creating smooth geological surfaces
 * Enhanced with geological validation and constraint enforcement
 *
 * Features:
 * - Anisotropic distance weighting (3D ellipsoidal distance)
 * - KD-tree optimization for neighbor search
 * - Geological validation and constraint enforcement
 */

import { GeologicalValidator } from './GeologicalValidator';

const EPSILON = 1e-10;

/**
 * Default anisotropy scale factors
 * Lz = 0.1 means vertical distance is 10x more "expensive" than horizontal
 * This prioritizes horizontal neighbors, matching geological layer continuity
 */
const DEFAULT_ANISOTROPY = {
  Lx: 1.0,   // East-West scale (horizontal baseline)
  Ly: 1.0,   // North-South scale (horizontal baseline)
  Lz: 0.1    // Vertical scale - 10:1 ratio makes Z expensive
};

export class SpatialInterpolationEngine {
  static buildKDTree(points) {
    if (points.length === 0) return null;
    
    function buildTree(points, depth = 0) {
      if (points.length === 0) return null;
      if (points.length === 1) return { point: points[0], left: null, right: null };
      
      const axis = depth % 2;
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
   * Perform Inverse Distance Weighting interpolation with confidence weighting
   *
   * Points with higher confidence (observed data, confidence=1.0) have more
   * influence than estimated/interpolated points (confidence<1.0). This allows
   * actual borehole observations to dominate over zero-thickness markers
   * inserted for missing layers.
   *
   * @param {Object} targetPoint - Point to interpolate {x, y}
   * @param {Array} dataPoints - Known data points with values [{x, y, value, confidence?}]
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
      // FIX: Return exact value for points at same location (was incorrectly skipping)
      if (distance < 0.001) {
        return point.value;
      }
      if (maxDistance && distance > maxDistance) {
        continue;
      }

      // Confidence weighting: actual observations (confidence=1.0) have more
      // influence than estimated points (e.g., zero-thickness markers at 0.6)
      const pointConfidence = point.confidence ?? 1.0;
      const weight = pointConfidence * (1 / Math.pow(distance, power));
      numerator += weight * point.value;
      denominator += weight;
    }
    if (denominator === 0) {
      // Fallback to nearest neighbor when no valid weights
      let minDist = Infinity;
      let nearestValue = 0;
      for (const point of dataPoints) {
        const dx = targetPoint.x - point.x;
        const dy = targetPoint.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
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
   * Calculate anisotropic (ellipsoidal) distance between two points
   * Makes vertical distance "expensive" to prioritize horizontal neighbors
   *
   * Formula: d = sqrt((dx/Lx)² + (dy/Ly)² + (dz/Lz)²)
   *
   * With default Lz = 0.1:
   * - 1 foot horizontal = 1 unit distance
   * - 1 foot vertical = 10 units distance (10x more expensive)
   *
   * This matches geological reality where layers are continuous horizontally
   * but can change dramatically over short vertical distances.
   *
   * @param {Object} p1 - First point {x, y, topZ, bottomZ} or {x, y, z}
   * @param {Object} p2 - Second point
   * @param {Object} scales - Scale factors {Lx, Ly, Lz}, defaults to 10:1 ratio
   * @returns {number} Anisotropic distance
   */
  static anisotropicDistance(p1, p2, scales = DEFAULT_ANISOTROPY) {
    const { Lx = 1.0, Ly = 1.0, Lz = 0.1 } = scales;

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;

    // Get Z values - handle both topZ/bottomZ format and simple z format
    // For layer points, use the center elevation
    const z1 = p1.topZ !== undefined
      ? (p1.topZ + (p1.bottomZ !== undefined ? p1.bottomZ : p1.topZ)) / 2
      : (p1.z !== undefined ? p1.z : 0);
    const z2 = p2.topZ !== undefined
      ? (p2.topZ + (p2.bottomZ !== undefined ? p2.bottomZ : p2.topZ)) / 2
      : (p2.z !== undefined ? p2.z : 0);
    const dz = z1 - z2;

    // Ellipsoidal distance with anisotropic scaling
    return Math.sqrt(
      (dx / Lx) ** 2 +
      (dy / Ly) ** 2 +
      (dz / Lz) ** 2
    );
  }

  /**
   * Perform anisotropic Inverse Distance Weighting interpolation
   * Uses 3D ellipsoidal distance to prioritize horizontal neighbors
   *
   * @param {Object} targetPoint - Point to interpolate {x, y} or {x, y, z}
   * @param {Array} dataPoints - Known data points with values [{x, y, topZ, bottomZ, value}]
   * @param {number} power - IDW power parameter (default 2)
   * @param {Object} options - Additional options {maxDistance, scales}
   * @returns {number} Interpolated value at target point
   */
  static inverseDistanceWeightingAnisotropic(targetPoint, dataPoints, power = 2, options = {}) {
    const {
      maxDistance = null,
      scales = DEFAULT_ANISOTROPY,
      targetZ = null  // Optional Z for target point (for 3D queries)
    } = options;

    if (dataPoints.length === 0) return 0;
    if (dataPoints.length === 1) return dataPoints[0].value;

    // Create target with Z if provided
    const target = targetZ !== null
      ? { ...targetPoint, z: targetZ }
      : targetPoint;

    let numerator = 0;
    let denominator = 0;

    for (const point of dataPoints) {
      const distance = this.anisotropicDistance(target, point, scales);

      // FIX: Return exact value for points at same location (was incorrectly skipping)
      if (distance < 0.001) {
        return point.value;
      }
      if (maxDistance && distance > maxDistance) {
        continue;
      }

      const weight = 1 / Math.pow(distance, power);
      numerator += weight * point.value;
      denominator += weight;
    }

    if (denominator === 0) {
      // Fallback to nearest neighbor when no valid weights
      let minDist = Infinity;
      let nearestValue = 0;
      for (const point of dataPoints) {
        const distance = this.anisotropicDistance(target, point, scales);
        if (distance < minDist) {
          minDist = distance;
          nearestValue = point.value;
        }
      }
      return nearestValue;
    }

    return numerator / denominator;
  }

  /**
   * Interpolate both top and bottom surfaces for a geological layer
   * @param {Array} layerPoints - Points with layer data [{x, y, topZ, bottomZ}]
   * @param {Object} gridExtent - Grid boundaries
   * @param {number} resolution - Grid resolution
   * @param {Object} options - Additional options {power, maxDistance, useKDTree, maxNeighbors}
   * @returns {Object} {topSurface, bottomSurface} arrays of interpolated points
   */
  static interpolateLayerSurface(layerPoints, gridExtent, resolution, options = {}) {
    const {
      power = 2,
      maxDistance = null,
      useKDTree = true,  // Feature flag: use KD-tree optimization
      maxNeighbors = 12,  // Maximum neighbors to consider per grid point
      useAnisotropy = false,  // NEW: Enable 3D anisotropic distance
      anisotropyScales = DEFAULT_ANISOTROPY  // NEW: {Lx, Ly, Lz} scale factors
    } = options;
    const grid = this.generateGrid(gridExtent, resolution);

    // When using anisotropy, disable KD-tree (it's 2D only)
    // Performance impact is acceptable for typical borehole counts (<100)
    const effectiveUseKDTree = useKDTree && !useAnisotropy;

    if (layerPoints.length < 3) {
      // CRITICAL FIX: Transform layer points to use z (N-S) coordinate as y for distance calculations
      // Layer points have: y = surface elevation, z = N-S coordinate
      // Grid points have: y = N-S coordinate (from extent using borehole.z)
      const transformedPoints = layerPoints.map(p => ({
        ...p,
        y: p.z  // Use N-S coordinate for distance calculations
      }));

      if (layerPoints.length === 1) {
        const point = transformedPoints[0];
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
        const p1 = transformedPoints[0];
        const p2 = transformedPoints[1];

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

    // KD-TREE OPTIMIZATION: Build trees once for efficient nearest neighbor search
    // This reduces complexity from O(n*m) to O(n*log(m)) where n=grid points, m=boreholes
    // Expected speedup: 10-100x on sites with >20 boreholes
    // NOTE: KD-tree is 2D only, disabled when using 3D anisotropic distance
    let topTree = null;
    let bottomTree = null;
    const shouldUseKDTree = effectiveUseKDTree && layerPoints.length >= 8;

    if (shouldUseKDTree) {
      // Build KD-trees for top and bottom surfaces
      // CRITICAL FIX: Use p.z (North-South) not p.y (surface elevation) for distance calculations
      // The grid uses extent.minY/maxY which are derived from borehole.z (N-S coordinate)
      const topPoints = layerPoints.map(p => ({ x: p.x, y: p.z, value: p.topZ }));
      const bottomPoints = layerPoints.map(p => ({ x: p.x, y: p.z, value: p.bottomZ }));
      topTree = this.buildKDTree(topPoints);
      bottomTree = this.buildKDTree(bottomPoints);
    }

    const topSurface = grid.map((gridPoint) => {
      let dataPoints;
      if (shouldUseKDTree) {
        // Use KD-tree to find only nearest neighbors (major performance win!)
        const neighbors = this.findNearestNeighbors(topTree, gridPoint, maxNeighbors);
        dataPoints = neighbors;
      } else {
        // Fallback: use all points (original behavior for <8 boreholes or anisotropy mode)
        // Include full Z data for anisotropic distance calculation
        // CRITICAL FIX: Use p.z (North-South) not p.y (surface elevation) for distance calculations
        dataPoints = layerPoints.map(p => ({
          x: p.x,
          y: p.z,  // N-S coordinate (matches grid coordinate system)
          value: p.topZ,
          topZ: p.topZ,
          bottomZ: p.bottomZ
        }));
      }

      // Choose interpolation method based on anisotropy setting
      const interpolatedZ = useAnisotropy
        ? this.inverseDistanceWeightingAnisotropic(gridPoint, dataPoints, power, {
            maxDistance,
            scales: anisotropyScales
          })
        : this.inverseDistanceWeighting(gridPoint, dataPoints, power, maxDistance);

      // Calculate confidence based on distance to nearest data point
      const confidence = this.calculateConfidence(gridPoint, dataPoints, maxDistance || 32.8);

      return {
        ...gridPoint,
        z: interpolatedZ,
        confidence
      };
    });

    const bottomSurface = grid.map(gridPoint => {
      let dataPoints;
      if (shouldUseKDTree) {
        // Use KD-tree to find only nearest neighbors (major performance win!)
        const neighbors = this.findNearestNeighbors(bottomTree, gridPoint, maxNeighbors);
        dataPoints = neighbors;
      } else {
        // Fallback: use all points (original behavior for <8 boreholes or anisotropy mode)
        // Include full Z data for anisotropic distance calculation
        // CRITICAL FIX: Use p.z (North-South) not p.y (surface elevation) for distance calculations
        dataPoints = layerPoints.map(p => ({
          x: p.x,
          y: p.z,  // N-S coordinate (matches grid coordinate system)
          value: p.bottomZ,
          topZ: p.topZ,
          bottomZ: p.bottomZ
        }));
      }

      // Choose interpolation method based on anisotropy setting
      const interpolatedZ = useAnisotropy
        ? this.inverseDistanceWeightingAnisotropic(gridPoint, dataPoints, power, {
            maxDistance,
            scales: anisotropyScales
          })
        : this.inverseDistanceWeighting(gridPoint, dataPoints, power, maxDistance);

      // Calculate confidence based on distance to nearest data point
      const confidence = this.calculateConfidence(gridPoint, dataPoints, maxDistance || 32.8);

      return {
        ...gridPoint,
        z: interpolatedZ,
        confidence
      };
    });

    // Basic minimum thickness enforcement (enhanced validation applied later)
    const minThickness = 0.1; // 10cm minimum
    for (let i = 0; i < topSurface.length; i++) {
      if (bottomSurface[i].z > topSurface[i].z - minThickness) {
        bottomSurface[i].z = topSurface[i].z - minThickness;
      }
    }

    return { topSurface, bottomSurface, gridResolution: resolution };
  }

  static linearInterpolation(targetPoint, p1, p2, valueField) {
    const dist1 = Math.sqrt(Math.pow(targetPoint.x - p1.x, 2) + Math.pow(targetPoint.y - p1.y, 2));
    const dist2 = Math.sqrt(Math.pow(targetPoint.x - p2.x, 2) + Math.pow(targetPoint.y - p2.y, 2));
    if (dist1 === 0) return p1[valueField];
    if (dist2 === 0) return p2[valueField];

    const totalDist = dist1 + dist2;
    const weight1 = (totalDist - dist1) / totalDist;
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
    const allZCoordinates = [];

    for (const borehole of boreholes) {
      const zValue = borehole.z ?? 0;
      allZCoordinates.push(zValue);
      minX = Math.min(minX, borehole.x);
      maxX = Math.max(maxX, borehole.x);
      minY = Math.min(minY, zValue); // Use z for N-S in Three.js
      maxY = Math.max(maxY, zValue);
    }

    // Add padding
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const paddingX = rangeX * (padding - 1) / 2;
    const paddingY = rangeY * (padding - 1) / 2;

    // Check for flat N-S distribution which causes flat interpolated surfaces
    const uniqueZCount = new Set(allZCoordinates.map(z => Math.round(z * 10) / 10)).size;
    const allZSame = uniqueZCount === 1;
    const zSpreadWarningThreshold = 5; // feet

    if (allZSame || rangeY < zSpreadWarningThreshold) {
      console.warn(`[Interpolation] Boreholes have limited N-S spread (${rangeY.toFixed(1)} ft) - surfaces may appear flat. Space boreholes further apart for better results.`);
    }

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
      maxY: maxY + paddingY,
      avgSpacing: this.calculateAverageSpacing(boreholes),
      boreholePositionWarning: allZSame || rangeY < zSpreadWarningThreshold,
      actualZRange: rangeY
    };
  }

  /**
   * Calculate average spacing between boreholes
   * Used for adaptive confidence distance calculation
   * @param {Array} boreholes - Array of boreholes
   * @returns {number} Average distance between nearest neighbors (feet)
   */
  static calculateAverageSpacing(boreholes) {
    if (boreholes.length < 2) return 50; // Default for single borehole

    let totalNearestDistance = 0;
    let count = 0;

    for (let i = 0; i < boreholes.length; i++) {
      let nearestDistance = Infinity;

      for (let j = 0; j < boreholes.length; j++) {
        if (i === j) continue;

        const dx = boreholes[i].x - boreholes[j].x;
        const dy = boreholes[i].z - boreholes[j].z; // Use z for N-S in Three.js
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < nearestDistance) {
          nearestDistance = distance;
        }
      }

      if (nearestDistance < Infinity) {
        totalNearestDistance += nearestDistance;
        count++;
      }
    }

    return count > 0 ? totalNearestDistance / count : 50;
  }

  /**
   * Calculate adaptive confidence distance based on borehole spacing
   * Returns a confidence threshold that adapts to site density:
   * - Dense sites (close boreholes): shorter confidence distance
   * - Sparse sites (far boreholes): longer confidence distance
   *
   * @param {Array} boreholes - Array of boreholes
   * @param {Object} options - Configuration options
   * @returns {number} Adaptive confidence distance (feet)
   */
  static calculateAdaptiveConfidenceDistance(boreholes, options = {}) {
    const {
      multiplier = 1.5,  // Confidence distance = avg spacing × multiplier
      minDistance = 20,  // Minimum confidence distance (feet)
      maxDistance = 100  // Maximum confidence distance (feet)
    } = options;

    const avgSpacing = this.calculateAverageSpacing(boreholes);
    const adaptiveDistance = avgSpacing * multiplier;

    // Clamp to reasonable range
    return Math.max(minDistance, Math.min(maxDistance, adaptiveDistance));
  }

  /**
   * Apply geological validation and constraints to interpolated layer sequence
   * @param {Array} layerSequence - Array of interpolated layers
   * @param {Object} validationOptions - Geological validation options
   * @returns {Array} Geologically validated layer sequence
   */
  static applyGeologicalValidation(layerSequence, validationOptions = {}) {

    // Default validation options - NATURAL MODE DEFAULTS
    // These allow realistic geological variation. Override with conservative
    // settings by passing validationOptions from interpolationStyleSettings.
    const options = {
      minThickness: 0.05,       // 5cm minimum (allows natural thinning)
      maxSlope: 45,             // 45° maximum slope (allows realistic dips)
      smoothingRadius: 0,       // No smoothing by default
      enforceOrder: true,       // Enforce stratigraphic ordering
      applyLateralContinuity: false, // No averaging by default
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

    // NATURAL MODE DEFAULTS - allow realistic geological variation
    const validationOptions = {
      minThickness: options.minThickness ?? 0.05,
      maxSlope: options.maxSlope ?? 45,
      smoothingRadius: options.smoothingRadius ?? 0,
      enforceOrder: options.enforceOrder !== false,
      applyLateralContinuity: options.applyLateralContinuity ?? false
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

  /**
   * Cross-validate interpolation accuracy using Leave-One-Out Cross-Validation (LOOCV)
   * Tests interpolation accuracy by removing each borehole and predicting its value from others
   *
   * @param {Array} boreholes - Array of boreholes with layer data
   * @param {string} layerName - Name of layer to validate
   * @param {Object} options - Validation options {power, useKDTree, maxNeighbors}
   * @returns {Object} Validation statistics {meanError, maxError, rmse, errors[], predictions[]}
   */
  static crossValidateLayer(boreholes, layerName, options = {}) {
    const { power = 2, useKDTree = true, maxNeighbors = 12 } = options;

    if (boreholes.length < 3) {
      return {
        valid: false,
        message: 'Need at least 3 boreholes for cross-validation',
        meanError: 0,
        maxError: 0,
        rmse: 0,
        errors: [],
        predictions: []
      };
    }

    const errors = [];
    const predictions = [];

    // Leave-one-out cross-validation
    for (let i = 0; i < boreholes.length; i++) {
      const testBorehole = boreholes[i];
      const trainingBoreholes = boreholes.filter((_, idx) => idx !== i);

      // Get actual value for this borehole's layer
      const layer = testBorehole.layers?.find(l => l.material === layerName);
      if (!layer) continue;

      const actualTopZ = layer.from !== undefined ? -layer.from : (layer.depthFrom !== undefined ? -layer.depthFrom : 0);
      const actualBottomZ = layer.to !== undefined ? -layer.to : (layer.depthTo !== undefined ? -layer.depthTo : 0);

      // Build training data points
      const trainingPoints = trainingBoreholes
        .map(bh => {
          const bhLayer = bh.layers?.find(l => l.material === layerName);
          if (!bhLayer) return null;
          return {
            x: bh.x,
            y: bh.z, // Use z for N-S coordinate
            topZ: bhLayer.from !== undefined ? -bhLayer.from : (bhLayer.depthFrom !== undefined ? -bhLayer.depthFrom : 0),
            bottomZ: bhLayer.to !== undefined ? -bhLayer.to : (bhLayer.depthTo !== undefined ? -bhLayer.depthTo : 0)
          };
        })
        .filter(p => p !== null);

      if (trainingPoints.length < 2) continue;

      // Build KD-tree for training data if enabled
      let topTree = null;
      let bottomTree = null;
      if (useKDTree && trainingPoints.length >= 8) {
        const topPoints = trainingPoints.map(p => ({ x: p.x, y: p.y, value: p.topZ }));
        const bottomPoints = trainingPoints.map(p => ({ x: p.x, y: p.y, value: p.bottomZ }));
        topTree = this.buildKDTree(topPoints);
        bottomTree = this.buildKDTree(bottomPoints);
      }

      // Predict top and bottom elevations at test location
      const testPoint = { x: testBorehole.x, y: testBorehole.z };

      let topDataPoints, bottomDataPoints;
      if (topTree && bottomTree) {
        topDataPoints = this.findNearestNeighbors(topTree, testPoint, maxNeighbors);
        bottomDataPoints = this.findNearestNeighbors(bottomTree, testPoint, maxNeighbors);
      } else {
        topDataPoints = trainingPoints.map(p => ({ x: p.x, y: p.y, value: p.topZ }));
        bottomDataPoints = trainingPoints.map(p => ({ x: p.x, y: p.y, value: p.bottomZ }));
      }

      const predictedTopZ = this.inverseDistanceWeighting(testPoint, topDataPoints, power);
      const predictedBottomZ = this.inverseDistanceWeighting(testPoint, bottomDataPoints, power);

      // Calculate errors
      const topError = Math.abs(predictedTopZ - actualTopZ);
      const bottomError = Math.abs(predictedBottomZ - actualBottomZ);
      const avgError = (topError + bottomError) / 2;

      errors.push(avgError);
      predictions.push({
        boreholeName: testBorehole.name || `Borehole ${i + 1}`,
        actual: { topZ: actualTopZ, bottomZ: actualBottomZ },
        predicted: { topZ: predictedTopZ, bottomZ: predictedBottomZ },
        error: avgError
      });
    }

    if (errors.length === 0) {
      return {
        valid: false,
        message: 'No valid predictions could be made',
        meanError: 0,
        maxError: 0,
        rmse: 0,
        errors: [],
        predictions: []
      };
    }

    // Calculate statistics
    const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const maxError = Math.max(...errors);
    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);

    return {
      valid: true,
      meanError,
      maxError,
      rmse,
      errors,
      predictions,
      sampleSize: errors.length
    };
  }

  /**
   * Validate interpolation accuracy across all layers
   *
   * @param {Array} boreholes - Array of boreholes
   * @param {Array} materialLayers - Array of material layer names
   * @param {Object} options - Validation options
   * @returns {Object} Comprehensive validation statistics
   */
  static validateInterpolationAccuracy(boreholes, materialLayers, options = {}) {
    if (boreholes.length < 3) {
      return {
        valid: false,
        message: 'Need at least 3 boreholes for validation',
        overallMeanError: 0,
        overallMaxError: 0,
        overallRMSE: 0,
        layerResults: {}
      };
    }

    const layerResults = {};
    const allErrors = [];

    // Validate each layer
    for (const layerName of materialLayers) {
      const validation = this.crossValidateLayer(boreholes, layerName, options);
      layerResults[layerName] = validation;

      if (validation.valid) {
        allErrors.push(...validation.errors);
      }
    }

    if (allErrors.length === 0) {
      return {
        valid: false,
        message: 'No valid predictions across all layers',
        overallMeanError: 0,
        overallMaxError: 0,
        overallRMSE: 0,
        layerResults
      };
    }

    // Calculate overall statistics
    const overallMeanError = allErrors.reduce((sum, e) => sum + e, 0) / allErrors.length;
    const overallMaxError = Math.max(...allErrors);
    const overallRMSE = Math.sqrt(allErrors.reduce((sum, e) => sum + e * e, 0) / allErrors.length);

    return {
      valid: true,
      overallMeanError,
      overallMaxError,
      overallRMSE,
      layerResults,
      totalPredictions: allErrors.length
    };
  }

  /**
   * Validate borehole positions for interpolation quality
   * Checks if boreholes are spatially distributed enough for meaningful IDW
   *
   * @param {Array} boreholes - Array of boreholes
   * @returns {Object} Validation result with warnings and suggestions
   */
  static validateBoreholePositions(boreholes) {
    if (!boreholes || boreholes.length === 0) {
      return { valid: false, error: 'No boreholes provided' };
    }

    if (boreholes.length === 1) {
      return {
        valid: true,
        warning: 'Only 1 borehole - surfaces will be flat (horizontal continuity assumed)',
        suggestions: ['Add more boreholes for varied surfaces']
      };
    }

    // Check X (E-W) distribution
    const xValues = boreholes.map(bh => bh.x ?? 0);
    const xRange = Math.max(...xValues) - Math.min(...xValues);

    // Check Z (N-S) distribution - this is the critical one
    const zValues = boreholes.map(bh => bh.z ?? 0);
    const zRange = Math.max(...zValues) - Math.min(...zValues);
    const uniqueZ = new Set(zValues.map(z => Math.round(z * 10) / 10)).size;
    const allZZero = zValues.every(z => Math.abs(z) < 0.1);

    const warnings = [];
    const suggestions = [];

    if (allZZero) {
      warnings.push('ALL boreholes have z=0 (N-S coordinate not set)');
      suggestions.push(
        'Click at different North-South positions when placing boreholes',
        'Upload a site map and place boreholes at actual positions',
        'Edit boreholes to set z-coordinates manually'
      );
    } else if (zRange < 5) {
      warnings.push(`N-S spread is only ${zRange.toFixed(1)} ft - surfaces may appear flat`);
      suggestions.push('Space boreholes further apart in the N-S direction');
    }

    if (xRange < 5 && zRange < 5) {
      warnings.push('Boreholes are clustered in a small area - IDW will produce nearly uniform values');
    }

    return {
      valid: warnings.length === 0,
      xRange,
      zRange,
      boreholeCount: boreholes.length,
      uniqueZPositions: uniqueZ,
      allZZero,
      warnings,
      suggestions,
      positions: boreholes.map(bh => ({
        name: bh.name,
        x: bh.x?.toFixed(1),
        z: bh.z?.toFixed(1)
      }))
    };
  }

  /**
   * Suggest redistributed positions for boreholes that are all at z=0
   * Creates a grid layout that preserves x-positions but spreads z-coordinates
   *
   * @param {Array} boreholes - Array of boreholes
   * @param {number} targetSpacing - Desired spacing between boreholes (default: 25 ft)
   * @returns {Array} Suggested new positions [{id, name, currentZ, suggestedZ}]
   */
  static suggestBoreholeRedistribution(boreholes, targetSpacing = 25) {
    if (!boreholes || boreholes.length <= 1) {
      return [];
    }

    const suggestions = [];
    const count = boreholes.length;

    // Calculate grid dimensions (columns determine row placement)
    const cols = Math.ceil(Math.sqrt(count));

    boreholes.forEach((bh, index) => {
      const row = Math.floor(index / cols);
      const suggestedZ = row * targetSpacing;

      suggestions.push({
        id: bh.id,
        name: bh.name,
        currentX: bh.x,
        currentZ: bh.z ?? 0,
        suggestedZ: suggestedZ,
        changeNeeded: Math.abs((bh.z ?? 0) - suggestedZ) > 1
      });
    });

    return suggestions;
  }
}