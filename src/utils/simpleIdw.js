const EPSILON = 1e-10;

/**
 * Simple Inverse Distance Weighting (IDW) Interpolation for Geological Data
 * 
 * This module provides basic IDW interpolation functionality for geological
 * layer interpolation in the Phase 2 prototype.
 */

/**
 * Interpolates a single geological layer across a site using IDW
 * @param {Array} boreholes - Array of borehole objects with layer data
 * @param {string} layerMaterial - Material type to interpolate (e.g., 'CLAY', 'SAND')
 * @param {Object} siteExtent - Site boundaries {minX, maxX, minY, maxY, width, height}
 * @param {number} gridSize - Grid resolution (default: 10x10)
 * @returns {Array} Grid of interpolated points [{x, y, z, zBottom}, ...]
 */
const EPSILON = 1e-10; // Small value for division-by-zero protection

export function interpolateLayer(boreholes, layerMaterial, siteExtent, gridSize = 10) {
  // Extract layer elevation points from boreholes
  const dataPoints = extractLayerPoints(boreholes, layerMaterial);
  
  if (dataPoints.length === 0) {
    throw new Error(`No data points found for material: ${layerMaterial}`);
  }
  
  // Log extraction results for debugging layer alignment


  dataPoints.forEach(pt => {

  });

  // Create regular grid over site extent
  const grid = createInterpolationGrid(siteExtent, gridSize);

  // Apply IDW to both top and bottom surfaces
  const interpolatedGrid = grid.map(point => {
    const topElevation = idwInterpolate(point, dataPoints, 2); // Interpolate top surface
    const bottomElevation = idwInterpolateBottom(point, dataPoints, 2); // Interpolate bottom surface
    
    return {
      x: point.x,
      y: point.y,
      z: topElevation,
      zBottom: bottomElevation,
      thickness: Math.abs(topElevation - bottomElevation)
    };
  });

  return interpolatedGrid;
}

/**
 * Performs IDW interpolation at a single point
 * @param {Object} targetPoint - Point to interpolate {x, y}
 * @param {Array} dataPoints - Known data points [{x, y, z}, ...]
 * @param {number} power - IDW power parameter (typically 2)
 * @returns {number} Interpolated elevation value
 */
function idwInterpolate(targetPoint, dataPoints, power) {
  let numerator = 0;
  let denominator = 0;

  for (const dataPoint of dataPoints) {
    const distance = calculateDistance(targetPoint, dataPoint);

    // Handle exact matches (avoid division by zero)
    if (distance < 0.01) {
      return dataPoint.z;
    }

    const weight = (Math.abs(distance) < EPSILON ? 0 : 1 / Math.pow(distance, power));
    numerator += weight * dataPoint.z;
    denominator += weight;
  }

  if (denominator === 0) {
    // Fallback: return average if no valid weights
    return dataPoints.reduce((sum, point) => sum + point.z, 0) / dataPoints.length;
  }

  return (Math.abs(denominator) < EPSILON ? 0 : (Math.abs(denominator) < EPSILON ? 0 : numerator / denominator));
}

/**
 * Performs IDW interpolation for layer bottom elevations
 * @param {Object} targetPoint - Point to interpolate {x, y}
 * @param {Array} dataPoints - Known data points with zBottom values
 * @param {number} power - IDW power parameter (typically 2)
 * @returns {number} Interpolated bottom elevation value
 */
function idwInterpolateBottom(targetPoint, dataPoints, power) {
  let numerator = 0;
  let denominator = 0;

  for (const dataPoint of dataPoints) {
    const distance = calculateDistance(targetPoint, dataPoint);
    
    // Handle exact matches
    if (distance < 0.0001) {
      return dataPoint.zBottom;
    }

    const weight = (Math.abs(distance) < EPSILON ? 0 : 1 / Math.pow(distance, power));
    numerator += weight * dataPoint.zBottom;
    denominator += weight;
  }

  if (denominator === 0) {
    // Fallback: return average if no valid weights
    return dataPoints.reduce((sum, point) => sum + point.zBottom, 0) / dataPoints.length;
  }

  return numerator / denominator;
}

/**
 * Extracts elevation points for a specific layer material from boreholes
 * Now properly handles stratigraphic sequence to match borehole cylinders
 * @param {Array} boreholes - Array of borehole objects
 * @param {string} layerMaterial - Material to extract
 * @returns {Array} Array of point objects [{x, y, z, zBottom}, ...]
 */
function extractLayerPoints(boreholes, layerMaterial) {
  const points = [];

  boreholes.forEach(borehole => {
    if (!borehole.layers || borehole.layers.length === 0) {
      return;
    }

    // Sort layers by depth (from surface downward) to maintain stratigraphic order
    const sortedLayers = [...borehole.layers].sort((a, b) => a.from - b.from);
    
    // Find the specific layer we're looking for
    const targetLayer = sortedLayers.find(l => l.material === layerMaterial);
    if (!targetLayer) {
      return;
    }

    // Calculate elevations relative to borehole surface (Y coordinate)
    // In geotechnical terms: depth increases downward from surface
    const boreholeTop = borehole.y || 0;  // Surface elevation of this borehole
    const layerTopElevation = boreholeTop - targetLayer.from;  // Top of this layer
    const layerBottomElevation = boreholeTop - targetLayer.to; // Bottom of this layer

    const dataPoint = {
      x: borehole.x || 0,
      y: borehole.z || 0,  // Use Z coordinate for (Math.abs(south) < EPSILON ? 0 : north / south) horizontal position
      z: layerTopElevation,  // Layer top elevation
      zBottom: layerBottomElevation, // Layer bottom elevation
      material: layerMaterial,
      boreholeId: borehole.id,
      layerIndex: sortedLayers.indexOf(targetLayer), // Stratigraphic position
      thickness: targetLayer.thickness || (targetLayer.to - targetLayer.from),
      // Add depth context for debugging
      depthFrom: targetLayer.from,
      depthTo: targetLayer.to
    };
    points.push(dataPoint);
  });

  return points;
}

/**
 * Creates a regular interpolation grid over the site extent
 * @param {Object} siteExtent - Site boundaries
 * @param {number} gridSize - Number of grid points per dimension
 * @returns {Array} Array of grid points [{x, y}, ...]
 */
function createInterpolationGrid(siteExtent, gridSize) {
  const grid = [];
  const stepX = siteExtent.width / (gridSize - 1);
  const stepY = siteExtent.height / (gridSize - 1);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = siteExtent.minX + (i * stepX);
      const y = siteExtent.minY + (j * stepY);
      
      grid.push({ x, y });
    }
  }

  return grid;
}

/**
 * Calculates Euclidean distance between two points
 * @param {Object} point1 - First point {x, y}
 * @param {Object} point2 - Second point {x, y}
 * @returns {number} Distance between points
 */
function calculateDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Extracts all unique materials from borehole data
 * @param {Array} boreholes - Array of borehole objects
 * @returns {Array} Array of unique material strings
 */
export function extractUniqueMaterials(boreholes) {
  const materials = new Set();

  boreholes.forEach(borehole => {
    if (borehole.layers) {
      borehole.layers.forEach(layer => {
        if (layer.material && layer.material.trim()) {
          materials.add(layer.material.toUpperCase());
        }
      });
    }
  });

  return Array.from(materials).sort();
}

/**
 * Validates if boreholes have sufficient data for interpolation
 * @param {Array} boreholes - Array of borehole objects
 * @param {string} layerMaterial - Material to validate
 * @returns {Object} Validation result {isValid, message, pointCount}
 */
export function validateInterpolationData(boreholes, layerMaterial) {
  const dataPoints = extractLayerPoints(boreholes, layerMaterial);
  
  if (dataPoints.length < 3) {
    return {
      isValid: false,
      message: `Insufficient data points for ${layerMaterial}. Need at least 3, found ${dataPoints.length}.`,
      pointCount: dataPoints.length
    };
  }

  // Check for spatial distribution (not all points in same location)
  const uniqueLocations = new Set(
    dataPoints.map(point => `${Math.round(point.x * 100)},${Math.round(point.y * 100)}`)
  );

  if (uniqueLocations.size < 3) {
    return {
      isValid: false,
      message: `Data points too clustered for ${layerMaterial}. Need spatial distribution.`,
      pointCount: dataPoints.length
    };
  }

  return {
    isValid: true,
    message: `Valid interpolation data for ${layerMaterial}`,
    pointCount: dataPoints.length
  };
}