/**
 * Simplified Interpolation Engine for Geological Modeling
 * Implements IDW and Kriging methods optimized for geological realism
 * Focus on proven, reliable methods for professional geological analysis
 */

import { interpolationLogger } from '../utils/Logger.js';

const EPSILON = 1e-10; // Small value for division-by-zero protection

export class AdvancedInterpolationEngine {

  /**
   * Direct method interpolation - use IDW or Kriging as specified
   * @param {Object} targetPoint - Point to interpolate {x, y}
   * @param {Array} dataPoints - Known data points with values  
   * @param {string} method - Method to use ('idw' or 'kriging')
   * @param {Object} options - Interpolation options
   * @returns {Object} Interpolation result with quality metrics
   */
  static interpolateWithMethod(targetPoint, dataPoints, method = 'idw', options = {}) {
    switch (method) {
      case 'kriging':
        return this.simpleKriging(targetPoint, dataPoints, options);
      case 'idw':
      default:
        return this.enhancedIDW(targetPoint, dataPoints, options);
    }
  }

  /**
   * Enhanced IDW with adaptive power and anisotropy
   * @param {Object} targetPoint - Target interpolation point
   * @param {Array} dataPoints - Source data points
   * @param {Object} options - IDW options
   * @returns {Object} Enhanced IDW result
   */
  static enhancedIDW(targetPoint, dataPoints, options = {}) {
    const {
      basePower = 2,
      adaptivePower = true,
      anisotropy = null,
      maxDistance = null,
      minPoints = 3
    } = options;

    if (dataPoints.length === 0) return { value: 0, confidence: 0, quality: 0 };
    if (dataPoints.length === 1) return { value: dataPoints[0].value, confidence: 0.5, quality: 0.7 };

    let numerator = 0;
    let denominator = 0;
    const distances = [];
    const weights = [];

    // Calculate distances and adaptive power
    for (const point of dataPoints) {
      let distance = this.calculateDistance(targetPoint, point, anisotropy);
      
      // Handle exact matches
      if (distance < 0.001) {
        return { value: point.value, confidence: 1.0, quality: 1.0 };
      }

      // Apply distance cutoff
      if (maxDistance && distance > maxDistance) continue;

      distances.push(distance);

      // Adaptive power based on data density
      let power = basePower;
      if (adaptivePower) {
        const localDensity = this.calculateLocalDensity(point, dataPoints, distance * 2);
        power = basePower + (localDensity - 1) * 0.5; // Increase power in dense areas
      }

      const weight = (Math.abs(distance) < EPSILON ? 0 : 1 / Math.pow(distance, power));
      weights.push(weight);
      numerator += weight * point.value;
      denominator += weight;
    }

    if (denominator === 0 || distances.length < minPoints) {
      // Fallback to nearest neighbor
      const nearest = dataPoints.reduce((prev, curr) => {
        const prevDist = this.calculateDistance(targetPoint, prev, anisotropy);
        const currDist = this.calculateDistance(targetPoint, curr, anisotropy);
        return currDist < prevDist ? curr : prev;
      });
      return { value: nearest.value, confidence: 0.3, quality: 0.4 };
    }

    // Calculate quality metrics
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const quality = Math.exp(-avgDistance / 10) * Math.min(distances.length / 5, 1);
    const confidence = this.calculateIDWConfidence(distances, weights, dataPoints.length);

    return {
      value: (Math.abs(denominator) < EPSILON ? 0 : numerator / denominator),
      confidence,
      quality,
      avgDistance,
      pointsUsed: distances.length
    };
  }

  /**
   * Simple Kriging implementation for geological data
   * @param {Object} targetPoint - Target point
   * @param {Array} dataPoints - Data points
   * @param {Object} options - Kriging options
   * @returns {Object} Kriging result
   */
  static simpleKriging(targetPoint, dataPoints, options = {}) {
    const {
      variogramModel = 'spherical',
      range = 25,
      nugget = 0.1,
      sill = 1.0
    } = options;

    if (dataPoints.length < 3) {
      return this.enhancedIDW(targetPoint, dataPoints, options);
    }

    try {
      // Build covariance matrix
      const n = dataPoints.length;
      const C = Array(n + 1).fill(null).map(() => Array(n + 1).fill(0));
      
      // Fill covariance matrix
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) {
            C[i][j] = sill + nugget;
          } else {
            const distance = this.calculateDistance(dataPoints[i], dataPoints[j]);
            C[i][j] = this.variogramFunction(distance, variogramModel, range, nugget, sill);
          }
        }
        C[i][n] = 1; // Lagrange multiplier constraint
        C[n][i] = 1;
      }
      C[n][n] = 0;

      // Build right-hand side vector
      const b = Array(n + 1).fill(0);
      for (let i = 0; i < n; i++) {
        const distance = this.calculateDistance(targetPoint, dataPoints[i]);
        b[i] = this.variogramFunction(distance, variogramModel, range, nugget, sill);
      }
      b[n] = 1;

      // Solve system using Gaussian elimination
      const weights = this.solveLinearSystem(C, b);
      
      if (!weights) {
        return this.enhancedIDW(targetPoint, dataPoints, options);
      }

      // Calculate interpolated value
      let value = 0;
      for (let i = 0; i < n; i++) {
        value += weights[i] * dataPoints[i].value;
      }

      // Calculate kriging variance (confidence measure)
      let variance = sill + nugget;
      for (let i = 0; i < n; i++) {
        variance -= weights[i] * b[i];
      }
      variance -= weights[n]; // Lagrange multiplier

      const confidence = Math.max(0, Math.min(1, 1 - Math.sqrt(Math.abs(variance)) / sill));
      const quality = confidence * 0.9 + 0.1; // Kriging generally high quality

      return {
        value,
        confidence,
        quality,
        variance: Math.abs(variance),
        weights: weights.slice(0, n)
      };

    } catch (error) {
      interpolationLogger.warn('Kriging failed, falling back to enhanced IDW:', error.message);
      return this.enhancedIDW(targetPoint, dataPoints, options);
    }
  }



  // ===== HELPER METHODS =====

  /**
   * Calculate distance with optional anisotropy
   */
  static calculateDistance(point1, point2, anisotropy = null) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;

    if (!anisotropy) {
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Apply anisotropy transformation
    const { angle = 0, ratio = 1 } = anisotropy;
    const cos_a = Math.cos(angle * Math.PI / 180);
    const sin_a = Math.sin(angle * Math.PI / 180);
    
    const dx_rot = dx * cos_a + dy * sin_a;
    const dy_rot = -dx * sin_a + dy * cos_a;
    
    return Math.sqrt(dx_rot * dx_rot + dy_rot * dy_rot / (ratio * ratio));
  }

  /**
   * Calculate local data density around a point
   */
  static calculateLocalDensity(point, allPoints, radius) {
    let count = 0;
    for (const other of allPoints) {
      if (this.calculateDistance(point, other) <= radius) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate IDW confidence based on distances and weights
   */
  static calculateIDWConfidence(distances, weights, totalPoints) {
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const weightSum = weights.reduce((a, b) => a + b, 0);
    
    const distanceFactor = Math.exp(-avgDistance / 20);
    const pointsFactor = Math.min(totalPoints / 5, 1);
    const weightFactor = Math.min(weightSum / 10, 1);
    
    return distanceFactor * pointsFactor * weightFactor;
  }

  /**
   * Variogram function for kriging
   */
  static variogramFunction(distance, model, range, nugget, sill) {
    if (distance === 0) return sill + nugget;
    
    const h = (Math.abs(range) < EPSILON ? 0 : distance / range);
    
    switch (model) {
      case 'spherical':
        if (h <= 1) {
          return sill * (1 - (1.5 * h - 0.5 * h * h * h)) + nugget;
        } else {
          return nugget;
        }
      case 'exponential':
        return sill * (1 - Math.exp(-3 * h)) + nugget;
      case 'gaussian':
        return sill * (1 - Math.exp(-3 * h * h)) + nugget;
      default:
        return sill * (1 - Math.exp(-3 * h)) + nugget;
    }
  }



  /**
   * Simple linear system solver using Gaussian elimination
   */
  static solveLinearSystem(A, b) {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Check for singular matrix
      if (Math.abs(augmented[i][i]) < 1e-10) {
        return null;
      }
      
      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }
    
    return x;
  }


  /**
   * Matrix operations
   */
  static transpose(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }

}

export default AdvancedInterpolationEngine;