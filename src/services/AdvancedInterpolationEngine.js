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

  /**
   * Calculate directional variogram for anisotropy detection
   * Computes semi-variance in a specific direction
   *
   * @param {Array} boreholes - Array of boreholes with layer data
   * @param {string} layerName - Name of layer to analyze
   * @param {number} angle - Direction angle in degrees (0=East, 90=North)
   * @param {Object} options - Options {tolerance, maxDistance}
   * @returns {Array} Variogram data [{distance, semivariance, pairCount}]
   */
  static calculateDirectionalVariogram(boreholes, layerName, angle, options = {}) {
    const {
      tolerance = 22.5,  // Angular tolerance in degrees (±22.5° = 45° window)
      maxDistance = 200,  // Maximum distance to consider (feet)
      lagSize = 20,      // Distance bin size (feet)
      numLags = 10       // Number of lag bins
    } = options;

    // Extract layer data from boreholes
    const points = [];
    for (const bh of boreholes) {
      const layer = bh.layers?.find(l => l.material === layerName);
      if (!layer) continue;

      const value = layer.from !== undefined ? -layer.from : (layer.depthFrom !== undefined ? -layer.depthFrom : 0);
      points.push({
        x: bh.x,
        y: bh.z, // Use z for N-S coordinate
        value
      });
    }

    if (points.length < 3) {
      return []; // Need at least 3 points for meaningful variogram
    }

    // Initialize lag bins
    const lags = Array(numLags).fill(null).map((_, i) => ({
      distance: (i + 0.5) * lagSize,
      semivariance: 0,
      pairCount: 0
    }));

    // Convert angle to radians
    const angleRad = angle * Math.PI / 180;
    const toleranceRad = tolerance * Math.PI / 180;

    // Calculate semi-variances for point pairs
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0 || distance > maxDistance) continue;

        // Calculate bearing angle
        const bearing = Math.atan2(dy, dx);
        let angleDiff = Math.abs(bearing - angleRad);

        // Normalize angle difference to [-π, π]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        angleDiff = Math.abs(angleDiff);

        // Check if within angular tolerance
        if (angleDiff <= toleranceRad || angleDiff >= (Math.PI - toleranceRad)) {
          // Determine which lag bin
          const lagIndex = Math.floor(distance / lagSize);
          if (lagIndex < numLags) {
            const semiVar = Math.pow(points[j].value - points[i].value, 2) / 2;
            lags[lagIndex].semivariance += semiVar;
            lags[lagIndex].pairCount++;
          }
        }
      }
    }

    // Average semi-variances
    return lags
      .filter(lag => lag.pairCount > 0)
      .map(lag => ({
        distance: lag.distance,
        semivariance: lag.semivariance / lag.pairCount,
        pairCount: lag.pairCount
      }));
  }

  /**
   * Detect anisotropy (directional dependence) in geological data
   * Analyzes variability in multiple directions to identify directional trends
   *
   * @param {Array} boreholes - Array of boreholes with layer data
   * @param {string} layerName - Name of layer to analyze
   * @param {Object} options - Detection options
   * @returns {Object|null} Anisotropy parameters {detected, angle, ratio, confidence} or null
   */
  static detectAnisotropy(boreholes, layerName, options = {}) {
    const {
      angles = [0, 45, 90, 135],  // Directions to test (degrees)
      minRatio = 1.5,              // Minimum ratio to consider anisotropic
      minConfidence = 0.6          // Minimum confidence threshold
    } = options;

    if (boreholes.length < 5) {
      return null; // Need at least 5 boreholes for anisotropy detection
    }

    // Calculate variograms in each direction
    const directionalVariograms = {};
    for (const angle of angles) {
      const variogram = this.calculateDirectionalVariogram(boreholes, layerName, angle, options);
      if (variogram.length > 0) {
        directionalVariograms[angle] = variogram;
      }
    }

    if (Object.keys(directionalVariograms).length < 3) {
      return null; // Need at least 3 directions for comparison
    }

    // Calculate average semivariance for each direction (use first 3 lags)
    const directionalAverages = {};
    for (const [angle, variogram] of Object.entries(directionalVariograms)) {
      const firstLags = variogram.slice(0, 3);
      const avgSemivar = firstLags.reduce((sum, lag) => sum + lag.semivariance, 0) / firstLags.length;
      const totalPairs = firstLags.reduce((sum, lag) => sum + lag.pairCount, 0);
      directionalAverages[angle] = { avgSemivar, totalPairs };
    }

    // Find directions with minimum and maximum semivariance
    let minAngle = null, minSemivar = Infinity;
    let maxAngle = null, maxSemivar = -Infinity;

    for (const [angle, data] of Object.entries(directionalAverages)) {
      if (data.avgSemivar < minSemivar) {
        minSemivar = data.avgSemivar;
        minAngle = parseInt(angle);
      }
      if (data.avgSemivar > maxSemivar) {
        maxSemivar = data.avgSemivar;
        maxAngle = parseInt(angle);
      }
    }

    // Calculate anisotropy ratio
    const ratio = Math.abs(minSemivar) < EPSILON ? 1 : maxSemivar / minSemivar;

    // Calculate confidence based on data quality
    const minPairs = Math.min(...Object.values(directionalAverages).map(d => d.totalPairs));
    const pairConfidence = Math.min(minPairs / 10, 1.0); // More pairs = higher confidence
    const ratioConfidence = Math.min((ratio - 1) / 2, 1.0); // Higher ratio = stronger signal
    const confidence = (pairConfidence + ratioConfidence) / 2;

    // Determine if anisotropy is significant
    const detected = ratio >= minRatio && confidence >= minConfidence;

    if (!detected) {
      return {
        detected: false,
        angle: null,
        ratio: 1.0,
        confidence: 0,
        message: `Weak or no anisotropy detected (ratio: ${ratio.toFixed(2)}, confidence: ${confidence.toFixed(2)})`
      };
    }

    // Major axis (direction of maximum continuity) is perpendicular to max semivariance
    const majorAxisAngle = (maxAngle + 90) % 180;

    return {
      detected: true,
      angle: majorAxisAngle,  // Direction of maximum continuity
      ratio: Math.sqrt(ratio), // Use sqrt for distance transformation
      confidence,
      minDirection: minAngle,
      maxDirection: maxAngle,
      directionalData: directionalAverages,
      message: `Anisotropy detected: ${majorAxisAngle}° direction, ratio ${ratio.toFixed(2)}`
    };
  }

}

export default AdvancedInterpolationEngine;