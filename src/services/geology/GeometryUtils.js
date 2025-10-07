/**
 * Geometry Utilities for 3D Geological Modeling
 * 
 * Contains spatial indexing, geometric calculations, and utility functions
 * for 3D geological mesh generation and spatial analysis.
 */

// Performance optimization constants
const MAX_NEARBY_BOREHOLES = 10; // Limit nearest neighbor searches
const SPATIAL_GRID_SIZE = 50; // Spatial grid cell size (feet)
const EPSILON = 1e-10; // Small value for division-by-zero protection

/**
 * Geometric utility functions for geological modeling
 */
export class GeometryUtils {
  /**
   * Build spatial index for efficient borehole lookups
   * Creates a grid-based spatial index for O(1) average case borehole queries
   * @param {Array} boreholes - Array of borehole objects with x, y coordinates
   * @returns {Map} Spatial index mapping grid keys to borehole arrays
   */
  static buildSpatialIndex(boreholes) {
    const index = new Map();
    
    boreholes.forEach(bh => {
      const gridX = Math.floor((bh.x || 0) / SPATIAL_GRID_SIZE);
      const gridY = Math.floor((bh.y || 0) / SPATIAL_GRID_SIZE);
      const key = `${gridX},${gridY}`;
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(bh);
    });
    
    return index;
  }

  /**
   * Get nearby boreholes using spatial index
   * Efficiently finds boreholes within a specified radius using grid-based lookup
   * @param {number} x - Target X coordinate
   * @param {number} y - Target Y coordinate  
   * @param {number} radius - Search radius in feet
   * @param {Map} spatialIndex - Pre-built spatial index from buildSpatialIndex()
   * @returns {Array} Array of nearby boreholes sorted by distance (closest first)
   */
  static getNearbyBoreholes(x, y, radius, spatialIndex) {
    const nearby = [];
    const gridRadius = Math.ceil(radius / SPATIAL_GRID_SIZE);
    const centerGridX = Math.floor(x / SPATIAL_GRID_SIZE);
    const centerGridY = Math.floor(y / SPATIAL_GRID_SIZE);
    
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      for (let dy = -gridRadius; dy <= gridRadius; dy++) {
        const key = `${centerGridX + dx},${centerGridY + dy}`;
        const boreholes = spatialIndex.get(key) || [];
        nearby.push(...boreholes);
      }
    }
    
    // Filter by actual distance and limit to MAX_NEARBY_BOREHOLES
    return nearby
      .map(bh => ({
        borehole: bh,
        distance: Math.sqrt((bh.x - x) ** 2 + (bh.y - y) ** 2)
      }))
      .filter(item => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_NEARBY_BOREHOLES)
      .map(item => item.borehole);
  }

  /**
   * Calculate statistical variation in a dataset
   * Computes coefficient of variation (standard deviation / mean) for geological analysis
   * @param {Array} values - Numeric values to analyze
   * @returns {number} Variation coefficient (0 = no variation, higher = more variable)
   */
  static calculateVariation(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Fix the original bug: simplified coefficient of variation calculation
    return mean !== 0 ? (Math.abs(stdDev / mean)) : 0;
  }

  /**
   * Remove duplicate grid points within tolerance
   * Eliminates nearly identical points that could cause mesh artifacts
   * @param {Array} gridPoints - Array of points with x, y properties
   * @returns {Array} Unique grid points within 1cm tolerance
   */
  static removeDuplicateGridPoints(gridPoints) {
    const unique = [];
    const tolerance = 0.01; // 1cm tolerance for geological modeling

    for (const point of gridPoints) {
      const isDuplicate = unique.some(existing => {
        const distance = Math.sqrt(
          Math.pow(point.x - existing.x, 2) + 
          Math.pow(point.y - existing.y, 2)
        );
        return distance < tolerance;
      });

      if (!isDuplicate) {
        unique.push(point);
      }
    }

    return unique;
  }

  /**
   * Calculate volume statistics from mesh data
   * Analyzes geological layer thickness and provides descriptive statistics
   * @param {Object} volumeData - Volume data with vertices, material, etc.
   * @returns {Object} Statistics including min/max/avg thickness, vertex/triangle counts
   */
  static calculateVolumeStatistics(volumeData) {
    let minThickness = Infinity;
    let maxThickness = -Infinity;
    let avgThickness = 0;

    // Approximate by sampling grid points (assumes top/bottom vertex structure)
    const numVertices = volumeData.vertexCount / 2; // Half top, half bottom
    for (let i = 0; i < numVertices; i++) {
      const topY = volumeData.vertices[i * 3 + 1];
      const bottomY = volumeData.vertices[(numVertices + i) * 3 + 1];
      const thickness = topY - bottomY;
      
      minThickness = Math.min(minThickness, thickness);
      maxThickness = Math.max(maxThickness, thickness);
      avgThickness += thickness;
    }

    avgThickness /= numVertices;

    return {
      material: volumeData.material,
      minThickness: minThickness.toFixed(2),
      maxThickness: maxThickness.toFixed(2),
      avgThickness: avgThickness.toFixed(2),
      vertexCount: volumeData.vertexCount,
      triangleCount: volumeData.indexCount / 3
    };
  }

  /**
   * Calculate distance between two 2D points
   * @param {Object} point1 - First point {x, y}
   * @param {Object} point2 - Second point {x, y}  
   * @returns {number} Euclidean distance in same units as input
   */
  static calculateDistance2D(point1, point2) {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }

  /**
   * Calculate distance between two 3D points
   * @param {Object} point1 - First point {x, y, z}
   * @param {Object} point2 - Second point {x, y, z}
   * @returns {number} Euclidean distance in same units as input
   */
  static calculateDistance3D(point1, point2) {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2) + 
      Math.pow(point2.z - point1.z, 2)
    );
  }

  /**
   * Calculate centroid of a set of points
   * @param {Array} points - Array of points with x, y properties (and optional z)
   * @returns {Object} Centroid point with average coordinates
   */
  static calculateCentroid(points) {
    if (points.length === 0) return { x: 0, y: 0, z: 0 };

    const sum = points.reduce((acc, point) => ({
      x: acc.x + (point.x || 0),
      y: acc.y + (point.y || 0),
      z: acc.z + (point.z || 0)
    }), { x: 0, y: 0, z: 0 });

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length
    };
  }

  /**
   * Calculate bounding box for a set of points
   * @param {Array} points - Array of points with x, y, z properties
   * @returns {Object} Bounding box {minX, maxX, minY, maxY, minZ, maxZ}
   */
  static calculateBoundingBox(points) {
    if (points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }

    const bounds = points.reduce((acc, point) => ({
      minX: Math.min(acc.minX, point.x || 0),
      maxX: Math.max(acc.maxX, point.x || 0),
      minY: Math.min(acc.minY, point.y || 0),
      maxY: Math.max(acc.maxY, point.y || 0),
      minZ: Math.min(acc.minZ, point.z || 0),
      maxZ: Math.max(acc.maxZ, point.z || 0)
    }), {
      minX: Infinity, maxX: -Infinity,
      minY: Infinity, maxY: -Infinity,
      minZ: Infinity, maxZ: -Infinity
    });

    return bounds;
  }
}

// Export constants for use by other modules
export { MAX_NEARBY_BOREHOLES, SPATIAL_GRID_SIZE, EPSILON };